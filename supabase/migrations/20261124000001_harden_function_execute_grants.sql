-- ============================================================================
-- MIGRATION: 20261124000001_harden_function_execute_grants.sql
-- DESCRIÇÃO: Endurecimento de search_path em update_updated_at_column() e
--            revogação de privilégios EXECUTE para anon/PUBLIC em funções
--            SECURITY DEFINER expostas no schema public.
-- ============================================================================

ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- Funções exclusivas de trigger não precisam ser executáveis via RPC por anon/authenticated
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_reservation_approval() FROM PUBLIC, anon, authenticated;

-- Funções auxiliares de RLS e RPC autenticada: revogar acesso anônimo, manter apenas authenticated
REVOKE ALL ON FUNCTION public.is_superadmin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;

REVOKE ALL ON FUNCTION public.is_condo_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_condo_admin(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.user_has_active_membership(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_active_membership(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.user_has_condo_role(UUID, VARCHAR[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_condo_role(UUID, VARCHAR[]) TO authenticated;

REVOKE ALL ON FUNCTION public.resolve_user_by_email(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_user_by_email(TEXT) TO authenticated;
