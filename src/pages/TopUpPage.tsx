import TopUpPanel from '../components/panels/TopUpPanel';
import StripeElementsProvider from '@/components/StripeElementsProvider';

export default function TopUpPage() {
  return (
    <div>
      <StripeElementsProvider>
        <TopUpPanel />
      </StripeElementsProvider>
    </div>
  );
}
