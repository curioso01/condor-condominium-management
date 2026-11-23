-- ============================================================================
-- MIGRATION: 20261104000001_pilot_readiness_schema_and_rls.sql
-- DESCRIÇÃO: Adequação de Schema, Isolamento Multi-Condomínio e Blindagem RLS
--            para Prontidão de Cliente-Piloto (4 Condomínios).
-- COMPATIBILIDADE: 100% compatível com DEPLOY_ALL_MIGRATIONS.sql
--                  (usa update_updated_at_column(), user_has_active_membership(),
--                   is_condo_admin(), user_has_condo_role(UUID, VARCHAR[])).
-- NOTA: Operação 100% aditiva (sem DROP TABLE / sem remoção de dados).
--       NÃO executar em produção sem autorização prévia e backup.
-- ============================================================================

-- 1. EXTENSÃO DE COLUNAS EM public.user_profiles (Sincronização de e-mail do Auth)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(LOWER(email));

-- Backfill seguro de e-mail para perfis já existentes a partir de auth.users
DO $$
BEGIN
  UPDATE public.user_profiles up
  SET email = au.email
  FROM auth.users au
  WHERE up.id = au.id
    AND (up.email IS NULL OR up.email = '');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Backfill de email em user_profiles ignorado: %', SQLERRM;
END $$;

-- Atualiza trigger handle_new_user() para incluir o email automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, full_name, email, phone, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE
    SET full_name = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
        email = COALESCE(EXCLUDED.email, public.user_profiles.email),
        phone = COALESCE(EXCLUDED.phone, public.user_profiles.phone),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.user_profiles.avatar_url),
        updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função RPC segura para síndicos/superadmins localizarem usuário existente no Auth por e-mail
CREATE OR REPLACE FUNCTION public.resolve_user_by_email(target_email TEXT)
RETURNS TABLE (
    user_id UUID,
    full_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
BEGIN
    -- Apenas superadmin ou síndico ativo de algum condomínio pode consultar
    IF NOT (
        public.is_superadmin() OR
        EXISTS (
            SELECT 1 FROM public.condominium_members cm
            WHERE cm.user_id = auth.uid()
              AND cm.role = 'sindico'
              AND cm.status = 'active'
        )
    ) THEN
        RAISE EXCEPTION 'Acesso negado: apenas Síndicos e Super Administradores podem consultar usuários por e-mail.';
    END IF;

    RETURN QUERY
    SELECT
        au.id AS user_id,
        COALESCE(up.full_name, COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)))::VARCHAR(255) AS full_name,
        au.email::VARCHAR(255) AS email,
        up.phone::VARCHAR(20) AS phone,
        up.avatar_url AS avatar_url
    FROM auth.users au
    LEFT JOIN public.user_profiles up ON up.id = au.id
    WHERE LOWER(au.email) = LOWER(TRIM(target_email))
    LIMIT 1;
END;
$$;

-- 2. EXTENSÃO DE COLUNAS EM public.common_areas (Alinhamento com amenityService.ts)
ALTER TABLE public.common_areas
  ADD COLUMN IF NOT EXISTS capacity INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS rules TEXT DEFAULT 'Sujeito ao regimento interno do condomínio.',
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emoji TEXT DEFAULT '🏢',
  ADD COLUMN IF NOT EXISTS hours TEXT DEFAULT '08:00 às 22:00';

-- 3. EXTENSÃO DE COLUNAS EM public.units (Alinhamento com unitService.ts / Censo)
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS owner_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS resident_type TEXT DEFAULT 'Proprietário' CHECK (resident_type IN ('Proprietário', 'Inquilino')),
  ADD COLUMN IF NOT EXISTS parking_spot TEXT,
  ADD COLUMN IF NOT EXISTS has_pet BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vehicle_model TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_plate TEXT,
  ADD COLUMN IF NOT EXISTS square_meters NUMERIC(8, 2) DEFAULT 92.00,
  ADD COLUMN IF NOT EXISTS residents_count INT DEFAULT 1;

