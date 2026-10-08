import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  X,
  HelpCircle,
  Search,
  ChevronDown,
  ChevronUp,
  Headphones,
  MessageCircle,
  Mail,
  Send,
  Building,
  CheckCircle2,
} from 'lucide-react';

export interface HelpFaqModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FaqItem {
  id: string;
  category: 'Geral' | 'Acesso' | 'Reservas' | 'Encomendas' | 'Finanças' | 'Manutenção';
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-1',
    category: 'Acesso',
    question: 'Como funciona o reconhecimento facial BioSync AI nas catracas?',
    answer:
      'O BioSync AI realiza a verificação biométrica em tempo real na entrada de pedestres e cancelas veiculares em menos de 0.3 segundos com 99.8% de precisão. O morador cadastrado não necessita de crachás ou tags RFID: basta aproximar o rosto da câmera na clausura.',
  },
  {
    id: 'faq-2',
    category: 'Geral',
    question: 'Como atualizo minha foto de perfil para o reconhecimento e para o app?',
    answer:
      'Clique na sua foto no topo da tela ou no ícone de engrenagem na barra lateral para abrir as Configurações. Na aba "Perfil & Foto", faça o upload de uma foto nítida do seu computador ou escolha uma pré-definida e clique em "Salvar Alterações". A foto é sincronizada imediatamente.',
  },
  {
    id: 'faq-3',
    category: 'Reservas',
    question: 'Como reservar o Salão de Festas, Churrasqueira ou Espaço Gourmet?',
    answer:
      'Acesse o menu "Espaços & Reservas" na barra lateral. Navegue pelo calendário interativo de 60 dias, selecione a data desejada e clique em "Solicitar Reserva". A taxa de limpeza/reserva associada será vinculada à sua unidade conforme o regulamento interno.',
  },
  {
    id: 'faq-4',
    category: 'Encomendas',
    question: 'Como retirar encomendas recebidas no Smart Locker?',
    answer:
      'Quando uma encomenda (Mercado Livre, Amazon, Correios, etc.) é recebida na portaria, ela é armazenada em uma gaveta protegida do Smart Locker. Você recebe um aviso no app com o número do compartimento e um código PIN de 4 dígitos. Digite o PIN no teclado do locker para abrir a porta.',
  },
  {
    id: 'faq-5',
    category: 'Manutenção',
    question: 'Quem pode abrir e gerenciar ordens de serviço e chamados prediais?',
    answer:
      'A abertura e despacho de chamados de manutenção para o condomínio são de responsabilidade do Síndico Geral, Super Administrador e da Portaria. Isso garante que as ordens de serviço sigam os fluxos contratuais com as empresas prestadoras (elevadores, bombas, gerador, segurança).',
  },
  {
    id: 'faq-6',
    category: 'Finanças',
    question: 'Quem possui autorização para acessar o painel financeiro?',
    answer:
      'Por normas estritas de governança, sigilo bancário e conformidade contábil, apenas o Síndico e o Super Administrador têm acesso à conciliação bancária, fluxo de caixa, inadimplência e emissão de boletos. Porteiros e moradores não possuem permissão de acesso ao módulo financeiro do condomínio.',
  },
  {
    id: 'faq-7',
    category: 'Geral',
    question: 'Onde encontro os comunicados oficiais e convocações de assembleias?',
    answer:
      'No ícone de sino (notificações) no topo da tela, clique em "Ver Mural de Comunicados Oficiais". Todos os avisos de assembleias, manutenções programadas e convivência predial ficam centralizados e fixados por ordem de prioridade.',
  },
];

