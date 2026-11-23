import React from 'react';
import { ShieldAlert, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { LoginView } from './LoginView';
import { Logo } from '../common/Logo';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'superadmin' | 'sindico' | 'porteiro' | 'morador';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const {
    user,
    isLoading,
    currentRole,
    memberships,
    isDemoSession,
    signOut,
    refreshMemberships,
  } = useAuth();

  // 1. Initial session loading state: Prevents UI flash of protected content
  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-[#F4F6F9] dark:bg-[#0B0F17] flex flex-col items-center justify-center p-4"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Logo size="lg" showText={false} />
            <div className="absolute -inset-2 border-2 border-emerald-500/20 border-t-emerald-600 rounded-3xl animate-spin" />
          </div>
          <div className="text-center">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-wide uppercase">
              Verificando Credenciais
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Carregando contexto seguro do condomínio...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated state: Render login view
  if (!user) {
    return <LoginView />;
  }

  // 3. Fail-closed Gate: usuário autenticado sem vínculo ativo em nenhum condomínio (currentRole === null)
  // Impede acesso indevido ao layout administrativo quando o acesso foi revogado ou ainda não vinculado.
  if (!isDemoSession && (!currentRole || memberships.length === 0)) {
    return (
      <div className="min-h-screen bg-[#F4F6F9] dark:bg-[#0B0F17] flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 p-7 sm:p-8 rounded-3xl shadow-soft border border-slate-200 dark:border-slate-800 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200/70 dark:border-amber-800/60">
            <ShieldAlert className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
            Aguardando Vinculação ao Condomínio
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            Sua conta (<strong className="text-slate-700 dark:text-slate-200">{user.email}</strong>) está autenticada, mas ainda não possui vínculo ativo com nenhum condomínio ou o acesso foi revogado pela administração.
          </p>
          <p className="text-[11px] text-slate-400 mt-2">
            Solicite ao Síndico ou ao Super Administrador a vinculação do seu e-mail em &ldquo;Configurações &gt; Usuários &amp; Privilégios&rdquo;.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => refreshMemberships()}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Verificar Novamente</span>
            </button>
            <button
              type="button"
              onClick={() => signOut()}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair da Conta</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Role-based authorization gate (if specific role is enforced on route)
  if (requiredRole) {
    const roleHierarchy: Record<string, number> = {
      superadmin: 4,
      sindico: 3,
      porteiro: 2,
      morador: 1,
    };

    const userLevel = currentRole ? roleHierarchy[currentRole] || 0 : 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    if (userLevel < requiredLevel) {
      return (
        <div className="min-h-screen bg-[#F4F6F9] dark:bg-[#0B0F17] flex flex-col items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 max-w-md text-center">
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4 font-bold text-xl">
              !
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">Acesso Restrito</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Seu papel atual ({currentRole || 'sem vínculo'}) não possui permissão para acessar este módulo.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="py-2.5 px-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold rounded-xl hover:opacity-90 transition-colors cursor-pointer"
            >
              Recarregar Painel
            </button>
          </div>
        </div>
      );
    }
  }

  // 5. Authenticated and authorized: Render protected children
  return <>{children}</>;
};
