-- ==============================================================================
-- CONDOR SAAS - SEED DE USUÁRIOS DE TESTE NO SUPABASE (SÍNDICO, MORADOR & PORTEIRO)
-- Compatível com Supabase Auth (GoTrue) — inclui tokens vazios ('') e auth.identities.
-- Execute APENAS no SQL Editor do projeto de HOMOLOGAÇÃO (STAGING).
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
    v_condo_id UUID;
    v_sindico_id UUID := '116e1481-818d-4161-93b2-db836b08f160';
    v_morador_id UUID := '786e1481-818d-4161-93b2-db836b08f168';
    v_porteiro_id UUID := '28297913-3de5-45c5-8b33-ec019c174d4c';
    v_encrypted_pw TEXT;
    -- ATENÇÃO: Altere a senha abaixo para a senha temporária desejada em STAGING antes de executar.
    v_plain_password TEXT := 'DEFINIR_SENHA_TEMPORARIA_STAGING';
BEGIN
    IF v_plain_password = 'DEFINIR_SENHA_TEMPORARIA_STAGING' THEN
        RAISE EXCEPTION 'Defina uma senha temporária em v_plain_password antes de executar este seed.';
    END IF;

    -- 1. Obter condomínio existente (Residencial Imperial Tower) ou criar
    SELECT id INTO v_condo_id FROM public.condominiums ORDER BY created_at ASC LIMIT 1;
    IF v_condo_id IS NULL THEN
        INSERT INTO public.condominiums (name, cnpj, address, city, state)
        VALUES ('Residencial Imperial Tower', '12.345.678/0001-90', 'Av. Paulista, 1000', 'São Paulo', 'SP')
        RETURNING id INTO v_condo_id;
    END IF;

    v_encrypted_pw := crypt(v_plain_password, gen_salt('bf'));

    -- 2. SÍNDICO DE TESTE (sindico.teste@condor.com.br)
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'sindico.teste@condor.com.br') THEN
        UPDATE auth.users
        SET encrypted_password = v_encrypted_pw,
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            confirmation_token = COALESCE(confirmation_token, ''),
            recovery_token = COALESCE(recovery_token, ''),
            email_change_token_new = COALESCE(email_change_token_new, ''),
            email_change = COALESCE(email_change, ''),
            raw_user_meta_data = jsonb_build_object('full_name', 'Dra. Helena Martins (Síndica Teste)', 'role', 'sindico'),
            updated_at = now()
        WHERE email = 'sindico.teste@condor.com.br'
        RETURNING id INTO v_sindico_id;
    ELSE
        INSERT INTO auth.users (
            id, instance_id, email, encrypted_password, email_confirmed_at,
            confirmation_token, recovery_token, email_change_token_new, email_change,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
        ) VALUES (
            v_sindico_id, '00000000-0000-0000-0000-000000000000', 'sindico.teste@condor.com.br', v_encrypted_pw, now(),
            '', '', '', '',
            '{"provider":"email","providers":["email"]}',
            '{"full_name":"Dra. Helena Martins (Síndica Teste)","role":"sindico"}',
            now(), now(), 'authenticated', 'authenticated'
        );
    END IF;

    -- 3. MORADOR DE TESTE (morador.teste@condor.com.br)
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'morador.teste@condor.com.br') THEN
        UPDATE auth.users
        SET encrypted_password = v_encrypted_pw,
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            confirmation_token = COALESCE(confirmation_token, ''),
            recovery_token = COALESCE(recovery_token, ''),
            email_change_token_new = COALESCE(email_change_token_new, ''),
            email_change = COALESCE(email_change, ''),
            raw_user_meta_data = jsonb_build_object('full_name', 'Carlos Oliveira (Morador Teste)', 'role', 'morador'),
            updated_at = now()
        WHERE email = 'morador.teste@condor.com.br'
        RETURNING id INTO v_morador_id;
    ELSE
        INSERT INTO auth.users (
            id, instance_id, email, encrypted_password, email_confirmed_at,
            confirmation_token, recovery_token, email_change_token_new, email_change,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
        ) VALUES (
            v_morador_id, '00000000-0000-0000-0000-000000000000', 'morador.teste@condor.com.br', v_encrypted_pw, now(),
            '', '', '', '',
            '{"provider":"email","providers":["email"]}',
            '{"full_name":"Carlos Oliveira (Morador Teste)","role":"morador"}',
            now(), now(), 'authenticated', 'authenticated'
        );
    END IF;

    -- 4. PORTEIRO DE TESTE (porteiro.teste@condor.com.br)
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'porteiro.teste@condor.com.br') THEN
        UPDATE auth.users
        SET encrypted_password = v_encrypted_pw,
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            confirmation_token = COALESCE(confirmation_token, ''),
            recovery_token = COALESCE(recovery_token, ''),
            email_change_token_new = COALESCE(email_change_token_new, ''),
            email_change = COALESCE(email_change, ''),
            raw_user_meta_data = jsonb_build_object('full_name', 'Antônio Ferreira (Porteiro Teste)', 'role', 'porteiro'),
            updated_at = now()
        WHERE email = 'porteiro.teste@condor.com.br'
        RETURNING id INTO v_porteiro_id;
    ELSE
        INSERT INTO auth.users (
            id, instance_id, email, encrypted_password, email_confirmed_at,
            confirmation_token, recovery_token, email_change_token_new, email_change,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
        ) VALUES (
            v_porteiro_id, '00000000-0000-0000-0000-000000000000', 'porteiro.teste@condor.com.br', v_encrypted_pw, now(),
            '', '', '', '',
            '{"provider":"email","providers":["email"]}',
            '{"full_name":"Antônio Ferreira (Porteiro Teste)","role":"porteiro"}',
            now(), now(), 'authenticated', 'authenticated'
        );
    END IF;

    -- 5. GARANTIR auth.identities (exigido pelo GoTrue / Supabase Auth)
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES
        (gen_random_uuid(), v_sindico_id, v_sindico_id::text, jsonb_build_object('sub', v_sindico_id::text, 'email', 'sindico.teste@condor.com.br'), 'email', now(), now(), now()),
        (gen_random_uuid(), v_morador_id, v_morador_id::text, jsonb_build_object('sub', v_morador_id::text, 'email', 'morador.teste@condor.com.br'), 'email', now(), now(), now()),
        (gen_random_uuid(), v_porteiro_id, v_porteiro_id::text, jsonb_build_object('sub', v_porteiro_id::text, 'email', 'porteiro.teste@condor.com.br'), 'email', now(), now(), now())
    ON CONFLICT (provider_id, provider) DO NOTHING;

    -- 6. PERFIS DE USUÁRIO (public.user_profiles)
    INSERT INTO public.user_profiles (id, full_name, phone, avatar_url)
    VALUES
        (v_sindico_id,  'Dra. Helena Martins (Síndica Teste)', '(11) 98000-0001', NULL),
        (v_morador_id,  'Carlos Oliveira (Morador Teste)',     '(11) 97123-4567', NULL),
        (v_porteiro_id, 'Antônio Ferreira (Porteiro Teste)',   '(11) 96543-2109', NULL)
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        updated_at = now();

    -- 7. VÍNCULOS CONDOMINIAIS E PRIVILÉGIOS (public.condominium_members)
    INSERT INTO public.condominium_members (condominium_id, user_id, role, status)
    VALUES
        (v_condo_id, v_sindico_id,  'sindico',  'active'),
        (v_condo_id, v_morador_id,  'morador',  'active'),
        (v_condo_id, v_porteiro_id, 'porteiro', 'active')
    ON CONFLICT (condominium_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        status = 'active',
        updated_at = now();

    RAISE NOTICE 'Perfis teste ativados com sucesso no Supabase! Condomínio: % | Síndico: sindico.teste@condor.com.br | Morador: morador.teste@condor.com.br | Porteiro: porteiro.teste@condor.com.br', v_condo_id;
END $$;
