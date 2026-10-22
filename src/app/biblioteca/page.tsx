import type { Metadata } from 'next';
import { Library } from '../../screens/Library';

export const metadata: Metadata = {
  title: 'Biblioteca',
  description: 'Tus MCPs publicados, borradores, generaciones en curso y MCPs guardados.',
};

export default function LibraryPage() {
  return <Library />;
}
