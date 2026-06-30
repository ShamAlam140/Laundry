import React from 'react';
import ItemTable from './ItemTable';
import type { IOrderItem } from '../../types';

// TypeScript interface for ServiceSection component props
export interface ServiceSectionProps {
  items: IOrderItem[];
  currency: string;
  deliveryDate?: string;
}

/**
 * ServiceSection Component
 * 
 * Displays active service items in a dedicated section with blue theme styling.
 * Uses the shared ItemTable component for consistent table structure.
 * 
 * Features:
 * - Blue color scheme (bg-blue-600, border-blue-200) for visual distinction
 * - Service icon (🔧) and clear section header
 * - Service subtotal calculation and display
 * - Empty state handling with user-friendly messaging
 * - Responsive design for mobile and desktop
 * 
 * Requirements: 1.1, 1.2, 3.1, 3.4
 */
const ServiceSection: React.FC<ServiceSectionProps> = ({ 
  items, 
  currency, 
  deliveryDate 
}) => {
  // Calculate subtotal for active service items
  const serviceSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  
  // Empty state handling - display user-friendly message when no services exist
  if (!items || items.length === 0) {
    return (
      <div className="mb-8">
        <div className="bg-[#1c2a5e] text-white p-3 rounded-t-lg">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            🔧 Active Services
          </h3>
        </div>
        <div className="border border-t-0 border-slate-200 bg-slate-50 p-6 rounded-b-lg text-center">
          <p className="text-slate-600 font-medium text-sm">No active services on this invoice</p>
          <p className="text-slate-500 text-xs mt-1">All services have been completed or refunded</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      {/* Section Header with Professional Navy Theme */}
      <div className="bg-[#1c2a5e] text-white p-3 rounded-t-lg">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          🔧 Active Services
        </h3>
        <p className="text-blue-100 text-xs mt-1">
          {items.length} service{items.length !== 1 ? 's' : ''} • Total: {currency}{serviceSubtotal.toLocaleString()}
        </p>
      </div>
      
      {/* Service Items Table */}
      <div className="border border-t-0 border-slate-200 bg-white rounded-b-lg">
        <ItemTable 
          items={items}
          currency={currency}
          deliveryDate={deliveryDate}
          sectionType="service"
          className="border-slate-200"
        />
        
        {/* Service Subtotal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-slate-700 font-medium text-sm">Service Subtotal:</span>
              <span className="text-slate-500 text-xs">({items.length} item{items.length !== 1 ? 's' : ''})</span>
            </div>
            <span className="font-semibold text-slate-900 text-sm">
              {currency}{serviceSubtotal.toLocaleString()}
            </span>
          </div>
          
          {/* Additional service information */}
          <div className="mt-2 pt-2 border-t border-slate-200">
            <p className="text-slate-600 text-xs">
              ✓ All services are active and billable • Tax will be calculated separately
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceSection;