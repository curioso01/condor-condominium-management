import React, { useState, useEffect } from 'react';
import {
  X,
  Megaphone,
  CheckCircle2,
  Pin,
  Plus,
  Eye,
  Send,
  Trash2,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { useAuth } from '../../contexts/AuthContext';

export interface Announcement {
  id: string;
  title: string;
  category: 'Urgente' | 'Assembleia' | 'Manutenção' | 'Convivência' | 'Geral';
  priority: 'alta' | 'media' | 'normal';
  author: string;
  date: string;
  content: string;
  isPinned: boolean;
  viewsCount: number;
}

export interface AnnouncementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  condominiumName?: string;
}

const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'anc-1',
    title: 'Assembleia Geral Ordinária (AGO) - Previsão Orçamentária 2027',
    category: 'Assembleia',
    priority: 'alta',
    author: 'Dra. Patrícia Lima • Síndica Geral',
    date: '28 de Outubro às 19:30',
    content:
      'Convocamos todos os condôminos para a Assembleia Geral no Salão de Festas Principal (Bloco A) e via transmissão online no app Condor. Pautas: Prestação de contas do exercício atual, eleição do conselho fiscal e aprovação da modernização dos elevadores.',
    isPinned: true,
    viewsCount: 178,
  },
  {
    id: 'anc-2',
    title: 'Manutenção Preventiva dos Elevadores Atlas & Barramento Elétrico',
    category: 'Manutenção',
    priority: 'media',
    author: 'Engenharia Predial Condor',
    date: 'Amanhã, das 09:00 às 13:00',
    content:
      'Informamos que os elevadores sociais da Torre 1 passarão por manutenção preventiva periódica. Durante o período, o elevador de serviço estará operando normalmente com prioridade a idosos e gestantes.',
    isPinned: true,
    viewsCount: 152,
  },
  {
    id: 'anc-3',
    title: 'Aviso Importante: Limpeza Semestral das Caixas d\'Água',
    category: 'Urgente',
    priority: 'alta',
    author: 'Administração Predial',
    date: '15 de Novembro (Feriado)',
    content:
      'Haverá interrupção temporária no fornecimento de água potável entre 08:00 e 14:00 para desinfecção e laudo bacteriológico das caixas superiores. Solicitamos que economizem água.',
    isPinned: false,
    viewsCount: 134,
  },
  {
    id: 'anc-4',
    title: 'Campanha de Convivência: Recolhimento de Dejetos Pets nas Áreas Verdes',
    category: 'Convivência',
    priority: 'normal',
    author: 'Comissão de Moradores',
    date: '02 de Outubro',
    content:
      'Lembramos aos tutores que é obrigatório o uso de guia e o recolhimento imediato dos dejetos nas praças internas e pista de caminhada. Estações de saquinhos biodegradáveis já foram instaladas no Pet Place.',
    isPinned: false,
    viewsCount: 165,
  },
];

