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
  ShieldCheck,
  KeyRound,
  ArrowRight,
  MessageCircle,
  UserPlus,
  User,
  Phone,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Logo } from '../common/Logo';
import {
  OFFICIAL_SUPPORT_EMAIL,
  OFFICIAL_SUPPORT_WHATSAPP_DISPLAY,
  buildSupportWhatsAppUrl,
} from '../../services/supportService';

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

const firstAccessSchema = z.object({
  fullName: z.string().trim().min(3, 'Informe seu nome completo'),
  email: z.string().trim().min(1, 'O e-mail é obrigatório').email('Informe um e-mail válido'),
  phone: z.string().trim().optional(),
  temporaryPassword: z.string().trim().min(6, 'Informe a senha temporária de 1º acesso'),
});

type AuthViewMode = 'login' | 'first_access' | 'forgot_password' | 'reset_password';

export const LoginView: React.FC = () => {
  const { signIn, resetPasswordForEmail, updatePassword } = useAuth();

  const [mode, setMode] = useState<AuthViewMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // First-access self-onboarding state (only visible while no síndico exists)
  const [firstAccessAvailable, setFirstAccessAvailable] = useState(false);
  const [firstAccessFullName, setFirstAccessFullName] = useState('');
  const [firstAccessPhone, setFirstAccessPhone] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [showTempPassword, setShowTempPassword] = useState(false);

  // States per auth-screens & forms-and-validation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Detect recovery mode from URL hash & check whether síndica first-access is available
  useEffect(() => {
    if (window.location.hash.includes('reset-password') || window.location.hash.includes('type=recovery')) {
      setMode('reset_password');
    }

    if (!isSupabaseConfigured) return;
    let cancelled = false;
    supabase.functions
      .invoke('sindica-first-access', { body: { action: 'status' } })
      .then(({ data, error }) => {
        if (!cancelled && !error && data?.available === true) {
          setFirstAccessAvailable(true);
        }
      })
      .catch(() => {
        // Ignore silently
      });

    return () => {
      cancelled = true;
    };
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
      if (firstAccessAvailable && password.trim() === 'Condor@2026') {
        setTemporaryPassword(password.trim());
        setMode('first_access');
        setFormError(null);
        setSuccessNotice(
          'Identificamos que este é o seu Primeiro Acesso como Síndica! Informe seu Nome Completo abaixo e clique em Ativar Meu Acesso para entrar.'
        );
        return;
      }
      setFormError('E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.');
    }
  };

  // Handle Síndica First Access submission
  const handleFirstAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSuccessNotice(null);

    const validation = firstAccessSchema.safeParse({
      fullName: firstAccessFullName,
      email,
      phone: firstAccessPhone,
      temporaryPassword,
    });

    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.issues.forEach((err) => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('sindica-first-access', {
        body: {
          action: 'claim',
          full_name: firstAccessFullName.trim(),
          email: email.trim().toLowerCase(),
          phone: firstAccessPhone.trim() || null,
          temporary_password: temporaryPassword.trim(),
        },
      });

      if (error || !data?.ok) {
        let msg = data?.error;
        if (!msg && (error as any)?.context) {
          try {
            const errJson = await (error as any).context.json();
            msg = errJson?.error;
          } catch {
            // ignore json parse errors
          }
        }
        setFormError(
          msg ||
            'Não foi possível ativar seu primeiro acesso. Verifique a senha temporária e tente novamente.'
        );
        setIsSubmitting(false);
        return;
      }

      setSuccessNotice('Acesso da síndica ativado! Entrando no sistema...');
      const { error: loginErr } = await signIn(email.trim().toLowerCase(), temporaryPassword.trim());
      setIsSubmitting(false);

      if (loginErr) {
        setMode('login');
        setPassword(temporaryPassword.trim());
        setSuccessNotice('Conta cadastrada com sucesso! Clique em "Entrar no Sistema" para acessar.');
      }
    } catch {
      setIsSubmitting(false);
      setFormError('Falha de comunicação ao ativar primeiro acesso. Tente novamente.');
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

              {firstAccessAvailable && (
                <div className="mt-5 pt-4 border-t border-slate-100 text-center space-y-2">
                  <p className="text-[11px] text-slate-500 font-medium">
                    Primeiro acesso da administração do condomínio?
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('first_access');
                      setFormError(null);
                      setFieldErrors({});
                      setSuccessNotice(null);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <UserPlus className="w-4 h-4 text-emerald-600" />
                    <span>Primeiro Acesso da Síndica? Cadastre seu e-mail aqui</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* VIEW: FIRST ACCESS (Síndica self-registration with temporary password) */}
          {mode === 'first_access' && (
            <div>
              <div className="mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setFormError(null);
                    setFieldErrors({});
                    setSuccessNotice(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar para login
                </button>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-emerald-600" />
                  Primeiro Acesso da Síndica
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Cadastre seu e-mail pessoal ou corporativo usando a senha temporária informada na implantação para ativar seu painel.
                </p>
              </div>

              <form onSubmit={handleFirstAccessSubmit} noValidate className="space-y-3.5">
                <div>
                  <label
                    htmlFor="condor-fa-name"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1"
                  >
                    Nome Completo *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <input
                      id="condor-fa-name"
                      type="text"
                      autoComplete="name"
                      value={firstAccessFullName}
                      onChange={(e) => {
                        setFirstAccessFullName(e.target.value);
                        if (fieldErrors.fullName) setFieldErrors({ ...fieldErrors, fullName: '' });
                      }}
                      placeholder="Seu nome completo"
                      className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border text-slate-900 text-sm rounded-xl focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all ${
                        fieldErrors.fullName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                      }`}
                    />
                  </div>
                  {fieldErrors.fullName && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">{fieldErrors.fullName}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="condor-fa-email"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1"
                  >
                    Seu E-mail de Acesso *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <input
                      id="condor-fa-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' });
                      }}
                      placeholder="sindica@condominio.com.br"
                      className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border text-slate-900 text-sm rounded-xl focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all ${
                        fieldErrors.email ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                      }`}
                    />
                  </div>
                  {fieldErrors.email && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">{fieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="condor-fa-phone"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1"
                  >
                    Telefone / WhatsApp (opcional)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <input
                      id="condor-fa-phone"
                      type="tel"
                      autoComplete="tel"
                      value={firstAccessPhone}
                      onChange={(e) => setFirstAccessPhone(e.target.value)}
                      placeholder="(21) 99999-0000"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="condor-fa-temp-password"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1"
                  >
                    Senha Temporária de 1º Acesso *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <input
                      id="condor-fa-temp-password"
                      type={showTempPassword ? 'text' : 'password'}
                      autoComplete="off"
                      value={temporaryPassword}
                      onChange={(e) => {
                        setTemporaryPassword(e.target.value);
                        if (fieldErrors.temporaryPassword) {
                          setFieldErrors({ ...fieldErrors, temporaryPassword: '' });
                        }
                      }}
                      placeholder="Digite a senha temporária"
                      className={`w-full pl-10 pr-11 py-2.5 bg-slate-50 border text-slate-900 text-sm rounded-xl focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all ${
                        fieldErrors.temporaryPassword ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowTempPassword(!showTempPassword)}
                      aria-label={showTempPassword ? 'Ocultar senha' : 'Exibir senha'}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showTempPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.temporaryPassword && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">
                      {fieldErrors.temporaryPassword}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold text-sm rounded-xl shadow-pill transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Ativando primeiro acesso...</span>
                    </>
                  ) : (
                    <>
                      <span>Ativar Meu Acesso e Entrar</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
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

        {/* Security & Support Footer */}
        <div className="mt-6 space-y-2.5 text-center text-xs text-slate-500">
          <div className="flex items-center justify-center gap-2 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Ambiente protegido por criptografia e isolamento RLS por condomínio.</span>
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap text-[11px]">
            <span className="text-slate-400 font-medium">Suporte Técnico:</span>
            <a
              href={buildSupportWhatsAppUrl('Olá! Preciso de suporte para acessar a plataforma CONDOR.')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp {OFFICIAL_SUPPORT_WHATSAPP_DISPLAY}</span>
            </a>
            <span className="text-slate-300">•</span>
            <a
              href={`mailto:${OFFICIAL_SUPPORT_EMAIL}?subject=${encodeURIComponent('Suporte de Acesso — Plataforma CONDOR')}`}
              className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900 hover:underline"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{OFFICIAL_SUPPORT_EMAIL}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
