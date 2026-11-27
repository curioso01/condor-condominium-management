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
  Landmark,
  QrCode,
  Receipt,
  Eye,
  KeyRound,
  History,
  FileDown,
  Lock,
  ChevronLeft,
  ChevronRight,
  PawPrint,
  Clock,
  SlidersHorizontal,
  FileText,
  BellRing,
} from 'lucide-react';
import { userService, type CondominiumUser } from '../../services/userService';
import { unitService } from '../../services/unitService';
import { condominiumService } from '../../services/condominiumService';
import { avatarService } from '../../services/avatarService';
import { auditService, type AuditLogEntry } from '../../services/auditService';
import { lgpdService, LGPD_POLICY_VERSION } from '../../services/lgpdService';
import {
  getBrowserNotificationPermission,
  requestPushPermissionAndRegister,
} from '../../services/notificationPushService';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PremiumSelect } from '../ui/PremiumSelect';
import {
  DEFAULT_SUBSINDICO_PERMISSIONS,
  SUBSINDICO_PERMISSION_OPTIONS,
  formatRoleLabel,
  type CondominiumRole,
  type SubSindicoPermissionKey,
  type SubSindicoPermissions,
} from '../../types/database.types';
import {
  bankAccountService,
  PRESET_BANKS,
  type CondominiumBankSettings,
} from '../../services/bankAccountService';
import { BoletoModal } from './BoletoModal';

export type SettingsTab =
  | 'perfil'
  | 'condominio'
  | 'usuarios'
  | 'database'
  | 'preferencias'
  | 'banco'
  | 'auditoria'
  | 'privacidade';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: SettingsTab;
}

