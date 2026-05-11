import type { Metadata } from 'next';
import PricingContent from './PricingContent';

export const metadata: Metadata = {
  title: 'Pricing & Plans',
  description: 'Simple, transparent pricing for CAD organizations. Choose the Monthly or Yearly plan that fits your studio size.',
  openGraph: {
    title: 'CADONCE Pricing | Scalable Plans for CAD Organizations',
    description: 'Empower your CAD organization with professional task management and client CRM. Plans starting at ₹100.',
  }
};

export default function PricingPage() {
  return <PricingContent />;
}
