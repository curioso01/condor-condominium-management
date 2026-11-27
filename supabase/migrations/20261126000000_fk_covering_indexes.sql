-- =============================================================================
-- CONDOR — ÍNDICES DE CHAVE ESTRANGEIRA & HARDENING DE PERFORMANCE
-- Projeto exclusivo: CondoGest SaaS (hbxyzdqshjztunjlduvg)
-- Elimina os 11 alertas de foreign keys sem índice detectados pelo Supabase Advisor
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_amenity_reservations_approved_by ON public.amenity_reservations (approved_by);
CREATE INDEX IF NOT EXISTS idx_amenity_reservations_common_area_id ON public.amenity_reservations (common_area_id);
CREATE INDEX IF NOT EXISTS idx_amenity_reservations_created_by ON public.amenity_reservations (created_by);
CREATE INDEX IF NOT EXISTS idx_announcements_author_user_id ON public.announcements (author_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON public.audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_condominium_bank_settings_updated_by ON public.condominium_bank_settings (updated_by);
CREATE INDEX IF NOT EXISTS idx_condominium_members_unit_id ON public.condominium_members (unit_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_consents_condominium_id ON public.lgpd_consents (condominium_id);
CREATE INDEX IF NOT EXISTS idx_packages_created_by ON public.packages (created_by);
CREATE INDEX IF NOT EXISTS idx_packages_unit_id ON public.packages (unit_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets (user_id);
