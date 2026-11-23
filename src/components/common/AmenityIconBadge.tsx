import React from 'react';
import {
  Sparkles,
  Flame,
  Trophy,
  Waves,
  Dumbbell,
  PawPrint,
  UtensilsCrossed,
  Building2,
  PartyPopper,
  Trees,
  Coffee,
  Gamepad2,
} from 'lucide-react';

export interface AmenityIconOption {
  key: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  tone: string;
}

export const AMENITY_ICON_OPTIONS: AmenityIconOption[] = [
  { key: 'party', label: 'Salão de Festas', icon: PartyPopper, tone: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' },
  { key: 'gourmet', label: 'Espaço Gourmet', icon: UtensilsCrossed, tone: 'bg-amber-500/12 text-amber-600 dark:text-amber-400' },
  { key: 'bbq', label: 'Churrasqueira', icon: Flame, tone: 'bg-orange-500/12 text-orange-600 dark:text-orange-400' },
  { key: 'court', label: 'Quadra / Esportes', icon: Trophy, tone: 'bg-sky-500/12 text-sky-600 dark:text-sky-400' },
  { key: 'pool', label: 'Piscina / Spa', icon: Waves, tone: 'bg-cyan-500/12 text-cyan-600 dark:text-cyan-400' },
  { key: 'gym', label: 'Academia / Fitness', icon: Dumbbell, tone: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-400' },
  { key: 'pet', label: 'Espaço Pet', icon: PawPrint, tone: 'bg-teal-500/12 text-teal-600 dark:text-teal-400' },
  { key: 'games', label: 'Salão de Jogos / Kids', icon: Gamepad2, tone: 'bg-violet-500/12 text-violet-600 dark:text-violet-400' },
  { key: 'cowork', label: 'Coworking / Lounge', icon: Coffee, tone: 'bg-slate-500/12 text-slate-600 dark:text-slate-300' },
  { key: 'garden', label: 'Jardim / Praça', icon: Trees, tone: 'bg-green-500/12 text-green-600 dark:text-green-400' },
  { key: 'hall', label: 'Área Comum', icon: Building2, tone: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' },
  { key: 'premium', label: 'Espaço Exclusivo', icon: Sparkles, tone: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' },
];

/**
 * Resolve qualquer nome de espaço ou emoji legado salvo no banco para um ícone vetorial Lucide premium.
 * Garante estética executiva sem emojis cartunescos mesmo em registros antigos.
 */
export function resolveAmenityIconMeta(spaceName?: string, legacyEmojiOrKey?: string): AmenityIconOption {
  const key = (legacyEmojiOrKey || '').trim().toLowerCase();
  const byKey = AMENITY_ICON_OPTIONS.find((opt) => opt.key === key);
  if (byKey) return byKey;

  const combined = `${spaceName || ''} ${legacyEmojiOrKey || ''}`.toLowerCase();

  if (combined.includes('churras') || combined.includes('🍖') || combined.includes('🥩') || combined.includes('🔥')) {
    return AMENITY_ICON_OPTIONS[2]; // Flame
  }
  if (combined.includes('gourmet') || combined.includes('cozinha') || combined.includes('🥂') || combined.includes('🍽')) {
    return AMENITY_ICON_OPTIONS[1]; // UtensilsCrossed
  }
  if (combined.includes('quadra') || combined.includes('tênis') || combined.includes('tenis') || combined.includes('esport') || combined.includes('🎾') || combined.includes('⚽')) {
    return AMENITY_ICON_OPTIONS[3]; // Trophy
  }
  if (combined.includes('piscina') || combined.includes('sauna') || combined.includes('spa') || combined.includes('🏊')) {
    return AMENITY_ICON_OPTIONS[4]; // Waves
  }
  if (combined.includes('academia') || combined.includes('fitness') || combined.includes('muscul') || combined.includes('🏋')) {
    return AMENITY_ICON_OPTIONS[5]; // Dumbbell
  }
  if (combined.includes('pet') || combined.includes('agility') || combined.includes('🐾')) {
    return AMENITY_ICON_OPTIONS[6]; // PawPrint
  }
  if (combined.includes('jogo') || combined.includes('brinqued') || combined.includes('infantil') || combined.includes('kids') || combined.includes('🎈') || combined.includes('🎮')) {
    return AMENITY_ICON_OPTIONS[7]; // Gamepad2
  }
  if (combined.includes('cowork') || combined.includes('estudo') || combined.includes('reuni') || combined.includes('lounge') || combined.includes('☕')) {
    return AMENITY_ICON_OPTIONS[8]; // Coffee
  }
  if (combined.includes('jardim') || combined.includes('bosque') || combined.includes('praça') || combined.includes('ar livre') || combined.includes('🌳')) {
    return AMENITY_ICON_OPTIONS[9]; // Trees
  }
  if (combined.includes('festa') || combined.includes('salão') || combined.includes('salao') || combined.includes('🎉')) {
    return AMENITY_ICON_OPTIONS[0]; // PartyPopper
  }

  return AMENITY_ICON_OPTIONS[10]; // Building2
}

interface AmenityIconBadgeProps {
  spaceName?: string;
  emoji?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const AmenityIconBadge: React.FC<AmenityIconBadgeProps> = ({
  spaceName,
  emoji,
  size = 'sm',
  className = '',
}) => {
  const meta = resolveAmenityIconMeta(spaceName, emoji);
  const IconComp = meta.icon;

  const boxSizes = {
    xs: 'w-6 h-6 rounded-lg',
    sm: 'w-8 h-8 rounded-xl',
    md: 'w-10 h-10 rounded-2xl',
    lg: 'w-12 h-12 rounded-2xl',
  };

  const iconSizes = {
    xs: 'w-3.5 h-3.5',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 border border-current/15 ${meta.tone} ${boxSizes[size]} ${className}`}
      aria-hidden="true"
    >
      <IconComp className={iconSizes[size]} />
    </span>
  );
};
