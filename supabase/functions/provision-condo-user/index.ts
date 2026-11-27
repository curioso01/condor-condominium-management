import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getEnvKey(legacyEnv: string, jsonMapEnv: string): string {
  const direct = Deno.env.get(legacyEnv);
  if (direct) return direct;
  try {
    const parsed = JSON.parse(Deno.env.get(jsonMapEnv) || "{}");
    return parsed?.default || "";
  } catch {
    return "";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Sessão não autenticada." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = getEnvKey("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEYS");
    const serviceRoleKey = getEnvKey("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Configuração interna do servidor incompleta." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: callerAuth, error: callerErr } = await userClient.auth.getUser(token);
    if (callerErr || !callerAuth?.user?.id) {
      return new Response(
        JSON.stringify({ error: "Token de acesso inválido ou expirado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const condominiumId = String(body?.condominium_id || "").trim();
    const normalizedEmail = String(body?.email || "").trim().toLowerCase();
    const fullName = String(body?.full_name || "").trim();
    const phone = body?.phone ? String(body.phone).trim() : null;
    const requestedRole = String(body?.role || "morador").trim();
    const initialPassword = String(body?.initial_password || "Condor@2026").trim();

    if (!condominiumId || !normalizedEmail || !fullName) {
      return new Response(
        JSON.stringify({ error: "Informe condomínio, nome completo e e-mail válido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (initialPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: "A senha provisória de 1º acesso deve ter no mínimo 8 caracteres." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verifica autorização RBAC do usuário que está cadastrando
    const { data: callerMemberships, error: memCheckErr } = await supabaseAdmin
      .from("condominium_members")
      .select("condominium_id, role, status, permissions")
      .eq("user_id", callerAuth.user.id)
      .eq("status", "active");

    if (memCheckErr || !callerMemberships || callerMemberships.length === 0) {
      return new Response(
        JSON.stringify({ error: "Acesso negado: nenhum vínculo administrativo ativo." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isSuperAdmin = callerMemberships.some((m: any) => m.role === "superadmin");
    const condoMembership = callerMemberships.find((m: any) => m.condominium_id === condominiumId);
    const isSindicoInCondo = condoMembership?.role === "sindico";
    const isAuthorizedSubSindico =
      condoMembership?.role === "subsindico" &&
      Boolean(condoMembership?.permissions?.manage_units) &&
      requestedRole === "morador";

    if (!isSuperAdmin && !isSindicoInCondo && !isAuthorizedSubSindico) {
      return new Response(
        JSON.stringify({
          error: "Acesso negado: apenas Síndico, Superadmin ou Sub-Síndico autorizado podem provisionar acessos.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (requestedRole === "superadmin" && !isSuperAdmin) {
      return new Response(
        JSON.stringify({
          error: "Violação de privilégio bloqueada: apenas um Super Administrador pode conceder superadmin.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Tenta criar a conta no Supabase Auth já confirmada para 1º acesso imediato
    let targetUserId = "";
    let createdNewAuthAccount = false;

    const { data: createdAuth, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: initialPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (!createAuthErr && createdAuth?.user?.id) {
      targetUserId = createdAuth.user.id;
      createdNewAuthAccount = true;
    } else {
      // Caso o e-mail já exista no Supabase Auth, localiza o UUID existente
      const { data: existingProfile } = await supabaseAdmin
        .from("user_profiles")
        .select("id")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (existingProfile?.id) {
        targetUserId = existingProfile.id;
      } else {
        const { data: usersPage, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        if (listErr) {
          return new Response(
            JSON.stringify({ error: createAuthErr?.message || listErr.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const found = (usersPage?.users || []).find(
          (u: any) => String(u.email || "").toLowerCase() === normalizedEmail
        );
        if (found?.id) {
          targetUserId = found.id;
        }
      }
    }

    if (!targetUserId) {
      return new Response(
        JSON.stringify({
          error: createAuthErr?.message || "Não foi possível criar ou localizar a conta de acesso.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Garante que o perfil público tenha nome, e-mail e telefone sincronizados
    await supabaseAdmin.from("user_profiles").upsert(
      {
        id: targetUserId,
        email: normalizedEmail,
        full_name: fullName,
        phone: phone || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    return new Response(
      JSON.stringify({
        user_id: targetUserId,
        created_new_auth_account: createdNewAuthAccount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Erro inesperado ao provisionar usuário." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
