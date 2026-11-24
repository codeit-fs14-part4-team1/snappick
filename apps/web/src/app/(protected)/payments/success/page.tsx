import { Suspense } from 'react';
import PaymentFlow from '@/features/payments/components/PaymentFlow';

export default function Page() {
  return (
    <Suspense>
      <PaymentFlow mode="success" />
    </Suspense>
  );
}
