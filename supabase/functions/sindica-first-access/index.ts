import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = getEnvKey("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Configuração interna do servidor incompleta." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verifica trava atômica de uso único: existe algum síndico ativo no banco?
    const [{ count: sindicoCount, error: countErr }, { data: targetCondo, error: condoErr }] =
      await Promise.all([
        supabaseAdmin
          .from("condominium_members")
          .select("id", { count: "exact", head: true })
          .eq("role", "sindico")
          .eq("status", "active"),
        supabaseAdmin
          .from("condominiums")
          .select("id")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

    if (countErr || condoErr) {
      return new Response(
        JSON.stringify({ error: "Não foi possível consultar o estado inicial do sistema." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const available = (sindicoCount ?? 0) === 0 && Boolean(targetCondo?.id);

    let body: any = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const action = req.method === "GET" ? "status" : String(body?.action || "status").trim();

    if (action === "status") {
      return new Response(
        JSON.stringify({ available }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action !== "claim") {
      return new Response(
        JSON.stringify({ error: "Ação inválida." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!available || !targetCondo?.id) {
      return new Response(
        JSON.stringify({
          error:
            "O primeiro acesso da síndica já foi concluído. Utilize o login normal com seu e-mail e senha.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const temporaryPassword = String(body?.temporary_password || "").trim();
    const expectedTempPassword =
      Deno.env.get("SINDICA_FIRST_ACCESS_PASSWORD") || "Condor@2026";

    if (!temporaryPassword || temporaryPassword !== expectedTempPassword) {
      return new Response(
        JSON.stringify({ error: "Senha temporária de primeiro acesso inválida." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fullName = String(body?.full_name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const phone = body?.phone ? String(body.phone).trim() : null;

    if (fullName.length < 3) {
      return new Response(
        JSON.stringify({ error: "Informe seu nome completo (mínimo de 3 caracteres)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!EMAIL_REGEX.test(email) || email === "admin@condor.com.br") {
      return new Response(
        JSON.stringify({ error: "Informe um e-mail pessoal ou corporativo válido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cria a conta da síndica no Supabase Auth com e-mail já confirmado
    const { data: createdAuth, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: expectedTempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createAuthErr || !createdAuth?.user?.id) {
      const msgLower = String(createAuthErr?.message || "").toLowerCase();
      const friendlyMsg =
        msgLower.includes("already") || msgLower.includes("registered") || msgLower.includes("exists")
          ? "Este e-mail já está cadastrado na plataforma. Use o login normal ou recupere a senha."
          : createAuthErr?.message || "Não foi possível criar a conta de acesso da síndica.";
      return new Response(
        JSON.stringify({ error: friendlyMsg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = createdAuth.user.id;

    // Cria/atualiza o perfil público
    const { error: profileErr } = await supabaseAdmin.from("user_profiles").upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        phone: phone || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar perfil da síndica. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Vincula como Síndico Geral do condomínio inicial
    const { data: memberRow, error: memberErr } = await supabaseAdmin
      .from("condominium_members")
      .insert({
        condominium_id: targetCondo.id,
        user_id: userId,
        role: "sindico",
        status: "active",
        unit_number: "Administração",
        log_access_granted: true,
      })
      .select("id")
      .single();

    if (memberErr || !memberRow?.id) {
      await supabaseAdmin.from("user_profiles").delete().eq("id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Erro ao vincular acesso ao condomínio. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Registra na trilha de auditoria do condomínio
    await supabaseAdmin.from("audit_logs").insert({
      condominium_id: targetCondo.id,
      actor_user_id: userId,
      action: "SINDICO_FIRST_ACCESS_CLAIMED",
      entity_table: "condominium_members",
      entity_id: memberRow.id,
      metadata: { email },
    });

    return new Response(
      JSON.stringify({ ok: true, email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Erro inesperado no primeiro acesso." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
