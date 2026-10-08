# 🦅 Condor - Sistema de Gestão Condominial Multi-tenant

[![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.x-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20Postgres-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> Plataforma SaaS moderna, segura e responsiva para administração inteligente de condomínios residenciais e comerciais, com controle de acesso em tempo real, gestão financeira, ordens de serviço, reservas de espaços e isolamento multi-tenant via **Supabase Row Level Security (RLS)**.

---

## 📸 Visão Geral da Plataforma

O **Condor** resolve os maiores atritos na convivência e gestão predial, integrando portaria física e remota, corpo diretivo (síndico/administradora) e moradores em um ambiente unificado.

### Principais Pilares:
1. **Multi-inquilino (Multi-tenant):** Separação lógica rígida entre condomínios no banco de dados através de políticas RLS do PostgreSQL.
2. **Controle de Acesso Baseado em Papéis (RBAC):** Interfaces e permissões dinamicamente adaptadas ao perfil do usuário autenticado.
3. **Resiliência Offline-first:** Suporte a cache e fallback inteligente em `localStorage` quando o banco remoto estiver em manutenção ou desconectado.
4. **Alta Fidelidade Visual:** Design System premium com suporte nativo a temas Claro e Escuro, animações suaves e tipografia moderna.

---

## 👥 Perfis de Acesso & Matriz de Permissões (RBAC)

| Módulo / Funcionalidade | Super Admin | Síndico Geral | Portaria | Morador |
| :--- | :---: | :---: | :---: | :---: |
| **Painel Financeiro & Boletos** | ✅ Total | ✅ Total | ❌ Bloqueado | 🔒 Apenas seus boletos |
| **Abertura de Chamados (O.S.)** | ✅ Total | ✅ Total | ✅ Permitido | 🔒 Apenas visualização |
| **Gestão de Usuários & Privilégios** | ✅ Total | ✅ Total | ❌ Bloqueado | ❌ Bloqueado |
| **Portaria, Catracas & Câmeras** | ✅ Total | ✅ Total | ✅ Operador | ❌ Bloqueado |
| **Logs em Tempo Real** | ✅ Automático | ✅ Automático | 🛡️ Sob concessão | ❌ Bloqueado |
| **Reservas de Áreas Comuns** | ✅ Total | ✅ Total | ✅ Consulta | ✅ Agendamento |
| **Mural de Comunicados Oficiais** | ✏️ Criar/Editar | ✏️ Criar/Editar | 👁️ Visualizar | 👁️ Visualizar |
| **Console Supabase** | ✅ Visível | ❌ Oculto | ❌ Oculto | ❌ Oculto |

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide React (Ícones)
- **Roteamento & Estado:** Context API (`AuthContext`, `ThemeContext`), LocalStorage State Caching
- **Validação de Formulários:** Zod v4 (schemas declarativos e seguros)
- **Backend & Database:** Supabase (PostgreSQL 15, Auth com JWT, Row Level Security, Triggers e Funções PL/pgSQL)
- **Build Tooling:** Vite, PostCSS, Autoprefixer, TypeScript Compiler (`tsc`)

---

## 🚀 Como Executar Localmente

### 1. Clonar o repositório
```bash
git clone https://github.com/curioso01/condor-condominium-platform.git
cd condor-condominium-platform
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar variáveis de ambiente
Crie um arquivo `.env` na raiz do projeto com base no `.env.example`:
```env
VITE_SUPABASE_URL=https://hbxyzdqshjztunjlduvg.supabase.co
VITE_SUPABASE_ANON_KEY=seu_token_anonimo_aqui
```

### 4. Executar em modo desenvolvimento
```bash
npm run dev
```
Acesse `http://localhost:3000` no seu navegador.

---

## 🗄️ Estrutura do Banco de Dados (Supabase)

Todas as migrações SQL consolidadas e idempotentes estão localizadas em:
`supabase/DEPLOY_ALL_MIGRATIONS.sql`

Tabelas configuradas:
- `public.condominiums`: Cadastro de condomínios
- `public.user_profiles`: Perfis de usuário (foto, telefone, nome completo)
- `public.condominium_members`: Vínculos de membresia, papéis e privilégios delegados
- `public.units`: Unidades habitacionais e comerciais
- `public.common_areas`: Áreas de lazer (Salão de festas, churrasqueiras, quadras)
- `public.invoices`: Cobranças, cotas condominiais e chaves PIX
- `public.maintenance_orders`: Ordens de serviço e manutenções prediais
- `public.amenity_reservations`: Reservas com detecção de choque de horários
- `public.access_logs`: Registros de acessos, biometria facial e entregas de encomendas

---

## 🔑 Credenciais Pré-configuradas para Testes

> **Senha Padrão para todos:** `condor@2026`

- **Síndica:** `sindico@condor.com.br`
- **Super Administrador:** `admin@condor.com.br`
- **Portaria:** `porteiro@condor.com.br` ou `porteiro.teste@condor.com.br`
- **Morador:** `morador@condor.com.br` ou `morador.teste@condor.com.br`

---

## 🌐 Deploy na Vercel

O projeto foi arquitetado para ser implantado na **Vercel** com zero configurações adicionais:

1. Importe o repositório no [Dashboard da Vercel](https://vercel.com/new).
2. O framework detectará automaticamente como **Vite**.
3. Adicione as variáveis de ambiente em **Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Clique em **Deploy**.

---

## 📄 Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais detalhes.
