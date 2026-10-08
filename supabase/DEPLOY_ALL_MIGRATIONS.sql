-- ==============================================================================
-- CONDOR SAAS - SISTEMA DE ADMINISTRAÇÃO CONDOMINIAL
-- DEPLOY MASTER CONSOLIDADO: Todas as Migrations & Seeds para o Supabase SQL Editor
-- Versão: 1.0 (Produção & Demonstração)
-- Execução: Copie todo este arquivo e cole no SQL Editor do console Supabase.
-- Idempotente: Pode ser executado múltiplas vezes com total segurança.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PARTE 1: EXTENSÕES & FUNÇÕES UTILITÁRIAS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- PARTE 2: TABELAS MULTI-TENANT PRINCIPAIS
-- ------------------------------------------------------------------------------

-- 1. Condomínios
CREATE TABLE IF NOT EXISTS public.condominiums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    cnpj VARCHAR(18) UNIQUE,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_condominiums_name ON public.condominiums(name);
CREATE INDEX IF NOT EXISTS idx_condominiums_city_state ON public.condominiums(city, state);

DROP TRIGGER IF EXISTS update_condominiums_updated_at ON public.condominiums;
CREATE TRIGGER update_condominiums_updated_at
BEFORE UPDATE ON public.condominiums
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 2. Perfis de Usuário (vinculados a auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_full_name ON public.user_profiles(full_name);

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 3. Membros do Condomínio (Multi-tenant Junction)
CREATE TABLE IF NOT EXISTS public.condominium_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('superadmin', 'sindico', 'morador', 'porteiro')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    log_access_granted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_condominium UNIQUE (condominium_id, user_id)
);

ALTER TABLE public.condominium_members ADD COLUMN IF NOT EXISTS log_access_granted BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_condo_members_user ON public.condominium_members(user_id);
CREATE INDEX IF NOT EXISTS idx_condo_members_condo ON public.condominium_members(condominium_id);
CREATE INDEX IF NOT EXISTS idx_condo_members_status_role ON public.condominium_members(condominium_id, user_id, status, role);

DROP TRIGGER IF EXISTS update_condominium_members_updated_at ON public.condominium_members;
CREATE TRIGGER update_condominium_members_updated_at
BEFORE UPDATE ON public.condominium_members
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 4. Unidades / Apartamentos
CREATE TABLE IF NOT EXISTS public.units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
    identifier VARCHAR(50) NOT NULL,
    block VARCHAR(50) NOT NULL,
    floor INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_condominium_unit UNIQUE (condominium_id, block, identifier)
);

CREATE INDEX IF NOT EXISTS idx_units_condominium ON public.units(condominium_id);
CREATE INDEX IF NOT EXISTS idx_units_block_identifier ON public.units(condominium_id, block, identifier);

DROP TRIGGER IF EXISTS update_units_updated_at ON public.units;
CREATE TRIGGER update_units_updated_at
BEFORE UPDATE ON public.units
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 5. Áreas Comuns
CREATE TABLE IF NOT EXISTS public.common_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_common_areas_condo ON public.common_areas(condominium_id, active);

