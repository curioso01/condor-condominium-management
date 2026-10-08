import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ThemeToggle } from '../ui/ThemeToggle';
import {
  X,
  Settings,
  User,
  Building,
  Database,
  Bell,
  Camera,
  Upload,
  CheckCircle2,
  Copy,
  Check,
  Shield,
  Save,
  Users,
  UserPlus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { userService, type CondominiumUser } from '../../services/userService';
import type { CondominiumRole } from '../../types/database.types';

export type SettingsTab = 'perfil' | 'condominio' | 'usuarios' | 'database' | 'preferencias';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: SettingsTab;
}

const PRESET_AVATARS = [
  {
    label: 'Executiva 1',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCcP2EM7PC3LJ-2tvwQdWRy4rZQHQfz32_v0HHn2ANWMg-BcuiRQgCTS3AsMkvhoYaTcH-I3azZMuXcowKAlf25CS3BVa5WIG7PXHBtH_9ptOqZJBwecSc-CShsf3tQACctQWqGXWl1GS7Bn95cYEubf_IEPUUzvlJ_wertPm0iXxxGASFB0WmV5nKuLcUOPwwMy2gn1vpEEXpUYVIHLw4THq1rGIi5WTlem19-6YXj88WVJd244wElMg',
  },
  {
    label: 'Executiva 2',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCTczSNnAmSvG-_c4hP69EGDtwbCYVlL01COY56Y33FWfPs1KmchYiQTHgOWPBUnxuWWzRbXiqxM94DulZL2z3lZE6J-ZHtFTWZulmXCV_LyxWhwlI298nj6FnTzRrTFbr8PwwXg5YIB-Jf4lhh3nPxASbnl9O_uGo-AjZQ9n60urOzEEuFyMwe5Tn2ExzBbqc6akHC03yYEtrEC30dgK3TSAIabYdbPFhP9yVlIfuF4Z1qOo9eNoF2Bg',
  },
  {
    label: 'Executivo 1',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80',
  },
  {
    label: 'Executivo 2',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80',
  },
  {
    label: 'Profissional 3',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=240&auto=format&fit=crop&q=80',
  },
  {
    label: 'Profissional 4',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&auto=format&fit=crop&q=80',
  },
  {
    label: 'Profissional 5',
    url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=240&auto=format&fit=crop&q=80',
  },
  {
    label: 'Profissional 6',
    url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=240&auto=format&fit=crop&q=80',
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'perfil',
}) => {
  const { profile, user, currentCondominium, currentRole, updateProfile, canManageUsers, isSuperAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);

  // Profile editing state
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedMigration, setCopiedMigration] = useState(false);
  const [copiedSeedUsers, setCopiedSeedUsers] = useState(false);

  // Users & Privileges state
  const [usersList, setUsersList] = useState<CondominiumUser[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserUnit, setNewUserUnit] = useState('');
  const [newUserRole, setNewUserRole] = useState<CondominiumRole>('morador');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | CondominiumRole>('all');
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  // File upload ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setAvatarUrl(profile.avatar_url || '');
    }
  }, [profile]);

  useEffect(() => {
    if (defaultTab === 'usuarios' && !canManageUsers) {
      setActiveTab('perfil');
    } else if (defaultTab === 'database' && !isSuperAdmin) {
      setActiveTab('perfil');
    } else {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, canManageUsers, isSuperAdmin]);

  const loadUsers = useCallback(() => {
    const condoId = currentCondominium?.id || 'condo-imperial-001';
    const list = userService.getUsers(condoId);
    setUsersList(list);
  }, [currentCondominium?.id]);

  useEffect(() => {
    if (isOpen && activeTab === 'usuarios' && canManageUsers) {
      loadUsers();
    }
  }, [isOpen, activeTab, canManageUsers, loadUsers]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle local file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFeedback('A imagem selecionada é muito grande. Escolha uma imagem de até 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setAvatarUrl(result);
        setFeedback('Foto carregada com sucesso! Clique em "Salvar Alterações" para confirmar.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    const { error } = await updateProfile({
      full_name: fullName.trim() || 'Usuário Condor',
      phone: phone.trim() || null,
      avatar_url: avatarUrl || null,
    });

    setIsSaving(false);

    if (error) {
      setFeedback(`Erro ao salvar perfil: ${error.message}`);
    } else {
      setFeedback('Perfil e foto atualizados com sucesso no sistema!');
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleCopyMigrationScript = () => {
    const sql = `-- Migration Condor: Espaços e Portaria
CREATE TABLE IF NOT EXISTS public.amenity_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  space_name TEXT NOT NULL,
  emoji TEXT DEFAULT '🎉',
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  responsible_name TEXT NOT NULL,
  unit_number TEXT NOT NULL,
  rental_fee NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'Aprovado / Taxa Paga',
  status_type TEXT DEFAULT 'success',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  photo_url TEXT,
  auth_type TEXT NOT NULL,
  auth_detail TEXT,
  access_point TEXT NOT NULL,
  destination TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`;
    navigator.clipboard?.writeText(sql);
    setCopiedMigration(true);
    setTimeout(() => setCopiedMigration(false), 3000);
  };

  const handleCopySeedUsersScript = () => {
    const sql = `-- CONDOR: Seed de Usuários de Teste no Supabase (Morador e Porteiro)
DO $$
DECLARE
    v_condo_id UUID;
    v_morador_id UUID := '786e1481-818d-4161-93b2-db836b08f168';
    v_porteiro_id UUID := '28297913-3de5-45c5-8b33-ec019c174d4c';
    v_encrypted_pw TEXT := crypt('condor@2026', gen_salt('bf'));
BEGIN
    SELECT id INTO v_condo_id FROM public.condominiums LIMIT 1;
    IF v_condo_id IS NULL THEN
        INSERT INTO public.condominiums (name, cnpj, address, city, state)
        VALUES ('Residencial Imperial Tower', '12.345.678/0001-90', 'Av. Paulista, 1000', 'São Paulo', 'SP')
        RETURNING id INTO v_condo_id;
    END IF;

    -- Morador Teste no Auth
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'morador.teste@condor.com.br') THEN
        UPDATE auth.users
        SET encrypted_password = v_encrypted_pw, email_confirmed_at = COALESCE(email_confirmed_at, now())
        WHERE email = 'morador.teste@condor.com.br' RETURNING id INTO v_morador_id;
    ELSE
        INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, role, aud)
        VALUES (v_morador_id, '00000000-0000-0000-0000-000000000000', 'morador.teste@condor.com.br', v_encrypted_pw, now(), 'authenticated', 'authenticated');
    END IF;

    -- Porteiro Teste no Auth
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'porteiro.teste@condor.com.br') THEN
        UPDATE auth.users
        SET encrypted_password = v_encrypted_pw, email_confirmed_at = COALESCE(email_confirmed_at, now())
        WHERE email = 'porteiro.teste@condor.com.br' RETURNING id INTO v_porteiro_id;
    ELSE
        INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, role, aud)
        VALUES (v_porteiro_id, '00000000-0000-0000-0000-000000000000', 'porteiro.teste@condor.com.br', v_encrypted_pw, now(), 'authenticated', 'authenticated');
    END IF;

    -- Perfis
    INSERT INTO public.user_profiles (id, full_name, phone)
    VALUES 
        (v_morador_id, 'Carlos Oliveira (Morador Teste)', '(11) 97123-4567'),
        (v_porteiro_id, 'Antônio Ferreira (Porteiro Teste)', '(11) 96543-2109')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone;

    -- Vínculos de Acesso
    INSERT INTO public.condominium_members (condominium_id, user_id, role, status)
    VALUES 
        (v_condo_id, v_morador_id, 'morador', 'active'),
        (v_condo_id, v_porteiro_id, 'porteiro', 'active')
    ON CONFLICT (condominium_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active';
END $$;`;
    navigator.clipboard?.writeText(sql);
    setCopiedSeedUsers(true);
    setTimeout(() => setCopiedSeedUsers(false), 3000);
  };

  // Helper labels for privileges
  const getRoleLabel = (role: CondominiumRole) => {
    switch (role) {
      case 'superadmin':
        return 'Super Administrador';
      case 'sindico':
        return 'Síndico Geral';
      case 'porteiro':
        return 'Portaria & Acessos';
      case 'morador':
        return 'Morador / Residente';
      default:
        return role;
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageUsers) {
      setFeedback('Acesso negado: apenas o Síndico e o Super Administrador podem cadastrar novos usuários.');
      return;
    }
    if (!newUserFullName.trim() || !newUserEmail.trim()) {
      setFeedback('Por favor, informe ao menos o nome completo e o e-mail do usuário.');
      return;
    }

    setIsSubmittingUser(true);
    const res = await userService.createUser(
      {
        condominium_id: currentCondominium?.id || 'condo-imperial-001',
        full_name: newUserFullName,
        email: newUserEmail,
        phone: newUserPhone,
        unit_number: newUserUnit,
        role: newUserRole,
      },
      currentRole
    );
    setIsSubmittingUser(false);

    if (res.error) {
      setFeedback(`Erro: ${res.error.message}`);
      return;
    }

    setFeedback(`Usuário ${newUserFullName} cadastrado com sucesso com o privilégio de ${getRoleLabel(newUserRole)}!`);
    setIsAddingUser(false);
    setNewUserFullName('');
    setNewUserEmail('');
    setNewUserPhone('');
    setNewUserUnit('');
    setNewUserRole('morador');
    loadUsers();
  };

  const handleRoleChange = async (targetUserId: string, targetUserName: string, newRole: CondominiumRole) => {
    if (!canManageUsers) {
      setFeedback('Acesso negado: apenas o Síndico e o Super Administrador podem conceder ou alterar privilégios.');
      return;
    }

    const res = await userService.updateUserRole(
      targetUserId,
      currentCondominium?.id || 'condo-imperial-001',
      newRole,
      currentRole
    );

    if (res.error) {
      setFeedback(`Erro ao conceder privilégio: ${res.error.message}`);
      return;
    }

    setFeedback(`Privilégio de ${targetUserName} atualizado para "${getRoleLabel(newRole)}" com sucesso.`);
    loadUsers();
  };

  const handleToggleLogAccess = async (targetUserId: string, targetUserName: string, newAccess: boolean) => {
    if (!canManageUsers) {
      setFeedback('Acesso negado: apenas o Síndico e o Super Administrador podem conceder acesso aos logs.');
      return;
    }

    const res = await userService.setLogAccess(
      targetUserId,
      currentCondominium?.id || 'condo-imperial-001',
      newAccess,
      currentRole
    );

    if (res.error) {
      setFeedback(`Erro ao atualizar permissão de logs: ${res.error.message}`);
      return;
    }

    setFeedback(`Permissão do Log em Tempo Real de "${targetUserName}" foi ${newAccess ? 'concedida' : 'revogada'} com sucesso.`);
    loadUsers();
  };

  const handleRemoveUser = async (targetUserId: string, targetUserName: string) => {
    if (!canManageUsers) {
      setFeedback('Acesso negado: apenas o Síndico e o Super Administrador podem remover usuários.');
      return;
    }

    if (!window.confirm(`Tem certeza de que deseja revogar o acesso de "${targetUserName}" no condomínio?`)) {
      return;
    }

    const res = await userService.removeUser(
      targetUserId,
      currentCondominium?.id || 'condo-imperial-001',
      currentRole
    );

    if (res.error) {
      setFeedback(`Erro ao remover: ${res.error.message}`);
      return;
    }

    setFeedback(`Acesso de ${targetUserName} revogado com sucesso.`);
    loadUsers();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-4xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-gradient-to-r from-slate-50/50 to-white dark:from-slate-900 dark:to-slate-800/60">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-extrabold flex items-center justify-center text-lg shadow-sm">
              <Settings className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="settings-modal-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Configurações do Sistema
                </h3>
                <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                  {currentCondominium?.name || 'Condomínio'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Perfil de acesso, foto do usuário, dados do condomínio e status da infraestrutura
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
            aria-label="Fechar configurações"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="flex items-center gap-1.5 px-6 pt-3 border-b border-slate-100 dark:border-slate-800 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('perfil')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'perfil'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Perfil & Foto</span>
          </button>
          <button
            onClick={() => setActiveTab('condominio')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'condominio'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Dados do Condomínio</span>
          </button>
          {canManageUsers && (
            <button
              onClick={() => setActiveTab('usuarios')}
              className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'usuarios'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Usuários & Privilégios</span>
            </button>
          )}
          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('database')}
              className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'database'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Banco de Dados & Supabase</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('preferencias')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'preferencias'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Preferências & Tema</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* TAB 1: PERFIL & FOTO */}
          {activeTab === 'perfil' && (
            <form onSubmit={handleSaveProfile} className="space-y-5">
              {/* Avatar management section */}
              <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-5">
                {/* Photo preview with ring */}
                <div className="relative group shrink-0">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 ring-4 ring-emerald-500/30 dark:ring-emerald-500/20 shadow-md">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Foto de perfil"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-2xl font-bold uppercase">
                        {fullName ? fullName[0] : 'U'}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 rounded-full bg-slate-950/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Alterar Foto"
                  >
                    <Camera className="w-6 h-6" />
                    <span className="text-[9px] font-bold mt-1">Alterar</span>
                  </button>
                </div>

                {/* Upload action buttons */}
                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Foto de Perfil</h4>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Envie uma foto do seu computador ou escolha uma foto predefinida abaixo.
                    </p>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />

                  <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Fazer Upload de Imagem</span>
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => setAvatarUrl('')}
                        className="px-3 py-1.5 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer"
                      >
                        Remover Foto
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Preset Gallery */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Ou escolha uma foto predefinida:
                </span>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
                  {PRESET_AVATARS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAvatarUrl(preset.url)}
                      className={`relative rounded-2xl overflow-hidden aspect-square border-2 transition-all cursor-pointer ${
                        avatarUrl === preset.url
                          ? 'border-emerald-600 scale-105 shadow-md ring-2 ring-emerald-500/40'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                      }`}
                      title={preset.label}
                    >
                      <img
                        src={preset.url}
                        alt={preset.label}
                        className="w-full h-full object-cover"
                      />
                      {avatarUrl === preset.url && (
                        <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-600 rounded-full flex items-center justify-center text-[8px] text-white font-bold">
                          ✓
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom URL Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Ou cole um link direto da web para sua foto:
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={customUrlInput}
                    onChange={(e) => setCustomUrlInput(e.target.value)}
                    placeholder="https://exemplo.com/sua-foto.jpg"
                    className="flex-1 px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customUrlInput.trim()) {
                        setAvatarUrl(customUrlInput.trim());
                        setCustomUrlInput('');
                      }
                    }}
                    className="px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer"
                  >
                    Aplicar
                  </button>
                </div>
              </div>

              {/* User Data Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 98765-4321"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-400">
                  E-mail: <strong>{user?.email || 'admin@condor.com.br'}</strong>
                </span>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: CONDOMÍNIO */}
          {activeTab === 'condominio' && (
            <div className="space-y-4">
              <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Condomínio Ativo</span>
                  <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {currentCondominium?.name || 'Residencial Imperial Tower'}
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                    {currentCondominium?.address || 'Av. Paulista, 1000'} • {currentCondominium?.city || 'São Paulo'} - {currentCondominium?.state || 'SP'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <Building className="w-5 h-5" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">CNPJ</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {currentCondominium?.cnpj || '12.345.678/0001-90'}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Papel do Usuário</span>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 capitalize mt-0.5 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" />
                    <span>{currentRole || 'síndico'}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: USUÁRIOS & PRIVILÉGIOS (RBAC) - Visível apenas para Síndico e Superadmin */}
          {canManageUsers && activeTab === 'usuarios' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-4">
                  {/* Policy and action banner */}
                  <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 uppercase flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          Controle de Acessos RBAC
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {usersList.length} Usuários Cadastrados
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
                        Gestão de Usuários & Concessão de Privilégios
                      </h4>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                        Cadastre novos colaboradores e moradores, e defina papéis de acesso do condomínio.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsAddingUser(!isAddingUser)}
                      className="px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer self-start sm:self-auto shrink-0"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>{isAddingUser ? 'Fechar Formulário' : 'Cadastrar Novo Usuário'}</span>
                    </button>
                  </div>

                  {/* New User Form */}
                  {isAddingUser && (
                    <form
                      onSubmit={handleCreateUser}
                      className="p-5 rounded-3xl bg-white dark:bg-slate-800 border-2 border-emerald-500/40 dark:border-emerald-500/30 shadow-md space-y-4 animate-fadeIn"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                        <div>
                          <h5 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                            Cadastrar Novo Usuário e Conceder Privilégio
                          </h5>
                          <p className="text-[11px] text-slate-400">
                            Apenas o Síndico e o Super Administrador possuem autorização para registrar este acesso.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsAddingUser(false)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                            Nome Completo *
                          </label>
                          <input
                            type="text"
                            value={newUserFullName}
                            onChange={(e) => setNewUserFullName(e.target.value)}
                            placeholder="Ex: Beatriz Lima Duarte"
                            className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                            E-mail de Acesso *
                          </label>
                          <input
                            type="email"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            placeholder="Ex: beatriz@condor.com.br"
                            className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                            Telefone / WhatsApp
                          </label>
                          <input
                            type="text"
                            value={newUserPhone}
                            onChange={(e) => setNewUserPhone(e.target.value)}
                            placeholder="(11) 98765-4321"
                            className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                            Unidade / Posto
                          </label>
                          <input
                            type="text"
                            value={newUserUnit}
                            onChange={(e) => setNewUserUnit(e.target.value)}
                            placeholder="Ex: Apto 402-A ou Guarita Principal"
                            className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                          Privilégio / Papel Concedido *
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <label
                            className={`p-2.5 rounded-xl border flex flex-col cursor-pointer transition ${
                              newUserRole === 'morador'
                                ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 font-bold'
                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100/60 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="new-user-role"
                                value="morador"
                                checked={newUserRole === 'morador'}
                                onChange={() => setNewUserRole('morador')}
                                className="text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="text-xs">Morador</span>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 pl-5">Reservas, avisos e boletos</span>
                          </label>

                          <label
                            className={`p-2.5 rounded-xl border flex flex-col cursor-pointer transition ${
                              newUserRole === 'porteiro'
                                ? 'border-sky-600 bg-sky-50/60 dark:bg-sky-950/40 text-sky-950 dark:text-sky-200 font-bold'
                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100/60 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="new-user-role"
                                value="porteiro"
                                checked={newUserRole === 'porteiro'}
                                onChange={() => setNewUserRole('porteiro')}
                                className="text-sky-600 focus:ring-sky-500"
                              />
                              <span className="text-xs">Portaria & Acessos</span>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 pl-5">Guarita, encomendas e lockers</span>
                          </label>

                          <label
                            className={`p-2.5 rounded-xl border flex flex-col cursor-pointer transition ${
                              newUserRole === 'sindico'
                                ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 font-bold'
                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100/60 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="new-user-role"
                                value="sindico"
                                checked={newUserRole === 'sindico'}
                                onChange={() => setNewUserRole('sindico')}
                                className="text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="text-xs">Síndico Geral</span>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 pl-5">Gestão total e novos cadastros</span>
                          </label>

                          {isSuperAdmin && (
                            <label
                              className={`p-2.5 rounded-xl border flex flex-col cursor-pointer transition sm:col-span-3 ${
                                newUserRole === 'superadmin'
                                  ? 'border-purple-600 bg-purple-50/60 dark:bg-purple-950/40 text-purple-950 dark:text-purple-200 font-bold'
                                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100/60 dark:hover:bg-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name="new-user-role"
                                  value="superadmin"
                                  checked={newUserRole === 'superadmin'}
                                  onChange={() => setNewUserRole('superadmin')}
                                  className="text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-xs">Super Administrador (Acesso Geral Multi-Condomínios)</span>
                              </div>
                            </label>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsAddingUser(false)}
                          className="px-4 py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-xs cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmittingUser}
                          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm cursor-pointer"
                        >
                          {isSubmittingUser ? 'Cadastrando...' : 'Confirmar e Conceder Privilégio'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Role filter pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(['all', 'sindico', 'porteiro', 'morador', 'superadmin'] as const).map((roleKey) => {
                      const isActive = userRoleFilter === roleKey;
                      const label =
                        roleKey === 'all'
                          ? 'Todos os Usuários'
                          : roleKey === 'sindico'
                          ? 'Síndicos'
                          : roleKey === 'porteiro'
                          ? 'Portaria'
                          : roleKey === 'morador'
                          ? 'Moradores'
                          : 'Super Admins';
                      return (
                        <button
                          key={roleKey}
                          type="button"
                          onClick={() => setUserRoleFilter(roleKey)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                            isActive
                              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Users List with Privilege Selector */}
                  <div className="space-y-2">
                    {usersList
                      .filter((u) => (userRoleFilter === 'all' ? true : u.role === userRoleFilter))
                      .map((condoUser) => {
                        const isTargetSuperAdmin = condoUser.role === 'superadmin';
                        const canModifyTarget = !isTargetSuperAdmin || isSuperAdmin;

                        return (
                          <div
                            key={condoUser.id}
                            className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-600 transition"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200 shrink-0">
                                {condoUser.avatar_url ? (
                                  <img
                                    src={condoUser.avatar_url}
                                    alt={condoUser.full_name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  condoUser.full_name
                                    .split(' ')
                                    .map((n) => n[0])
                                    .slice(0, 2)
                                    .join('')
                                    .toUpperCase()
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h5 className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                                    {condoUser.full_name}
                                  </h5>
                                  {condoUser.unit_number && (
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700 font-medium">
                                      {condoUser.unit_number}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400">
                                  {condoUser.email} {condoUser.phone && `• ${condoUser.phone}`}
                                </p>
                              </div>
                            </div>

                            {/* Privilege Assignment Control & Log Realtime Access */}
                            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
                              {/* Log access permission toggle (síndico and superadmin have automatic access) */}
                              {condoUser.role !== 'sindico' && condoUser.role !== 'superadmin' ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleLogAccess(
                                      condoUser.id,
                                      condoUser.full_name,
                                      !condoUser.log_access_granted
                                    )
                                  }
                                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                                    condoUser.log_access_granted
                                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                      : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-600'
                                  }`}
                                  title="Conceder ou revogar visualização do Log em Tempo Real"
                                >
                                  <span>Log Realtime:</span>
                                  <span className={condoUser.log_access_granted ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : ''}>
                                    {condoUser.log_access_granted ? 'Liberado ✓' : 'Bloqueado ✕'}
                                  </span>
                                </button>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-200/50 dark:border-slate-700">
                                  Logs: Acesso Total
                                </span>
                              )}

                              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                                <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                                  Privilégio:
                                </span>
                                <select
                                  value={condoUser.role}
                                  disabled={!canModifyTarget}
                                  onChange={(e) =>
                                    handleRoleChange(condoUser.id, condoUser.full_name, e.target.value as CondominiumRole)
                                  }
                                  className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer disabled:opacity-50"
                                  title="Conceder ou alterar privilégio do usuário"
                                >
                                  <option value="morador" className="dark:bg-slate-900">Morador</option>
                                  <option value="porteiro" className="dark:bg-slate-900">Portaria</option>
                                  <option value="sindico" className="dark:bg-slate-900">Síndico</option>
                                  {isSuperAdmin && (
                                    <option value="superadmin" className="dark:bg-slate-900">Super Admin</option>
                                  )}
                                </select>
                              </div>

                              {canModifyTarget && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveUser(condoUser.id, condoUser.full_name)}
                                  className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition cursor-pointer"
                                  title="Revogar Acesso"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}

          {/* TAB 4: BANCO DE DADOS & SUPABASE (Exclusivo para Super Administrador) */}
          {isSuperAdmin && activeTab === 'database' && (
            <div className="space-y-4">
              <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Supabase PostgreSQL</h4>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Conectado
                  </span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-xs">
                  Instância Supabase configurada em <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono">https://hbxyzdqshjztunjlduvg.supabase.co</code>
                </p>
              </div>

              <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                      Script SQL de Migrações (Reservas e Portaria)
                    </h5>
                    <p className="text-[11px] text-slate-400">
                      Caso deseje recriar ou verificar as tabelas diretamente no painel do Supabase
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyMigrationScript}
                    className="px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1 cursor-pointer border border-emerald-200 dark:border-emerald-800"
                  >
                    {copiedMigration ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedMigration ? 'Copiado!' : 'Copiar SQL'}</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h5 className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                        Script SQL: Usuários de Teste (Morador & Porteiro)
                      </h5>
                      <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                        Supabase Seed
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Cria e ativa diretamente no banco: <strong>morador.teste@condor.com.br</strong> e <strong>porteiro.teste@condor.com.br</strong> (senha: <code className="font-mono">condor@2026</code>)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySeedUsersScript}
                    className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition shadow-sm shrink-0"
                  >
                    {copiedSeedUsers ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSeedUsers ? 'Copiado!' : 'Copiar SQL Seed'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PREFERÊNCIAS */}
          {activeTab === 'preferencias' && (
            <div className="space-y-4">
              <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Tema da Interface</h4>
                  <p className="text-slate-400 text-xs mt-0.5">Alterne entre o tema Claro e Escuro</p>
                </div>
                <ThemeToggle variant="segmented" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