export const HelpFaqModal: React.FC<HelpFaqModalProps> = ({ isOpen, onClose }) => {
  const { currentRole, currentCondominium } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('faq-1');

  // Support form state (for admin users)
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSuccess, setSupportSuccess] = useState(false);
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);

  const isSindicoOrAdmin = currentRole === 'sindico' || currentRole === 'superadmin';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = ['Todas', 'Geral', 'Acesso', 'Reservas', 'Encomendas', 'Finanças', 'Manutenção'];

  const filteredFaqs = FAQ_ITEMS.filter((item) => {
    const matchesCategory = selectedCategory === 'Todas' || item.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleSendSupportTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMessage.trim()) return;
    setIsSubmittingSupport(true);
    setTimeout(() => {
      setIsSubmittingSupport(false);
      setSupportSuccess(true);
      setSupportMessage('');
      setTimeout(() => setSupportSuccess(false), 5000);
    }, 800);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="faq-modal-title"
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
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="faq-modal-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Central de Ajuda & Perguntas Frequentes (FAQ)
                </h3>
                <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                  Condor 24/7
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Instruções passo a passo de como utilizar a plataforma e canais de suporte
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
            aria-label="Fechar Central de Ajuda"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Digite sua dúvida (ex: reserva, biometria, encomenda, foto, portaria)..."
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          {/* Categories Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* FAQ Accordion List */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Perguntas e Respostas ({filteredFaqs.length})
            </h4>

            {filteredFaqs.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700 dark:text-slate-300">Nenhuma pergunta encontrada</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Tente buscar por termos mais genéricos como "acesso" ou "reserva".</p>
              </div>
            ) : (
              filteredFaqs.map((faq) => {
                const isExpanded = expandedFaqId === faq.id;
                return (
                  <div
                    key={faq.id}
                    className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900/60 transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                      className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800">
                          {faq.category}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-[13px]">
                          {faq.question}
                        </span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 text-slate-600 dark:text-slate-300 text-xs leading-relaxed border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/20 animate-fadeIn">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* SECTION: EXCLUSIVE PLATFORM SUPPORT FOR ADMINS (Síndico & Super Admin) */}
          {isSindicoOrAdmin ? (
            <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/50 dark:from-emerald-950/40 dark:via-slate-900 dark:to-teal-950/20 border-2 border-emerald-500/30 dark:border-emerald-500/20 shadow-md space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Headphones className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        Suporte Dedicado Condor Enterprise
                      </h4>
                      <span className="text-[9px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase">
                        Admin VIP
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Canal exclusivo para Síndicos e Super Administradores com SLA emergencial de 15 min.
                    </p>
                  </div>
                </div>
              </div>

              {/* Direct Contacts Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <a
                  href="https://wa.me/5511987654321?text=Ol%C3%A1%2C%20sou%20s%C3%ADndico(a)%20do%20condom%C3%ADnio%20e%20preciso%20de%20suporte%20no%20app%20Condor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:shadow-xs transition flex items-center gap-3 group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs block group-hover:text-emerald-600">
                      WhatsApp 24/7 de Plantão
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">+55 (11) 98765-4321</span>
                  </div>
                </a>

                <a
                  href="mailto:suporte.sindico@condor.com.br?subject=Chamado%20de%20Suporte%20Condor%20-%20Administra%C3%A7%C3%A3o"
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:shadow-xs transition flex items-center gap-3 group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs block group-hover:text-sky-600">
                      E-mail Técnico Prioritário
                    </span>
                    <span className="text-[11px] text-slate-400">suporte.sindico@condor.com.br</span>
                  </div>
                </a>
              </div>

              {/* Direct Ticket Form */}
              <form onSubmit={handleSendSupportTicket} className="space-y-2 pt-2 border-t border-emerald-100 dark:border-slate-800">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                  Enviar Mensagem Direta à Equipe Condor:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                    placeholder="Descreva a solicitação ou incidente técnico..."
                    className="flex-1 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingSupport}
                    className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0 transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmittingSupport ? 'Enviando...' : 'Enviar'}</span>
                  </button>
                </div>
                {supportSuccess && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 pt-1 animate-fadeIn">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Chamado registrado com sucesso! Um especialista responderá em instantes.
                  </p>
                )}
              </form>
            </div>
          ) : (
            /* NON-ADMIN VIEW (Morador ou Porteiro): Contato da Administração Local */
            <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                    Administração Predial do {currentCondominium?.name || 'Condomínio'}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Para dúvidas sobre boletos, regras de convivência ou ocorrências locais, contate a portaria ou a síndica.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                Guarita / Síndica
              </span>
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
            Fechar Ajuda
          </button>
        </div>
      </div>
    </div>
  );
};
