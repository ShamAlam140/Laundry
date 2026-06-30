import React from 'react';
import ItemTable from './ItemTable';
import type { IOrderItem } from '../../types';

// TypeScript interface for RefundSection component props
export interface RefundSectionProps {
  items: IOrderItem[];
  currency: string;
  deliveryDate?: string;
  totalRefundAmount?: number;
}

/**
 * RefundSection Component
 * 
 * Displays refunded items in a dedicated section with red theme styling.
 * Uses the shared ItemTable component for consistent table structure.
 * Only renders when refunded items exist (conditional rendering).
 * 
 * Features:
 * - Red color scheme (bg-red-600, border-red-200) for visual distinction
 * - Refund icon (🔄) and clear section header
 * - Refund total calculation and display with negative formatting
 * - Refund-specific information display (amounts, reasons)
 * - Conditional rendering - only shows when refunded items exist
 * - Responsive design for mobile and desktop
 * 
 * Requirements: 2.1, 2.2, 3.2, 3.5
 */
const RefundSection: React.FC<RefundSectionProps> = ({ 
  items, 
  currency, 
  deliveryDate,
  totalRefundAmount 
}) => {
  // Conditional rendering - only render when refunded items exist
  if (!items || items.length === 0) {
    return null; // Don't render section if no refunded items
  }

  // Calculate total refunded amount from items if not provided
  const calculatedRefundTotal = totalRefundAmount || 
    items.reduce((sum, item) => sum + (item.refundAmount || 0), 0);

  return (
    <div className="mb-8">
      {/* Section Header with Professional Red Theme */}
      <div className="bg-red-700 text-white p-3 rounded-t-lg">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          🔄 Refunded Items
        </h3>
        <p className="text-red-100 text-xs mt-1">
          {items.length} refunded item{items.length !== 1 ? 's' : ''} • Total: -{currency}{calculatedRefundTotal.toLocaleString()}
        </p>
      </div>
      
      {/* Refunded Items Table */}
      <div className="border border-t-0 border-slate-200 bg-white rounded-b-lg">
        <ItemTable 
          items={items}
          currency={currency}
          deliveryDate={deliveryDate}
          sectionType="refund"
          className="border-slate-200"
        />
        
        {/* Refund Total Footer */}
        <div className="p-3 bg-red-50 border-t border-slate-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-slate-700 font-medium text-sm">Total Refunded:</span>
              <span className="text-slate-500 text-xs">({items.length} item{items.length !== 1 ? 's' : ''})</span>
            </div>
            <span className="font-semibold text-red-700 text-sm">
              -{currency}{calculatedRefundTotal.toLocaleString()}
            </span>
          </div>
          
          {/* Additional refund information */}
          <div className="mt-2 pt-2 border-t border-slate-200">
            <p className="text-slate-600 text-xs">
              ⚠️ Refunded amounts have been deducted from the total invoice • Processing may take 3-5 business days
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RefundSection;