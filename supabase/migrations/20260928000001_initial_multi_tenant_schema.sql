-- ==============================================================================
-- CONDOR SAAS - SISTEMA DE ADMINISTRAÇÃO CONDOMINIAL
-- Migration 01: Initial Multi-tenant Schema
-- Created: 2026-09-28
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Helper function for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Condominiums Table
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

-- Index for searching and listing condominiums
CREATE INDEX IF NOT EXISTS idx_condominiums_name ON public.condominiums(name);
CREATE INDEX IF NOT EXISTS idx_condominiums_city_state ON public.condominiums(city, state);

CREATE TRIGGER update_condominiums_updated_at
BEFORE UPDATE ON public.condominiums
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 3. User Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_full_name ON public.user_profiles(full_name);

CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 4. Condominium Memberships (Multi-tenant Junction Table)
-- A user can belong to multiple condominiums with different roles
CREATE TABLE IF NOT EXISTS public.condominium_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('superadmin', 'sindico', 'morador', 'porteiro')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_condominium UNIQUE (condominium_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_condo_members_user ON public.condominium_members(user_id);
CREATE INDEX IF NOT EXISTS idx_condo_members_condo ON public.condominium_members(condominium_id);
CREATE INDEX IF NOT EXISTS idx_condo_members_status_role ON public.condominium_members(condominium_id, user_id, status, role);

CREATE TRIGGER update_condominium_members_updated_at
BEFORE UPDATE ON public.condominium_members
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 5. Units Table
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

CREATE TRIGGER update_units_updated_at
BEFORE UPDATE ON public.units
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 6. Common Areas Table
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

CREATE TRIGGER update_common_areas_updated_at
BEFORE UPDATE ON public.common_areas
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 7. Automatic User Profile Creation on Supabase Auth Sign Up
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
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger firing on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
