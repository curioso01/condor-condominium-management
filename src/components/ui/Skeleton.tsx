import React from 'react';
import { cn } from '../../lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={cn('animate-pulse rounded-2xl bg-slate-200/70', className)}
      {...props}
    />
  );
};
