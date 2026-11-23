-- ============================================================================
-- MIGRATION: 20261123000001_security_lgpd_packages_and_rls.sql
-- DESCRIÇÃO: Endurecimento de Segurança, Privacidade LGPD, Integridade de
--            Reservas, Permissão de Portaria em Manutenção, Smart Lockers
--            (public.packages), Tickets de Suporte, Consentimento LGPD e
--            Bucket de Avatares (Supabase Storage).
-- COMPATIBILIDADE: 100% aditiva e compatível com DEPLOY_ALL_MIGRATIONS.sql e
--                  20261104000001_pilot_readiness_schema_and_rls.sql.
-- ============================================================================

-- ============================================================================
-- 1. LGPD FIX: RESTRINGIR public.user_profiles (Morador vê apenas o próprio perfil)
-- ============================================================================
-- Evita que um morador comum faça scraping de e-mails e telefones de vizinhos via API.
DROP POLICY IF EXISTS select_user_profiles ON public.user_profiles;
DROP POLICY IF EXISTS "select_user_profiles" ON public.user_profiles;
CREATE POLICY select_user_profiles
  ON public.user_profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_superadmin()
    OR EXISTS (
      SELECT 1
      FROM public.condominium_members my_m
      JOIN public.condominium_members their_m
        ON my_m.condominium_id = their_m.condominium_id
      WHERE my_m.user_id = auth.uid()
        AND my_m.status = 'active'
        AND my_m.role IN ('sindico', 'porteiro', 'superadmin')
        AND their_m.user_id = public.user_profiles.id
        AND their_m.status = 'active'
    )
  );

-- ============================================================================
-- 2. LGPD FIX: RESTRINGIR public.units (Morador vê apenas a própria unidade)
-- ============================================================================
-- Evita exposição de placas de veículos, vagas e proprietários de outros apartamentos.
DROP POLICY IF EXISTS select_units ON public.units;
DROP POLICY IF EXISTS "select_units" ON public.units;
CREATE POLICY select_units
  ON public.units FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR public.user_has_condo_role(condominium_id, ARRAY['sindico', 'porteiro']::VARCHAR[])
    OR EXISTS (
      SELECT 1
      FROM public.condominium_members cm
      WHERE cm.condominium_id = units.condominium_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND (
          cm.unit_id = units.id
          OR (
            cm.unit_number IS NOT NULL
            AND LOWER(TRIM(cm.unit_number)) = LOWER(TRIM(units.identifier))
          )
        )
    )
  );

-- ============================================================================
-- 3. RESERVAS DE ÁREAS COMUNS: INTEGRIDADE, ANTI-DUPLICIDADE E ANTI-BYPASS
-- ============================================================================
ALTER TABLE public.amenity_reservations
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Índice único parcial impedindo sobreposição exata de espaço/data/horário (excluindo canceladas/recusadas)
CREATE UNIQUE INDEX IF NOT EXISTS idx_amenity_reservations_no_overlap
  ON public.amenity_reservations (condominium_id, space_name, date, start_time)
  WHERE status NOT ILIKE '%Cancelad%' AND status NOT ILIKE '%Recusad%';

-- Trigger de segurança no banco: impede que morador auto-aprove reserva em espaço com requires_approval = true
CREATE OR REPLACE FUNCTION public.enforce_reservation_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requires_approval BOOLEAN := false;
BEGIN
  -- Registra autoria automaticamente quando autenticado
  IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  -- Verifica se a área comum exige aprovação prévia do síndico
  IF NEW.common_area_id IS NOT NULL THEN
    SELECT COALESCE(ca.requires_approval, false)
      INTO v_requires_approval
      FROM public.common_areas ca
     WHERE ca.id = NEW.common_area_id
       AND ca.condominium_id = NEW.condominium_id
     LIMIT 1;
  ELSE
    SELECT COALESCE(ca.requires_approval, false)
      INTO v_requires_approval
      FROM public.common_areas ca
     WHERE ca.condominium_id = NEW.condominium_id
       AND LOWER(TRIM(ca.name)) = LOWER(TRIM(NEW.space_name))
     LIMIT 1;
  END IF;

  -- Se o espaço exige aprovação e o solicitante NÃO é síndico/superadmin, força status pendente no servidor
  IF v_requires_approval AND NOT public.is_condo_admin(NEW.condominium_id) THEN
    NEW.status := 'Aguardando Aprovação do Síndico';
    NEW.status_type := 'warning';
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_reservation_approval ON public.amenity_reservations;
CREATE TRIGGER trg_enforce_reservation_approval
  BEFORE INSERT ON public.amenity_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_reservation_approval();

-- Políticas RLS atualizadas para public.amenity_reservations (incluindo superadmin e cancelamento próprio pelo morador)
DROP POLICY IF EXISTS "Membros do condomínio podem ver reservas" ON public.amenity_reservations;
DROP POLICY IF EXISTS select_amenity_reservations ON public.amenity_reservations;
CREATE POLICY select_amenity_reservations
  ON public.amenity_reservations FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR public.user_has_active_membership(condominium_id)
  );

DROP POLICY IF EXISTS "Membros ativos podem criar reservas" ON public.amenity_reservations;
DROP POLICY IF EXISTS insert_amenity_reservations ON public.amenity_reservations;
CREATE POLICY insert_amenity_reservations
  ON public.amenity_reservations FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR public.user_has_active_membership(condominium_id)
  );

DROP POLICY IF EXISTS "Síndicos e superadmins podem atualizar reservas" ON public.amenity_reservations;
DROP POLICY IF EXISTS update_amenity_reservations ON public.amenity_reservations;
CREATE POLICY update_amenity_reservations
  ON public.amenity_reservations FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR public.is_condo_admin(condominium_id)
  )
  WITH CHECK (
    public.is_superadmin()
    OR public.is_condo_admin(condominium_id)
  );

