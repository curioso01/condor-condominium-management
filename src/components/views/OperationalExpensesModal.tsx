import React, { useState } from 'react';
import { Receipt, Trash2, Search, CheckCircle2, X } from 'lucide-react';
import type { OperationalExpense } from '../../services/financialDataService';

interface OperationalExpensesModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: OperationalExpense[];
  monthlyBudget: number;
  onAddExpense: (exp: Omit<OperationalExpense, 'id'>) => void;
  onDeleteExpense: (id: string) => void;
  onUpdateBudget: (newBudget: number) => void;
}

export const OperationalExpensesModal: React.FC<OperationalExpensesModalProps> = ({
  isOpen,
  onClose,
  expenses,
  monthlyBudget,
  onAddExpense,
  onDeleteExpense,
  onUpdateBudget,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'budget'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');

  // Form states
  const [newSupplier, setNewSupplier] = useState('');
  const [newCategory, setNewCategory] = useState<OperationalExpense['category']>('Manutenção & Elevadores');
  const [newAmount, setNewAmount] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newStatus, setNewStatus] = useState<'Pago' | 'A Vencer'>('A Vencer');
  const [addSuccess, setAddSuccess] = useState(false);

  // Budget edit state
  const [editBudgetVal, setEditBudgetVal] = useState(monthlyBudget.toString());

  if (!isOpen) return null;

  const totalAmount = expenses.reduce((acc, e) => acc + e.amount, 0);
  const budgetConsumed = monthlyBudget > 0 ? Math.round((totalAmount / monthlyBudget) * 100) : 0;

  const filtered = expenses.filter((e) => {
    const matchesSearch = e.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          e.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'Todas' || e.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newAmount.replace(/\D/g, '')) || 0;
    if (!newSupplier.trim() || val <= 0) return;

    onAddExpense({
      supplier: newSupplier.trim(),
      category: newCategory,
      amount: val,
      dueDate: newDueDate || '25/10',
      status: newStatus,
    });

    setAddSuccess(true);
    setNewSupplier('');
    setNewAmount('');
    setTimeout(() => {
      setAddSuccess(false);
      setActiveTab('list');
    }, 1200);
  };

  const handleBudgetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(editBudgetVal) || monthlyBudget;
    onUpdateBudget(val);
    setActiveTab('list');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                Despesas Operacionais & Fornecedores
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Detalhamento dos contratos, concessionárias e folha de pagamento ({expenses.length} fornecedores)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Executado</span>
            <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 block mt-0.5 tabular-nums">
              {totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800/60">
            <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase block">Orçamento Previsto</span>
            <span className="text-base font-extrabold text-amber-900 dark:text-amber-200 block mt-0.5 tabular-nums">
              {monthlyBudget.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Consumo da Verba</span>
            <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 block mt-0.5 tabular-nums">
              {budgetConsumed}%
            </span>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'list'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Lista de Despesas ({expenses.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('add')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'add'
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            + Nova Despesa
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('budget')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'budget'
                ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Editar Teto Orçado
          </button>
        </div>

        {activeTab === 'list' && (
          <div>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mb-3">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar fornecedor ou categoria..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-[11px] font-semibold">
                {['Todas', 'Folha & Portaria', 'Manutenção & Elevadores', 'Concessionárias', 'Outros'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg shrink-0 transition cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
              {filtered.map((e) => (
                <div key={e.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{e.supplier}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                        {e.category}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">Vencimento: {e.dueDate}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="font-extrabold text-slate-900 dark:text-slate-100 tabular-nums block">
                        {e.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      <span className={`text-[10px] font-bold ${e.status === 'Pago' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {e.status}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteExpense(e.id)}
                      className="p-1 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                      title="Excluir despesa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'add' && (
          <form onSubmit={handleAddSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nome do Fornecedor / Serviço
              </label>
              <input
                type="text"
                required
                value={newSupplier}
                onChange={(e) => setNewSupplier(e.target.value)}
                placeholder="Ex: Atlas Schindler, Sabesp, etc."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Categoria
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Folha & Portaria">Folha & Portaria</option>
                  <option value="Manutenção & Elevadores">Manutenção & Elevadores</option>
                  <option value="Concessionárias">Concessionárias</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  step="10"
                  required
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="Ex: 14500"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Vencimento
                </label>
                <input
                  type="text"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  placeholder="Ex: 15/10"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="A Vencer">A Vencer</option>
                  <option value="Pago">Pago</option>
                </select>
              </div>
            </div>

            {addSuccess && (
              <div className="p-3 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Despesa cadastrada e orçamento recalculado!</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-pill transition cursor-pointer mt-2"
            >
              Adicionar Fornecedor
            </button>
          </form>
        )}

        {activeTab === 'budget' && (
          <form onSubmit={handleBudgetSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Teto Orçamentário Mensal (R$)
              </label>
              <input
                type="number"
                step="1000"
                required
                value={editBudgetVal}
                onChange={(e) => setEditBudgetVal(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                O valor orçado define a meta mensal para cálculo da taxa de consumo de verba (atualmente em {budgetConsumed}%).
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="flex-1 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-pill transition cursor-pointer"
              >
                Salvar Orçamento
              </button>
            </div>
          </form>
        )}

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
