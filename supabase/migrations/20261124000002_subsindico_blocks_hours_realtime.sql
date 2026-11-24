-- ============================================================================
-- MIGRATION: 20261124000002_subsindico_blocks_hours_realtime.sql
-- 1. Privilégios granulares para Sub-Síndico (condominium_members.permissions)
-- 2. Gestão completa de Blocos/Torres por condomínio (condominiums.blocks + RPCs)
-- 3. Regras opcionais de limite de horário em Áreas Comuns e Condomínios
-- 4. Realtime (announcements & packages) + tabela push_subscriptions (PWA Push)
-- ============================================================================

ALTER TABLE public.condominium_members
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.condominiums
  ADD COLUMN IF NOT EXISTS blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS default_reservation_time_limit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_reservation_start_time VARCHAR(5) NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS default_reservation_end_time VARCHAR(5) NOT NULL DEFAULT '22:00';

UPDATE public.condominiums c
SET blocks = COALESCE(
  (
    SELECT jsonb_agg(b ORDER BY b)
    FROM (
      SELECT DISTINCT TRIM(u.block) AS b
      FROM public.units u
      WHERE u.condominium_id = c.id
        AND u.block IS NOT NULL
        AND TRIM(u.block) <> ''
    ) sub
  ),
  '[]'::jsonb
)
WHERE jsonb_typeof(c.blocks) <> 'array' OR jsonb_array_length(c.blocks) = 0;

