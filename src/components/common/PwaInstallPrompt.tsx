import React, { useState, useEffect } from 'react';
import { Smartphone, Download, Share, PlusSquare, X, Check, Sparkles } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Verifica se já está rodando instalado como PWA Standalone
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(Boolean(isStandaloneMode));
      return Boolean(isStandaloneMode);
    };

    if (checkStandalone()) return;

    // 2. Detecta iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // 3. Verifica se o usuário já dispensou recentemente (últimos 7 dias)
    const dismissedAt = localStorage.getItem('condor_pwa_dismissed_at');
    const isRecentlyDismissed = dismissedAt && Date.now() - Number(dismissedAt) < 7 * 24 * 60 * 60 * 1000;

    // 4. Captura o evento nativo do Android/Chrome
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!isRecentlyDismissed) {
        setShowBanner(true);
      }
    };

    // 5. Detecta quando o app foi instalado com sucesso
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowBanner(false);
      setIsModalOpen(false);
      localStorage.setItem('condor_pwa_installed', 'true');
    };

    // 6. Listener para abrir o modal de qualquer botão da UI
    const handleOpenInstall = () => {
      setIsModalOpen(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('condor:open-pwa-install', handleOpenInstall);

    // Se for iOS e não dispensou, mostra o banner informativo
    if (isIosDevice && !isRecentlyDismissed) {
      const timer = setTimeout(() => setShowBanner(true), 2500);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('condor:open-pwa-install', handleOpenInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setShowBanner(false);
          setIsModalOpen(false);
        }
        setDeferredPrompt(null);
      } catch {
        setIsModalOpen(true);
      }
    } else {
      // Abre o modal com instruções visuais (especialmente iOS ou desktop)
      setIsModalOpen(true);
    }
  };

  const handleDismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem('condor_pwa_dismissed_at', String(Date.now()));
  };

  if (isStandalone || isInstalled) return null;

  return (
    <>
      {/* BANNER FLUTUANTE DISCRETO (Mobile / Web) */}
      {showBanner && (
        <aside
          role="complementary"
          aria-label="Instalação do Aplicativo Condor"
          className="fixed bottom-20 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-slate-900/95 dark:bg-slate-900/95 text-white backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-slate-700/80 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-md">
              <img
                src="/condor-emblem.png"
                alt="Condor"
                className="w-7 h-7 object-contain drop-shadow"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
              <Smartphone className="w-6 h-6 text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">App Oficial</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] text-slate-300">Instalação Direta</span>
              </div>
              <h4 className="text-sm font-bold text-white mt-0.5 truncate">Instale o App Condor</h4>
              <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">
                Acesse mais rápido, receba avisos de encomendas e use mesmo com internet fraca.
              </p>

              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="px-3.5 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{deferredPrompt ? 'Instalar Agora' : 'Como Instalar'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDismissBanner}
                  className="px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Agora não
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismissBanner}
              aria-label="Fechar aviso"
              className="p-1 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800 shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}

      {/* MODAL GUIA DE INSTALAÇÃO (Passo a passo iOS / Android / Desktop) */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 relative space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/30 shrink-0">
                  <img src="/condor-emblem.png" alt="Condor" className="w-7 h-7 object-contain drop-shadow" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                      PWA Premium
                    </span>
                    <Sparkles className="w-3 h-3 text-amber-500" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100">
                    Instalar CONDOR no seu Celular
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Vantagens */}
            <div className="grid grid-cols-2 gap-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                  ✓
                </span>
                <span>Ícone na tela inicial</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                  ✓
                </span>
                <span>Abre em tela cheia</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                  ✓
                </span>
                <span>PIN de entrega rápido</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                  ✓
                </span>
                <span>Não ocupa memória</span>
              </div>
            </div>

            {/* Passo a Passo Específico */}
            {isIos ? (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Instalação no iPhone / iPad (Safari)
                </h4>
                <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700">
                    <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-950/80 text-sky-600 dark:text-sky-300 flex items-center justify-center shrink-0 font-bold">
                      <Share className="w-4 h-4" />
                    </div>
                    <span>
                      1. Toque no botão de <strong>Compartilhar</strong> na barra inferior do Safari.
                    </span>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0 font-bold">
                      <PlusSquare className="w-4 h-4" />
                    </div>
                    <span>
                      2. Role para baixo e selecione <strong>"Adicionar à Tela de Início"</strong>.
                    </span>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700">
                    <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0 font-bold">
                      <Check className="w-4 h-4" />
                    </div>
                    <span>
                      3. Toque em <strong>"Adicionar"</strong> no canto superior direito. Pronto!
                    </span>
                  </div>
                </div>
              </div>
            ) : deferredPrompt ? (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Instalação no Android / Chrome
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  O aplicativo está pronto para ser instalado diretamente no seu dispositivo com um clique:
                </p>
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Instalar Condor no Dispositivo</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Instalação no Computador / Navegador
                </h4>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                  <p>
                    No seu navegador (Chrome, Edge ou Brave), clique no ícone de <strong>instalação de aplicativo</strong> (computador com seta para baixo) na barra de endereços URL à direita.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    O Condor passará a abrir em uma janela dedicada e independente do navegador.
                  </p>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
              >
                Entendi, Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
