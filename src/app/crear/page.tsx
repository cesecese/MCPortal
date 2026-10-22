import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Create } from '../../screens/Create';

export const metadata: Metadata = { title: 'Crear MCP' };

export default function CreatePage() {
  return (
    <Suspense>
      <Create />
    </Suspense>
  );
}
