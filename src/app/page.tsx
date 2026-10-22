import { Suspense } from 'react';
import { Explore } from '../screens/Explore';

export default function HomePage() {
  return (
    <Suspense>
      <Explore />
    </Suspense>
  );
}