DROP TRIGGER IF EXISTS update_common_areas_updated_at ON public.common_areas;
CREATE TRIGGER update_common_areas_updated_at
BEFORE UPDATE ON public.common_areas
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 6. Trigger automático de criação de perfil a partir do auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, full_name, phone, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE
    SET full_name = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
        phone = COALESCE(EXCLUDED.phone, public.user_profiles.phone),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.user_profiles.avatar_url),
        updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- PARTE 3: HELPER FUNCTIONS & POLÍTICAS RLS (SEGURANÇA MULTI-TENANT)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.condominium_members
        WHERE user_id = auth.uid()
          AND role = 'superadmin'
          AND status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.user_has_active_membership(target_condo_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.condominium_members
        WHERE user_id = auth.uid()
          AND condominium_id = target_condo_id
          AND status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.user_has_condo_role(target_condo_id UUID, allowed_roles VARCHAR[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.condominium_members
        WHERE user_id = auth.uid()
          AND condominium_id = target_condo_id
          AND status = 'active'
          AND role = ANY(allowed_roles)
    );
$$;

CREATE OR REPLACE FUNCTION public.is_condo_admin(target_condo_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT (
        public.is_superadmin() OR
        public.user_has_condo_role(target_condo_id, ARRAY['sindico']::VARCHAR[])
    );
$$;

-- RLS Habilitação
ALTER TABLE public.condominiums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condominium_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.common_areas ENABLE ROW LEVEL SECURITY;

-- Políticas: user_profiles
DROP POLICY IF EXISTS select_user_profiles ON public.user_profiles;
CREATE POLICY select_user_profiles ON public.user_profiles
FOR SELECT TO authenticated
USING (
    id = auth.uid() OR
    public.is_superadmin() OR
    EXISTS (
        SELECT 1
        FROM public.condominium_members my_m
        JOIN public.condominium_members their_m ON my_m.condominium_id = their_m.condominium_id
        WHERE my_m.user_id = auth.uid()
          AND my_m.status = 'active'
          AND their_m.user_id = public.user_profiles.id
          AND their_m.status = 'active'
    )
);

DROP POLICY IF EXISTS insert_user_profiles ON public.user_profiles;
CREATE POLICY insert_user_profiles ON public.user_profiles
FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS update_user_profiles ON public.user_profiles;
CREATE POLICY update_user_profiles ON public.user_profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS delete_user_profiles ON public.user_profiles;
CREATE POLICY delete_user_profiles ON public.user_profiles
FOR DELETE TO authenticated
USING (id = auth.uid() OR public.is_superadmin());

-- Políticas: condominiums
DROP POLICY IF EXISTS select_condominiums ON public.condominiums;
CREATE POLICY select_condominiums ON public.condominiums
FOR SELECT TO authenticated
USING (
    public.is_superadmin() OR
    public.user_has_active_membership(id)
);

DROP POLICY IF EXISTS insert_condominiums ON public.condominiums;
CREATE POLICY insert_condominiums ON public.condominiums
FOR INSERT TO authenticated
WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS update_condominiums ON public.condominiums;
CREATE POLICY update_condominiums ON public.condominiums
FOR UPDATE TO authenticated
USING (public.is_condo_admin(id))
WITH CHECK (public.is_condo_admin(id));

DROP POLICY IF EXISTS delete_condominiums ON public.condominiums;
CREATE POLICY delete_condominiums ON public.condominiums
FOR DELETE TO authenticated
USING (public.is_superadmin());

-- Políticas: condominium_members
DROP POLICY IF EXISTS select_condominium_members ON public.condominium_members;
CREATE POLICY select_condominium_members ON public.condominium_members
FOR SELECT TO authenticated
USING (
    user_id = auth.uid() OR
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id) OR
    public.user_has_condo_role(condominium_id, ARRAY['porteiro']::VARCHAR[])
);

DROP POLICY IF EXISTS insert_condominium_members ON public.condominium_members;
CREATE POLICY insert_condominium_members ON public.condominium_members
FOR INSERT TO authenticated
WITH CHECK (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);

DROP POLICY IF EXISTS update_condominium_members ON public.condominium_members;
CREATE POLICY update_condominium_members ON public.condominium_members
FOR UPDATE TO authenticated
USING (
    public.is_superadmin() OR
    (public.is_condo_admin(condominium_id) AND user_id <> auth.uid())
)
WITH CHECK (
    public.is_superadmin() OR
    (public.is_condo_admin(condominium_id) AND user_id <> auth.uid())
);

DROP POLICY IF EXISTS delete_condominium_members ON public.condominium_members;
CREATE POLICY delete_condominium_members ON public.condominium_members
FOR DELETE TO authenticated
USING (
    public.is_superadmin() OR
    (public.is_condo_admin(condominium_id) AND user_id <> auth.uid())
);

-- Políticas: units
DROP POLICY IF EXISTS select_units ON public.units;
CREATE POLICY select_units ON public.units
FOR SELECT TO authenticated
USING (
    public.is_superadmin() OR
    public.user_has_active_membership(condominium_id)
);

DROP POLICY IF EXISTS insert_units ON public.units;
CREATE POLICY insert_units ON public.units
FOR INSERT TO authenticated
WITH CHECK (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);

DROP POLICY IF EXISTS update_units ON public.units;
CREATE POLICY update_units ON public.units
FOR UPDATE TO authenticated
USING (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
)
WITH CHECK (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);

DROP POLICY IF EXISTS delete_units ON public.units;
CREATE POLICY delete_units ON public.units
FOR DELETE TO authenticated
USING (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);

-- Políticas: common_areas
DROP POLICY IF EXISTS select_common_areas ON public.common_areas;
CREATE POLICY select_common_areas ON public.common_areas
FOR SELECT TO authenticated
USING (
    public.is_superadmin() OR
    public.user_has_active_membership(condominium_id)
);

DROP POLICY IF EXISTS insert_common_areas ON public.common_areas;
CREATE POLICY insert_common_areas ON public.common_areas
FOR INSERT TO authenticated
WITH CHECK (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);

DROP POLICY IF EXISTS update_common_areas ON public.common_areas;
CREATE POLICY update_common_areas ON public.common_areas
FOR UPDATE TO authenticated
USING (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
)
WITH CHECK (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);

DROP POLICY IF EXISTS delete_common_areas ON public.common_areas;
CREATE POLICY delete_common_areas ON public.common_areas
FOR DELETE TO authenticated
USING (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);

-- ------------------------------------------------------------------------------
-- PARTE 4: MÓDULO FINANCEIRO (INVOICES / COBRANÇAS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    resident_name VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    due_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    paid_at TIMESTAMPTZ,
    pix_code TEXT,
    reminder_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_invoice_per_unit_cota UNIQUE (unit_id, description, due_date),
    CONSTRAINT paid_requires_paid_at CHECK (status <> 'paid' OR paid_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_invoices_condo_due ON public.invoices(condominium_id, due_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_condo_status ON public.invoices(condominium_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_unit ON public.invoices(unit_id);

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_invoices ON public.invoices;
CREATE POLICY select_invoices ON public.invoices
FOR SELECT TO authenticated
USING (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);

DROP POLICY IF EXISTS insert_invoices ON public.invoices;
CREATE POLICY insert_invoices ON public.invoices
FOR INSERT TO authenticated
WITH CHECK (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);

DROP POLICY IF EXISTS update_invoices ON public.invoices;
CREATE POLICY update_invoices ON public.invoices
FOR UPDATE TO authenticated
USING (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
)
WITH CHECK (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);

DROP POLICY IF EXISTS delete_invoices ON public.invoices;
CREATE POLICY delete_invoices ON public.invoices
FOR DELETE TO authenticated
USING (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);

-- ------------------------------------------------------------------------------
-- PARTE 5: MÓDULO DE MANUTENÇÃO (ORDENS DE SERVIÇO & CHAMADOS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.maintenance_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'Geral',
    description TEXT NOT NULL,
    priority VARCHAR(30) NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Prioridade Máxima', 'Média', 'Normal', 'Preventiva')),
    status VARCHAR(30) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'certified')),
    progress_percentage INT NOT NULL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
    scheduled_time VARCHAR(100) NOT NULL DEFAULT 'Horário Comercial',
    technician_name VARCHAR(255),
    technician_company VARCHAR(255),
    technician_initials VARCHAR(10),
    materials_reserved BOOLEAN NOT NULL DEFAULT false,
    has_certificate BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_orders_condo_created ON public.maintenance_orders(condominium_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_orders_condo_status ON public.maintenance_orders(condominium_id, status);
CREATE INDEX IF NOT EXISTS idx_maintenance_orders_condo_priority ON public.maintenance_orders(condominium_id, priority);

DROP TRIGGER IF EXISTS update_maintenance_orders_updated_at ON public.maintenance_orders;
CREATE TRIGGER update_maintenance_orders_updated_at
BEFORE UPDATE ON public.maintenance_orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.maintenance_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_maintenance_orders ON public.maintenance_orders;
CREATE POLICY select_maintenance_orders ON public.maintenance_orders
FOR SELECT TO authenticated
USING (
    public.is_superadmin() OR
    public.user_has_active_membership(condominium_id)
);

-- Síndico, Superadmin e Porteiro podem abrir chamados!
DROP POLICY IF EXISTS insert_maintenance_orders ON public.maintenance_orders;
CREATE POLICY insert_maintenance_orders ON public.maintenance_orders
FOR INSERT TO authenticated
WITH CHECK (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id) OR
    public.user_has_condo_role(condominium_id, ARRAY['porteiro']::VARCHAR[])
);

DROP POLICY IF EXISTS update_maintenance_orders ON public.maintenance_orders;
CREATE POLICY update_maintenance_orders ON public.maintenance_orders
FOR UPDATE TO authenticated
USING (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
)
WITH CHECK (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);

DROP POLICY IF EXISTS delete_maintenance_orders ON public.maintenance_orders;
CREATE POLICY delete_maintenance_orders ON public.maintenance_orders
FOR DELETE TO authenticated
USING (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);

-- ------------------------------------------------------------------------------
-- PARTE 6: RESERVAS DE ÁREAS COMUNS & REGISTRO DE ACESSOS (PORTARIA)
-- ------------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_amenity_reservations_condo_date ON public.amenity_reservations(condominium_id, date);
CREATE INDEX IF NOT EXISTS idx_amenity_reservations_space ON public.amenity_reservations(condominium_id, space_name, date);

DROP TRIGGER IF EXISTS update_amenity_reservations_updated_at ON public.amenity_reservations;
CREATE TRIGGER update_amenity_reservations_updated_at
BEFORE UPDATE ON public.amenity_reservations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

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

ALTER TABLE public.amenity_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros do condomínio podem ver reservas" ON public.amenity_reservations;
CREATE POLICY "Membros do condomínio podem ver reservas"
ON public.amenity_reservations FOR SELECT
USING (
    public.is_superadmin() OR
    public.user_has_active_membership(condominium_id)
);

DROP POLICY IF EXISTS "Membros ativos podem criar reservas" ON public.amenity_reservations;
CREATE POLICY "Membros ativos podem criar reservas"
ON public.amenity_reservations FOR INSERT
WITH CHECK (
    public.is_superadmin() OR
    public.user_has_active_membership(condominium_id)
);

DROP POLICY IF EXISTS "Síndicos e superadmins podem atualizar reservas" ON public.amenity_reservations;
CREATE POLICY "Síndicos e superadmins podem atualizar reservas"
ON public.amenity_reservations FOR UPDATE
USING (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);

DROP POLICY IF EXISTS "Síndicos e superadmins podem remover reservas" ON public.amenity_reservations;
CREATE POLICY "Síndicos e superadmins podem remover reservas"
ON public.amenity_reservations FOR DELETE
USING (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);

DROP POLICY IF EXISTS "Porteiros, síndicos e admins podem ver logs de acesso" ON public.access_logs;
CREATE POLICY "Porteiros, síndicos e admins podem ver logs de acesso"
ON public.access_logs FOR SELECT
USING (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id) OR
    public.user_has_condo_role(condominium_id, ARRAY['porteiro']::VARCHAR[])
);

DROP POLICY IF EXISTS "Porteiros, síndicos e admins podem registrar logs de acesso" ON public.access_logs;
CREATE POLICY "Porteiros, síndicos e admins podem registrar logs de acesso"
ON public.access_logs FOR INSERT
WITH CHECK (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id) OR
    public.user_has_condo_role(condominium_id, ARRAY['porteiro']::VARCHAR[])
);

-- ------------------------------------------------------------------------------
-- PARTE 7: POVOAMENTO (SEEDS: CONDOMÍNIO, ÁREAS, UNIDADES E USUÁRIOS DE TESTE)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_condo_id UUID;
    v_area_festas_id UUID;
    v_area_gourmet_id UUID;
    v_area_quadra_id UUID;
    v_unit_402_id UUID;
    v_unit_401_id UUID;
    v_unit_303_id UUID;
    v_unit_108_id UUID;
    v_unit_302_id UUID;
    v_unit_104_id UUID;
    v_encrypted_pw TEXT;
    
    -- IDs estáveis para usuários seed
    v_sindico_id UUID := '11111111-1111-4111-8111-111111111111';
    v_admin_id UUID := '22222222-2222-4222-8222-222222222222';
    v_porteiro_id UUID := '33333333-3333-4333-8333-333333333333';
    v_porteiro_teste_id UUID := '28297913-3de5-45c5-8b33-ec019c174d4c';
    v_morador_id UUID := '44444444-4444-4444-8444-444444444444';
    v_morador_teste_id UUID := '786e1481-818d-4161-93b2-db836b08f168';

    r_user RECORD;
BEGIN
    -- 1. Garante Condomínio Padrão
    SELECT id INTO v_condo_id FROM public.condominiums WHERE cnpj = '12.345.678/0001-90' LIMIT 1;
    IF v_condo_id IS NULL THEN
        INSERT INTO public.condominiums (id, name, cnpj, address, city, state)
        VALUES ('00000000-0000-0000-0000-000000000001', 'Residencial Imperial Tower', '12.345.678/0001-90', 'Av. Paulista, 1000 - Bela Vista', 'São Paulo', 'SP')
        RETURNING id INTO v_condo_id;
    END IF;

    -- 2. Garante Áreas Comuns Padrão
    INSERT INTO public.common_areas (condominium_id, name, description, active)
    VALUES 
        (v_condo_id, 'Salão de Festas Nobre (Bloco A)', 'Espaço climatizado para até 120 pessoas com acústica integrada.', true),
        (v_condo_id, 'Espaço Gourmet & Churrasqueira 01', 'Bancada em mármore, chopeira dupla e deck externo com pergolado.', true),
        (v_condo_id, 'Quadra de Tênis de Saibro', 'Iluminação LED esportiva e vestiários exclusivos.', true),
        (v_condo_id, 'Academia & Fitness Center', 'Equipamentos Life Fitness de última geração e sala de pilates.', true),
        (v_condo_id, 'Espaço Pet / Dog Park', 'Área cercada com pista de agility e gramado revitalizado.', true),
        (v_condo_id, 'Coworking & Reuniões', 'Estações individuais com internet gigabit e cabine acústica.', true)
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_area_festas_id FROM public.common_areas WHERE condominium_id = v_condo_id AND name LIKE 'Salão de Festas%' LIMIT 1;
    SELECT id INTO v_area_gourmet_id FROM public.common_areas WHERE condominium_id = v_condo_id AND name LIKE 'Espaço Gourmet%' LIMIT 1;
    SELECT id INTO v_area_quadra_id FROM public.common_areas WHERE condominium_id = v_condo_id AND name LIKE 'Quadra de Tênis%' LIMIT 1;

    -- 3. Garante Unidades Padrão
    INSERT INTO public.units (condominium_id, identifier, block, floor)
    VALUES 
        (v_condo_id, '402', 'Bloco A', 4),
        (v_condo_id, '401', 'Bloco A', 4),
        (v_condo_id, '303', 'Bloco A', 3),
        (v_condo_id, '108', 'Bloco B', 1),
        (v_condo_id, '302', 'Bloco B', 3),
        (v_condo_id, '104', 'Bloco A', 1)
    ON CONFLICT (condominium_id, block, identifier) DO NOTHING;

    SELECT id INTO v_unit_402_id FROM public.units WHERE condominium_id = v_condo_id AND block = 'Bloco A' AND identifier = '402' LIMIT 1;
    SELECT id INTO v_unit_401_id FROM public.units WHERE condominium_id = v_condo_id AND block = 'Bloco A' AND identifier = '401' LIMIT 1;
    SELECT id INTO v_unit_303_id FROM public.units WHERE condominium_id = v_condo_id AND block = 'Bloco A' AND identifier = '303' LIMIT 1;
    SELECT id INTO v_unit_108_id FROM public.units WHERE condominium_id = v_condo_id AND block = 'Bloco B' AND identifier = '108' LIMIT 1;
    SELECT id INTO v_unit_302_id FROM public.units WHERE condominium_id = v_condo_id AND block = 'Bloco B' AND identifier = '302' LIMIT 1;
    SELECT id INTO v_unit_104_id FROM public.units WHERE condominium_id = v_condo_id AND block = 'Bloco A' AND identifier = '104' LIMIT 1;

    -- Senha universal de teste: condor@2026
    v_encrypted_pw := crypt('condor@2026', gen_salt('bf'));

    -- 4. CRIAR / SINCRONIZAR USUÁRIOS NO AUTH.USERS E PUBLIC.USER_PROFILES
    FOR r_user IN 
        SELECT * FROM (
            VALUES 
                (v_sindico_id, 'sindico@condor.com.br', 'Dra. Patrícia Lima', '(11) 98765-4321', 'sindico', 'https://lh3.googleusercontent.com/aida-public/AB6AXuCcP2EM7PC3LJ-2tvwQdWRy4rZQHQfz32_v0HHn2ANWMg-BcuiRQgCTS3AsMkvhoYaTcH-I3azZMuXcowKAlf25CS3BVa5WIG7PXHBtH_9ptOqZJBwecSc-CShsf3tQACctQWqGXWl1GS7Bn95cYEubf_IEPUUzvlJ_wertPm0iXxxGASFB0WmV5nKuLcUOPwwMy2gn1vpEEXpUYVIHLw4THq1rGIi5WTlem19-6YXj88WVJd244wElMg'),
                (v_admin_id, 'admin@condor.com.br', 'Superadministrador Geral', '(11) 99999-9999', 'superadmin', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80'),
                (v_porteiro_id, 'porteiro@condor.com.br', 'Marcos Silva (Portaria)', '(11) 96543-2109', 'porteiro', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&auto=format&fit=crop&q=80'),
                (v_porteiro_teste_id, 'porteiro.teste@condor.com.br', 'Antônio Ferreira (Porteiro Teste)', '(11) 96543-2109', 'porteiro', NULL),
                (v_morador_id, 'morador@condor.com.br', 'Carlos Eduardo Oliveira', '(11) 97123-4567', 'morador', NULL),
                (v_morador_teste_id, 'morador.teste@condor.com.br', 'Carlos Oliveira (Morador Teste)', '(11) 97123-4567', 'morador', NULL)
        ) AS t(id, email, full_name, phone, role, avatar_url)
    LOOP
        -- Cria ou atualiza auth.users
        IF EXISTS (SELECT 1 FROM auth.users WHERE email = r_user.email) THEN
            UPDATE auth.users
            SET encrypted_password = v_encrypted_pw,
                email_confirmed_at = COALESCE(email_confirmed_at, now()),
                raw_user_meta_data = jsonb_build_object('full_name', r_user.full_name, 'role', r_user.role, 'phone', r_user.phone),
                updated_at = now()
            WHERE email = r_user.email;
            
            -- Recupera o id real caso já existisse com outro uuid
            SELECT id INTO r_user.id FROM auth.users WHERE email = r_user.email LIMIT 1;
        ELSE
            INSERT INTO auth.users (
                id, instance_id, email, encrypted_password, email_confirmed_at,
                raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
            ) VALUES (
                r_user.id,
                '00000000-0000-0000-0000-000000000000',
                r_user.email,
                v_encrypted_pw,
                now(),
                '{"provider":"email","providers":["email"]}',
                jsonb_build_object('full_name', r_user.full_name, 'role', r_user.role, 'phone', r_user.phone),
                now(),
                now(),
                'authenticated',
                'authenticated'
            );
        END IF;

        -- Garante perfil em public.user_profiles
        INSERT INTO public.user_profiles (id, full_name, phone, avatar_url)
        VALUES (r_user.id, r_user.full_name, r_user.phone, r_user.avatar_url)
        ON CONFLICT (id) DO UPDATE 
        SET full_name = EXCLUDED.full_name,
            phone = EXCLUDED.phone,
            avatar_url = COALESCE(EXCLUDED.avatar_url, public.user_profiles.avatar_url),
            updated_at = now();

        -- Garante vínculo e privilégio em public.condominium_members
        INSERT INTO public.condominium_members (condominium_id, user_id, role, status, log_access_granted)
        VALUES (v_condo_id, r_user.id, r_user.role, 'active', (r_user.role IN ('superadmin', 'sindico', 'porteiro')))
        ON CONFLICT (condominium_id, user_id) DO UPDATE 
        SET role = EXCLUDED.role,
            status = 'active',
            log_access_granted = EXCLUDED.log_access_granted,
            updated_at = now();
    END LOOP;

    -- 5. SEED: BOLETOS / COBRANÇAS FINANCEIRAS (Se vazio)
    IF NOT EXISTS (SELECT 1 FROM public.invoices WHERE condominium_id = v_condo_id) AND v_unit_402_id IS NOT NULL THEN
        INSERT INTO public.invoices (condominium_id, unit_id, resident_name, description, amount, due_date, status, pix_code)
        VALUES 
            (v_condo_id, v_unit_402_id, 'Carlos Eduardo Duarte', 'Cota Condominial Ordinária - Outubro/2026', 1450.00, '2026-10-10', 'pending', '00020126580014BR.GOV.BCB.PIX0136condor-pix-fake-key-40252040000530398654071450.005802BR5925Condominio Imperial6009Sao Paulo62070503***6304ABCD'),
            (v_condo_id, v_unit_401_id, 'Marina Albuquerque', 'Cota Condominial Ordinária - Outubro/2026', 1120.00, '2026-10-10', 'pending', '00020126580014BR.GOV.BCB.PIX0136condor-pix-fake-key-40152040000530398654071120.005802BR5925Condominio Imperial6009Sao Paulo62070503***6304BCDE'),
            (v_condo_id, v_unit_303_id, 'Rafael Cavalcanti', 'Cota Condominial Ordinária - Outubro/2026', 1310.00, CURRENT_DATE, 'pending', '00020126580014BR.GOV.BCB.PIX0136condor-pix-fake-key-30352040000530398654071310.005802BR5925Condominio Imperial6009Sao Paulo62070503***6304CDEF'),
            (v_condo_id, v_unit_108_id, 'Juliana Mendes Ramos', 'Cota Condominial Ordinária - Setembro/2026', 990.00, '2026-09-10', 'paid', NULL)
        ON CONFLICT DO NOTHING;
        
        -- Atualiza paid_at no boleto já pago
        UPDATE public.invoices 
        SET paid_at = '2026-09-08 14:32:00-03' 
        WHERE condominium_id = v_condo_id AND status = 'paid' AND paid_at IS NULL;
    END IF;

    -- 6. SEED: ORDENS DE SERVIÇO & MANUTENÇÃO (Se vazio)
    IF NOT EXISTS (SELECT 1 FROM public.maintenance_orders WHERE condominium_id = v_condo_id) THEN
        INSERT INTO public.maintenance_orders (
            condominium_id, code, title, location, category, description, priority, status, progress_percentage, scheduled_date, scheduled_time, technician_name, technician_company, technician_initials, materials_reserved, has_certificate
        ) VALUES 
            (v_condo_id, 'OS-2026-088', 'Manutenção Preventiva dos Elevadores Atlas', 'Torre Sol • Elevadores 01 e 02', 'Preventiva', 'Inspeção mensal de cabos de tração, sensores de nivelamento e lubrificação dos trilhos.', 'Prioridade Máxima', 'in_progress', 65, CURRENT_DATE, '09:00 - 13:00', 'Roberto Albuquerque', 'Atlas Schindler Elevadores', 'RA', true, true),
            (v_condo_id, 'OS-2026-089', 'Substituição de Lâmpadas LED do Subsolo 2', 'Garagem G-2 • Setores D e E', 'Elétrica', 'Troca de 18 luminárias tubulares fluorescentes por painéis LED 40W de alta eficiência.', 'Normal', 'scheduled', 0, CURRENT_DATE + INTERVAL '1 day', 'Horário Comercial', 'Marcos Elétrica ME', 'Marcos Prestadora', 'ME', true, false),
            (v_condo_id, 'OS-2026-085', 'Desobstrução e Limpeza da Calha de Drenagem', 'Cobertura Bloco A', 'Hidráulica', 'Remoção de folhas e sedimentos da calha central para prevenção de alagamento pluvial.', 'Média', 'completed', 100, CURRENT_DATE - INTERVAL '2 days', '14:00', 'Carlos Manutenções', 'Alpha Engenharia Predial', 'CM', true, true)
        ON CONFLICT DO NOTHING;
    END IF;

    -- 7. SEED: RESERVAS DE ESPAÇOS (Se vazio)
    IF NOT EXISTS (SELECT 1 FROM public.amenity_reservations WHERE condominium_id = v_condo_id) THEN
        INSERT INTO public.amenity_reservations (
            condominium_id, common_area_id, space_name, emoji, date, start_time, end_time, date_str, responsible_name, unit_number, rental_fee, status, status_type
        ) VALUES 
            (v_condo_id, v_area_festas_id, 'Salão de Festas Nobre (Bloco A)', '🎉', CURRENT_DATE + INTERVAL '3 days', '18:00', '23:30', 'Sexta-feira, 18:00 - 23:30', 'Carlos Eduardo Duarte', '402', 350.00, 'Aprovado / Taxa Paga', 'success'),
            (v_condo_id, v_area_gourmet_id, 'Espaço Gourmet & Churrasqueira 01', '🥩', CURRENT_DATE + INTERVAL '4 days', '11:00', '18:00', 'Sábado, 11:00 - 18:00', 'Marina Albuquerque', '401', 180.00, 'Aprovado / Taxa Paga', 'success'),
            (v_condo_id, v_area_quadra_id, 'Quadra de Tênis de Saibro', '🎾', CURRENT_DATE, '07:00', '09:00', 'Hoje, 07:00 - 09:00', 'Rafael Cavalcanti', '303', 0.00, 'Aprovado / Isento', 'info')
        ON CONFLICT DO NOTHING;
    END IF;

    -- 8. SEED: REGISTROS DE ACESSO / PORTARIA (Se vazio)
    IF NOT EXISTS (SELECT 1 FROM public.access_logs WHERE condominium_id = v_condo_id) THEN
        INSERT INTO public.access_logs (
            condominium_id, person_name, auth_type, auth_detail, access_point, destination, entry_type
        ) VALUES 
            (v_condo_id, 'Carlos E. Duarte', 'facial', 'BioSync Facial 99.8% • Aprovado', 'Catraca Principal 01', 'Apto 402 - Bloco A', 'Morador Residente'),
            (v_condo_id, 'Marina Albuquerque', 'facial', 'BioSync Facial 99.4% • Aprovado', 'Catraca Principal 01', 'Apto 401 - Bloco A', 'Morador Residente'),
            (v_condo_id, 'Entregador Mercado Livre (Lucas)', 'qr_code', 'QR Code Temporário • Aprovado', 'Eclusa de Pedestres 02', 'Smart Locker #08', 'Entrega Encomenda'),
            (v_condo_id, 'Roberto Albuquerque (Técnico Atlas)', 'manual', 'Documento RG verificado • OS-2026-088', 'Guarita Central', 'Casa de Máquinas / Elevadores', 'Prestador de Serviço')
        ON CONFLICT DO NOTHING;
    END IF;

    RAISE NOTICE '>>> IMPLANTAÇÃO CONDOR CONCLUÍDA COM SUCESSO! Condomínio ID: %', v_condo_id;
END $$;

-- ------------------------------------------------------------------------------
-- PARTE 8: CONSULTA DIAGNÓSTICA DE CONFIRMAÇÃO
-- ------------------------------------------------------------------------------
SELECT 
    'condominiums' AS tabela, count(*) AS total_registros FROM public.condominiums
UNION ALL
SELECT 'common_areas', count(*) FROM public.common_areas
UNION ALL
SELECT 'units', count(*) FROM public.units
UNION ALL
SELECT 'condominium_members', count(*) FROM public.condominium_members
UNION ALL
SELECT 'invoices', count(*) FROM public.invoices
UNION ALL
SELECT 'maintenance_orders', count(*) FROM public.maintenance_orders
UNION ALL
SELECT 'amenity_reservations', count(*) FROM public.amenity_reservations
UNION ALL
SELECT 'access_logs', count(*) FROM public.access_logs
UNION ALL
SELECT 'auth.users (cadastrados)', count(*) FROM auth.users WHERE email LIKE '%@condor.com.br';