ALTER TABLE public.common_areas
  ADD COLUMN IF NOT EXISTS enforce_time_limit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS available_start_time VARCHAR(5) NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS available_end_time VARCHAR(5) NOT NULL DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS max_duration_hours NUMERIC(4,1) DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.user_has_condo_permission(target_condo_id UUID, perm_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    public.is_superadmin()
    OR public.is_condo_admin(target_condo_id)
    OR EXISTS (
      SELECT 1
      FROM public.condominium_members cm
      WHERE cm.condominium_id = target_condo_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role = 'subsindico'
        AND COALESCE((cm.permissions ->> perm_key)::boolean, false) = true
    );
$$;

REVOKE ALL ON FUNCTION public.user_has_condo_permission(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_condo_permission(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.rename_condominium_block(
  target_condo_id UUID,
  old_block TEXT,
  new_block TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old TEXT := TRIM(COALESCE(old_block, ''));
  v_new TEXT := TRIM(COALESCE(new_block, ''));
  v_blocks JSONB;
  v_units_updated INT := 0;
BEGIN
  IF NOT public.user_has_condo_permission(target_condo_id, 'manage_units') THEN
    RAISE EXCEPTION 'Acesso negado: apenas Síndico, Super Administrador ou Sub-Síndico autorizado podem editar blocos.';
  END IF;

  IF v_old = '' OR v_new = '' THEN
    RAISE EXCEPTION 'Informe o nome atual e o novo nome do bloco.';
  END IF;

  IF LOWER(v_old) = LOWER(v_new) THEN
    UPDATE public.units SET block = v_new, updated_at = now()
     WHERE condominium_id = target_condo_id AND LOWER(TRIM(block)) = LOWER(v_old);
    GET DIAGNOSTICS v_units_updated = ROW_COUNT;
  ELSE
    IF EXISTS (
      SELECT 1
      FROM public.units u1
      JOIN public.units u2
        ON u1.condominium_id = u2.condominium_id
       AND LOWER(TRIM(u1.identifier)) = LOWER(TRIM(u2.identifier))
      WHERE u1.condominium_id = target_condo_id
        AND LOWER(TRIM(u1.block)) = LOWER(v_old)
        AND LOWER(TRIM(u2.block)) = LOWER(v_new)
    ) THEN
      RAISE EXCEPTION 'Já existem unidades com a mesma numeração no bloco de destino "%".', v_new;
    END IF;

    UPDATE public.units SET block = v_new, updated_at = now()
     WHERE condominium_id = target_condo_id AND LOWER(TRIM(block)) = LOWER(v_old);
    GET DIAGNOSTICS v_units_updated = ROW_COUNT;
  END IF;

  UPDATE public.condominium_members
     SET block = v_new, updated_at = now()
   WHERE condominium_id = target_condo_id AND LOWER(TRIM(block)) = LOWER(v_old);

  SELECT COALESCE(
    (
      SELECT jsonb_agg(val ORDER BY val)
      FROM (
        SELECT DISTINCT CASE WHEN LOWER(TRIM(elem)) = LOWER(v_old) THEN v_new ELSE TRIM(elem) END AS val
        FROM jsonb_array_elements_text(COALESCE(c.blocks, '[]'::jsonb)) elem
        UNION
        SELECT v_new
      ) s
      WHERE val <> ''
    ),
    jsonb_build_array(v_new)
  ) INTO v_blocks
  FROM public.condominiums c
  WHERE c.id = target_condo_id;

  UPDATE public.condominiums
     SET blocks = COALESCE(v_blocks, '[]'::jsonb), updated_at = now()
   WHERE id = target_condo_id;

  INSERT INTO public.audit_logs (condominium_id, actor_user_id, action, entity_table, entity_id, metadata)
  VALUES (
    target_condo_id,
    auth.uid(),
    'BLOCK_RENAMED',
    'condominiums',
    target_condo_id::text,
    jsonb_build_object('old_block', v_old, 'new_block', v_new, 'units_updated', v_units_updated)
  );

  RETURN jsonb_build_object('blocks', COALESCE(v_blocks, '[]'::jsonb), 'units_updated', v_units_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.rename_condominium_block(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_condominium_block(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_condominium_block(
  target_condo_id UUID,
  target_block TEXT,
  reassign_to_block TEXT DEFAULT NULL,
  delete_units BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target TEXT := TRIM(COALESCE(target_block, ''));
  v_reassign TEXT := TRIM(COALESCE(reassign_to_block, ''));
  v_units_count INT := 0;
  v_blocks JSONB;
BEGIN
  IF NOT public.user_has_condo_permission(target_condo_id, 'manage_units') THEN
    RAISE EXCEPTION 'Acesso negado: apenas Síndico, Super Administrador ou Sub-Síndico autorizado podem excluir blocos.';
  END IF;

  IF v_target = '' THEN
    RAISE EXCEPTION 'Informe o nome do bloco a ser removido.';
  END IF;

  SELECT count(*) INTO v_units_count
  FROM public.units
  WHERE condominium_id = target_condo_id
    AND LOWER(TRIM(block)) = LOWER(v_target);

  IF v_units_count > 0 THEN
    IF v_reassign <> '' AND LOWER(v_reassign) <> LOWER(v_target) THEN
      IF EXISTS (
        SELECT 1
        FROM public.units u1
        JOIN public.units u2
          ON u1.condominium_id = u2.condominium_id
         AND LOWER(TRIM(u1.identifier)) = LOWER(TRIM(u2.identifier))
        WHERE u1.condominium_id = target_condo_id
          AND LOWER(TRIM(u1.block)) = LOWER(v_target)
          AND LOWER(TRIM(u2.block)) = LOWER(v_reassign)
      ) THEN
        RAISE EXCEPTION 'Não foi possível mover as unidades: já existem números iguais em "%".', v_reassign;
      END IF;

      UPDATE public.units SET block = v_reassign, updated_at = now()
       WHERE condominium_id = target_condo_id AND LOWER(TRIM(block)) = LOWER(v_target);

      UPDATE public.condominium_members SET block = v_reassign, updated_at = now()
       WHERE condominium_id = target_condo_id AND LOWER(TRIM(block)) = LOWER(v_target);
    ELSIF delete_units THEN
      DELETE FROM public.units
       WHERE condominium_id = target_condo_id AND LOWER(TRIM(block)) = LOWER(v_target);
    ELSE
      RAISE EXCEPTION 'Este bloco possui % unidade(s) vinculada(s). Escolha outro bloco para mover as unidades ou confirme a exclusão das unidades do bloco.', v_units_count;
    END IF;
  END IF;

  SELECT COALESCE(
    (
      SELECT jsonb_agg(val ORDER BY val)
      FROM (
        SELECT DISTINCT TRIM(elem) AS val
        FROM jsonb_array_elements_text(COALESCE(c.blocks, '[]'::jsonb)) elem
        WHERE LOWER(TRIM(elem)) <> LOWER(v_target)
          AND TRIM(elem) <> ''
      ) s
    ),
    '[]'::jsonb
  ) INTO v_blocks
  FROM public.condominiums c
  WHERE c.id = target_condo_id;

  UPDATE public.condominiums
     SET blocks = COALESCE(v_blocks, '[]'::jsonb), updated_at = now()
   WHERE id = target_condo_id;

  INSERT INTO public.audit_logs (condominium_id, actor_user_id, action, entity_table, entity_id, metadata)
  VALUES (
    target_condo_id,
    auth.uid(),
    'BLOCK_DELETED',
    'condominiums',
    target_condo_id::text,
    jsonb_build_object('deleted_block', v_target, 'reassigned_to', NULLIF(v_reassign, ''), 'deleted_units', delete_units, 'affected_units', v_units_count)
  );

  RETURN jsonb_build_object('blocks', COALESCE(v_blocks, '[]'::jsonb), 'affected_units', v_units_count);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_condominium_block(UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_condominium_block(UUID, TEXT, TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_reservation_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requires_approval BOOLEAN := false;
BEGIN
  IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;

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

  IF v_requires_approval AND NOT public.user_has_condo_permission(NEW.condominium_id, 'manage_reservations') THEN
    NEW.status := 'Aguardando Aprovação do Síndico';
    NEW.status_type := 'warning';
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_reservation_approval() FROM PUBLIC, anon, authenticated;

ALTER POLICY insert_common_areas ON public.common_areas TO authenticated
  WITH CHECK (public.user_has_condo_permission(condominium_id, 'manage_common_areas'));
ALTER POLICY update_common_areas ON public.common_areas TO authenticated
  USING (public.user_has_condo_permission(condominium_id, 'manage_common_areas'))
  WITH CHECK (public.user_has_condo_permission(condominium_id, 'manage_common_areas'));
ALTER POLICY delete_common_areas ON public.common_areas TO authenticated
  USING (public.user_has_condo_permission(condominium_id, 'manage_common_areas'));

ALTER POLICY insert_announcements ON public.announcements TO authenticated
  WITH CHECK (public.user_has_condo_permission(condominium_id, 'manage_announcements'));
ALTER POLICY update_announcements ON public.announcements TO authenticated
  USING (public.user_has_condo_permission(condominium_id, 'manage_announcements'))
  WITH CHECK (public.user_has_condo_permission(condominium_id, 'manage_announcements'));
ALTER POLICY delete_announcements ON public.announcements TO authenticated
  USING (public.user_has_condo_permission(condominium_id, 'manage_announcements'));

ALTER POLICY update_amenity_reservations ON public.amenity_reservations TO authenticated
  USING (public.user_has_condo_permission(condominium_id, 'manage_reservations'))
  WITH CHECK (public.user_has_condo_permission(condominium_id, 'manage_reservations'));
ALTER POLICY delete_amenity_reservations ON public.amenity_reservations TO authenticated
  USING (
    public.user_has_condo_permission(condominium_id, 'manage_reservations')
    OR (public.user_has_active_membership(condominium_id) AND created_by = auth.uid())
  );

ALTER POLICY insert_maintenance_orders ON public.maintenance_orders TO authenticated
  WITH CHECK (
    public.user_has_condo_permission(condominium_id, 'manage_maintenance')
    OR public.user_has_condo_role(condominium_id, ARRAY['porteiro']::VARCHAR[])
  );
ALTER POLICY update_maintenance_orders ON public.maintenance_orders TO authenticated
  USING (
    public.user_has_condo_permission(condominium_id, 'manage_maintenance')
    OR public.user_has_condo_role(condominium_id, ARRAY['porteiro']::VARCHAR[])
  )
  WITH CHECK (
    public.user_has_condo_permission(condominium_id, 'manage_maintenance')
    OR public.user_has_condo_role(condominium_id, ARRAY['porteiro']::VARCHAR[])
  );
ALTER POLICY delete_maintenance_orders ON public.maintenance_orders TO authenticated
  USING (public.user_has_condo_permission(condominium_id, 'manage_maintenance'));

ALTER POLICY select_units ON public.units TO authenticated
  USING (
    public.is_superadmin()
    OR public.user_has_condo_role(condominium_id, ARRAY['sindico', 'porteiro']::VARCHAR[])
    OR public.user_has_condo_permission(condominium_id, 'manage_units')
    OR public.user_has_condo_permission(condominium_id, 'manage_concierge')
    OR public.user_has_condo_permission(condominium_id, 'view_finance')
    OR EXISTS (
      SELECT 1 FROM public.condominium_members cm
      WHERE cm.condominium_id = units.condominium_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND (
          cm.unit_id = units.id
          OR (cm.unit_number IS NOT NULL AND LOWER(TRIM(cm.unit_number)) = LOWER(TRIM(units.identifier)))
        )
    )
  );
ALTER POLICY insert_units ON public.units TO authenticated
  WITH CHECK (public.user_has_condo_permission(condominium_id, 'manage_units'));
ALTER POLICY update_units ON public.units TO authenticated
  USING (public.user_has_condo_permission(condominium_id, 'manage_units'))
  WITH CHECK (public.user_has_condo_permission(condominium_id, 'manage_units'));
ALTER POLICY delete_units ON public.units TO authenticated
  USING (public.user_has_condo_permission(condominium_id, 'manage_units'));

ALTER POLICY select_invoices ON public.invoices TO authenticated
  USING (
    public.user_has_condo_permission(condominium_id, 'view_finance')
    OR EXISTS (
      SELECT 1 FROM public.condominium_members cm
      WHERE cm.condominium_id = invoices.condominium_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.unit_id = invoices.unit_id
    )
  );
ALTER POLICY insert_invoices ON public.invoices TO authenticated
  WITH CHECK (public.user_has_condo_permission(condominium_id, 'view_finance'));
ALTER POLICY update_invoices ON public.invoices TO authenticated
  USING (public.user_has_condo_permission(condominium_id, 'view_finance'))
  WITH CHECK (public.user_has_condo_permission(condominium_id, 'view_finance'));
ALTER POLICY delete_invoices ON public.invoices TO authenticated
  USING (public.user_has_condo_permission(condominium_id, 'view_finance'));

ALTER POLICY select_operational_expenses ON public.operational_expenses TO authenticated
  USING (public.user_has_condo_permission(condominium_id, 'view_finance'));
ALTER POLICY insert_operational_expenses ON public.operational_expenses TO authenticated
  WITH CHECK (public.user_has_condo_permission(condominium_id, 'view_finance'));
ALTER POLICY update_operational_expenses ON public.operational_expenses TO authenticated
  USING (public.user_has_condo_permission(condominium_id, 'view_finance'))
  WITH CHECK (public.user_has_condo_permission(condominium_id, 'view_finance'));
ALTER POLICY delete_operational_expenses ON public.operational_expenses TO authenticated
  USING (public.user_has_condo_permission(condominium_id, 'view_finance'));

ALTER POLICY select_condo_financial_config ON public.condominium_financial_config TO authenticated
  USING (public.user_has_condo_permission(condominium_id, 'view_finance'));
ALTER POLICY insert_condo_financial_config ON public.condominium_financial_config TO authenticated
  WITH CHECK (public.user_has_condo_permission(condominium_id, 'view_finance'));
ALTER POLICY update_condo_financial_config ON public.condominium_financial_config TO authenticated
  USING (public.user_has_condo_permission(condominium_id, 'view_finance'))
  WITH CHECK (public.user_has_condo_permission(condominium_id, 'view_finance'));
ALTER POLICY delete_condo_financial_config ON public.condominium_financial_config TO authenticated
  USING (public.user_has_condo_permission(condominium_id, 'view_finance'));

ALTER POLICY select_packages ON public.packages TO authenticated
  USING (
    public.user_has_condo_permission(condominium_id, 'manage_concierge')
    OR public.user_has_condo_role(condominium_id, ARRAY['porteiro']::VARCHAR[])
    OR EXISTS (
      SELECT 1 FROM public.condominium_members cm
      WHERE cm.condominium_id = packages.condominium_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND (
          (cm.unit_id IS NOT NULL AND cm.unit_id = packages.unit_id)
          OR (cm.unit_number IS NOT NULL AND packages.unit_number ILIKE ('%' || TRIM(cm.unit_number) || '%'))
        )
    )
  );
ALTER POLICY insert_packages ON public.packages TO authenticated
  WITH CHECK (
    public.user_has_condo_permission(condominium_id, 'manage_concierge')
    OR public.user_has_condo_role(condominium_id, ARRAY['porteiro']::VARCHAR[])
  );
ALTER POLICY update_packages ON public.packages TO authenticated
  USING (
    public.user_has_condo_permission(condominium_id, 'manage_concierge')
    OR public.user_has_condo_role(condominium_id, ARRAY['porteiro']::VARCHAR[])
  )
  WITH CHECK (
    public.user_has_condo_permission(condominium_id, 'manage_concierge')
    OR public.user_has_condo_role(condominium_id, ARRAY['porteiro']::VARCHAR[])
  );
ALTER POLICY delete_packages ON public.packages TO authenticated
  USING (
    public.user_has_condo_permission(condominium_id, 'manage_concierge')
    OR public.user_has_condo_role(condominium_id, ARRAY['porteiro']::VARCHAR[])
  );

ALTER POLICY select_access_logs ON public.access_logs TO authenticated
  USING (
    public.user_has_condo_permission(condominium_id, 'manage_concierge')
    OR public.user_has_condo_role(condominium_id, ARRAY['porteiro']::VARCHAR[])
    OR EXISTS (
      SELECT 1 FROM public.condominium_members cm
      WHERE cm.condominium_id = access_logs.condominium_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.log_access_granted = true
    )
  );
ALTER POLICY insert_access_logs ON public.access_logs TO authenticated
  WITH CHECK (
    public.user_has_condo_permission(condominium_id, 'manage_concierge')
    OR public.user_has_condo_role(condominium_id, ARRAY['porteiro']::VARCHAR[])
    OR (public.user_has_active_membership(condominium_id) AND auth_type = 'qr_code' AND entry_type = 'Convidado QR Válido')
  );

ALTER POLICY select_audit_logs ON public.audit_logs TO authenticated
  USING (
    public.is_superadmin()
    OR (condominium_id IS NOT NULL AND public.user_has_condo_permission(condominium_id, 'view_audit'))
  );

ALTER POLICY select_user_profiles ON public.user_profiles TO authenticated
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
        AND my_m.role IN ('sindico', 'subsindico', 'porteiro', 'superadmin')
        AND their_m.user_id = public.user_profiles.id
        AND their_m.status = 'active'
    )
  );

ALTER POLICY insert_condominium_members ON public.condominium_members TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR (
      public.is_condo_admin(condominium_id)
      AND user_id <> auth.uid()
      AND role IN ('sindico', 'subsindico', 'morador', 'porteiro')
    )
  );

ALTER POLICY update_condominium_members ON public.condominium_members TO authenticated
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
      AND role IN ('sindico', 'subsindico', 'morador', 'porteiro')
    )
  );

ALTER POLICY update_condominiums ON public.condominiums TO authenticated
  USING (public.user_has_condo_permission(id, 'manage_units'))
  WITH CHECK (public.user_has_condo_permission(id, 'manage_units'));

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT,
  auth_key TEXT,
  user_agent TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, condominium_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_condo ON public.push_subscriptions(condominium_id, enabled);

CREATE OR REPLACE TRIGGER trg_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_push_subscriptions ON public.push_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_superadmin() OR public.is_condo_admin(condominium_id));
CREATE POLICY insert_push_subscriptions ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (public.is_superadmin() OR public.user_has_active_membership(condominium_id)));
CREATE POLICY update_push_subscriptions ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY delete_push_subscriptions ON public.push_subscriptions FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_superadmin());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'announcements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'packages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.packages;
  END IF;
END $$;
