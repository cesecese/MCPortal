'use client';

import type { ReactNode } from 'react';
import { AppShell } from '../components/AppShell';
import { StoreProvider } from '../store/store';
import { ToastProvider } from '../store/toast';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <StoreProvider>
        <AppShell>{children}</AppShell>
      </StoreProvider>
    </ToastProvider>
  );
}
