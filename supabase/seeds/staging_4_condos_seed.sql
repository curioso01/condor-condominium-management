-- ============================================================================
-- MIGRATION / SEED DE HOMOLOGAÇÃO (STAGING): 20261104000002_staging_4_condos_seed.sql
-- DESCRIÇÃO: Massa de dados fictícia (sem PII real - LGPD Safe) para validar
--            a operação da Síndica-Piloto administrando 4 condomínios distintos
--            (sendo o 4º condomínio recém-assumido e vazio para teste de estado limpo),
--            além de porteiros e moradores isolados por condomínio.
-- ATENÇÃO: Executar APENAS no banco de HOMOLOGAÇÃO (STAGING) via SQL Editor.
--          Verifica existência prévia dos usuários em auth.users antes de vincular.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  -- 4 Condomínios da Síndica-Piloto
  v_condo_1 UUID := '11111111-1111-4111-8111-111111111101'; -- Residencial Reserva Imperial (Piloto 01)
  v_condo_2 UUID := '22222222-2222-4222-8222-222222222202'; -- Condomínio Ilhas Gregas (Piloto 02)
  v_condo_3 UUID := '33333333-3333-4333-8333-333333333303'; -- Edifício Jardim Botânico (Piloto 03)
  v_condo_4 UUID := '44444444-4444-4444-8444-444444444404'; -- Solar das Palmeiras (Piloto 04 - Recém-Assumido / Vazio)

  -- IDs de Usuários Fictícios de Homologação (resolvidos ou criados em auth.users)
  v_sindica_id   UUID := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  v_morador_c1   UUID := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  v_morador_c2   UUID := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
  v_porteiro_c1  UUID := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
  v_porteiro_c3  UUID := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';

  -- Unidades Fictícias (Condomínios 1, 2 e 3; Condomínio 4 permanece com 0 unidades para validar estado vazio)
  v_unit_c1 UUID := 'd1111111-1111-4111-8111-111111111101';
  v_unit_c2 UUID := 'd2222222-2222-4222-8222-222222222202';
  v_unit_c3 UUID := 'd3333333-3333-4333-8333-333333333303';

  -- ATENÇÃO: Substitua o placeholder abaixo por uma senha forte exclusiva do ambiente de STAGING antes de executar no SQL Editor.
  v_pw TEXT := crypt('DEFINIR_SENHA_FORTE_STAGING', gen_salt('bf'));
