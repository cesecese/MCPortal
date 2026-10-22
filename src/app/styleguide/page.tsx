import type { Metadata } from 'next';
import { StyleGuide } from '../../screens/StyleGuide';

export const metadata: Metadata = {
  title: 'Styleguide',
  robots: { index: false, follow: false },
};

export default function StyleGuidePage() {
  return <StyleGuide />;
}
