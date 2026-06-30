import React from 'react';
import type { IOrderItem } from '../../types';

// TypeScript interfaces for the ItemTable component
export interface ItemTableProps {
  items: IOrderItem[];
  currency: string;
  deliveryDate?: string;
  sectionType: 'service' | 'refund' | 'manual';
  className?: string;
}

interface MobileItemCardProps {
  item: IOrderItem;
  currency: string;
  sectionType: 'service' | 'refund' | 'manual';
  deliveryDate?: string;
}

// Mobile card layout component for small screens
const MobileItemCard: React.FC<MobileItemCardProps> = ({ 
  item, 
  currency, 
  sectionType, 
  deliveryDate 
}) => {
  const cardClass = sectionType === 'service' 
    ? 'border-slate-200 bg-slate-50 hover:bg-slate-100' 
    : sectionType === 'manual'
    ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
    : 'border-red-200 bg-red-50 hover:bg-red-100';
  
  const getItemTypeIndicator = () => {
    if (sectionType === 'service') {
      return (
        <div className="space-y-1">
          <p className="text-xs text-slate-600">🔧 Service - {item.serviceType}</p>
          {item.damageDetails && (
            <p className="text-xs text-red-600">⚠️ Damage: {item.damageDetails}</p>
          )}
        </div>
      );
    } else if (sectionType === 'manual') {
      return (
        <div className="space-y-1">
          <p className="text-xs text-emerald-600">📦 Item - {item.itemType}</p>
          <p className="text-xs text-emerald-500">For damage tracking only</p>
          {item.damageDetails && (
            <p className="text-xs text-red-600">⚠️ Damage: {item.damageDetails}</p>
          )}
        </div>
      );
    } else {
      return (
        <div className="space-y-1">
          <p className="text-xs text-red-600">
            🔄 Refunded: -{currency}{item.refundAmount?.toLocaleString() || '0'}
          </p>
          {item.refundReason && (
            <p className="text-xs text-red-500">Reason: {item.refundReason}</p>
          )}
          {item.refundReasonDescription && (
            <p className="text-xs text-red-400 italic">"{item.refundReasonDescription}"</p>
          )}
          {item.damageDetails && (
            <p className="text-xs text-orange-600">⚠️ Original Damage: {item.damageDetails}</p>
          )}
        </div>
      );
    }
  };

  return (
    <div className={`p-4 border rounded-lg mb-3 transition-colors ${cardClass}`}>
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-medium text-slate-900">{item.serviceName || item.itemName}</h4>
        <span className="font-bold text-slate-900">
          {sectionType === 'refund' ? '-' : ''}{currency}{item.subtotal.toLocaleString()}
        </span>
      </div>
      <div className="text-sm text-slate-600 space-y-1">
        <p>Qty: {item.quantity} × {currency}{item.pricePerUnit.toLocaleString()}</p>
        {deliveryDate && (
          <p>Delivery: {new Date(deliveryDate).toLocaleDateString()}</p>
        )}
        {getItemTypeIndicator()}
        {item.damagedQuantity && (
          <p className="text-xs text-red-600">({item.damagedQuantity} damaged)</p>
        )}
      </div>
    </div>
  );
};

// Main ItemTable component with responsive design
const ItemTable: React.FC<ItemTableProps> = ({ 
  items, 
  currency, 
  deliveryDate, 
  sectionType,
  className = ''
}) => {
  // Helper functions for styling based on section type
  const getRowHoverClass = () => {
    if (sectionType === 'service') return 'hover:bg-slate-50';
    if (sectionType === 'manual') return 'hover:bg-emerald-50';
    return 'hover:bg-red-50';
  };

  const getHeaderClass = () => {
    if (sectionType === 'service') return 'bg-[#1c2a5e] text-white';
    if (sectionType === 'manual') return 'bg-emerald-600 text-white';
    return 'bg-red-700 text-white';
  };

  const getItemTypeIndicator = (item: IOrderItem) => {
    if (sectionType === 'service') {
      return (
        <div className="space-y-1">
          <p className="text-xs text-slate-600">🔧 Service - {item.serviceType}</p>
          {item.damageDetails && (
            <p className="text-xs text-red-600">⚠️ Damage: {item.damageDetails}</p>
          )}
        </div>
      );
    } else if (sectionType === 'manual') {
      return (
        <div className="space-y-1">
          <p className="text-xs text-emerald-600">📦 Item - {item.itemType}</p>
          <p className="text-xs text-emerald-500">For damage tracking only</p>
          {item.damageDetails && (
            <p className="text-xs text-red-600">⚠️ Damage: {item.damageDetails}</p>
          )}
        </div>
      );
    } else {
      return (
        <div className="space-y-1">
          <p className="text-xs text-red-600">
            🔄 Refunded: -{currency}{item.refundAmount?.toLocaleString() || '0'}
          </p>
          {item.refundReason && (
            <p className="text-xs text-red-500">Reason: {item.refundReason}</p>
          )}
          {item.refundReasonDescription && (
            <p className="text-xs text-red-400 italic">"{item.refundReasonDescription}"</p>
          )}
          {item.damageDetails && (
            <p className="text-xs text-orange-600">⚠️ Original Damage: {item.damageDetails}</p>
          )}
        </div>
      );
    }
  };

  // Return null if no items
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <>
      {/* Desktop Table Layout */}
      <div className="hidden md:block overflow-x-auto">
        <table className={`w-full border ${className}`}>
          <thead>
            <tr className={getHeaderClass()}>
              <th className="text-left py-3 px-4 font-semibold">Delivery Date</th>
              <th className="text-left py-3 px-4 font-semibold">Item Name</th>
              <th className="text-center py-3 px-4 font-semibold">Qty</th>
              <th className="text-right py-3 px-4 font-semibold">Rate</th>
              <th className="text-right py-3 px-4 font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr 
                key={`${sectionType}-${idx}`} 
                className={`border-b ${className} ${getRowHoverClass()} transition-colors`}
              >
                <td className="py-3 px-4 text-sm text-slate-700">
                  {deliveryDate ? new Date(deliveryDate).toLocaleDateString() : ''}
                </td>
                <td className="py-3 px-4">
                  <div>
                    <p className="font-medium text-slate-900">{item.serviceName || item.itemName}</p>
                    {getItemTypeIndicator(item)}
                  </div>
                </td>
                <td className="text-center py-3 px-4">
                  <div className="font-medium text-slate-900">{item.quantity}</div>
                  {item.damagedQuantity && (
                    <div className="text-red-600 text-xs">({item.damagedQuantity} damaged)</div>
                  )}
                </td>
                <td className="text-right py-3 px-4 text-slate-900">
                  {currency}{item.pricePerUnit.toLocaleString()}
                </td>
                <td className="text-right py-3 px-4 font-bold text-slate-900">
                  {sectionType === 'refund' ? '-' : ''}{currency}{item.subtotal.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout */}
      <div className="md:hidden">
        {items.map((item, idx) => (
          <MobileItemCard
            key={`${sectionType}-mobile-${idx}`}
            item={item}
            currency={currency}
            sectionType={sectionType}
            deliveryDate={deliveryDate}
          />
        ))}
      </div>
    </>
  );
};

export default ItemTable;