export const AnnouncementsModal: React.FC<AnnouncementsModalProps> = ({
  isOpen,
  onClose,
  condominiumName = 'Condomínio Residencial',
}) => {
  const { currentRole, profile } = useAuth();
  const canManageAnnouncements = currentRole === 'sindico' || currentRole === 'superadmin';

  const [announcements, setAnnouncements] = useState<Announcement[]>(INITIAL_ANNOUNCEMENTS);
  const [categoryFilter, setCategoryFilter] = useState<'Todos' | 'Urgente' | 'Assembleia' | 'Manutenção' | 'Convivência'>('Todos');
  const [isCreating, setIsCreating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<Announcement['category']>('Geral');
  const [newPriority, setNewPriority] = useState<Announcement['priority']>('normal');
  const [newContent, setNewContent] = useState('');

  // Handle ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = announcements.filter((a) => {
    if (categoryFilter === 'Todos') return true;
    return a.category === categoryFilter;
  });

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageAnnouncements) {
      setFeedback('Acesso negado: apenas o Síndico e o Super Administrador podem criar comunicados.');
      return;
    }
    if (!newTitle.trim() || !newContent.trim()) return;

    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });

    const created: Announcement = {
      id: `anc-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      priority: newPriority,
      author: profile?.full_name ? `${profile.full_name} • Administração` : 'Administração do Condomínio',
      date: `Hoje, ${dateStr}`,
      content: newContent.trim(),
      isPinned: newPriority === 'alta',
      viewsCount: 1,
    };

    setAnnouncements((prev) => [created, ...prev]);
    setIsCreating(false);
    setNewTitle('');
    setNewContent('');
    setFeedback('Comunicado oficial publicado no Mural e notificado aos moradores via push!');
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleDeleteAnnouncement = (id: string, title: string) => {
    if (!canManageAnnouncements) return;
    if (window.confirm(`Tem certeza de que deseja excluir o comunicado "${title}"?`)) {
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      setFeedback('Comunicado excluído com sucesso do mural.');
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleTogglePin = (id: string) => {
    if (!canManageAnnouncements) return;
    setAnnouncements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isPinned: !a.isPinned } : a))
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcements-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-4xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-gradient-to-r from-slate-50/50 to-white dark:from-slate-900 dark:to-slate-800/60">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-extrabold flex items-center justify-center text-lg shadow-sm">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="announcements-modal-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Mural Oficial de Avisos & Comunicados
                </h3>
                <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                  {condominiumName}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Comunicados oficiais, convocações de assembleias e avisos de manutenções com notificação push
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
            aria-label="Fechar mural"
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

        {/* Filter Bar & Action */}
        <div className="px-6 pt-4 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
            {(['Todos', 'Urgente', 'Assembleia', 'Manutenção', 'Convivência'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {canManageAnnouncements ? (
            <button
              type="button"
              onClick={() => setIsCreating(!isCreating)}
              className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isCreating ? 'Cancelar Criação' : 'Novo Comunicado'}</span>
            </button>
          ) : (
            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full shrink-0">
              Mural Oficial • Visualização
            </span>
          )}
        </div>

        {/* Modal Content / Form */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* New Announcement Form (Apenas Administradores) */}
          {canManageAnnouncements && isCreating && (
            <form
              onSubmit={handleCreateAnnouncement}
              className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3.5 animate-fadeIn"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Criar Novo Comunicado Oficial</h4>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  Notificação Push Automática
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Título do Comunicado
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Interrupção Programada de Energia Elétrica na Torre 2"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                    Categoria
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Geral">Geral</option>
                    <option value="Urgente">Urgente</option>
                    <option value="Assembleia">Assembleia</option>
                    <option value="Manutenção">Manutenção</option>
                    <option value="Convivência">Convivência</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                    Prioridade
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="normal">Normal</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta (Fixar no Topo)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Texto Completo do Comunicado
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Descreva detalhes, datas, recomendações e canais de contato com a administração..."
                  rows={4}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Publicar e Disparar Push</span>
                </button>
              </div>
            </form>
          )}

          {/* Announcements Feed */}
          <div className="space-y-3.5">
            {filtered.map((item) => (
              <article
                key={item.id}
                className={`p-4 sm:p-5 rounded-3xl border transition-all ${
                  item.isPinned
                    ? 'bg-gradient-to-br from-emerald-50/40 via-white to-slate-50/40 dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-900 border-emerald-200/80 dark:border-emerald-800/80 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.isPinned && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                        <Pin className="w-3 h-3" />
                        Fixado
                      </span>
                    )}
                    <Badge
                      variant={
                        item.category === 'Urgente'
                          ? 'amber'
                          : item.category === 'Assembleia'
                          ? 'emerald'
                          : item.category === 'Manutenção'
                          ? 'sky'
                          : 'slate'
                      }
                    >
                      {item.category}
                    </Badge>
                    <span className="text-xs text-slate-400 font-medium">{item.date}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Eye className="w-3.5 h-3.5" />
                      <span>{item.viewsCount} visualizações</span>
                    </div>

                    {canManageAnnouncements && (
                      <div className="flex items-center gap-1 ml-1.5 border-l border-slate-200 dark:border-slate-700 pl-2">
                        <button
                          type="button"
                          onClick={() => handleTogglePin(item.id)}
                          className={`p-1 rounded-lg transition cursor-pointer ${
                            item.isPinned
                              ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60'
                              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                          title={item.isPinned ? 'Desafixar comunicado' : 'Fixar no topo'}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAnnouncement(item.id, item.title)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                          title="Excluir comunicado"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5 leading-snug">
                  {item.title}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{item.content}</p>

                <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold">{item.author}</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                    Sincronizado no App Morador
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Total de {announcements.length} comunicados ativos no painel
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
          >
            Fechar Mural
          </button>
        </div>
      </div>
    </div>
  );
};