-- 4. EXTENSÃO DE COLUNAS EM public.condominium_members (Permissão de Logs e Dados da Unidade por Condomínio)
ALTER TABLE public.condominium_members
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS block VARCHAR(50),
  ADD COLUMN IF NOT EXISTS resident_type VARCHAR(30) DEFAULT 'Proprietário',
  ADD COLUMN IF NOT EXISTS has_pet BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(20),
  ADD COLUMN IF NOT EXISTS log_access_granted BOOLEAN NOT NULL DEFAULT false;

-- 5. NOVA TABELA: public.announcements (Mural Oficial de Comunicados por Condomínio)
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Comunicado'
    CHECK (category IN ('Urgente', 'Manutenção', 'Assembleia', 'Convivência', 'Comunicado')),
  content TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_condo_pinned
  ON public.announcements(condominium_id, is_pinned DESC, created_at DESC);

DROP TRIGGER IF EXISTS trg_announcements_updated_at ON public.announcements;
CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 6. NOVA TABELA: public.condominium_bank_settings (Conta Bancária & Pix Isolados por Condomínio)
CREATE TABLE IF NOT EXISTS public.condominium_bank_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id UUID NOT NULL UNIQUE REFERENCES public.condominiums(id) ON DELETE CASCADE,
  bank_code TEXT NOT NULL DEFAULT '341',
  bank_name TEXT NOT NULL DEFAULT 'Itaú Unibanco S.A.',
  agency TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_digit TEXT NOT NULL,
  wallet_code TEXT NOT NULL DEFAULT '109',
  beneficiary_name TEXT NOT NULL,
  beneficiary_cnpj TEXT NOT NULL,
  pix_key_type TEXT NOT NULL DEFAULT 'CNPJ'
    CHECK (pix_key_type IN ('CNPJ', 'E-mail', 'Telefone', 'Chave Aleatória')),
  pix_key TEXT NOT NULL,
  interest_rate_monthly NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
  fine_percent NUMERIC(5, 2) NOT NULL DEFAULT 2.00,
  instructions_line1 TEXT,
  instructions_line2 TEXT,
  active_integration BOOLEAN NOT NULL DEFAULT true,
  updated_by_name TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_condo_bank_settings_updated_at ON public.condominium_bank_settings;
CREATE TRIGGER trg_condo_bank_settings_updated_at
  BEFORE UPDATE ON public.condominium_bank_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.condominium_bank_settings ENABLE ROW LEVEL SECURITY;

-- 7. NOVA TABELA: public.condominium_financial_config (Fundo de Reserva, Metas e Telemetria por Condomínio)
CREATE TABLE IF NOT EXISTS public.condominium_financial_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id UUID NOT NULL UNIQUE REFERENCES public.condominiums(id) ON DELETE CASCADE,
  reserve_fund_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  reserve_fund_yield_rate NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
  reserve_fund_institution TEXT NOT NULL DEFAULT 'Conta Rendimento CDI',
  reserve_fund_target_title TEXT NOT NULL DEFAULT 'Meta Anual de Reserva',
  reserve_fund_target_amount NUMERIC(14, 2) NOT NULL DEFAULT 100000.00,
  reserve_fund_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  monthly_budget NUMERIC(14, 2) NOT NULL DEFAULT 50000.00,
  ai_diagnosis JSONB DEFAULT NULL,
  channel_metrics JSONB DEFAULT NULL,
  ai_energy JSONB DEFAULT NULL,
  health_metrics JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_condo_financial_config_updated_at ON public.condominium_financial_config;
CREATE TRIGGER trg_condo_financial_config_updated_at
  BEFORE UPDATE ON public.condominium_financial_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.condominium_financial_config ENABLE ROW LEVEL SECURITY;

-- 8. NOVA TABELA: public.operational_expenses (Despesas Operacionais por Condomínio)
CREATE TABLE IF NOT EXISTS public.operational_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  supplier TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pago', 'Pendente', 'Agendado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operational_expenses_condo ON public.operational_expenses(condominium_id, due_date DESC);