BEGIN
  -- 1. Cadastrar os 4 Condomínios Fictícios
  INSERT INTO public.condominiums (id, name, cnpj, address, city, state)
  VALUES
    (v_condo_1, 'Residencial Reserva Imperial (Piloto 01)', '10.111.222/0001-01', 'Av. Paulista, 1000', 'São Paulo', 'SP'),
    (v_condo_2, 'Condomínio Ilhas Gregas (Piloto 02)',      '20.222.333/0001-02', 'Rua Oscar Freire, 450', 'São Paulo', 'SP'),
    (v_condo_3, 'Edifício Jardim Botânico (Piloto 03)',     '30.333.444/0001-03', 'Al. Santos, 820', 'São Paulo', 'SP'),
    (v_condo_4, 'Solar das Palmeiras (Piloto 04 - Novo)',   '40.444.555/0001-04', 'Rua dos Pinheiros, 310', 'São Paulo', 'SP')
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name, cnpj = EXCLUDED.cnpj, address = EXCLUDED.address;

  -- 2. Verificar existência ou provisionar usuários fictícios em auth.users (com tokens GoTrue e auth.identities)
  -- 2.1 Síndica Piloto (vinculada aos 4 condomínios)
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'sindica.piloto@condor-homolog.com.br') THEN
    UPDATE auth.users
    SET encrypted_password = v_pw,
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        confirmation_token = COALESCE(confirmation_token, ''),
        recovery_token = COALESCE(recovery_token, ''),
        email_change_token_new = COALESCE(email_change_token_new, ''),
        email_change = COALESCE(email_change, '')
    WHERE email = 'sindica.piloto@condor-homolog.com.br'
    RETURNING id INTO v_sindica_id;
  ELSE
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, email_change_token_new, email_change, role, aud, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (v_sindica_id, '00000000-0000-0000-0000-000000000000', 'sindica.piloto@condor-homolog.com.br', v_pw, now(), '', '', '', '', 'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}', '{"full_name":"Dra. Helena Martins (Síndica Piloto)"}', now(), now());
  END IF;

  -- 2.2 Morador Condomínio 1
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'morador.imperial@condor-homolog.com.br') THEN
    UPDATE auth.users
    SET encrypted_password = v_pw,
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        confirmation_token = COALESCE(confirmation_token, ''),
        recovery_token = COALESCE(recovery_token, ''),
        email_change_token_new = COALESCE(email_change_token_new, ''),
        email_change = COALESCE(email_change, '')
    WHERE email = 'morador.imperial@condor-homolog.com.br'
    RETURNING id INTO v_morador_c1;
  ELSE
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, email_change_token_new, email_change, role, aud, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (v_morador_c1, '00000000-0000-0000-0000-000000000000', 'morador.imperial@condor-homolog.com.br', v_pw, now(), '', '', '', '', 'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}', '{"full_name":"Morador Fictício 01 (Reserva Imperial)"}', now(), now());
  END IF;

  -- 2.3 Moradora Condomínio 2
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'morador.ilhas@condor-homolog.com.br') THEN
    UPDATE auth.users
    SET encrypted_password = v_pw,
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        confirmation_token = COALESCE(confirmation_token, ''),
        recovery_token = COALESCE(recovery_token, ''),
        email_change_token_new = COALESCE(email_change_token_new, ''),
        email_change = COALESCE(email_change, '')
    WHERE email = 'morador.ilhas@condor-homolog.com.br'
    RETURNING id INTO v_morador_c2;
  ELSE
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, email_change_token_new, email_change, role, aud, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (v_morador_c2, '00000000-0000-0000-0000-000000000000', 'morador.ilhas@condor-homolog.com.br', v_pw, now(), '', '', '', '', 'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}', '{"full_name":"Moradora Fictícia 02 (Ilhas Gregas)"}', now(), now());
  END IF;

  -- 2.4 Porteiro Condomínio 1
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'portaria.imperial@condor-homolog.com.br') THEN
    UPDATE auth.users
    SET encrypted_password = v_pw,
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        confirmation_token = COALESCE(confirmation_token, ''),
        recovery_token = COALESCE(recovery_token, ''),
        email_change_token_new = COALESCE(email_change_token_new, ''),
        email_change = COALESCE(email_change, '')
    WHERE email = 'portaria.imperial@condor-homolog.com.br'
    RETURNING id INTO v_porteiro_c1;
  ELSE
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, email_change_token_new, email_change, role, aud, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (v_porteiro_c1, '00000000-0000-0000-0000-000000000000', 'portaria.imperial@condor-homolog.com.br', v_pw, now(), '', '', '', '', 'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}', '{"full_name":"Portaria Turno A (Reserva Imperial)"}', now(), now());
  END IF;

  -- 2.5 Porteiro Condomínio 3
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'portaria.jardim@condor-homolog.com.br') THEN
    UPDATE auth.users
    SET encrypted_password = v_pw,
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        confirmation_token = COALESCE(confirmation_token, ''),
        recovery_token = COALESCE(recovery_token, ''),
        email_change_token_new = COALESCE(email_change_token_new, ''),
        email_change = COALESCE(email_change, '')
    WHERE email = 'portaria.jardim@condor-homolog.com.br'
    RETURNING id INTO v_porteiro_c3;
  ELSE
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token, email_change_token_new, email_change, role, aud, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (v_porteiro_c3, '00000000-0000-0000-0000-000000000000', 'portaria.jardim@condor-homolog.com.br', v_pw, now(), '', '', '', '', 'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}', '{"full_name":"Portaria Turno B (Jardim Botânico)"}', now(), now());
  END IF;

  -- 2.6 Garantir auth.identities para login GoTrue sem erros de schema
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_sindica_id,  v_sindica_id::text,  jsonb_build_object('sub', v_sindica_id::text,  'email', 'sindica.piloto@condor-homolog.com.br'),    'email', now(), now(), now()),
    (gen_random_uuid(), v_morador_c1,  v_morador_c1::text,  jsonb_build_object('sub', v_morador_c1::text,  'email', 'morador.imperial@condor-homolog.com.br'),  'email', now(), now(), now()),
    (gen_random_uuid(), v_morador_c2,  v_morador_c2::text,  jsonb_build_object('sub', v_morador_c2::text,  'email', 'morador.ilhas@condor-homolog.com.br'),     'email', now(), now(), now()),
    (gen_random_uuid(), v_porteiro_c1, v_porteiro_c1::text, jsonb_build_object('sub', v_porteiro_c1::text, 'email', 'portaria.imperial@condor-homolog.com.br'), 'email', now(), now(), now()),
    (gen_random_uuid(), v_porteiro_c3, v_porteiro_c3::text, jsonb_build_object('sub', v_porteiro_c3::text, 'email', 'portaria.jardim@condor-homolog.com.br'),   'email', now(), now(), now())
  ON CONFLICT (provider_id, provider) DO NOTHING;

  -- 3. Garantir Perfis em public.user_profiles somente para usuários confirmados em auth.users
  INSERT INTO public.user_profiles (id, full_name, email, phone)
  VALUES
    (v_sindica_id,  'Dra. Helena Martins (Síndica Piloto)', 'sindica.piloto@condor-homolog.com.br',    '(11) 90000-0001'),
    (v_morador_c1,  'Morador Fictício 01 (Imperial)',       'morador.imperial@condor-homolog.com.br',  '(11) 90000-0002'),
    (v_morador_c2,  'Moradora Fictícia 02 (Ilhas Gregas)',  'morador.ilhas@condor-homolog.com.br',     '(11) 90000-0003'),
    (v_porteiro_c1, 'Portaria Turno A (Imperial)',          'portaria.imperial@condor-homolog.com.br', '(11) 90000-0004'),
    (v_porteiro_c3, 'Portaria Turno B (Jardim Botânico)',   'portaria.jardim@condor-homolog.com.br',   '(11) 90000-0005')
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, phone = EXCLUDED.phone;

  -- 4. Unidades independentes nos Condomínios 1, 2 e 3 (Condomínio 4 fica sem registros para teste de estado vazio)
  INSERT INTO public.units (id, condominium_id, identifier, block, floor, owner_name, resident_type, parking_spot, has_pet, vehicle_model, vehicle_plate, residents_count)
  VALUES
    (v_unit_c1, v_condo_1, '101', 'Torre Imperial', 1, 'Morador Fictício 01 (Imperial)',      'Proprietário', 'G1-101', true,  'SUV Híbrido (Fictício)', 'TST-1A01', 3),
    (v_unit_c2, v_condo_2, '202', 'Bloco Mykonos',  2, 'Moradora Fictícia 02 (Ilhas Gregas)', 'Inquilino',    'G2-202', false, 'Sedan Compacto',         'TST-2B02', 2),
    (v_unit_c3, v_condo_3, '303', 'Torre Orquídea', 3, 'Condômino Fictício 03 (Jardim)',      'Proprietário', 'G1-303', true,  'Hatch Elétrico',         'TST-3C03', 4)
  ON CONFLICT (condominium_id, block, identifier) DO UPDATE
    SET owner_name = EXCLUDED.owner_name,
        resident_type = EXCLUDED.resident_type,
        parking_spot = EXCLUDED.parking_spot,
        has_pet = EXCLUDED.has_pet,
        vehicle_model = EXCLUDED.vehicle_model,
        vehicle_plate = EXCLUDED.vehicle_plate,
        residents_count = EXCLUDED.residents_count;

  -- 5. Vínculos Multi-Condomínio: Validar existência em auth.users antes de vincular
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_sindica_id) THEN
    INSERT INTO public.condominium_members (condominium_id, user_id, role, status, log_access_granted)
    VALUES
      (v_condo_1, v_sindica_id, 'sindico', 'active', true),
      (v_condo_2, v_sindica_id, 'sindico', 'active', true),
      (v_condo_3, v_sindica_id, 'sindico', 'active', true),
      (v_condo_4, v_sindica_id, 'sindico', 'active', true)
    ON CONFLICT (condominium_id, user_id) DO UPDATE
      SET role = EXCLUDED.role, status = 'active', log_access_granted = true;
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_morador_c1) THEN
    INSERT INTO public.condominium_members (condominium_id, user_id, role, status, unit_id, unit_number, block, resident_type, has_pet)
    VALUES (v_condo_1, v_morador_c1, 'morador', 'active', v_unit_c1, '101', 'Torre Imperial', 'Proprietário', true)
    ON CONFLICT (condominium_id, user_id) DO UPDATE
      SET role = 'morador', status = 'active', unit_id = v_unit_c1, unit_number = '101', block = 'Torre Imperial';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_morador_c2) THEN
    INSERT INTO public.condominium_members (condominium_id, user_id, role, status, unit_id, unit_number, block, resident_type, has_pet)
    VALUES (v_condo_2, v_morador_c2, 'morador', 'active', v_unit_c2, '202', 'Bloco Mykonos', 'Inquilino', false)
    ON CONFLICT (condominium_id, user_id) DO UPDATE
      SET role = 'morador', status = 'active', unit_id = v_unit_c2, unit_number = '202', block = 'Bloco Mykonos';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_porteiro_c1) THEN
    INSERT INTO public.condominium_members (condominium_id, user_id, role, status, log_access_granted)
    VALUES (v_condo_1, v_porteiro_c1, 'porteiro', 'active', true)
    ON CONFLICT (condominium_id, user_id) DO UPDATE
      SET role = 'porteiro', status = 'active', log_access_granted = true;
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_porteiro_c3) THEN
    INSERT INTO public.condominium_members (condominium_id, user_id, role, status, log_access_granted)
    VALUES (v_condo_3, v_porteiro_c3, 'porteiro', 'active', true)
    ON CONFLICT (condominium_id, user_id) DO UPDATE
      SET role = 'porteiro', status = 'active', log_access_granted = true;
  END IF;

  -- 6. Configurações Bancárias Independentes para cada Condomínio
  INSERT INTO public.condominium_bank_settings (
    condominium_id, bank_code, bank_name, agency, account_number, account_digit,
    wallet_code, beneficiary_name, beneficiary_cnpj, pix_key_type, pix_key
  )
  VALUES
    (v_condo_1, '341', 'Itaú Unibanco S.A.',        '1001', '11111', '1', '109', 'Condomínio Reserva Imperial', '10.111.222/0001-01', 'CNPJ', '10.111.222/0001-01'),
    (v_condo_2, '033', 'Banco Santander S.A.',      '2002', '22222', '2', '101', 'Condomínio Ilhas Gregas',     '20.222.333/0001-02', 'CNPJ', '20.222.333/0001-02'),
    (v_condo_3, '237', 'Banco Bradesco S.A.',       '3003', '33333', '3', '09',  'Condomínio Jardim Botânico',  '30.333.444/0001-03', 'CNPJ', '30.333.444/0001-03'),
    (v_condo_4, '756', 'Banco Cooperativo Sicoob',  '4004', '44444', '4', '01',  'Condomínio Solar Palmeiras',  '40.444.555/0001-04', 'CNPJ', '40.444.555/0001-04')
  ON CONFLICT (condominium_id) DO UPDATE
    SET bank_code = EXCLUDED.bank_code,
        bank_name = EXCLUDED.bank_name,
        beneficiary_name = EXCLUDED.beneficiary_name,
        beneficiary_cnpj = EXCLUDED.beneficiary_cnpj,
        pix_key = EXCLUDED.pix_key;

  -- 7. Configuração Financeira / Fundo de Reserva Independente por Condomínio
  INSERT INTO public.condominium_financial_config (
    condominium_id, reserve_fund_balance, reserve_fund_yield_rate, reserve_fund_institution,
    reserve_fund_target_title, reserve_fund_target_amount, monthly_budget
  )
  VALUES
    (v_condo_1, 412300.84, 104.5, 'Itaú Private CDI',      'Modernização Elevadores', 500000.00, 145000.00),
    (v_condo_2, 185400.00, 102.0, 'Santander Reserva CDB', 'Reforma Fachada Bloco A', 250000.00,  82000.00),
    (v_condo_3, 620000.00, 106.0, 'Bradesco Prime DI',     'Implantação Energia Solar', 700000.00, 198000.00),
    (v_condo_4,      0.00, 100.0, 'Sicoob Conta Reserva',  'Fundo Inicial de Implantação', 100000.00, 45000.00)
  ON CONFLICT (condominium_id) DO UPDATE
    SET reserve_fund_balance = EXCLUDED.reserve_fund_balance,
        reserve_fund_target_title = EXCLUDED.reserve_fund_target_title,
        reserve_fund_target_amount = EXCLUDED.reserve_fund_target_amount;

  -- 8. Cobranças (Boletos) independentes nos Condomínios 1, 2 e 3 (Condomínio 4 fica vazio)
  INSERT INTO public.invoices (condominium_id, unit_id, resident_name, description, amount, due_date, status, paid_at, pix_code)
  VALUES
    (v_condo_1, v_unit_c1, 'Morador Fictício 01 (Imperial)',      'Cota Condominial Homologação - Imperial', 1250.00, CURRENT_DATE + 5,  'pending', NULL,  '00020126360014BR.GOV.BCB.PIX0114CONDO1IMPERIAL'),
    (v_condo_2, v_unit_c2, 'Moradora Fictícia 02 (Ilhas Gregas)', 'Cota Condominial Homologação - Ilhas',     890.00, CURRENT_DATE - 3,  'pending', NULL,  '00020126360014BR.GOV.BCB.PIX0114CONDO2ILHASGRE'),
    (v_condo_3, v_unit_c3, 'Condômino Fictício 03 (Jardim)',      'Cota Condominial Homologação - Jardim',   1640.00, CURRENT_DATE - 10, 'paid',    now(), '00020126360014BR.GOV.BCB.PIX0114CONDO3JARDIMBO')
  ON CONFLICT (unit_id, description, due_date) DO NOTHING;

  -- 9. Áreas Comuns independentes nos Condomínios 1, 2 e 3 (Condomínio 4 fica vazio)
  IF NOT EXISTS (SELECT 1 FROM public.common_areas WHERE condominium_id = v_condo_1) THEN
    INSERT INTO public.common_areas (condominium_id, name, description, capacity, fee, rules, requires_approval, emoji, hours, active)
    VALUES (v_condo_1, 'Salão Gourmet Imperial', 'Espaço climatizado para 50 pessoas', 50, 250.00, 'Cancelamento com 48h de antecedência.', false, '🥂', '10:00 às 23:00', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.common_areas WHERE condominium_id = v_condo_2) THEN
    INSERT INTO public.common_areas (condominium_id, name, description, capacity, fee, rules, requires_approval, emoji, hours, active)
    VALUES (v_condo_2, 'Taverna Santorini', 'Churrasqueira mediterrânea da piscina', 25, 120.00, 'Proibido som automotivo ou caixas amplificadas.', true, '🍖', '09:00 às 22:00', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.common_areas WHERE condominium_id = v_condo_3) THEN
    INSERT INTO public.common_areas (condominium_id, name, description, capacity, fee, rules, requires_approval, emoji, hours, active)
    VALUES (v_condo_3, 'Orquidário & Lounge', 'Espaço de convivência e eventos íntimos', 40, 320.00, 'Necessária aprovação da administração.', true, '🌿', '08:00 às 22:00', true);
  END IF;

  -- 10. Comunicados Oficiais Independentes nos Condomínios 1, 2 e 3
  IF NOT EXISTS (SELECT 1 FROM public.announcements WHERE condominium_id = v_condo_1) THEN
    INSERT INTO public.announcements (condominium_id, title, category, content, author_name, is_pinned)
    VALUES (v_condo_1, 'Manutenção dos Elevadores da Torre Imperial', 'Manutenção', 'Comunicado exclusivo do Residencial Reserva Imperial (Condomínio 01).', 'Dra. Helena Martins • Síndica', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.announcements WHERE condominium_id = v_condo_2) THEN
    INSERT INTO public.announcements (condominium_id, title, category, content, author_name, is_pinned)
    VALUES (v_condo_2, 'Assembleia Geral Ordinária - Ilhas Gregas', 'Assembleia', 'Comunicado exclusivo do Condomínio Ilhas Gregas (Condomínio 02).', 'Dra. Helena Martins • Síndica', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.announcements WHERE condominium_id = v_condo_3) THEN
    INSERT INTO public.announcements (condominium_id, title, category, content, author_name, is_pinned)
    VALUES (v_condo_3, 'Poda Programada do Bosque - Jardim Botânico', 'Comunicado', 'Comunicado exclusivo do Edifício Jardim Botânico (Condomínio 03).', 'Dra. Helena Martins • Síndica', true);
  END IF;
END $$;
