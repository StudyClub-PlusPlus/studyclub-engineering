import { Suspense } from 'react';

import { LoginPreview } from '@core/components/LoginPreview';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className='min-h-[70vh]' />}>
      <LoginPreview />
    </Suspense>
  );
}