DROP TRIGGER IF EXISTS trg_operational_expenses_updated_at ON public.operational_expenses;
CREATE TRIGGER trg_operational_expenses_updated_at
  BEFORE UPDATE ON public.operational_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.operational_expenses ENABLE ROW LEVEL SECURITY;

-- 9. NOVA TABELA: public.audit_logs (Trilha de Auditoria LGPD & Operações Críticas)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id UUID REFERENCES public.condominiums(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_table TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_condo_created ON public.audit_logs(condominium_id, created_at DESC);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 10. CORREÇÃO CRÍTICA DE RLS: BLOQUEIO DE ESCALADA DE PRIVILÉGIOS EM condominium_members
-- ============================================================================
-- Regra de Autorização Backend:
-- 1. Apenas 'superadmin' pode atribuir, editar ou remover o papel 'superadmin'.
-- 2. Um 'sindico' só pode gerenciar membros dos condomínios onde ele próprio é 'sindico' ativo.
-- 3. Um 'sindico' não pode alterar o próprio papel (user_id <> auth.uid()) nem conceder 'superadmin'.

DROP POLICY IF EXISTS insert_condominium_members ON public.condominium_members;
DROP POLICY IF EXISTS "insert_condominium_members" ON public.condominium_members;
CREATE POLICY insert_condominium_members
  ON public.condominium_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR (
      public.is_condo_admin(condominium_id)
      AND user_id <> auth.uid()
      AND role IN ('sindico', 'morador', 'porteiro')
    )
  );

DROP POLICY IF EXISTS update_condominium_members ON public.condominium_members;
DROP POLICY IF EXISTS "update_condominium_members" ON public.condominium_members;
CREATE POLICY update_condominium_members
  ON public.condominium_members FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR (
      public.is_condo_admin(condominium_id)
      AND user_id <> auth.uid()
      AND role <> 'superadmin'
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR (
      public.is_condo_admin(condominium_id)
      AND user_id <> auth.uid()
      AND role IN ('sindico', 'morador', 'porteiro')
    )
  );

DROP POLICY IF EXISTS delete_condominium_members ON public.condominium_members;
DROP POLICY IF EXISTS "delete_condominium_members" ON public.condominium_members;
CREATE POLICY delete_condominium_members
  ON public.condominium_members FOR DELETE TO authenticated
  USING (
    public.is_superadmin()
    OR (
      public.is_condo_admin(condominium_id)
      AND user_id <> auth.uid()
      AND role <> 'superadmin'
    )
  );

-- ============================================================================
-- 11. CORREÇÃO DE RLS EM public.invoices (Morador vê apenas boletos da sua unidade)
-- ============================================================================
DROP POLICY IF EXISTS select_invoices ON public.invoices;
DROP POLICY IF EXISTS "select_invoices" ON public.invoices;
CREATE POLICY select_invoices
  ON public.invoices FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR public.is_condo_admin(condominium_id)
    OR EXISTS (
      SELECT 1 FROM public.condominium_members cm
      WHERE cm.condominium_id = invoices.condominium_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.unit_id = invoices.unit_id
    )
  );

-- ============================================================================
-- 12. CORREÇÃO DE RLS EM public.access_logs (Respeitar log_access_granted e passes QR)
-- ============================================================================
DROP POLICY IF EXISTS "Porteiros, síndicos e admins podem ver logs de acesso" ON public.access_logs;
DROP POLICY IF EXISTS select_access_logs ON public.access_logs;
DROP POLICY IF EXISTS "select_access_logs" ON public.access_logs;
CREATE POLICY select_access_logs
  ON public.access_logs FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR public.user_has_condo_role(condominium_id, ARRAY['sindico', 'porteiro']::VARCHAR[])
    OR EXISTS (
      SELECT 1 FROM public.condominium_members cm
      WHERE cm.condominium_id = access_logs.condominium_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.log_access_granted = true
    )
  );

