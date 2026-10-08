-- ==============================================================================
-- CONDOR SAAS - SISTEMA DE ADMINISTRAÇÃO CONDOMINIAL
-- Migration 03: Invoices (Cobranças & Boletos)
-- Created: 2026-10-05
-- ==============================================================================

-- 1. Invoices Table
-- "Em atraso" e "pago antecipado" NÃO são gravados: são derivados no app a partir
-- de status + due_date + paid_at, evitando jobs de atualização de status.
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
    -- Idempotência: reemitir o mesmo lote (mesma cota/vencimento) não duplica boletos
    CONSTRAINT unique_invoice_per_unit_cota UNIQUE (unit_id, description, due_date),
    -- Coerência: boleto pago precisa de data de pagamento
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

-- 2. Row Level Security
-- Dados financeiros: acesso restrito a síndico / superadmin do condomínio.
-- (Moradores só poderão ver seus próprios boletos quando existir o vínculo
--  membro <-> unidade; até lá, não expomos nenhum boleto a eles.)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_invoices ON public.invoices;
CREATE POLICY select_invoices ON public.invoices
FOR SELECT
TO authenticated
USING (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);

DROP POLICY IF EXISTS insert_invoices ON public.invoices;
CREATE POLICY insert_invoices ON public.invoices
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);

DROP POLICY IF EXISTS update_invoices ON public.invoices;
CREATE POLICY update_invoices ON public.invoices
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

DROP POLICY IF EXISTS delete_invoices ON public.invoices;
CREATE POLICY delete_invoices ON public.invoices
FOR DELETE
TO authenticated
USING (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);
