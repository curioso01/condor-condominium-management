import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  moduleName?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Erro inesperado ao renderizar este módulo.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[Condor ErrorBoundary${this.props.moduleName ? `:${this.props.moduleName}` : ''}]`, error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="w-full min-h-[280px] flex items-center justify-center p-6"
        >
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-soft p-6 sm:p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-200/70 dark:border-rose-800/60">
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {this.props.moduleName
                ? `Falha temporária no módulo ${this.props.moduleName}`
                : 'Ocorreu um erro inesperado na interface'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Os dados do seu condomínio permanecem seguros. Tente recarregar o módulo ou retornar ao início.
            </p>
            {this.state.errorMessage && (
              <p className="mt-3 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 text-[11px] font-mono text-slate-600 dark:text-slate-300 break-words">
                {this.state.errorMessage}
              </p>
            )}
            <div className="mt-5 flex items-center justify-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={this.handleRetry}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tentar Novamente</span>
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Recarregar App</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
