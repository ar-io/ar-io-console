import GiftPanel from '../components/panels/GiftPanel';
import StripeElementsProvider from '../components/StripeElementsProvider';

export default function GiftPage() {
  return (
    <div>
      <StripeElementsProvider>
        <GiftPanel />
      </StripeElementsProvider>
    </div>
  );
}