'use client';

import type { ImgHTMLAttributes } from 'react';

import { ORBIT_LEDGER_LOGO_ASSETS, type OrbitLedgerLogoVariant } from '@/lib/brand-assets';

type OrbitLedgerLogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & {
  alt?: string;
  variant?: OrbitLedgerLogoVariant;
};

export function OrbitLedgerLogo({ alt = 'Orbit Ledger', variant = 'primary', ...props }: OrbitLedgerLogoProps) {
  return <img {...props} alt={alt} src={ORBIT_LEDGER_LOGO_ASSETS[variant]} />;
}
