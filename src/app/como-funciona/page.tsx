import type { Metadata } from 'next';
import { HowItWorks } from '../../screens/HowItWorks';

export const metadata: Metadata = {
  title: 'Cómo funciona',
  description: 'Qué es MCPortal y cómo convierte una web que ya usas en herramientas para tu asistente.',
};

export default function HowItWorksPage() {
  return <HowItWorks />;
}
