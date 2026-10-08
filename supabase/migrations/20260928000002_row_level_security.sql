-- ==============================================================================
-- CONDOR SAAS - SISTEMA DE ADMINISTRAÇÃO CONDOMINIAL
-- Migration 02: Row Level Security (RLS) & Multi-tenant Isolation
-- Created: 2026-09-28
-- ==============================================================================

-- 1. Enable Row Level Security on all core tables
ALTER TABLE public.condominiums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condominium_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.common_areas ENABLE ROW LEVEL SECURITY;

-- 2. Helper Security Functions (SECURITY DEFINER with strict search_path)
-- These prevent infinite recursion in RLS subqueries

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

-- ==============================================================================
-- 3. POLICIES: user_profiles
-- ==============================================================================

-- SELECT: Users can view their own profile, OR profiles of co-members in shared active condominiums
CREATE POLICY select_user_profiles ON public.user_profiles
FOR SELECT
TO authenticated
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

-- INSERT: Only the authenticated user can create their own profile
CREATE POLICY insert_user_profiles ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (
    id = auth.uid()
);

-- UPDATE: Users can only update their own profile
CREATE POLICY update_user_profiles ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- DELETE: Users can delete their own profile or platform superadmin
CREATE POLICY delete_user_profiles ON public.user_profiles
FOR DELETE
TO authenticated
USING (
    id = auth.uid() OR public.is_superadmin()
);

-- ==============================================================================
-- 4. POLICIES: condominiums
-- ==============================================================================

-- SELECT: Members can only see condominiums where they have active membership
CREATE POLICY select_condominiums ON public.condominiums
FOR SELECT
TO authenticated
USING (
    public.is_superadmin() OR
    public.user_has_active_membership(id)
);

-- INSERT: Controlled creation (only superadmin or platform onboarding)
CREATE POLICY insert_condominiums ON public.condominiums
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_superadmin()
);

-- UPDATE: Only síndico of that condominium or platform superadmin
CREATE POLICY update_condominiums ON public.condominiums
FOR UPDATE
TO authenticated
USING (
    public.is_condo_admin(id)
)
WITH CHECK (
    public.is_condo_admin(id)
);

-- DELETE: Only platform superadmin can delete a condominium
CREATE POLICY delete_condominiums ON public.condominiums
FOR DELETE
TO authenticated
USING (
    public.is_superadmin()
);

-- ==============================================================================
-- 5. POLICIES: condominium_members (Anti-Privilege Escalation)
-- ==============================================================================

-- SELECT: Users see their own memberships, or condo admins/porteiros see condo roster
CREATE POLICY select_condominium_members ON public.condominium_members
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id) OR
    public.user_has_condo_role(condominium_id, ARRAY['porteiro']::VARCHAR[])
);

-- INSERT: Only síndico or superadmin can add members. Users CANNOT self-assign.
CREATE POLICY insert_condominium_members ON public.condominium_members
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);

-- UPDATE: Only síndico or superadmin. Prevents self-promotion (cannot update own role).
CREATE POLICY update_condominium_members ON public.condominium_members
FOR UPDATE
TO authenticated
USING (
    public.is_superadmin() OR
    (public.is_condo_admin(condominium_id) AND user_id <> auth.uid())
)
WITH CHECK (
    public.is_superadmin() OR
    (public.is_condo_admin(condominium_id) AND user_id <> auth.uid())
);

-- DELETE: Only síndico or superadmin. Cannot delete own administrative membership.
CREATE POLICY delete_condominium_members ON public.condominium_members
FOR DELETE
TO authenticated
USING (
    public.is_superadmin() OR
    (public.is_condo_admin(condominium_id) AND user_id <> auth.uid())
);

-- ==============================================================================
-- 6. POLICIES: units
-- ==============================================================================

-- SELECT: Any active member of the condominium can view units
CREATE POLICY select_units ON public.units
FOR SELECT
TO authenticated
USING (
    public.is_superadmin() OR
    public.user_has_active_membership(condominium_id)
);

-- INSERT: Only síndico or superadmin can register units
CREATE POLICY insert_units ON public.units
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);

-- UPDATE: Only síndico or superadmin can update units
CREATE POLICY update_units ON public.units
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

-- DELETE: Only síndico or superadmin can delete units
CREATE POLICY delete_units ON public.units
FOR DELETE
TO authenticated
USING (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);

-- ==============================================================================
-- 7. POLICIES: common_areas
-- ==============================================================================

-- SELECT: Any active member can view common areas
CREATE POLICY select_common_areas ON public.common_areas
FOR SELECT
TO authenticated
USING (
    public.is_superadmin() OR
    public.user_has_active_membership(condominium_id)
);

-- INSERT / UPDATE / DELETE: Only síndico or superadmin
CREATE POLICY insert_common_areas ON public.common_areas
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);

CREATE POLICY update_common_areas ON public.common_areas
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

CREATE POLICY delete_common_areas ON public.common_areas
FOR DELETE
TO authenticated
USING (
    public.is_superadmin() OR
    public.is_condo_admin(condominium_id)
);
