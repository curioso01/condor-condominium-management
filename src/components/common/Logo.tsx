import React from 'react';
import condorEmblem from '../../assets/condor-emblem.png';
import condorLogoFull from '../../assets/condor-logo-full.png';

export interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'icon' | 'full';
  onClick?: () => void;
}

export const Logo: React.FC<LogoProps> = ({ 
  className = '', 
  showText = true,
  size = 'md',
  variant = 'icon',
  onClick,
}) => {
  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-11 h-11',
    lg: 'w-14 h-14',
    xl: 'w-16 h-16',
  };

  const fullSizes = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-12',
    xl: 'h-16',
  };

  if (variant === 'full') {
    return (
      <div 
        onClick={onClick}
        className={`inline-flex items-center cursor-pointer group ${className}`}
        title="Condor — Gestão Inteligente de Condomínios"
      >
        <img
          src={condorLogoFull}
          alt="Condor — Gestão Inteligente de Condomínios"
          className={`${fullSizes[size]} w-auto object-contain rounded-xl shadow-md transition-all duration-200 group-hover:scale-105`}
        />
      </div>
    );
  }

  return (
    <div 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 group cursor-pointer ${className}`} 
      title="Condor — Gestão de Condomínios"
    >
      <div 
        className={`${iconSizes[size]} rounded-2xl overflow-hidden shadow-pill border border-emerald-950/20 bg-[#0f172a] flex items-center justify-center transform group-hover:scale-105 transition-all duration-200 ring-1 ring-emerald-500/20`}
      >
        <img 
          src={condorEmblem} 
          alt="Condor" 
          className="w-full h-full object-cover select-none"
          loading="eager"
        />
      </div>
      {showText && (
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mt-1 select-none group-hover:text-emerald-600 transition-colors">
          Condor
        </span>
      )}
    </div>
  );
};
