import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { Unit, ResidentMember } from '../../types/condominium';
import { Badge } from '../ui/Badge';
import {
  X,
  Users,
  Car,
  PawPrint,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Send,
  Plus,
  Key,
} from 'lucide-react';
import { BoletoModal, type BoletoInvoiceData } from './BoletoModal';

export interface UnitDetailsModalProps {
  unit: Unit | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateUnit?: (updatedUnit: Unit) => void;
  onOpenVisitorPass?: (unitNumber: string) => void;
}

export const UnitDetailsModal: React.FC<UnitDetailsModalProps> = ({
  unit,
  isOpen,
  onClose,
  onUpdateUnit,
  onOpenVisitorPass,
}) => {
  const { canManageUsers } = useAuth();
  const [activeTab, setActiveTab] = useState<'moradores' | 'veiculos' | 'pets' | 'financeiro'>('moradores');
  const [copiedPix, setCopiedPix] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isAddingResident, setIsAddingResident] = useState(false);
  const [newResidentName, setNewResidentName] = useState('');
  const [newResidentRole, setNewResidentRole] = useState('Residente');

  // Boleto modal state
  const [selectedInvoiceForBoleto, setSelectedInvoiceForBoleto] = useState<BoletoInvoiceData | null>(null);
  const [isBoletoModalOpen, setIsBoletoModalOpen] = useState(false);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !unit) return null;

  const isOverdue = unit.financialStatus === 'Em Atraso';

  const handleCopyPix = () => {
    navigator.clipboard?.writeText('00020126580014br.gov.bcb.pix0136condor-reserva-imperial@condor.com520400005303986540840.005802BR5925Condominio Reserva Imperial6009Sao Paulo62070503***6304E8A2');
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 3000);
  };

  const handleSendNotice = () => {
    setFeedback(`Notificação formal enviada com sucesso para ${unit.contactName} via e-mail e push WhatsApp!`);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleAddResident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageUsers) {
      setFeedback('Acesso negado: apenas o Síndico e o Super Administrador podem cadastrar novos moradores e conceder biometrias.');
      setTimeout(() => setFeedback(null), 4000);
      return;
    }
    if (!newResidentName.trim()) return;

    const initials = newResidentName
      .trim()
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const newMember: ResidentMember = {
      id: `m-${Date.now()}`,
      name: newResidentName.trim(),
      role: newResidentRole,
      initials: initials || 'MO',
      bioSyncActive: true,
    };

    const updatedMembers = [...(unit.members || []), newMember];
    const updatedUnit: Unit = {
      ...unit,
      residentsCount: updatedMembers.length,
      members: updatedMembers,
      bioSyncCount: `${updatedMembers.filter((m) => m.bioSyncActive).length}/${updatedMembers.length}`,
    };

    onUpdateUnit?.(updatedUnit);
    setNewResidentName('');
    setIsAddingResident(false);
    setFeedback(`Novo residente ${newMember.name} cadastrado e biometria BioSync sincronizada!`);
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unit-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-4xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-gradient-to-r from-slate-50/50 to-white dark:from-slate-900 dark:to-slate-800/60">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-extrabold flex items-center justify-center text-lg shadow-sm">
              {unit.number}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 id="unit-modal-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Apartamento {unit.number} • {unit.block}
                </h3>
                <Badge variant={unit.residentType === 'Proprietário' ? 'emerald' : 'slate'}>
                  {unit.residentType}
                </Badge>
                <Badge variant={isOverdue ? 'amber' : 'emerald'} dot>
                  {unit.financialStatus || 'Em Dia'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {unit.tower || 'Torre Principal'} • {unit.squareMeters || 85} m² de área privativa • {unit.residentsCount || 2} Moradores
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
            aria-label="Fechar modal"
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
            onClick={() => setActiveTab('moradores')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'moradores'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Moradores & BioSync ({unit.members?.length || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('veiculos')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'veiculos'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>Garagem & Veículo</span>
          </button>
          <button
            onClick={() => setActiveTab('pets')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'pets'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <PawPrint className="w-3.5 h-3.5" />
            <span>Animais ({unit.hasPet ? '1 Pet' : 'Nenhum'})</span>
          </button>
          <button
            onClick={() => setActiveTab('financeiro')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'financeiro'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Financeiro & Boletos</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* TAB 1: Moradores & BioSync */}
          {activeTab === 'moradores' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Quadro de Residentes</h4>
                  <p className="text-slate-400 text-[11px]">
                    Usuários cadastrados para acesso biométrico facial nas catracas e cancelas
                  </p>
                </div>
                {canManageUsers && (
                  <button
                    type="button"
                    onClick={() => setIsAddingResident(!isAddingResident)}
                    className="px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-emerald-200 dark:border-emerald-800 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Morador</span>
                  </button>
                )}
              </div>

              {/* Add resident inline form */}
              {canManageUsers && isAddingResident && (
                <form
                  onSubmit={handleAddResident}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3 animate-fadeIn"
                >
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">Novo Morador ou Dependente</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                        Nome Completo
                      </label>
                      <input
                        type="text"
                        value={newResidentName}
                        onChange={(e) => setNewResidentName(e.target.value)}
                        placeholder="Ex: Beatriz Lima Duarte"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                        Grau / Papel
                      </label>
                      <select
                        value={newResidentRole}
                        onChange={(e) => setNewResidentRole(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Residente">Residente</option>
                        <option value="Filho(a)">Filho(a)</option>
                        <option value="Cônjuge">Cônjuge</option>
                        <option value="Familiar">Familiar</option>
                        <option value="Colaborador Residencial">Colaborador Residencial</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingResident(false)}
                      className="px-3 py-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                    >
                      Salvar e Cadastrar Biometria
                    </button>
                  </div>
                </form>
              )}

              {/* Members List */}
              <div className="space-y-2.5">
                {unit.members?.map((member) => (
                  <div
                    key={member.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-800 dark:bg-slate-700 text-white font-bold flex items-center justify-center text-xs">
                        {member.initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 dark:text-slate-100">{member.name}</p>
                          {member.isMainContact && (
                            <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                              Responsável
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 text-[11px]">{member.role}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        BioSync Facial Ativo
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Unit Responsible Overview */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Proprietário Registrado</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-xs mt-0.5">
                    {unit.ownerName || unit.contactName}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Contato Principal</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-xs mt-0.5">{unit.contactName}</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Garagem & Veículos */}
          {activeTab === 'veiculos' && (
            <div className="space-y-4">
              <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Car className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Vaga de Garagem Vinculada</h4>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    {unit.parkingSpot || 'Vaga Não Atribuída'}
                  </span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-xs">
                  Localização: {unit.parkingFloor || 'Subsolo 1 (G1)'} • Demarcação individual com sensor de presença e tag de RFID autorizada.
                </p>
              </div>

              <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
                <h5 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                  Veículo Cadastrado na Portaria
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Modelo / Marca</span>
                    <p className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">{unit.vehicleModel || 'Jeep Compass Branco'}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Placa Mercosul</span>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                      {unit.vehiclePlate || 'BRA-2E19'}
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">TAG Cancelas</span>
                    <p className="font-bold text-slate-700 dark:text-slate-300 font-mono mt-0.5">RFID #84920 (Ativo)</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Pets */}
          {activeTab === 'pets' && (
            <div className="space-y-4">
              <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <PawPrint className="w-5 h-5 text-amber-500" />
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Registro de Animais de Estimação</h4>
                  </div>
                  <Badge variant={unit.hasPet ? 'amber' : 'slate'}>
                    {unit.hasPet ? 'Cadastrado' : 'Sem Animais'}
                  </Badge>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-xs">
                  {unit.hasPet
                    ? 'Animal cadastrado de acordo com as normas de convivência do condomínio.'
                    : 'Nenhum animal cadastrado nesta unidade até o momento.'}
                </p>
              </div>

              {unit.hasPet && (
                <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Descrição / Espécie</span>
                      <p className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {unit.petDescription || '1 Golden Retriever (Thor) • Porte Grande'}
                      </p>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Vacinação Antirrábica</span>
                      <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">Em Dia (Outubro 2026)</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Financeiro & Boletos */}
          {activeTab === 'financeiro' && (
            <div className="space-y-4">
              <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Status Financeiro Geral</span>
                  <h4 className="text-lg font-black text-slate-900 dark:text-slate-100 mt-0.5">
                    {unit.financialStatus || 'Condomínio em Dia'}
                  </h4>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Cota Condominial Mensal</span>
                  <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">R$ 840,00</p>
                </div>
              </div>

              {/* Invoices list */}
              <div className="space-y-2">
                <h5 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                  Boletos dos Últimos Meses
                </h5>
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100">Taxa Ordinária • Vencimento 10/10/2026</p>
                    <p className="text-[11px] text-slate-400">Boleto Digital com Chave Pix automática</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200">R$ 840,00</span>
                    <Badge variant={isOverdue ? 'amber' : 'emerald'}>
                      {isOverdue ? 'Pendente' : 'Liquidado'}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedInvoiceForBoleto({
                          id: `BOL-2026-${unit.number}-10`,
                          unitNumber: unit.number,
                          block: unit.block,
                          residentName: unit.ownerName || unit.contactName || 'Morador Responsável',
                          description: 'Taxa Condominial Ordinária (Ref. 10/2026)',
                          dueDate: '10/10/2026',
                          amount: 840.00,
                        });
                        setIsBoletoModalOpen(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer border border-emerald-200 dark:border-emerald-800"
                      title="Visualizar boleto bancário"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Ver Boleto</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100">Taxa Ordinária • Vencimento 10/09/2026</p>
                    <p className="text-[11px] text-slate-400">Pago via Pix em 08/09/2026</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200">R$ 840,00</span>
                    <Badge variant="emerald">Pago</Badge>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedInvoiceForBoleto({
                          id: `BOL-2026-${unit.number}-09`,
                          unitNumber: unit.number,
                          block: unit.block,
                          residentName: unit.ownerName || unit.contactName || 'Morador Responsável',
                          description: 'Taxa Condominial Ordinária (Ref. 09/2026)',
                          dueDate: '10/09/2026',
                          amount: 840.00,
                        });
                        setIsBoletoModalOpen(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-semibold text-[11px] flex items-center gap-1 transition cursor-pointer"
                      title="Visualizar via original do boleto"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>2ª Via</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Fast Pix copy */}
              <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-xs text-emerald-900 dark:text-emerald-300 font-semibold">
                    Linha Digitável / Copia e Cola Pix
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyPix}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold text-[11px] flex items-center gap-1 cursor-pointer transition shadow-xs"
                >
                  {copiedPix ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedPix ? 'Copiado!' : 'Copiar Pix'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSendNotice}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Notificação Formal</span>
            </button>
            {onOpenVisitorPass && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenVisitorPass(`Apto ${unit.number} • ${unit.block}`);
                }}
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-full bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border border-emerald-200 dark:border-emerald-800"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Passe de Visitante</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
          >
            Fechar Ficha
          </button>
        </div>
      </div>

      {/* Visualizador de Boleto Bancário */}
      <BoletoModal
        isOpen={isBoletoModalOpen}
        onClose={() => {
          setIsBoletoModalOpen(false);
          setSelectedInvoiceForBoleto(null);
        }}
        invoice={selectedInvoiceForBoleto}
      />
    </div>
  );
};
