-- ==============================================================================
-- CONDOR SAAS - SISTEMA DE ADMINISTRAÇÃO CONDOMINIAL
-- Migration 05: Amenity Reservations & Access Logs (Reservas & Portaria)
-- Created: 2026-10-07
-- ==============================================================================

-- 1. Amenity Reservations Table
CREATE TABLE IF NOT EXISTS public.amenity_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
    common_area_id UUID REFERENCES public.common_areas(id) ON DELETE SET NULL,
    space_name VARCHAR(100) NOT NULL,
    emoji VARCHAR(10) DEFAULT '🎉',
    date DATE NOT NULL,
    start_time VARCHAR(10) NOT NULL DEFAULT '08:00',
    end_time VARCHAR(10) NOT NULL DEFAULT '22:00',
    date_str VARCHAR(150),
    responsible_name VARCHAR(255) NOT NULL,
    unit_number VARCHAR(50) NOT NULL,
    rental_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'Aprovado / Taxa Paga',
    status_type VARCHAR(20) NOT NULL DEFAULT 'success' CHECK (status_type IN ('success', 'warning', 'info')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de busca e ordenação
CREATE INDEX IF NOT EXISTS idx_amenity_reservations_condo_date ON public.amenity_reservations(condominium_id, date);
CREATE INDEX IF NOT EXISTS idx_amenity_reservations_space ON public.amenity_reservations(condominium_id, space_name, date);

-- Trigger de updated_at
DROP TRIGGER IF EXISTS update_amenity_reservations_updated_at ON public.amenity_reservations;
CREATE TRIGGER update_amenity_reservations_updated_at
BEFORE UPDATE ON public.amenity_reservations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 2. Access Logs Table (Portaria, BioSync Facial, QR Codes e Entregas)
CREATE TABLE IF NOT EXISTS public.access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
    person_name VARCHAR(255) NOT NULL,
    photo_url TEXT,
    auth_type VARCHAR(50) NOT NULL DEFAULT 'facial' CHECK (auth_type IN ('facial', 'qr_code', 'delivery', 'manual', 'tag')),
    auth_detail VARCHAR(255) NOT NULL DEFAULT 'BioSync Facial 99.8% • Aprovado',
    access_point VARCHAR(100) NOT NULL DEFAULT 'Catraca Principal 01',
    destination VARCHAR(100) NOT NULL,
    entry_type VARCHAR(50) NOT NULL DEFAULT 'Morador Residente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_logs_condo_created ON public.access_logs(condominium_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_entry_type ON public.access_logs(condominium_id, entry_type);

-- 3. Row Level Security (RLS)
ALTER TABLE public.amenity_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para amenity_reservations
DROP POLICY IF EXISTS "Membros do condomínio podem ver reservas" ON public.amenity_reservations;
CREATE POLICY "Membros do condomínio podem ver reservas"
ON public.amenity_reservations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.condominium_members cm
        WHERE cm.condominium_id = amenity_reservations.condominium_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
);

DROP POLICY IF EXISTS "Membros ativos podem criar reservas" ON public.amenity_reservations;
CREATE POLICY "Membros ativos podem criar reservas"
ON public.amenity_reservations FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.condominium_members cm
        WHERE cm.condominium_id = amenity_reservations.condominium_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
);

DROP POLICY IF EXISTS "Síndicos e superadmins podem atualizar reservas" ON public.amenity_reservations;
CREATE POLICY "Síndicos e superadmins podem atualizar reservas"
ON public.amenity_reservations FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.condominium_members cm
        WHERE cm.condominium_id = amenity_reservations.condominium_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('sindico', 'superadmin')
        AND cm.status = 'active'
    )
);

DROP POLICY IF EXISTS "Síndicos e superadmins podem remover reservas" ON public.amenity_reservations;
CREATE POLICY "Síndicos e superadmins podem remover reservas"
ON public.amenity_reservations FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.condominium_members cm
        WHERE cm.condominium_id = amenity_reservations.condominium_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('sindico', 'superadmin')
        AND cm.status = 'active'
    )
);

-- Políticas para access_logs
DROP POLICY IF EXISTS "Porteiros, síndicos e admins podem ver logs de acesso" ON public.access_logs;
CREATE POLICY "Porteiros, síndicos e admins podem ver logs de acesso"
ON public.access_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.condominium_members cm
        WHERE cm.condominium_id = access_logs.condominium_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('porteiro', 'sindico', 'superadmin')
        AND cm.status = 'active'
    )
);

DROP POLICY IF EXISTS "Porteiros, síndicos e admins podem registrar logs de acesso" ON public.access_logs;
CREATE POLICY "Porteiros, síndicos e admins podem registrar logs de acesso"
ON public.access_logs FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.condominium_members cm
        WHERE cm.condominium_id = access_logs.condominium_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('porteiro', 'sindico', 'superadmin')
        AND cm.status = 'active'
    )
);
