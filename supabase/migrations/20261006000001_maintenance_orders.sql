-- ==============================================================================
-- CONDOR SAAS - SISTEMA DE ADMINISTRAÇÃO CONDOMINIAL
-- Migration 04: Maintenance Orders (Ordens de Serviço & Chamados)
-- Created: 2026-10-06
-- ==============================================================================

-- 1. Maintenance Orders Table
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

-- Índices para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_maintenance_orders_condo_created ON public.maintenance_orders(condominium_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_orders_condo_status ON public.maintenance_orders(condominium_id, status);
CREATE INDEX IF NOT EXISTS idx_maintenance_orders_condo_priority ON public.maintenance_orders(condominium_id, priority);

-- Trigger de atualização de updated_at
DROP TRIGGER IF EXISTS update_maintenance_orders_updated_at ON public.maintenance_orders;
CREATE TRIGGER update_maintenance_orders_updated_at
BEFORE UPDATE ON public.maintenance_orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 2. Row Level Security
ALTER TABLE public.maintenance_orders ENABLE ROW LEVEL SECURITY;

-- Qualquer membro ativo do condomínio (incluindo moradores e porteiros) pode visualizar chamados
DROP POLICY IF EXISTS select_maintenance_orders ON public.maintenance_orders;
CREATE POLICY select_maintenance_orders ON public.maintenance_orders
FOR SELECT
TO authenticated
USING (
    public.is_superadmin() OR
    public.user_has_active_membership(condominium_id)
);

-- Apenas síndico / superadmin pode criar ordens de serviço
DROP POLICY IF EXISTS insert_maintenance_orders ON public.maintenance_orders;
CREATE POLICY insert_maintenance_orders ON public.maintenance_orders
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);

-- Apenas síndico / superadmin pode atualizar ordens de serviço
DROP POLICY IF EXISTS update_maintenance_orders ON public.maintenance_orders;
CREATE POLICY update_maintenance_orders ON public.maintenance_orders
FOR UPDATE
TO authenticated
USING (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
)
WITH CHECK (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);

-- Apenas síndico / superadmin pode excluir ordens de serviço
DROP POLICY IF EXISTS delete_maintenance_orders ON public.maintenance_orders;
CREATE POLICY delete_maintenance_orders ON public.maintenance_orders
FOR DELETE
TO authenticated
USING (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);