DROP POLICY IF EXISTS "Porteiros, síndicos e admins podem registrar logs de acesso" ON public.access_logs;
DROP POLICY IF EXISTS insert_access_logs ON public.access_logs;
DROP POLICY IF EXISTS "insert_access_logs" ON public.access_logs;
CREATE POLICY insert_access_logs
  ON public.access_logs FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR public.user_has_condo_role(condominium_id, ARRAY['sindico', 'porteiro']::VARCHAR[])
    OR (
      public.user_has_active_membership(condominium_id)
      AND auth_type = 'qr_code'
      AND entry_type = 'Convidado QR Válido'
    )
  );

-- ============================================================================
-- 13. POLÍTICAS RLS DAS NOVAS TABELAS (Isolamento Estrito por Condomínio)
-- ============================================================================

-- announcements: Membros ativos do condomínio leem; apenas síndico/superadmin criam/editam/excluem
DROP POLICY IF EXISTS select_announcements ON public.announcements;
CREATE POLICY select_announcements
  ON public.announcements FOR SELECT TO authenticated
  USING (public.is_superadmin() OR public.user_has_active_membership(condominium_id));

DROP POLICY IF EXISTS manage_announcements ON public.announcements;
CREATE POLICY manage_announcements
  ON public.announcements FOR ALL TO authenticated
  USING (public.is_superadmin() OR public.is_condo_admin(condominium_id))
  WITH CHECK (public.is_superadmin() OR public.is_condo_admin(condominium_id));

-- condominium_bank_settings: Membros ativos leem (para emissão/visualização de boleto da unidade); apenas síndico/superadmin alteram
DROP POLICY IF EXISTS select_condo_bank_settings ON public.condominium_bank_settings;
CREATE POLICY select_condo_bank_settings
  ON public.condominium_bank_settings FOR SELECT TO authenticated
  USING (public.is_superadmin() OR public.user_has_active_membership(condominium_id));

DROP POLICY IF EXISTS manage_condo_bank_settings ON public.condominium_bank_settings;
CREATE POLICY manage_condo_bank_settings
  ON public.condominium_bank_settings FOR ALL TO authenticated
  USING (public.is_superadmin() OR public.is_condo_admin(condominium_id))
  WITH CHECK (public.is_superadmin() OR public.is_condo_admin(condominium_id));

-- condominium_financial_config: Apenas síndico/superadmin leem e gerenciam
DROP POLICY IF EXISTS select_condo_financial_config ON public.condominium_financial_config;
CREATE POLICY select_condo_financial_config
  ON public.condominium_financial_config FOR SELECT TO authenticated
  USING (public.is_superadmin() OR public.is_condo_admin(condominium_id));

DROP POLICY IF EXISTS manage_condo_financial_config ON public.condominium_financial_config;
CREATE POLICY manage_condo_financial_config
  ON public.condominium_financial_config FOR ALL TO authenticated
  USING (public.is_superadmin() OR public.is_condo_admin(condominium_id))
  WITH CHECK (public.is_superadmin() OR public.is_condo_admin(condominium_id));

-- operational_expenses: Apenas síndico/superadmin leem e gerenciam
DROP POLICY IF EXISTS select_operational_expenses ON public.operational_expenses;
CREATE POLICY select_operational_expenses
  ON public.operational_expenses FOR SELECT TO authenticated
  USING (public.is_superadmin() OR public.is_condo_admin(condominium_id));

DROP POLICY IF EXISTS manage_operational_expenses ON public.operational_expenses;
CREATE POLICY manage_operational_expenses
  ON public.operational_expenses FOR ALL TO authenticated
  USING (public.is_superadmin() OR public.is_condo_admin(condominium_id))
  WITH CHECK (public.is_superadmin() OR public.is_condo_admin(condominium_id));

-- audit_logs: Leitura restrita a síndico/superadmin; inserção autenticada no próprio condomínio
DROP POLICY IF EXISTS select_audit_logs ON public.audit_logs;
CREATE POLICY select_audit_logs
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_superadmin() OR (condominium_id IS NOT NULL AND public.is_condo_admin(condominium_id)));

DROP POLICY IF EXISTS insert_audit_logs ON public.audit_logs;
CREATE POLICY insert_audit_logs
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
    AND (condominium_id IS NULL OR public.user_has_active_membership(condominium_id) OR public.is_superadmin())
  );
