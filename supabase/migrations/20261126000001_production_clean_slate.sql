-- =============================================================================
-- CONDOR — LIMPEZA COMPLETA PARA ENTREGA EM PRODUÇÃO (GO-LIVE CLIENTE)
-- Projeto exclusivo: CondoGest SaaS (hbxyzdqshjztunjlduvg)
-- =============================================================================
-- O que este script faz com 100% de segurança:
-- 1. Remove TODOS os registros fictícios e de teste das tabelas operacionais
--    (acessos, encomendas, reservas, áreas comuns fictícias, boletos de teste,
--    despesas, ordens de serviço, comunicados, unidades fictícias, logs de teste).
-- 2. Remove as 6 contas de teste (morador.teste, porteiro.teste, sindico.teste,
--    sindico, porteiro, morador @condor.com.br) de public e auth.users.
-- 3. PRESERVA intacto o Superadministrador oficial (admin@condor.com.br) e seu
--    vínculo superadmin no condomínio base (redefinido para "Condomínio Principal",
--    sem CNPJ/endereço fictício), pronto para cadastrar os dados reais da cliente!
-- =============================================================================

BEGIN;

-- Trava de segurança: garante que estamos no schema do Condor antes de qualquer ação
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'condominium_members'
  ) THEN
    RAISE EXCEPTION 'Abortado: este banco não pertence ao schema do Condor!';
  END IF;
END $$;

-- 1. Limpar tabelas operacionais (ordem respeitando Foreign Keys)
DELETE FROM public.access_logs;
DELETE FROM public.packages;
DELETE FROM public.amenity_reservations;
DELETE FROM public.common_areas;
DELETE FROM public.invoices;
DELETE FROM public.operational_expenses;
DELETE FROM public.condominium_financial_config;
DELETE FROM public.condominium_bank_settings;
DELETE FROM public.maintenance_orders;
DELETE FROM public.announcements;
DELETE FROM public.support_tickets;
DELETE FROM public.lgpd_consents;
DELETE FROM public.push_subscriptions;
DELETE FROM public.audit_logs;

-- Desvincular unit_id de membros antes de limpar unidades fictícias
UPDATE public.condominium_members SET unit_id = NULL WHERE unit_id IS NOT NULL;
DELETE FROM public.units;

-- 2. Redefinir o condomínio inicial removendo o nome/CNPJ fictício ("Residencial Imperial Tower")
UPDATE public.condominiums
SET
  name = 'Condomínio Principal',
  cnpj = NULL,
  address = NULL,
  city = 'Rio de Janeiro',
  state = 'RJ',
  blocks = '["Bloco A"]'::jsonb,
  default_reservation_time_limit = false,
  default_reservation_start_time = '08:00',
  default_reservation_end_time = '22:00',
  updated_at = NOW()
WHERE id = '5a8d7ae3-dadc-46bd-8f53-62d97631f69c';

-- 3. Remover exclusivamente os 6 usuários de homologação/teste, preservando admin@condor.com.br
DELETE FROM public.condominium_members
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN (
    'morador.teste@condor.com.br',
    'porteiro.teste@condor.com.br',
    'sindico.teste@condor.com.br',
    'sindico@condor.com.br',
    'porteiro@condor.com.br',
    'morador@condor.com.br'
  )
);

DELETE FROM public.user_profiles
WHERE email IN (
  'morador.teste@condor.com.br',
  'porteiro.teste@condor.com.br',
  'sindico.teste@condor.com.br',
  'sindico@condor.com.br',
  'porteiro@condor.com.br',
  'morador@condor.com.br'
);

DELETE FROM auth.identities
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN (
    'morador.teste@condor.com.br',
    'porteiro.teste@condor.com.br',
    'sindico.teste@condor.com.br',
    'sindico@condor.com.br',
    'porteiro@condor.com.br',
    'morador@condor.com.br'
  )
);

DELETE FROM auth.users
WHERE email IN (
  'morador.teste@condor.com.br',
  'porteiro.teste@condor.com.br',
  'sindico.teste@condor.com.br',
  'sindico@condor.com.br',
  'porteiro@condor.com.br',
  'morador@condor.com.br'
);

-- 4. Limpar avatar fictício (Unsplash) caso exista no perfil do Superadmin
UPDATE public.user_profiles
SET
  full_name = 'Administrador Geral Condor',
  phone = '(21) 99817-6963',
  avatar_url = NULL,
  updated_at = NOW()
WHERE email = 'admin@condor.com.br';

COMMIT;
