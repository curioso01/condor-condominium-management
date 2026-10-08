import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LoginView } from './LoginView';
import { Logo } from '../common/Logo';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'superadmin' | 'sindico' | 'porteiro' | 'morador';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { user, isLoading, currentRole } = useAuth();

  // 1. Initial session loading state: Prevents UI flash of protected content
  if (isLoading) {
    return (
      <div 
        className="min-h-screen bg-[#F4F6F9] flex flex-col items-center justify-center p-4"
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
            <h2 className="text-sm font-bold text-slate-800 tracking-wide uppercase">
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

  // 3. Role-based authorization gate (if specific role is enforced on route)
  if (requiredRole) {
    const roleHierarchy: Record<string, number> = {
      superadmin: 4,
      sindico: 3,
      porteiro: 2,
      morador: 1,
    };

    const userLevel = roleHierarchy[currentRole || 'morador'] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    if (userLevel < requiredLevel) {
      return (
        <div className="min-h-screen bg-[#F4F6F9] flex flex-col items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 max-w-md text-center">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 font-bold text-xl">
              !
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Acesso Restrito</h3>
            <p className="text-xs text-slate-500 mb-6">
              Seu papel atual ({currentRole}) não possui permissão para acessar este módulo.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="py-2.5 px-4 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors"
            >
              Recarregar Painel
            </button>
          </div>
        </div>
      );
    }
  }

  // 4. Authenticated and authorized: Render protected children
  return <>{children}</>;
};
