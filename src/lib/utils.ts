import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Standard utility to merge Tailwind classes safely with clsx and tailwind-merge
 * Following component-architecture skill guidelines
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
