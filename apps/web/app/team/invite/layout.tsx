import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
};

export default function TeamInviteLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
