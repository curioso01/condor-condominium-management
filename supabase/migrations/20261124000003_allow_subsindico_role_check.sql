-- ============================================================================
-- MIGRATION: 20261124000003_allow_subsindico_role_check.sql
-- Amplia a constraint de papel em public.condominium_members para suportar 'subsindico'.
-- ============================================================================

ALTER TABLE public.condominium_members
  DROP CONSTRAINT IF EXISTS condominium_members_role_check,
  ADD CONSTRAINT condominium_members_role_check
    CHECK (role::text = ANY (ARRAY['superadmin'::character varying, 'sindico'::character varying, 'subsindico'::character varying, 'morador'::character varying, 'porteiro'::character varying]::text[]));
