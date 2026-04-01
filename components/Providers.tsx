'use client';

import { LangProvider } from './LangContext';
import { ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  return <LangProvider>{children}</LangProvider>;
}
