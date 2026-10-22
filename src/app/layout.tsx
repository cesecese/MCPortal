import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import { themeBootScript } from '../lib/theme';
import { Providers } from './providers';
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components.css';

export const metadata: Metadata = {
  title: { default: 'MCPortal', template: '%s · MCPortal' },
  description: 'El registro de servidores MCP generados a partir de webs sin API.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f3ee' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0f11' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
