import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  ShieldCheck,
  KeyRound,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Logo } from '../common/Logo';

// Zod Validation Schemas per forms-and-validation skill
const loginSchema = z.object({
  email: z.string().trim().min(1, 'O e-mail é obrigatório').email('Informe um e-mail válido'),
  password: z.string().min(6, 'A senha deve conter pelo menos 6 caracteres'),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, 'O e-mail é obrigatório').email('Informe um e-mail válido'),
});

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'A nova senha deve ter no mínimo 8 caracteres'),
  confirmPassword: z.string().min(8, 'Confirmação de senha necessária'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type AuthViewMode = 'login' | 'forgot_password' | 'reset_password';

export const LoginView: React.FC = () => {
  const { signIn, resetPasswordForEmail, updatePassword, isConfigured } = useAuth();

  const [mode, setMode] = useState<AuthViewMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // States per auth-screens & forms-and-validation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Detect recovery mode from URL hash
  useEffect(() => {
    if (window.location.hash.includes('reset-password') || window.location.hash.includes('type=recovery')) {
      setMode('reset_password');
    }
  }, []);

  // Handle Login submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.issues.forEach((err) => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    const { error } = await signIn(email, password);
    setIsSubmitting(false);

    if (error) {
      // Security-conscious generic error: avoid leaking which part was invalid
      setFormError('E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.');
    }
  };

  // Handle Forgot Password submission
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSuccessNotice(null);

    const validation = forgotPasswordSchema.safeParse({ email });
    if (!validation.success) {
      setFieldErrors({ email: validation.error.issues[0]?.message || 'E-mail inválido' });
      return;
    }

    setIsSubmitting(true);
    const { successMessage } = await resetPasswordForEmail(email);
    setIsSubmitting(false);
    setSuccessNotice(successMessage || 'Instruções enviadas com sucesso.');
  };

  // Handle Password Reset submission
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSuccessNotice(null);

    const validation = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.issues.forEach((err) => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    const { error } = await updatePassword(password);
    setIsSubmitting(false);

    if (error) {
      setFormError('Não foi possível redefinir sua senha. O link pode ter expirado.');
    } else {
      setSuccessNotice('Sua senha foi atualizada com sucesso! Você já pode entrar.');
      setTimeout(() => {
        setMode('login');
        setSuccessNotice(null);
        window.location.hash = '';
      }, 2500);
    }
  };

  // Quick fill demo personas for developer and reviewer testing
  const selectDemoPersona = (personaEmail: string) => {
    setEmail(personaEmail);
    setPassword('condor@2026');
    setFormError(null);
    setFieldErrors({});
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background ambient decorative glow */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-96 bg-gradient-to-b from-emerald-500/10 via-teal-500/5 to-transparent blur-3xl pointer-events-none" 
        aria-hidden="true" 
      />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo size="lg" showText={false} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            CONDOR
          </h1>
          <p className="text-xs uppercase tracking-widest text-emerald-700 font-bold mt-0.5">
            Administração Inteligente de Condomínios
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl shadow-floating-sidebar border border-slate-200/80">
          {/* Top Form Alert (Errors or Success) */}
          {formError && (
            <div 
              role="alert" 
              className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2.5 animate-fadeIn"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          {successNotice && (
            <div 
              role="status" 
              className="mb-6 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-start gap-2.5 animate-fadeIn"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* VIEW: LOGIN */}
          {mode === 'login' && (
            <div>
              <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-900">Acesse sua conta</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Informe suas credenciais para gerenciar seu condomínio.
                </p>
              </div>

              <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
                {/* Email field */}
                <div>
                  <label 
                    htmlFor="condor-login-email" 
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    E-mail Corporativo ou Pessoal
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <input
                      id="condor-login-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' });
                      }}
                      placeholder="nome@condominio.com.br"
                      aria-invalid={Boolean(fieldErrors.email)}
                      aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                      className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border text-slate-900 text-sm rounded-xl focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all ${
                        fieldErrors.email ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                      }`}
                    />
                  </div>
                  {fieldErrors.email && (
                    <p id="login-email-error" className="mt-1 text-xs text-rose-600 font-medium">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>

                {/* Password field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label 
                      htmlFor="condor-login-password" 
                      className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                    >
                      Senha de Acesso
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot_password');
                        setFormError(null);
                        setSuccessNotice(null);
                      }}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <input
                      id="condor-login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: '' });
                      }}
                      placeholder="••••••••"
                      aria-invalid={Boolean(fieldErrors.password)}
                      aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                      className={`w-full pl-10 pr-11 py-2.5 bg-slate-50 border text-slate-900 text-sm rounded-xl focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all ${
                        fieldErrors.password ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-r-xl"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p id="login-password-error" className="mt-1 text-xs text-rose-600 font-medium">
                      {fieldErrors.password}
                    </p>
                  )}
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold text-sm rounded-xl shadow-pill transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Validando acesso...</span>
                    </>
                  ) : (
                    <>
                      <span>Entrar no Sistema</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Developer / Demo Quick Access Switcher */}
              <div className="mt-8 pt-6 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                    Perfis de Demonstração
                  </span>
                  {!isConfigured && (
                    <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-semibold border border-amber-200">
                      Modo Preview
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => selectDemoPersona('sindico@condor.com.br')}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-colors flex flex-col group"
                  >
                    <span className="font-bold text-slate-800 group-hover:text-emerald-700">Síndica Geral</span>
                    <span className="text-[10px] text-slate-400">Res. Imperial (Admin)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => selectDemoPersona('porteiro@condor.com.br')}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-colors flex flex-col group"
                  >
                    <span className="font-bold text-slate-800 group-hover:text-emerald-700">Portaria & Acessos</span>
                    <span className="text-[10px] text-slate-400">Guarita Principal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => selectDemoPersona('morador@condor.com.br')}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-colors flex flex-col group"
                  >
                    <span className="font-bold text-slate-800 group-hover:text-emerald-700">Morador</span>
                    <span className="text-[10px] text-slate-400">Unidade 302-B</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => selectDemoPersona('admin@condor.com.br')}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-colors flex flex-col group"
                  >
                    <span className="font-bold text-slate-800 group-hover:text-emerald-700">Super Admin</span>
                    <span className="text-[10px] text-slate-400">Multi-condomínios</span>
                  </button>
                </div>

                <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-[11px] text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span>Credenciais de teste:</span>
                    <strong className="text-slate-800 font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">condor@2026</strong>
                  </span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                    Supabase Pronto
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: FORGOT PASSWORD */}
          {mode === 'forgot_password' && (
            <div>
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setFormError(null);
                    setSuccessNotice(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar para login
                </button>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-emerald-600" />
                  Recuperar Senha
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Digite seu e-mail cadastrado. Enviaremos um link seguro para redefinição da sua senha.
                </p>
              </div>

              <form onSubmit={handleForgotPasswordSubmit} noValidate className="space-y-4">
                <div>
                  <label 
                    htmlFor="condor-reset-email" 
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    E-mail Cadastrado
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <input
                      id="condor-reset-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (fieldErrors.email) setFieldErrors({});
                      }}
                      placeholder="seu.email@exemplo.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all"
                    />
                  </div>
                  {fieldErrors.email && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold text-sm rounded-xl shadow-pill transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Enviando link de recuperação...</span>
                    </>
                  ) : (
                    <span>Enviar Link de Recuperação</span>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* VIEW: RESET PASSWORD (After email recovery link click) */}
          {mode === 'reset_password' && (
            <div>
              <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Redefinir Nova Senha
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Crie uma nova senha segura com no mínimo 8 caracteres.
                </p>
              </div>

              <form onSubmit={handleResetPasswordSubmit} noValidate className="space-y-4">
                <div>
                  <label 
                    htmlFor="condor-new-password" 
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      id="condor-new-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full pl-4 pr-11 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">
                      {fieldErrors.password}
                    </p>
                  )}
                </div>

                <div>
                  <label 
                    htmlFor="condor-confirm-password" 
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    Confirmar Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      id="condor-confirm-password"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="w-full pl-4 pr-11 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Ocultar senha' : 'Exibir senha'}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.confirmPassword && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">
                      {fieldErrors.confirmPassword}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold text-sm rounded-xl shadow-pill transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  {isSubmitting ? 'Atualizando senha...' : 'Salvar Nova Senha'}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Security Footer Notice */}
        <div className="mt-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Ambiente protegido por criptografia de ponta a ponta e Supabase Auth.</span>
        </div>
      </div>
    </div>
  );
};