const PRESET_AVATARS = [
  {
    label: 'Executiva 1',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=240&auto=format&fit=crop&q=80',
  },
  {
    label: 'Executiva 2',
    url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=240&auto=format&fit=crop&q=80',
  },
  {
    label: 'Executivo 1',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80',
  },
  {
    label: 'Executivo 2',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&auto=format&fit=crop&q=80',
  },
  {
    label: 'Profissional 3',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80',
  },
  {
    label: 'Profissional 4',
    url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=240&auto=format&fit=crop&q=80',
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'perfil',
}) => {
  const {
    profile,
    user,
    memberships,
    currentCondominium,
    currentRole,
    updateProfile,
    updatePassword,
    refreshMemberships,
    canManageUsers,
    canViewAudit,
    isSuperAdmin,
    isSindico,
    isDemoSession,
  } = useAuth();
  const canManageBankSettings = isSuperAdmin || isSindico;

  const TIME_OPTIONS = Array.from({ length: 24 }, (_, h) => {
    const label = `${String(h).padStart(2, '0')}:00`;
    return { value: label, label };
  });

  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabButtonRefs = useRef<Partial<Record<SettingsTab, HTMLButtonElement | null>>>({});

  // Auto-centraliza suavemente a aba selecionada (revelando automaticamente as próximas abas da barra)
  useEffect(() => {
    if (!isOpen) return;
    const activeBtn = tabButtonRefs.current[activeTab];
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeTab, isOpen]);

  const scrollTabsBy = (delta: number) => {
    tabsContainerRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  // Profile editing state
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [copiedMigration, setCopiedMigration] = useState(false);

  // Logged-in password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Audit logs & LGPD state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [isExportingLgpd, setIsExportingLgpd] = useState(false);

  // Accessible confirmation dialog state (replaces window.confirm)
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    variant: 'danger' | 'primary';
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmLabel: 'Confirmar',
    variant: 'primary',
    onConfirm: () => {},
  });

  // Condominium edit & create state (Section 4.5)
  const [condoName, setCondoName] = useState(currentCondominium?.name || '');
  const [condoCnpj, setCondoCnpj] = useState(currentCondominium?.cnpj || '');
  const [condoAddress, setCondoAddress] = useState(currentCondominium?.address || '');
  const [condoCity, setCondoCity] = useState(currentCondominium?.city || '');
  const [condoState, setCondoState] = useState(currentCondominium?.state || 'SP');
  const [condoEnforceReservationHours, setCondoEnforceReservationHours] = useState(
    Boolean(currentCondominium?.default_reservation_time_limit)
  );
  const [condoResStartTime, setCondoResStartTime] = useState(
    (currentCondominium?.default_reservation_start_time || '08:00').slice(0, 5)
  );
  const [condoResEndTime, setCondoResEndTime] = useState(
    (currentCondominium?.default_reservation_end_time || '22:00').slice(0, 5)
  );
  const [isSavingCondo, setIsSavingCondo] = useState(false);

  const [isCreatingCondo, setIsCreatingCondo] = useState(false);
  const [newCondoName, setNewCondoName] = useState('');
  const [newCondoCnpj, setNewCondoCnpj] = useState('');
  const [newCondoAddress, setNewCondoAddress] = useState('');
  const [newCondoCity, setNewCondoCity] = useState('São Paulo');
  const [newCondoState, setNewCondoState] = useState('SP');
  const [isSubmittingNewCondo, setIsSubmittingNewCondo] = useState(false);

  // Bank settings state (isolated per condominium)
  const [bankSettings, setBankSettings] = useState<CondominiumBankSettings>(() =>
    bankAccountService.getSettings(currentCondominium?.id, currentCondominium?.name, currentCondominium?.cnpj)
  );
  const [isBoletoPreviewOpen, setIsBoletoPreviewOpen] = useState(false);
  const [isSavingBank, setIsSavingBank] = useState(false);

  // Users & Privileges state
  const [usersList, setUsersList] = useState<CondominiumUser[]>([]);
  const [availableBlocks, setAvailableBlocks] = useState<string[]>(['Bloco A', 'Bloco B']);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserCpf, setNewUserCpf] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserInitialPassword, setNewUserInitialPassword] = useState('Condor@2026');
  const [newUserApartment, setNewUserApartment] = useState('');
  const [newUserBlock, setNewUserBlock] = useState('Bloco A');
  const [newUserResidentType, setNewUserResidentType] = useState<'Proprietário' | 'Inquilino'>('Proprietário');
  const [newUserHasPet, setNewUserHasPet] = useState<boolean>(false);
  const [newUserRole, setNewUserRole] = useState<CondominiumRole>('morador');
  const [newUserPermissions, setNewUserPermissions] = useState<SubSindicoPermissions>({
    ...DEFAULT_SUBSINDICO_PERMISSIONS,
  });
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | CondominiumRole>('all');
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  // Sub-Síndico permissions editing popup state
  const [editingPermsUser, setEditingPermsUser] = useState<CondominiumUser | null>(null);
  const [editingPermsDraft, setEditingPermsDraft] = useState<SubSindicoPermissions>({
    ...DEFAULT_SUBSINDICO_PERMISSIONS,
  });
  const [isSavingPerms, setIsSavingPerms] = useState(false);

  // Push notification opt-in state
  const [pushStatus, setPushStatus] = useState(() => getBrowserNotificationPermission());
  const [isRequestingPush, setIsRequestingPush] = useState(false);

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
    } else if (defaultTab === 'auditoria' && !canManageUsers && !canViewAudit) {
      setActiveTab('perfil');
    } else if (defaultTab === 'database' && !isSuperAdmin) {
      setActiveTab('perfil');
    } else if (defaultTab === 'banco' && !canManageBankSettings) {
      setActiveTab('perfil');
    } else {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, canManageUsers, canViewAudit, isSuperAdmin, canManageBankSettings]);

  useEffect(() => {
    if (currentCondominium) {
      setCondoName(currentCondominium.name || '');
      setCondoCnpj(currentCondominium.cnpj || '');
      setCondoAddress(currentCondominium.address || '');
      setCondoCity(currentCondominium.city || '');
      setCondoState(currentCondominium.state || 'SP');
      setCondoEnforceReservationHours(Boolean(currentCondominium.default_reservation_time_limit));
      setCondoResStartTime((currentCondominium.default_reservation_start_time || '08:00').slice(0, 5));
      setCondoResEndTime((currentCondominium.default_reservation_end_time || '22:00').slice(0, 5));
    }
  }, [currentCondominium]);

  useEffect(() => {
    if (isOpen && currentCondominium?.id) {
      setPushStatus(getBrowserNotificationPermission());
      unitService.getUnitsByCondominium(currentCondominium.id).then((res) => {
        const blocks = unitService.getConsolidatedBlocks(currentCondominium.blocks, res.data || []);
        if (blocks.length > 0) {
          setAvailableBlocks(blocks);
          setNewUserBlock((prev) => (blocks.includes(prev) ? prev : blocks[0]));
        }
      });
    }
  }, [isOpen, currentCondominium?.id, currentCondominium?.blocks]);

  useEffect(() => {
    if (isOpen && currentCondominium?.id) {
      bankAccountService
        .fetchSettings(currentCondominium.id, currentCondominium.name, currentCondominium.cnpj)
        .then((res) => {
          setBankSettings(res.data);
        });
    }
  }, [isOpen, currentCondominium?.id, currentCondominium?.name, currentCondominium?.cnpj]);

  const handleSelectBankPreset = (code: string) => {
    const preset = PRESET_BANKS.find((b) => b.code === code);
    if (preset) {
      setBankSettings((prev) => ({
        ...prev,
        bankCode: preset.code,
        bankName: preset.fullName,
        walletCode: preset.defaultWallet,
      }));
    }
  };

  const handleSaveBankSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBank(true);
    try {
      const { data: updated, error } = await bankAccountService.saveSettingsAsync(
        currentCondominium?.id || '',
        bankSettings,
        profile?.full_name || 'Administrador'
      );
      if (error || !updated) {
        setFeedback(`Erro ao salvar configurações bancárias: ${error?.message || 'Falha na persistência remota.'}`);
        return;
      }
      setBankSettings(updated);
      setFeedback('Configuração do banco de recebimento de boletos confirmada no banco de dados!');
      setTimeout(() => setFeedback(null), 3500);
    } catch {
      setFeedback('Erro ao salvar configurações bancárias.');
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleResetBankSettings = () => {
    setConfirmState({
      isOpen: true,
      title: 'Restaurar configurações bancárias?',
      description:
        'As configurações de banco e chave Pix deste condomínio voltarão ao padrão inicial. Você poderá alterá-las novamente depois.',
      confirmLabel: 'Restaurar Padrão',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        if (!currentCondominium?.id) {
          setFeedback('Erro: condomínio ativo não identificado.');
          return;
        }
        const defaults = bankAccountService.resetSettings(
          currentCondominium.id,
          currentCondominium.name,
          currentCondominium.cnpj
        );
        const { data: updated, error } = await bankAccountService.saveSettingsAsync(
          currentCondominium.id,
          defaults,
          profile?.full_name || 'Administrador'
        );
        if (error) {
          setFeedback(`Erro ao restaurar configurações bancárias: ${error.message}`);
          return;
        }
        setBankSettings(updated || defaults);
        setFeedback('Configurações bancárias restauradas para o padrão.');
        setTimeout(() => setFeedback(null), 3500);
      },
    });
  };

  const handleSaveCondominium = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCondominium?.id) return;
    if (condoEnforceReservationHours && condoResStartTime >= condoResEndTime) {
      setFeedback('O horário de término das reservas precisa ser posterior ao horário de início.');
      return;
    }
    setIsSavingCondo(true);
    const { error } = await condominiumService.updateCondominium(
      currentCondominium.id,
      {
        name: condoName,
        cnpj: condoCnpj,
        address: condoAddress,
        city: condoCity,
        state: condoState,
        default_reservation_time_limit: condoEnforceReservationHours,
        default_reservation_start_time: condoEnforceReservationHours ? condoResStartTime : null,
        default_reservation_end_time: condoEnforceReservationHours ? condoResEndTime : null,
      },
      currentRole,
      [currentCondominium.id]
    );
    setIsSavingCondo(false);

    if (error) {
      setFeedback(`Erro ao atualizar dados do condomínio: ${error.message}`);
      return;
    }

    await refreshMemberships();
    setFeedback('Dados cadastrais e regras de horário do condomínio atualizados com sucesso!');
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleCreateCondominium = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      setFeedback('Acesso negado: apenas o Super Administrador pode cadastrar novos condomínios.');
      return;
    }
    setIsSubmittingNewCondo(true);
    const { data, error } = await condominiumService.createCondominium(
      {
        name: newCondoName,
        cnpj: newCondoCnpj,
        address: newCondoAddress,
        city: newCondoCity,
        state: newCondoState,
      },
      currentRole
    );
    setIsSubmittingNewCondo(false);

    if (error || !data) {
      setFeedback(`Erro ao cadastrar condomínio: ${error?.message || 'Falha na criação.'}`);
      return;
    }

    setIsCreatingCondo(false);
    setNewCondoName('');
    setNewCondoCnpj('');
    setNewCondoAddress('');
    await refreshMemberships();
    setFeedback(`Condomínio "${data.name}" cadastrado com sucesso!`);
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadUsers = useCallback(async () => {
    const condoId = currentCondominium?.id;
    if (!condoId) return;
    const { data, error } = await userService.fetchUsersByCondominium(condoId);
    if (error) {
      setFeedback(`Erro ao carregar usuários: ${error.message}`);
    }
    setUsersList(data);
  }, [currentCondominium?.id]);

  useEffect(() => {
    if (isOpen && activeTab === 'usuarios' && canManageUsers) {
      loadUsers();
    }
    if (isOpen && activeTab === 'auditoria' && (canManageUsers || canViewAudit) && currentCondominium?.id) {
      setIsLoadingAudit(true);
      auditService.getRecentLogs(currentCondominium.id, 40).then((res) => {
        setAuditLogs(res.data);
        setIsLoadingAudit(false);
      });
    }
  }, [isOpen, activeTab, canManageUsers, canViewAudit, loadUsers, currentCondominium?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !isOpen || confirmState.isOpen) return;
      if (editingPermsUser) {
        setEditingPermsUser(null);
        return;
      }
      if (isCreatingCondo) {
        setIsCreatingCondo(false);
        return;
      }
      if (isAddingUser) {
        setIsAddingUser(false);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, confirmState.isOpen, isCreatingCondo, isAddingUser, editingPermsUser]);

  // Upload de avatar via Supabase Storage (com compressão 256x256 WebP < 40 KB)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    setFeedback(null);

    const { url, storageUsed, error } = await avatarService.uploadAvatar(file, user?.id || '');
    setIsUploadingAvatar(false);

    if (error || !url) {
      setFeedback(error?.message || 'Erro ao carregar imagem.');
      return;
    }

    setAvatarUrl(url);
    setFeedback(
      storageUsed
        ? 'Foto enviada ao Supabase Storage! Clique em "Salvar Alterações" para confirmar.'
        : 'Foto otimizada e carregada! Clique em "Salvar Alterações" para confirmar.'
    );
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemoSession) {
      setFeedback('Alteração de senha disponível apenas em sessões reais autenticadas no Supabase.');
      return;
    }
    if (newPassword.length < 8) {
      setFeedback('A nova senha deve conter no mínimo 8 caracteres.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setFeedback('A confirmação da nova senha não coincide.');
      return;
    }

    setIsChangingPassword(true);
    const { error } = await updatePassword(newPassword);
    setIsChangingPassword(false);

    if (error) {
      setFeedback(`Erro ao atualizar senha: ${error.message}`);
      return;
    }

    setNewPassword('');
    setConfirmNewPassword('');
    setFeedback('Senha alterada com sucesso!');
    setTimeout(() => setFeedback(null), 4000);
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
    const sql = `-- Utilize EXCLUSIVAMENTE as migrations versionadas com RLS em supabase/migrations/:\n-- 1. supabase/DEPLOY_ALL_MIGRATIONS.sql\n-- 2. supabase/migrations/20261104000001_pilot_readiness_schema_and_rls.sql\n-- 3. supabase/migrations/20261123000001_security_lgpd_packages_and_rls.sql\n-- 4. supabase/migrations/20261124000001_subsindico_blocks_rules_and_push.sql`;
    navigator.clipboard?.writeText(sql);
    setCopiedMigration(true);
    setTimeout(() => setCopiedMigration(false), 3000);
  };

  // Helper labels for privileges
  const getRoleLabel = (role: CondominiumRole) => formatRoleLabel(role);

  const toggleNewUserPerm = (key: SubSindicoPermissionKey) => {
    setNewUserPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleEditingPerm = (key: SubSindicoPermissionKey) => {
    setEditingPermsDraft((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openEditPermissionsModal = (condoUser: CondominiumUser) => {
    setEditingPermsUser(condoUser);
    setEditingPermsDraft({
      ...DEFAULT_SUBSINDICO_PERMISSIONS,
      ...(condoUser.permissions || {}),
    });
  };

  const handleSaveSubSindicoPermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPermsUser || !currentCondominium?.id) return;
    setIsSavingPerms(true);
    const res = await userService.updateSubSindicoPermissions(
      editingPermsUser.id,
      currentCondominium.id,
      editingPermsDraft,
      currentRole
    );
    setIsSavingPerms(false);
    if (res.error) {
      setFeedback(`Erro ao salvar privilégios do Sub-Síndico: ${res.error.message}`);
      return;
    }
    setFeedback(`Privilégios do Sub-Síndico ${editingPermsUser.full_name} atualizados com sucesso!`);
    setEditingPermsUser(null);
    loadUsers();
  };

  const formatAuditActionLabel = (action: string) => {
    const map: Record<string, string> = {
      LGPD_DATA_EXPORT: 'Exportação de Dados Pessoais (LGPD)',
      LGPD_ANONYMIZATION_REQUEST: 'Solicitação de Anonimização / Exclusão (LGPD)',
      LGPD_CONSENT_ACCEPTED: 'Aceite de Termos & Privacidade (LGPD)',
      USER_ROLE_UPDATED: 'Alteração de Papel / Privilégio',
      SUBSINDICO_PERMISSIONS_UPDATED: 'Privilégios do Sub-Síndico Atualizados',
      USER_LOG_ACCESS_UPDATED: 'Permissão de Log Realtime Alterada',
      USER_REMOVED: 'Revogação de Acesso de Usuário',
      CONDO_BLOCK_RENAMED: 'Bloco / Torre Renomeado',
      CONDO_BLOCK_DELETED: 'Bloco / Torre Excluído',
      CONDO_UPDATED: 'Dados do Condomínio Atualizados',
    };
    return map[action] || action;
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageUsers) {
      setFeedback('Acesso negado: apenas o Síndico e o Super Administrador podem cadastrar novos usuários.');
      return;
    }
    if (!currentCondominium?.id) {
      setFeedback('Erro: selecione um condomínio válido antes de vincular usuários.');
      return;
    }
    if (!newUserFullName.trim() || !newUserEmail.trim()) {
      setFeedback('Por favor, informe ao menos o nome completo e o e-mail do usuário.');
      return;
    }

      if (newUserInitialPassword.trim().length > 0 && newUserInitialPassword.trim().length < 8) {
      setFeedback('A senha provisória de 1º acesso deve conter no mínimo 8 caracteres.');
      return;
    }

    setIsSubmittingUser(true);

    const condoId = currentCondominium.id;
    const formattedUnit = newUserApartment.trim()
      ? `${newUserApartment.trim()} (${newUserBlock})`
      : '';
    const passwordUsed = newUserInitialPassword.trim() || 'Condor@2026';

    const res = await userService.createUser(
      {
        condominium_id: condoId,
        full_name: newUserFullName,
        email: newUserEmail,
        phone: newUserPhone,
        cpf: newUserCpf,
        unit_number: formattedUnit,
        block: newUserBlock,
        resident_type: newUserResidentType,
        has_pet: newUserHasPet,
        role: newUserRole,
        permissions: newUserRole === 'subsindico' ? newUserPermissions : undefined,
        initial_password: passwordUsed,
      },
      currentRole
    );

    if (res.error) {
      setIsSubmittingUser(false);
      setFeedback(`Erro: ${res.error.message}`);
      return;
    }

    // Somente vincula/cria unidade no censo APÓS a criação/vinculação do usuário ter sido confirmada no Supabase
    if (newUserRole === 'morador' || newUserApartment.trim()) {
      await unitService.registerOrUpdateResidentUnit({
        condominium_id: condoId,
        identifier: newUserApartment.trim() || '101',
        block: newUserBlock.trim() || availableBlocks[0] || 'Bloco A',
        residentName: newUserFullName.trim(),
        residentType: newUserResidentType,
        hasPet: newUserHasPet,
        phone: newUserPhone,
        cpf: newUserCpf,
        email: newUserEmail,
      });
    }

    setIsSubmittingUser(false);

    setFeedback(
      `Usuário ${newUserFullName} cadastrado com sucesso como ${getRoleLabel(newUserRole)}! Para o 1º acesso, informe o e-mail ${newUserEmail.trim().toLowerCase()} e a senha provisória "${passwordUsed}".`
    );
    setIsAddingUser(false);
    setNewUserFullName('');
    setNewUserCpf('');
    setNewUserEmail('');
    setNewUserPhone('');
    setNewUserInitialPassword('Condor@2026');
    setNewUserApartment('');
    setNewUserBlock(availableBlocks[0] || 'Bloco A');
    setNewUserResidentType('Proprietário');
    setNewUserHasPet(false);
    setNewUserRole('morador');
    setNewUserPermissions({ ...DEFAULT_SUBSINDICO_PERMISSIONS });
    loadUsers();
  };

  const handleRoleChange = async (
    targetUser: CondominiumUser,
    newRole: CondominiumRole
  ) => {
    if (!canManageUsers) {
      setFeedback('Acesso negado: apenas o Síndico e o Super Administrador podem conceder ou alterar privilégios.');
      return;
    }
    if (!currentCondominium?.id) {
      setFeedback('Erro: condomínio ativo não identificado.');
      return;
    }

    const res = await userService.updateUserRole(
      targetUser.id,
      currentCondominium.id,
      newRole,
      currentRole,
      user?.id,
      newRole === 'subsindico'
        ? { ...DEFAULT_SUBSINDICO_PERMISSIONS, ...(targetUser.permissions || {}) }
        : undefined
    );

    if (res.error) {
      setFeedback(`Erro ao conceder privilégio: ${res.error.message}`);
      return;
    }

    setFeedback(`Privilégio de ${targetUser.full_name} atualizado para "${getRoleLabel(newRole)}" com sucesso.`);
    await loadUsers();
    if (newRole === 'subsindico') {
      openEditPermissionsModal({
        ...targetUser,
        role: 'subsindico',
        permissions: { ...DEFAULT_SUBSINDICO_PERMISSIONS, ...(targetUser.permissions || {}) },
      });
    }
  };

  const handleToggleLogAccess = async (targetUserId: string, targetUserName: string, newAccess: boolean) => {
    if (!canManageUsers) {
      setFeedback('Acesso negado: apenas o Síndico e o Super Administrador podem conceder acesso aos logs.');
      return;
    }
    if (!currentCondominium?.id) {
      setFeedback('Erro: condomínio ativo não identificado.');
      return;
    }

    const res = await userService.setLogAccess(
      targetUserId,
      currentCondominium.id,
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

  const handleRemoveUser = (targetUserId: string, targetUserName: string) => {
    if (!canManageUsers) {
      setFeedback('Acesso negado: apenas o Síndico e o Super Administrador podem remover usuários.');
      return;
    }
    if (!currentCondominium?.id) {
      setFeedback('Erro: condomínio ativo não identificado.');
      return;
    }

    const condoId = currentCondominium.id;
    setConfirmState({
      isOpen: true,
      title: `Revogar acesso de ${targetUserName}?`,
      description:
        'O usuário perderá imediatamente o acesso aos dados deste condomínio. A ação ficará registrada na trilha de auditoria.',
      confirmLabel: 'Revogar Acesso',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        const res = await userService.removeUser(targetUserId, condoId, currentRole);
        if (res.error) {
          setFeedback(`Erro ao remover: ${res.error.message}`);
          return;
        }
        setFeedback(`Acesso de ${targetUserName} revogado com sucesso.`);
        loadUsers();
      },
    });
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
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-4xl w-full max-w-4xl lg:max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-gradient-to-r from-slate-50/50 to-white dark:from-slate-900 dark:to-slate-800/60 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-extrabold flex items-center justify-center text-lg shadow-sm shrink-0">
              <Settings className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h3 id="settings-modal-title" className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Configurações
                </h3>
                <span className="text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                  {currentCondominium?.name || 'Condomínio'}
                </span>
              </div>
              <p className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Perfil de acesso, foto do usuário, dados do condomínio e status da infraestrutura
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors cursor-pointer shrink-0"
            aria-label="Fechar configurações"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="mx-6 sm:mx-8 my-4 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-semibold flex items-center gap-3 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="flex-1">{feedback}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Tabs Bar com Auto-Scroll Suave + Controles Laterais */}
        <div className="relative flex items-center border-b border-slate-200 dark:border-slate-800 px-2 sm:px-3 pt-4 shrink-0">
          <button
            type="button"
            onClick={() => scrollTabsBy(-220)}
            aria-label="Rolar abas para a esquerda"
            className="hidden sm:flex w-7 h-7 mb-2.5 rounded-full items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div
            ref={tabsContainerRef}
            role="tablist"
            aria-label="Seções de Configurações"
            className="flex-1 flex items-center gap-2 sm:gap-4 px-2 sm:px-3 overflow-x-auto scroll-smooth no-scrollbar text-xs sm:text-sm font-semibold"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'perfil'}
              ref={(el) => { tabButtonRefs.current.perfil = el; }}
              onClick={() => setActiveTab('perfil')}
              className={`pb-3.5 px-3 border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'perfil'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Perfil &amp; Foto</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'condominio'}
              ref={(el) => { tabButtonRefs.current.condominio = el; }}
              onClick={() => setActiveTab('condominio')}
              className={`pb-3.5 px-3 border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'condominio'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>Dados do Condomínio</span>
            </button>
            {canManageUsers && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'usuarios'}
                ref={(el) => { tabButtonRefs.current.usuarios = el; }}
                onClick={() => setActiveTab('usuarios')}
                className={`pb-3.5 px-3 border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'usuarios'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Usuários &amp; Privilégios</span>
              </button>
            )}
            {canManageBankSettings && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'banco'}
                ref={(el) => { tabButtonRefs.current.banco = el; }}
                onClick={() => setActiveTab('banco')}
                className={`pb-3.5 px-3 border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'banco'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Landmark className="w-4 h-4" />
                <span>Banco de Recebimento &amp; Boletos</span>
              </button>
            )}
            {(canManageUsers || canViewAudit) && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'auditoria'}
                ref={(el) => { tabButtonRefs.current.auditoria = el; }}
                onClick={() => setActiveTab('auditoria')}
                className={`pb-3.5 px-3 border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'auditoria'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <History className="w-4 h-4" />
                <span>Auditoria</span>
              </button>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'privacidade'}
              ref={(el) => { tabButtonRefs.current.privacidade = el; }}
              onClick={() => setActiveTab('privacidade')}
              className={`pb-3.5 px-3 border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'privacidade'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>Privacidade &amp; LGPD</span>
            </button>
            {isSuperAdmin && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'database'}
                ref={(el) => { tabButtonRefs.current.database = el; }}
                onClick={() => setActiveTab('database')}
                className={`pb-3.5 px-3 border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'database'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Database className="w-4 h-4" />
                <span>Banco de Dados &amp; Supabase</span>
              </button>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'preferencias'}
              ref={(el) => { tabButtonRefs.current.preferencias = el; }}
              onClick={() => setActiveTab('preferencias')}
              className={`pb-3.5 px-3 border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'preferencias'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Preferências &amp; Tema</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => scrollTabsBy(220)}
            aria-label="Rolar abas para a direita"
            className="hidden sm:flex w-7 h-7 mb-2.5 rounded-full items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 min-h-0 p-6 sm:p-8 pt-7 overflow-y-auto space-y-6 text-xs sm:text-sm">
          {/* TAB 1: PERFIL & FOTO */}
          {activeTab === 'perfil' && (
            <>
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
                      disabled={isUploadingAvatar}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingAvatar ? 'Enviando...' : 'Fazer Upload de Imagem'}</span>
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
                  E-mail: <strong>{user?.email || '—'}</strong>
                </span>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
                </button>
              </div>
            </form>
            <form
              onSubmit={handleChangePassword}
              className="mt-5 p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-3"
            >
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                  Segurança da Conta — Alterar Minha Senha
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                    Nova Senha (mín. 8 caracteres)
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    minLength={8}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                    Confirmar Nova Senha
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    minLength={8}
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isChangingPassword || isDemoSession}
                  className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isChangingPassword ? 'Atualizando...' : 'Atualizar Senha'}
                </button>
              </div>
            </form>
            </>
          )}

          {/* TAB 2: CONDOMÍNIO (Section 4.5: Edição para Síndico/Superadmin e Cadastro para Superadmin) */}
          {activeTab === 'condominio' && (
            <div className="space-y-5">
              <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Condomínio Ativo</span>
                  <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {currentCondominium?.name || 'Condomínio Residencial'}
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                    {currentCondominium?.address || 'Endereço não informado'} • {currentCondominium?.city || 'São Paulo'} - {currentCondominium?.state || 'SP'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => setIsCreatingCondo((prev) => !prev)}
                      className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                    >
                      {isCreatingCondo ? 'Cancelar Novo Condomínio' : '+ Cadastrar Novo Condomínio'}
                    </button>
                  )}
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
                    <Building className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">CNPJ</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {currentCondominium?.cnpj || 'Não informado'}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Papel do Usuário</span>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" />
                    <span>{formatRoleLabel(currentRole)}</span>
                  </p>
                </div>
              </div>

              {/* Popup Modal: Cadastrar Novo Condomínio (Exclusivo SuperAdmin) */}
              {isSuperAdmin && isCreatingCondo && (
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Cadastrar Novo Condomínio"
                  className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-sm animate-fadeIn"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setIsCreatingCondo(false);
                  }}
                >
                  <form
                    onSubmit={handleCreateCondominium}
                    className="w-full max-w-xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                  >
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
                          <Building className="w-5 h-5" />
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                            Cadastrar Novo Condomínio
                          </h5>
                          <p className="text-[11px] text-slate-400">
                            Exclusivo Super Administrador • Dados isolados por condomínio
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsCreatingCondo(false)}
                        aria-label="Fechar cadastro de condomínio"
                        className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex-1 min-h-0 p-6 overflow-y-auto">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                            Nome do Condomínio *
                          </label>
                          <input
                            type="text"
                            value={newCondoName}
                            onChange={(e) => setNewCondoName(e.target.value)}
                            placeholder="Ex: Condomínio Parque das Acácias"
                            className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                            CNPJ
                          </label>
                          <input
                            type="text"
                            value={newCondoCnpj}
                            onChange={(e) => setNewCondoCnpj(e.target.value)}
                            placeholder="00.000.000/0001-00"
                            className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                            Endereço Completo
                          </label>
                          <input
                            type="text"
                            value={newCondoAddress}
                            onChange={(e) => setNewCondoAddress(e.target.value)}
                            placeholder="Rua, Número e Bairro"
                            className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                            Cidade
                          </label>
                          <input
                            type="text"
                            value={newCondoCity}
                            onChange={(e) => setNewCondoCity(e.target.value)}
                            className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                            UF (Estado)
                          </label>
                          <input
                            type="text"
                            maxLength={2}
                            value={newCondoState}
                            onChange={(e) => setNewCondoState(e.target.value.toUpperCase())}
                            className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex justify-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsCreatingCondo(false)}
                        className="px-4 py-2 rounded-full text-xs font-semibold text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingNewCondo}
                        className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-pill cursor-pointer"
                      >
                        {isSubmittingNewCondo ? 'Cadastrando...' : 'Confirmar Cadastro'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Formulário de Edição do Condomínio Ativo (Síndico Autorizado ou SuperAdmin) */}
              {(isSindico || isSuperAdmin) && currentCondominium && (
                <form
                  onSubmit={handleSaveCondominium}
                  className="p-5 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      Editar Dados Cadastrais do Condomínio
                    </h5>
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full">
                      {isSuperAdmin ? 'Super Admin' : 'Síndico Autorizado'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                        Nome do Condomínio *
                      </label>
                      <input
                        type="text"
                        value={condoName}
                        onChange={(e) => setCondoName(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                        CNPJ
                      </label>
                      <input
                        type="text"
                        value={condoCnpj}
                        onChange={(e) => setCondoCnpj(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                        Endereço
                      </label>
                      <input
                        type="text"
                        value={condoAddress}
                        onChange={(e) => setCondoAddress(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                        Cidade
                      </label>
                      <input
                        type="text"
                        value={condoCity}
                        onChange={(e) => setCondoCity(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                        UF
                      </label>
                      <input
                        type="text"
                        maxLength={2}
                        value={condoState}
                        onChange={(e) => setCondoState(e.target.value.toUpperCase())}
                        className="w-full px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                      />
                    </div>
                  </div>

                  {/* Regra Padrão Opcional de Limite de Horário para Reservas */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <h6 className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                            Limite Padrão de Horário para Reservas de Espaços
                          </h6>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Opcional. Desativado = horário livre por padrão. Você também pode definir regras individuais por espaço comum.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={condoEnforceReservationHours}
                        onClick={() => setCondoEnforceReservationHours((prev) => !prev)}
                        className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 flex items-center ${
                          condoEnforceReservationHours
                            ? 'bg-emerald-600 justify-end'
                            : 'bg-slate-300 dark:bg-slate-700 justify-start'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-white shadow-sm block" />
                      </button>
                    </div>

                    {condoEnforceReservationHours && (
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Horário Inicial Permitido
                          </label>
                          <PremiumSelect
                            ariaLabel="Horário inicial padrão de reservas"
                            size="sm"
                            icon={<Clock className="w-3.5 h-3.5" />}
                            value={condoResStartTime}
                            onChange={setCondoResStartTime}
                            options={TIME_OPTIONS}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Horário Limite de Término
                          </label>
                          <PremiumSelect
                            ariaLabel="Horário final padrão de reservas"
                            size="sm"
                            icon={<Clock className="w-3.5 h-3.5" />}
                            value={condoResEndTime}
                            onChange={setCondoResEndTime}
                            options={TIME_OPTIONS}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingCondo}
                      className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingCondo ? 'Salvando...' : 'Salvar Dados do Condomínio'}</span>
                    </button>
                  </div>
                </form>
              )}
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

                  {/* Popup Modal: Cadastrar Novo Usuário */}
                  {isAddingUser && (
                    <div
                      role="dialog"
                      aria-modal="true"
                      aria-label="Cadastrar Novo Usuário e Conceder Privilégio"
                      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-sm animate-fadeIn"
                      onClick={(e) => {
                        if (e.target === e.currentTarget) setIsAddingUser(false);
                      }}
                    >
                      <form
                        onSubmit={handleCreateUser}
                        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
                      >
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900 shrink-0">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
                              <UserPlus className="w-5 h-5" />
                            </div>
                            <div>
                              <h5 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                                Cadastrar Novo Usuário e Conceder Privilégio
                              </h5>
                              <p className="text-[11px] text-slate-400">
                                Apenas o Síndico e o Super Administrador possuem autorização para registrar este acesso.
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsAddingUser(false)}
                            aria-label="Fechar cadastro de usuário"
                            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 cursor-pointer shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex-1 min-h-0 p-6 overflow-y-auto space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                                Nome Completo *
                              </label>
                              <input
                                type="text"
                                value={newUserFullName}
                                onChange={(e) => setNewUserFullName(e.target.value)}
                                placeholder="Ex: Beatriz Lima Duarte"
                                className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                                CPF
                              </label>
                              <input
                                type="text"
                                value={newUserCpf}
                                onChange={(e) => setNewUserCpf(e.target.value)}
                                placeholder="000.000.000-00"
                                className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                                className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                                placeholder="(21) 99999-0000"
                                className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                                Senha Provisória de 1º Acesso (mín. 8 caracteres) *
                              </label>
                              <input
                                type="text"
                                minLength={8}
                                value={newUserInitialPassword}
                                onChange={(e) => setNewUserInitialPassword(e.target.value)}
                                placeholder="Ex: Condor@2026"
                                className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                required
                              />
                              <p className="text-[10px] text-slate-400 mt-1">
                                Informe esta senha provisória ao usuário para o 1º login (ele poderá alterá-la em Configurações → Perfil &amp; Foto). Se o e-mail já possuir conta, a senha atual dele é mantida.
                              </p>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                                Apartamento / Unidade *
                              </label>
                              <input
                                type="text"
                                value={newUserApartment}
                                onChange={(e) => setNewUserApartment(e.target.value)}
                                placeholder="Ex: 402 ou 104"
                                className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                                Bloco / Torre *
                              </label>
                              <PremiumSelect
                                ariaLabel="Selecionar Bloco ou Torre"
                                size="md"
                                value={newUserBlock}
                                onChange={setNewUserBlock}
                                options={availableBlocks.map((b) => ({ value: b, label: b }))}
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                                Vínculo do Morador *
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setNewUserResidentType('Proprietário')}
                                  className={`py-2.5 px-3 rounded-2xl text-xs font-semibold border transition text-center cursor-pointer ${
                                    newUserResidentType === 'Proprietário'
                                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-bold'
                                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  Proprietário
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setNewUserResidentType('Inquilino')}
                                  className={`py-2.5 px-3 rounded-2xl text-xs font-semibold border transition text-center cursor-pointer ${
                                    newUserResidentType === 'Inquilino'
                                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-bold'
                                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  Inquilino
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                                Possui Pet / Animal de Estimação? *
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setNewUserHasPet(true)}
                                  className={`py-2.5 px-3 rounded-2xl text-xs font-semibold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                    newUserHasPet
                                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-bold'
                                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  <PawPrint className="w-3.5 h-3.5" />
                                  <span>Sim (Tem Pet)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setNewUserHasPet(false)}
                                  className={`py-2.5 px-3 rounded-2xl text-xs font-semibold border transition text-center cursor-pointer ${
                                    !newUserHasPet
                                      ? 'border-slate-800 dark:border-slate-300 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold'
                                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  Não possui
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                              Privilégio / Papel Concedido *
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                                <span className="text-[10px] text-slate-400 mt-1 pl-5">Mural, reservas, boletos e encomendas</span>
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
                                  <span className="text-xs">Portaria &amp; Acessos</span>
                                </div>
                                <span className="text-[10px] text-slate-400 mt-1 pl-5">Guarita, encomendas e abrir OS</span>
                              </label>

                              <label
                                className={`p-2.5 rounded-xl border flex flex-col cursor-pointer transition ${
                                  newUserRole === 'subsindico'
                                    ? 'border-teal-600 bg-teal-50/60 dark:bg-teal-950/40 text-teal-950 dark:text-teal-200 font-bold'
                                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100/60 dark:hover:bg-slate-800'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name="new-user-role"
                                    value="subsindico"
                                    checked={newUserRole === 'subsindico'}
                                    onChange={() => setNewUserRole('subsindico')}
                                    className="text-teal-600 focus:ring-teal-500"
                                  />
                                  <span className="text-xs">Sub-Síndico</span>
                                </div>
                                <span className="text-[10px] text-slate-400 mt-1 pl-5">Privilégios personalizados abaixo</span>
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
                                <span className="text-[10px] text-slate-400 mt-1 pl-5">Gestão total e cadastros</span>
                              </label>

                              {isSuperAdmin && (
                                <label
                                  className={`p-2.5 rounded-xl border flex flex-col cursor-pointer transition sm:col-span-2 ${
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

                            {newUserRole === 'subsindico' && (
                              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2.5">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div>
                                    <p className="text-[11px] font-extrabold text-teal-700 dark:text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                                      <SlidersHorizontal className="w-3.5 h-3.5" />
                                      Privilégios Autorizados ao Sub-Síndico
                                    </p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                      Marque exatamente o que este Sub-Síndico poderá operar (validado no servidor e banco de dados).
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const all: SubSindicoPermissions = {};
                                        SUBSINDICO_PERMISSION_OPTIONS.forEach((opt) => {
                                          all[opt.key] = true;
                                        });
                                        setNewUserPermissions(all);
                                      }}
                                      className="px-2 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 text-[10px] font-bold hover:bg-teal-100 transition cursor-pointer"
                                    >
                                      Marcar todos
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setNewUserPermissions({})}
                                      className="px-2 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold hover:bg-slate-300/70 transition cursor-pointer"
                                    >
                                      Limpar
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {SUBSINDICO_PERMISSION_OPTIONS.map((opt) => {
                                    const checked = Boolean(newUserPermissions[opt.key]);
                                    return (
                                      <label
                                        key={opt.key}
                                        className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                                          checked
                                            ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/40'
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleNewUserPerm(opt.key)}
                                          className="mt-0.5 w-3.5 h-3.5 rounded accent-teal-600 cursor-pointer shrink-0"
                                        />
                                        <div className="min-w-0">
                                          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 block leading-tight">
                                            {opt.label}
                                          </span>
                                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-snug">
                                            {opt.description}
                                          </span>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex items-center justify-end gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setIsAddingUser(false)}
                            className="px-4 py-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 font-semibold text-xs cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmittingUser}
                            className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-pill cursor-pointer"
                          >
                            {isSubmittingUser ? 'Cadastrando...' : 'Confirmar e Conceder Privilégio'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Role filter pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(['all', 'sindico', 'subsindico', 'porteiro', 'morador', 'superadmin'] as const).map((roleKey) => {
                      const isActive = userRoleFilter === roleKey;
                      const label =
                        roleKey === 'all'
                          ? 'Todos os Usuários'
                          : roleKey === 'sindico'
                          ? 'Síndicos'
                          : roleKey === 'subsindico'
                          ? 'Sub-Síndicos'
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

                              {condoUser.role === 'subsindico' && canModifyTarget && (
                                <button
                                  type="button"
                                  onClick={() => openEditPermissionsModal(condoUser)}
                                  className="px-2.5 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                                  title="Configurar privilégios granulares deste Sub-Síndico"
                                >
                                  <SlidersHorizontal className="w-3 h-3" />
                                  <span>
                                    Privilégios (
                                    {
                                      SUBSINDICO_PERMISSION_OPTIONS.filter(
                                        (opt) => condoUser.permissions?.[opt.key]
                                      ).length
                                    }
                                    /{SUBSINDICO_PERMISSION_OPTIONS.length})
                                  </span>
                                </button>
                              )}

                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase hidden sm:inline">
                                  Papel:
                                </span>
                                <PremiumSelect
                                  size="xs"
                                  className="w-36"
                                  ariaLabel={`Alterar privilégio de ${condoUser.full_name}`}
                                  icon={<Shield className="w-3.5 h-3.5" />}
                                  value={condoUser.role}
                                  disabled={!canModifyTarget}
                                  onChange={(val) =>
                                    handleRoleChange(condoUser, val as CondominiumRole)
                                  }
                                  options={[
                                    { value: 'morador', label: 'Morador' },
                                    { value: 'porteiro', label: 'Portaria' },
                                    { value: 'subsindico', label: 'Sub-Síndico' },
                                    { value: 'sindico', label: 'Síndico' },
                                    ...(isSuperAdmin ? [{ value: 'superadmin', label: 'Super Admin' }] : []),
                                  ]}
                                />
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
                  Instância Supabase ativa:{' '}
                  <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono">
                    {import.meta.env.VITE_SUPABASE_URL
                      ? new URL(import.meta.env.VITE_SUPABASE_URL).host
                      : 'Não configurado (.env)'}
                  </code>
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

              <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <h5 className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                        Isolamento Multi-Condomínio &amp; Row Level Security (RLS)
                      </h5>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Todas as 18 tabelas operacionais operam com RLS ativo, isolando rigorosamente moradores, unidades, boletos, encomendas e trilha de auditoria por condomínio.
                    </p>
                  </div>
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full font-bold shrink-0">
                    100% Protegido
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB AUDITORIA: TRILHA DE AUDITORIA DO CONDOMÍNIO */}
          {(canManageUsers || canViewAudit) && activeTab === 'auditoria' && (
            <div className="space-y-4">
              <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                    <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Trilha de Auditoria Operacional &amp; LGPD</span>
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                    Histórico imutável das operações críticas (alterações de papéis, solicitações LGPD e gestão de blocos) em {currentCondominium?.name || 'este condomínio'}.
                  </p>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                  {auditLogs.length} eventos
                </span>
              </div>

              {isLoadingAudit ? (
                <div className="p-8 text-center text-xs text-slate-400">Carregando trilha de auditoria...</div>
              ) : auditLogs.length === 0 ? (
                <div className="p-8 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                  Nenhum evento de auditoria registrado ainda para este condomínio.
                </div>
              ) : (
                <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[380px] overflow-y-auto">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="p-3.5 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800 dark:text-slate-100">
                              {formatAuditActionLabel(log.action)}
                            </span>
                            <span className="font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md">
                              {log.action}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                            Registro na tabela <code className="font-mono">{log.entity_table}</code>
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB PRIVACIDADE & LGPD */}
          {activeTab === 'privacidade' && (
            <div className="space-y-4">
              <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Proteção de Dados &amp; LGPD (Lei nº 13.709/2018)</span>
                  </h4>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Versão {LGPD_POLICY_VERSION}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Seus dados pessoais são isolados por condomínio via Row Level Security (RLS) no banco de dados. O condomínio atua como <strong>Controlador</strong> e a plataforma Condor como <strong>Operadora de Dados</strong>. Toda exportação ou pedido de anonimização fica registrado automaticamente na aba Auditoria para prestação de contas.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3">
                  <div>
                    <h5 className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                      Portabilidade dos Meus Dados (Art. 18, V)
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Exporte um relatório oficial formatado em <strong>PDF</strong> ou em texto legível (<strong>TXT</strong>) contendo seu perfil e vínculos condominiais cadastrados.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      disabled={isExportingLgpd || !user?.id}
                      onClick={async () => {
                        if (!user?.id) return;
                        setIsExportingLgpd(true);
                        const { error } = await lgpdService.exportMyPersonalDataPdf({
                          userId: user.id,
                          email: user.email,
                          profile,
                          memberships,
                          condominiumId: currentCondominium?.id,
                        });
                        setIsExportingLgpd(false);
                        setFeedback(
                          error
                            ? `Erro ao exportar dados em PDF: ${error.message}`
                            : 'Relatório oficial em PDF aberto para impressão ou salvamento!'
                        );
                      }}
                      className="flex-1 py-2.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      <span>{isExportingLgpd ? 'Gerando...' : 'Baixar em PDF'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isExportingLgpd || !user?.id}
                      onClick={async () => {
                        if (!user?.id) return;
                        setIsExportingLgpd(true);
                        const { error } = await lgpdService.exportMyPersonalDataTxt({
                          userId: user.id,
                          email: user.email,
                          profile,
                          memberships,
                          condominiumId: currentCondominium?.id,
                        });
                        setIsExportingLgpd(false);
                        setFeedback(
                          error
                            ? `Erro ao exportar dados em TXT: ${error.message}`
                            : 'Arquivo TXT com seus dados pessoais baixado com sucesso!'
                        );
                      }}
                      className="py-2.5 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>TXT</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3">
                  <div>
                    <h5 className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                      Solicitar Anonimização / Exclusão (Art. 18, VI)
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Registra formalmente sua solicitação junto à administração do condomínio (respeitando obrigações legais fiscais/contábeis).
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!user?.id}
                    onClick={() => {
                      setConfirmState({
                        isOpen: true,
                        title: 'Registrar solicitação de anonimização LGPD?',
                        description:
                          'Uma solicitação formal será registrada na trilha de conformidade LGPD para revisão pela administração do condomínio.',
                        confirmLabel: 'Registrar Solicitação',
                        variant: 'danger',
                        onConfirm: async () => {
                          setConfirmState((prev) => ({ ...prev, isOpen: false }));
                          if (!user?.id) return;
                          const { error } = await lgpdService.recordConsentOrRequest({
                            userId: user.id,
                            condominiumId: currentCondominium?.id,
                            consentType: 'anonymization_request',
                            metadata: { requested_by_email: user.email || null },
                          });
                          setFeedback(
                            error
                              ? `Erro ao registrar solicitação: ${error.message}`
                              : 'Solicitação LGPD registrada com sucesso na trilha de auditoria.'
                          );
                        },
                      });
                    }}
                    className="w-full py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold text-xs transition cursor-pointer"
                  >
                    Solicitar Anonimização de Dados
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PREFERÊNCIAS */}
          {activeTab === 'preferencias' && (
            <div className="space-y-4">
              <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Tema da Interface</h4>
                  <p className="text-slate-400 text-xs mt-0.5">Alterne entre o tema Claro e Escuro</p>
                </div>
                <ThemeToggle variant="segmented" />
              </div>

              <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <BellRing className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      Notificações Push (Comunicados &amp; Encomendas)
                    </h4>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 leading-relaxed">
                      Receba alertas instantâneos neste dispositivo sempre que a síndica publicar um comunicado no mural ou quando uma encomenda chegar na portaria em seu nome.
                    </p>
                  </div>
                </div>
                <div className="shrink-0">
                  {pushStatus === 'granted' ? (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Push Ativado
                    </span>
                  ) : pushStatus === 'denied' ? (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold">
                      Bloqueado no navegador
                    </span>
                  ) : pushStatus === 'unsupported' ? (
                    <span className="text-xs text-slate-400 font-semibold">Não suportado neste navegador</span>
                  ) : (
                    <button
                      type="button"
                      disabled={isRequestingPush}
                      onClick={async () => {
                        setIsRequestingPush(true);
                        const res = await requestPushPermissionAndRegister({
                          userId: user?.id,
                          condominiumId: currentCondominium?.id,
                        });
                        setIsRequestingPush(false);
                        setPushStatus(getBrowserNotificationPermission());
                        setFeedback(
                          res.granted
                            ? 'Notificações Push ativadas neste dispositivo!'
                            : res.status === 'denied'
                            ? 'Notificações bloqueadas nas permissões do navegador.'
                            : 'Não foi possível ativar as notificações push.'
                        );
                      }}
                      className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition cursor-pointer disabled:opacity-50"
                    >
                      {isRequestingPush ? 'Ativando...' : 'Ativar Alertas Push'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB BANCO: CONTA BANCÁRIA & EMISSÃO DE BOLETOS */}
          {activeTab === 'banco' && canManageBankSettings && (
            <form onSubmit={handleSaveBankSettings} className="space-y-6">
              {/* Banner Informativo */}
              <div className="p-4 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Landmark className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    Banco de Recebimento dos Boletos do Condomínio
                  </h4>
                  <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                    Configure a instituição bancária e os dados cadastrais onde os pagamentos dos boletos e PIX gerados pelo síndico serão creditados. Todos os boletos emitidos conterão estes dados, além do QR Code Pix oficial e código de barras FEBRABAN.
                  </p>
                </div>
              </div>

              {/* SEÇÃO 1: SELEÇÃO DO BANCO & CONTA CORRENTE */}
              <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Instituição Financeira & Domicílio Bancário</span>
                  </h5>
                  <span className="text-[11px] text-slate-400">Padrão FEBRABAN / CIP</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Seletor de Banco */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">
                      Instituição Bancária
                    </label>
                    <PremiumSelect
                      ariaLabel="Instituição Bancária"
                      size="md"
                      icon={<Landmark className="w-4 h-4" />}
                      value={bankSettings.bankCode}
                      onChange={handleSelectBankPreset}
                      options={PRESET_BANKS.map((b) => ({
                        value: b.code,
                        label: b.fullName,
                      }))}
                    />
                  </div>

                  {/* Nome do Banco */}
                  <div className="space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">
                      Nome de Exibição do Banco
                    </label>
                    <input
                      type="text"
                      value={bankSettings.bankName}
                      onChange={(e) => setBankSettings({ ...bankSettings, bankName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  {/* Código FEBRABAN */}
                  <div className="space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">
                      Código FEBRABAN (3 dígitos)
                    </label>
                    <input
                      type="text"
                      maxLength={3}
                      value={bankSettings.bankCode}
                      onChange={(e) => setBankSettings({ ...bankSettings, bankCode: e.target.value.replace(/\D/g, '') })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Ex: 341"
                      required
                    />
                  </div>

                  {/* Agência & Dígito */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">Agência</label>
                      <input
                        type="text"
                        value={bankSettings.agency}
                        onChange={(e) => setBankSettings({ ...bankSettings, agency: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="1234"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">Dígito</label>
                      <input
                        type="text"
                        maxLength={2}
                        value={bankSettings.agencyDigit}
                        onChange={(e) => setBankSettings({ ...bankSettings, agencyDigit: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="5"
                      />
                    </div>
                  </div>

                  {/* Conta Corrente & Dígito */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">Conta Corrente</label>
                      <input
                        type="text"
                        value={bankSettings.accountNumber}
                        onChange={(e) => setBankSettings({ ...bankSettings, accountNumber: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="98765"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">Dígito</label>
                      <input
                        type="text"
                        maxLength={2}
                        value={bankSettings.accountDigit}
                        onChange={(e) => setBankSettings({ ...bankSettings, accountDigit: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="4"
                        required
                      />
                    </div>
                  </div>

                  {/* Carteira */}
                  <div className="space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">
                      Carteira de Cobrança
                    </label>
                    <input
                      type="text"
                      value={bankSettings.walletCode}
                      onChange={(e) => setBankSettings({ ...bankSettings, walletCode: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Ex: 109, 17, 09"
                      required
                    />
                  </div>

                  {/* Convênio / Cedente */}
                  <div className="space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">
                      Código do Convênio / Cedente
                    </label>
                    <input
                      type="text"
                      value={bankSettings.agreementCode}
                      onChange={(e) => setBankSettings({ ...bankSettings, agreementCode: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Ex: 4829104"
                    />
                  </div>
                </div>
              </div>

              {/* SEÇÃO 2: DADOS DO BENEFICIÁRIO (CONDOMÍNIO) */}
              <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-4">
                <h5 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider flex items-center gap-2">
                  <Building className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Dados do Beneficiário (Identificação no Boleto)</span>
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">
                      Razão Social / Nome do Condomínio
                    </label>
                    <input
                      type="text"
                      value={bankSettings.beneficiaryName}
                      onChange={(e) => setBankSettings({ ...bankSettings, beneficiaryName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">
                      CNPJ do Condomínio
                    </label>
                    <input
                      type="text"
                      value={bankSettings.beneficiaryCnpj}
                      onChange={(e) => setBankSettings({ ...bankSettings, beneficiaryCnpj: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="00.000.000/0001-00"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">
                      Espécie do Documento
                    </label>
                    <input
                      type="text"
                      value={bankSettings.documentVariety}
                      onChange={(e) => setBankSettings({ ...bankSettings, documentVariety: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="DM - Duplicata Mercantil"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">
                      Endereço Completo do Beneficiário
                    </label>
                    <input
                      type="text"
                      value={bankSettings.beneficiaryAddress}
                      onChange={(e) => setBankSettings({ ...bankSettings, beneficiaryAddress: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Logradouro, número, bairro, cidade - UF, CEP"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* SEÇÃO 3: CONFIGURAÇÃO PIX (BOLETO HÍBRIDO) */}
              <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Configuração PIX (QR Code & Boleto Híbrido)</span>
                  </h5>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    EMVCo BACEN
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">Tipo de Chave PIX</label>
                    <PremiumSelect
                      ariaLabel="Tipo de Chave PIX"
                      size="md"
                      icon={<QrCode className="w-4 h-4" />}
                      value={bankSettings.pixKeyType}
                      onChange={(val) => setBankSettings({ ...bankSettings, pixKeyType: val as any })}
                      options={[
                        { value: 'cnpj', label: 'CNPJ do Condomínio' },
                        { value: 'email', label: 'E-mail' },
                        { value: 'telefone', label: 'Telefone Celular' },
                        { value: 'aleatoria', label: 'Chave Aleatória (EVP)' },
                      ]}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">Chave PIX Cadastrada no Banco</label>
                    <input
                      type="text"
                      value={bankSettings.pixKey}
                      onChange={(e) => setBankSettings({ ...bankSettings, pixKey: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Ex: 42.109.876/0001-35 ou financeiro@condor.com.br"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">Nome do Recebedor no PIX (máx 25 chars)</label>
                    <input
                      type="text"
                      maxLength={25}
                      value={bankSettings.pixMerchantName}
                      onChange={(e) => setBankSettings({ ...bankSettings, pixMerchantName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="CONDOR RESIDENCIAL"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">Cidade do Recebedor (máx 15 chars)</label>
                    <input
                      type="text"
                      maxLength={15}
                      value={bankSettings.pixMerchantCity}
                      onChange={(e) => setBankSettings({ ...bankSettings, pixMerchantCity: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="SAO PAULO"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* SEÇÃO 4: REGRAS E INSTRUÇÕES DE COBRANÇA */}
              <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-4">
                <h5 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Instruções de Pagamento, Multa e Juros</span>
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">Multa por Atraso (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={bankSettings.penaltyPercent}
                      onChange={(e) => setBankSettings({ ...bankSettings, penaltyPercent: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">Juros de Mora (% ao mês)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={bankSettings.interestMonthlyPercent}
                      onChange={(e) => setBankSettings({ ...bankSettings, interestMonthlyPercent: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">Instrução Linha 1 (Multa / Encargos)</label>
                    <input
                      type="text"
                      value={bankSettings.instructionsLine1}
                      onChange={(e) => setBankSettings({ ...bankSettings, instructionsLine1: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">Instrução Linha 2 (Orientação ao Caixa)</label>
                    <input
                      type="text"
                      value={bankSettings.instructionsLine2}
                      onChange={(e) => setBankSettings({ ...bankSettings, instructionsLine2: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs">Instrução Linha 3 (Aviso de Pagamento Pix)</label>
                    <input
                      type="text"
                      value={bankSettings.instructionsLine3}
                      onChange={(e) => setBankSettings({ ...bankSettings, instructionsLine3: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* BOTÕES DE AÇÃO */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsBoletoPreviewOpen(true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Visualizar Modelo de Boleto</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetBankSettings}
                    className="w-full sm:w-auto px-3 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                  >
                    Restaurar Padrão
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSavingBank}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-pill transition cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingBank ? 'Salvando...' : 'Salvar Dados Bancários'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Popup Modal: Editar Privilégios do Sub-Síndico */}
      {editingPermsUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Editar Privilégios do Sub-Síndico"
          className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingPermsUser(null);
          }}
        >
          <form
            onSubmit={handleSaveSubSindicoPermissions}
            className="w-full max-w-xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-sm shrink-0">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                    Privilégios do Sub-Síndico
                  </h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {editingPermsUser.full_name} • {editingPermsUser.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingPermsUser(null)}
                aria-label="Fechar privilégios do sub-síndico"
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Selecione exatamente quais módulos e ações este Sub-Síndico tem autorização para executar neste condomínio.
                </p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const all: SubSindicoPermissions = {};
                      SUBSINDICO_PERMISSION_OPTIONS.forEach((opt) => {
                        all[opt.key] = true;
                      });
                      setEditingPermsDraft(all);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 text-[10px] font-bold hover:bg-teal-100 transition cursor-pointer"
                  >
                    Marcar todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPermsDraft({})}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold hover:bg-slate-200 transition cursor-pointer"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SUBSINDICO_PERMISSION_OPTIONS.map((opt) => {
                  const checked = Boolean(editingPermsDraft[opt.key]);
                  return (
                    <label
                      key={opt.key}
                      className={`p-3 rounded-2xl border flex items-start gap-2.5 cursor-pointer transition ${
                        checked
                          ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/40'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEditingPerm(opt.key)}
                        className="mt-0.5 w-4 h-4 rounded accent-teal-600 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block leading-tight">
                          {opt.label}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-snug">
                          {opt.description}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingPermsUser(null)}
                className="px-4 py-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 font-semibold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingPerms}
                className="px-5 py-2 rounded-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs shadow-pill cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingPerms ? 'Salvando...' : 'Salvar Privilégios'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de Pré-visualização do Boleto Bancário */}
      <BoletoModal
        isOpen={isBoletoPreviewOpen}
        onClose={() => setIsBoletoPreviewOpen(false)}
        customBankSettings={bankSettings}
      />

      {/* Diálogo Acessível de Confirmação */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel}
        variant={confirmState.variant}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
