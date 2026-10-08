-- ==============================================================================
-- CONDOR SAAS - SEED DE USUÁRIOS DE TESTE NO SUPABASE (MORADOR & PORTEIRO)
-- Data: 2026-10-08
-- Executa no Supabase SQL Editor para garantir persistência completa e ativação.
-- ==============================================================================

-- 1. Garante que as extensões necessárias estejam ativas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Garante o condomínio padrão (Residencial Imperial Tower)
DO $$
DECLARE
    v_condo_id UUID;
    v_morador_id UUID := '786e1481-818d-4161-93b2-db836b08f168';
    v_porteiro_id UUID := '28297913-3de5-45c5-8b33-ec019c174d4c';
    v_encrypted_pw TEXT;
BEGIN
    -- Obter ou criar condomínio padrão
    SELECT id INTO v_condo_id FROM public.condominiums WHERE cnpj = '12.345.678/0001-90' LIMIT 1;
    IF v_condo_id IS NULL THEN
        INSERT INTO public.condominiums (name, cnpj, address, city, state)
        VALUES ('Residencial Imperial Tower', '12.345.678/0001-90', 'Av. Paulista, 1000', 'São Paulo', 'SP')
        RETURNING id INTO v_condo_id;
    END IF;

    -- Senha criptografada padrão: condor@2026
    v_encrypted_pw := crypt('condor@2026', gen_salt('bf'));

    -- 3. CADASTRO DE MORADOR NO SUPABASE AUTH (auth.users)
    -- Se o usuário já foi criado via API, atualizamos a confirmação de e-mail e senha
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'morador.teste@condor.com.br') THEN
        UPDATE auth.users
        SET encrypted_password = v_encrypted_pw,
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            raw_user_meta_data = jsonb_build_object('full_name', 'Carlos Oliveira (Morador Teste)', 'role', 'morador'),
            updated_at = now()
        WHERE email = 'morador.teste@condor.com.br'
        RETURNING id INTO v_morador_id;
    ELSE
        INSERT INTO auth.users (
            id, instance_id, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
        ) VALUES (
            v_morador_id,
            '00000000-0000-0000-0000-000000000000',
            'morador.teste@condor.com.br',
            v_encrypted_pw,
            now(),
            '{"provider":"email","providers":["email"]}',
            '{"full_name":"Carlos Oliveira (Morador Teste)","role":"morador"}',
            now(),
            now(),
            'authenticated',
            'authenticated'
        );
    END IF;

    -- 4. CADASTRO DE PORTEIRO NO SUPABASE AUTH (auth.users)
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'porteiro.teste@condor.com.br') THEN
        UPDATE auth.users
        SET encrypted_password = v_encrypted_pw,
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            raw_user_meta_data = jsonb_build_object('full_name', 'Antônio Ferreira (Porteiro Teste)', 'role', 'porteiro'),
            updated_at = now()
        WHERE email = 'porteiro.teste@condor.com.br'
        RETURNING id INTO v_porteiro_id;
    ELSE
        INSERT INTO auth.users (
            id, instance_id, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
        ) VALUES (
            v_porteiro_id,
            '00000000-0000-0000-0000-000000000000',
            'porteiro.teste@condor.com.br',
            v_encrypted_pw,
            now(),
            '{"provider":"email","providers":["email"]}',
            '{"full_name":"Antônio Ferreira (Porteiro Teste)","role":"porteiro"}',
            now(),
            now(),
            'authenticated',
            'authenticated'
        );
    END IF;

    -- 5. PERFIL DE USUÁRIO (public.user_profiles)
    INSERT INTO public.user_profiles (id, full_name, phone, avatar_url)
    VALUES 
        (v_morador_id, 'Carlos Oliveira (Morador Teste)', '(11) 97123-4567', NULL),
        (v_porteiro_id, 'Antônio Ferreira (Porteiro Teste)', '(11) 96543-2109', NULL)
    ON CONFLICT (id) DO UPDATE 
    SET full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        updated_at = now();

    -- 6. VÍNCULOS CONDOMINIAIS E PRIVILÉGIOS (public.condominium_members)
    -- Morador: Apenas visualiza suas unidades, boletos e reservas. Não tem acesso a cadastros.
    INSERT INTO public.condominium_members (condominium_id, user_id, role, status)
    VALUES (v_condo_id, v_morador_id, 'morador', 'active')
    ON CONFLICT (condominium_id, user_id) DO UPDATE 
    SET role = 'morador',
        status = 'active',
        updated_at = now();

    -- Porteiro: Acesso à portaria, câmeras, registros e encomendas. Não tem acesso a cadastros/privilégios.
    INSERT INTO public.condominium_members (condominium_id, user_id, role, status)
    VALUES (v_condo_id, v_porteiro_id, 'porteiro', 'active')
    ON CONFLICT (condominium_id, user_id) DO UPDATE 
    SET role = 'porteiro',
        status = 'active',
        updated_at = now();

    RAISE NOTICE 'Usuários de teste configurados com sucesso no Supabase! Condomínio ID: %, Morador ID: %, Porteiro ID: %',
        v_condo_id, v_morador_id, v_porteiro_id;
END $$;
