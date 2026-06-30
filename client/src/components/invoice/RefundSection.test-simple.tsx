// Simple test to verify RefundSection component compiles and works
import RefundSection from './RefundSection';
import type { IOrderItem } from '../../types';

// Mock refunded items for testing
const mockRefundedItems: IOrderItem[] = [
  {
    serviceName: 'Dry Cleaning',
    serviceType: 'dry-cleaning',
    quantity: 2,
    unit: 'piece',
    pricePerUnit: 15,
    subtotal: 30,
    isRefunded: true,
    refundAmount: 30,
    refundReason: 'Damaged',
    refundReasonDescription: 'Item was damaged during cleaning process'
  },
  {
    serviceName: 'Wash & Fold',
    serviceType: 'wash-fold',
    quantity: 1,
    unit: 'kg',
    pricePerUnit: 8,
    subtotal: 8,
    isRefunded: true,
    refundAmount: 8,
    refundReason: 'Quality_Issue'
  }
];

// Test component creation
const TestRefundSection = () => {
  return (
    <RefundSection
      items={mockRefundedItems}
      currency="$"
      deliveryDate="2024-01-15"
      totalRefundAmount={38}
    />
  );
};

// Test empty state (should return null)
const TestEmptyRefundSection = () => {
  return (
    <RefundSection
      items={[]}
      currency="$"
      deliveryDate="2024-01-15"
    />
  );
};

export { TestRefundSection, TestEmptyRefundSection };