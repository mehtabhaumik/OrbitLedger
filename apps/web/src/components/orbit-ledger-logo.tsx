'use client';

import type { ImgHTMLAttributes } from 'react';

import orbitLedgerLogo from '../../public/branding/orbit-ledger-logo-transparent.png';

type OrbitLedgerLogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & {
  alt?: string;
};

export function OrbitLedgerLogo({ alt = 'Orbit Ledger', ...props }: OrbitLedgerLogoProps) {
  return <img {...props} alt={alt} src={orbitLedgerLogo.src} />;
}