DROP POLICY IF EXISTS "Síndicos e superadmins podem remover reservas" ON public.amenity_reservations;
DROP POLICY IF EXISTS delete_amenity_reservations ON public.amenity_reservations;
CREATE POLICY delete_amenity_reservations
  ON public.amenity_reservations FOR DELETE TO authenticated
  USING (
    public.is_superadmin()
    OR public.is_condo_admin(condominium_id)
    OR (
      public.user_has_active_membership(condominium_id)
      AND created_by = auth.uid()
    )
  );

-- ============================================================================
-- 4. MANUTENÇÃO: ALINHAMENTO RBAC — PORTEIRO PODE ABRIR NOVAS ORDENS DE SERVIÇO
-- ============================================================================
DROP POLICY IF EXISTS insert_maintenance_orders ON public.maintenance_orders;
DROP POLICY IF EXISTS "insert_maintenance_orders" ON public.maintenance_orders;
CREATE POLICY insert_maintenance_orders
  ON public.maintenance_orders FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR public.user_has_condo_role(condominium_id, ARRAY['sindico', 'porteiro']::VARCHAR[])
  );

-- ============================================================================
-- 5. NOVA TABELA: public.packages (Controle Real de Encomendas & Smart Lockers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  unit_number VARCHAR(80) NOT NULL,
  recipient_name VARCHAR(255) NOT NULL,
  courier VARCHAR(120) NOT NULL,
  tracking_code VARCHAR(120),
  locker_compartment VARCHAR(60) NOT NULL DEFAULT 'Portaria Principal',
  size VARCHAR(30) NOT NULL DEFAULT 'Médio' CHECK (size IN ('Pequeno', 'Médio', 'Grande')),
  pickup_pin VARCHAR(12) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'awaiting' CHECK (status IN ('awaiting', 'picked_up')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  picked_up_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_packages_condo_status ON public.packages(condominium_id, status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_packages_unit ON public.packages(condominium_id, unit_id);

DROP TRIGGER IF EXISTS trg_packages_updated_at ON public.packages;
CREATE TRIGGER trg_packages_updated_at
  BEFORE UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_packages ON public.packages;
CREATE POLICY select_packages
  ON public.packages FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR public.user_has_condo_role(condominium_id, ARRAY['sindico', 'porteiro']::VARCHAR[])
    OR EXISTS (
      SELECT 1
      FROM public.condominium_members cm
      WHERE cm.condominium_id = packages.condominium_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND (
          (cm.unit_id IS NOT NULL AND cm.unit_id = packages.unit_id)
          OR (
            cm.unit_number IS NOT NULL
            AND packages.unit_number ILIKE ('%' || TRIM(cm.unit_number) || '%')
          )
        )
    )
  );

DROP POLICY IF EXISTS manage_packages ON public.packages;
CREATE POLICY manage_packages
  ON public.packages FOR ALL TO authenticated
  USING (
    public.is_superadmin()
    OR public.user_has_condo_role(condominium_id, ARRAY['sindico', 'porteiro']::VARCHAR[])
  )
  WITH CHECK (
    public.is_superadmin()
    OR public.user_has_condo_role(condominium_id, ARRAY['sindico', 'porteiro']::VARCHAR[])
  );

-- ============================================================================
-- 6. NOVA TABELA: public.support_tickets (Chamados de Suporte da Central FAQ)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id UUID REFERENCES public.condominiums(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  subject VARCHAR(255) NOT NULL DEFAULT 'Suporte Plataforma Condor',
  message TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_condo ON public.support_tickets(condominium_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_support_tickets ON public.support_tickets;
CREATE POLICY select_support_tickets
  ON public.support_tickets FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_superadmin()
    OR (condominium_id IS NOT NULL AND public.is_condo_admin(condominium_id))
  );

DROP POLICY IF EXISTS insert_support_tickets ON public.support_tickets;
CREATE POLICY insert_support_tickets
  ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 7. NOVA TABELA: public.lgpd_consents (Registro de Aceite e Solicitações LGPD)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.lgpd_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  condominium_id UUID REFERENCES public.condominiums(id) ON DELETE SET NULL,
  policy_version VARCHAR(30) NOT NULL DEFAULT '2026.1',
  consent_type VARCHAR(40) NOT NULL DEFAULT 'privacy_terms'
    CHECK (consent_type IN ('privacy_terms', 'data_export_request', 'anonymization_request')),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_lgpd_consents_user ON public.lgpd_consents(user_id, accepted_at DESC);

ALTER TABLE public.lgpd_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_lgpd_consents ON public.lgpd_consents;
CREATE POLICY select_lgpd_consents
  ON public.lgpd_consents FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_superadmin());

DROP POLICY IF EXISTS insert_lgpd_consents ON public.lgpd_consents;
CREATE POLICY insert_lgpd_consents
  ON public.lgpd_consents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 8. SUPABASE STORAGE: BUCKET DE AVATARES COM RLS (Substitui Base64 no Postgres)
-- ============================================================================
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'avatars',
    'avatars',
    true,
    2097152, -- 2 MB máx
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  )
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Criação automática do bucket avatars ignorada: %', SQLERRM;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
  CREATE POLICY "avatars_public_read"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'avatars');

  DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
  CREATE POLICY "avatars_owner_insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );

  DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
  CREATE POLICY "avatars_owner_update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );

  DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
  CREATE POLICY "avatars_owner_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Políticas de storage.objects para avatars ignoradas: %', SQLERRM;
END $$;
