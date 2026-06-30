import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useSettings } from '../context/SettingsContext';
import type { IOrder } from '../types';

const ProcessRefund = () => {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const { currency } = useSettings();
    const [order, setOrder] = useState<IOrder | null>(null);
    const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
    const [refundAmount, setRefundAmount] = useState(0);
    const [reason, setReason] = useState('');
    const [reasonDescription, setReasonDescription] = useState('');
    const [selectedItems, setSelectedItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const reasons = [
        { value: 'Damaged', label: '🔨 Damaged' },
        { value: 'Lost', label: '📦 Lost' },
        { value: 'Delayed_Service', label: '⏰ Delayed Service' },
        { value: 'Quality_Issue', label: '⚠️ Quality Issue' },
        { value: 'Customer_Complaint', label: '😞 Customer Complaint' },
        { value: 'Other', label: '📝 Other' },
    ];

    useEffect(() => {
        fetchOrder();
    }, [orderId]);

    const fetchOrder = async () => {
        try {
            const res = await api.get(`/orders/${orderId}`);
            setOrder(res.data.data);
            setRefundAmount(res.data.data.totalAmount);
        } catch (err) {
            toast.error('Failed to load order');
            navigate('/orders');
        }
    };

    const handleFullRefund = async () => {
        if (!reason) {
            toast.error('Please select a reason');
            return;
        }

        if (reason === 'Other' && !reasonDescription.trim()) {
            toast.error('Please provide a description for "Other" reason');
            return;
        }

        setLoading(true);
        try {
            await api.post('/refunds/full', {
                orderId,
                reason,
                reasonDescription: reason === 'Other' ? reasonDescription : undefined,
                refundAmount,
            });
            toast.success('✅ Full refund processed successfully!');
            navigate(`/orders/${orderId}`);
        } catch (err: any) {
            const errorMsg = err.response?.data?.error?.message || 'Failed to process refund';
            const details = err.response?.data?.error?.details;
            
            // Special handling for payment validation error
            const hasNoPaymentsError = errorMsg.includes('no payments') || (details && details.some((d: string) => d.includes('no payments')));
            if (hasNoPaymentsError) {
                toast.error('⚠️ Cannot process refund: Order has no payments yet. Please ensure the order is paid before processing refunds.');
            } else {
                toast.error(details ? `${errorMsg}: ${details.join(', ')}` : errorMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePartialRefund = async () => {
        if (selectedItems.length === 0) {
            toast.error('Please select at least one item');
            return;
        }

        // Validate all items have reasons and damage details
        const invalidItems = selectedItems.filter(i => 
            !i.reason || 
            (i.reason === 'Other' && !i.reasonDescription) ||
            !i.damageDetails?.trim() ||
            !i.damagedQuantity ||
            i.damagedQuantity <= 0
        );
        if (invalidItems.length > 0) {
            toast.error('Please provide reason, damage details, and damaged quantity for all selected items');
            return;
        }

        setLoading(true);
        try {
            // First try to process the refund
            await api.post('/refunds/partial', {
                orderId,
                items: selectedItems,
            });
            toast.success('✅ Partial refund processed successfully!');
            navigate(`/orders/${orderId}`);
        } catch (err: any) {
            console.log('Refund error:', err);
            console.log('Error response:', err.response);
            console.log('Error data:', err.response?.data);
            
            const errorMsg = err.response?.data?.error?.message || 'Failed to process refund';
            const details = err.response?.data?.error?.details;
            
            console.log('Error message:', errorMsg);
            console.log('Error details:', details);
            console.log('Error includes no payments in message:', errorMsg.includes('no payments'));
            console.log('Error includes no payments in details:', details && details.some((d: string) => d.includes('no payments')));
            
            // Special handling for payment validation error - record damage details instead
            const hasNoPaymentsError = errorMsg.includes('no payments') || (details && details.some((d: string) => d.includes('no payments')));
            if (hasNoPaymentsError) {
                console.log('Attempting to record damage details...');
                try {
                    const damageResponse = await api.post('/refunds/damage', {
                        orderId,
                        items: selectedItems,
                        notes: 'Damage details recorded - refund can be processed after payment',
                    });
                    console.log('Damage recording successful:', damageResponse);
                    toast.success('✅ Damage details recorded successfully! Refund can be processed after payment is received.');
                    navigate(`/orders/${orderId}`);
                } catch (damageErr: any) {
                    console.log('Damage recording failed:', damageErr);
                    console.log('Damage error response:', damageErr.response);
                    toast.error('Failed to record damage details: ' + (damageErr.response?.data?.error?.message || 'Unknown error'));
                }
            } else {
                toast.error(details ? `${errorMsg}: ${details.join(', ')}` : errorMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    if (!order) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Process Refund</h1>
                    <p className="text-sm text-slate-500 mt-1">Order {order.orderId}</p>
                </div>
                <button
                    onClick={() => navigate(`/orders/${orderId}`)}
                    className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
                >
                    ← Back to Order
                </button>
            </div>

            {/* Order Summary */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-base font-semibold text-slate-900 mb-3">Order Summary</h2>
                <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                        <span className="text-slate-500">Customer:</span>
                        <p className="font-medium text-slate-900">{order.customer.name}</p>
                    </div>
                    <div>
                        <span className="text-slate-500">Total Amount:</span>
                        <p className="font-medium text-slate-900">{currency}{order.totalAmount.toLocaleString()}</p>
                    </div>
                    <div>
                        <span className="text-slate-500">Status:</span>
                        <p className="font-medium text-slate-900 capitalize">{order.status}</p>
                    </div>
                </div>
            </div>

            {/* Refund Type Selection */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-base font-semibold text-slate-900 mb-4">Refund Type</h2>
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => setRefundType('full')}
                        className={`p-4 rounded-xl border-2 transition-all ${
                            refundType === 'full'
                                ? 'border-cyan-500 bg-cyan-50'
                                : 'border-slate-200 hover:border-slate-300'
                        }`}
                    >
                        <div className="text-2xl mb-2">💰</div>
                        <div className="font-semibold text-slate-900">Full Refund</div>
                        <div className="text-xs text-slate-500 mt-1">Refund entire order</div>
                    </button>
                    <button
                        onClick={() => setRefundType('partial')}
                        className={`p-4 rounded-xl border-2 transition-all ${
                            refundType === 'partial'
                                ? 'border-cyan-500 bg-cyan-50'
                                : 'border-slate-200 hover:border-slate-300'
                        }`}
                    >
                        <div className="text-2xl mb-2">📦</div>
                        <div className="font-semibold text-slate-900">Partial Refund</div>
                        <div className="text-xs text-slate-500 mt-1">Refund specific items</div>
                    </button>
                </div>
            </div>

            {/* Full Refund Form */}
            {refundType === 'full' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h2 className="text-base font-semibold text-slate-900 mb-4">Full Order Refund</h2>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Refund Amount
                            </label>
                            <input
                                type="number"
                                min={0}
                                step="any"
                                value={refundAmount}
                                onChange={(e) => setRefundAmount(Number(e.target.value))}
                                max={order.totalAmount}
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-cyan-500"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Maximum: {currency}{order.totalAmount.toLocaleString()}
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Refund Reason *
                            </label>
                            <select
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-cyan-500"
                            >
                                <option value="">Select a reason...</option>
                                {reasons.map((r) => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                            </select>
                        </div>

                        {reason === 'Other' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Description *
                                </label>
                                <textarea
                                    value={reasonDescription}
                                    onChange={(e) => setReasonDescription(e.target.value)}
                                    placeholder="Please provide details..."
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                                    rows={3}
                                />
                            </div>
                        )}

                        <button
                            onClick={handleFullRefund}
                            disabled={loading || !reason}
                            className="w-full py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl hover:from-red-400 hover:to-red-500 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Processing...' : `Process Full Refund (${currency}${refundAmount.toLocaleString()})`}
                        </button>
                    </div>
                </div>
            )}

            {/* Partial Refund Form */}
            {refundType === 'partial' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h2 className="text-base font-semibold text-slate-900 mb-4">Refund Information</h2>
                    
                    {/* Services Section (Information Only) */}
                    {order.items.filter(item => item.serviceType !== 'manual' && item.service).length > 0 && (
                        <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 bg-cyan-500 rounded-full"></span>
                                Services (Cannot be refunded individually)
                            </h3>
                            <div className="space-y-2">
                                {order.items.filter(item => item.serviceType !== 'manual' && item.service).map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-2 bg-white rounded-lg">
                                        <div>
                                            <p className="text-sm font-medium text-slate-900">{item.serviceName}</p>
                                            <p className="text-xs text-slate-500">{item.quantity} × {currency}{item.pricePerUnit}</p>
                                        </div>
                                        <span className="text-sm font-semibold text-slate-900">{currency}{item.subtotal}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                💡 Services can only be refunded as part of a full order refund
                            </p>
                        </div>
                    )}

                    {/* Manual Items Section (Refundable) */}
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                        Items Available for Refund
                    </h3>
                    
                    <div className="space-y-4">
                        {order.items.filter(item => item.serviceType === 'manual' || !item.service).map((item, idx) => {
                            const isSelected = selectedItems.find(i => i.itemId === item._id);
                            
                            return (
                                <div key={idx} className={`border rounded-xl p-4 transition-all ${
                                    isSelected ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200'
                                }`}>
                                    <div className="flex items-start gap-4">
                                        <input
                                            type="checkbox"
                                            checked={!!isSelected}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedItems([...selectedItems, {
                                                        itemId: item._id,
                                                        refundAmount: item.subtotal,
                                                        reason: 'Damaged',
                                                    }]);
                                                } else {
                                                    setSelectedItems(selectedItems.filter(i => i.itemId !== item._id));
                                                }
                                            }}
                                            className="mt-1"
                                        />
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <p className="font-medium text-slate-900">
                                                        {item.itemName || item.serviceName}
                                                    </p>
                                                    {item.itemType && (
                                                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                            {item.itemType}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-semibold text-slate-900">
                                                        {currency}{item.subtotal.toLocaleString()}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {item.quantity} × {currency}{item.pricePerUnit}
                                                    </p>
                                                </div>
                                            </div>

                                            {isSelected && (
                                                <div className="mt-3 space-y-3 pt-3 border-t border-slate-200">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-xs font-medium text-slate-700 mb-1">
                                                                Damaged Quantity *
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min="0.01"
                                                                step="any"
                                                                max={item.quantity}
                                                                value={isSelected.damagedQuantity || 1}
                                                                onChange={(e) => {
                                                                    const qty = Number(e.target.value);
                                                                    const pricePerUnit = item.subtotal / item.quantity;
                                                                    setSelectedItems(selectedItems.map(i =>
                                                                        i.itemId === item._id
                                                                            ? { 
                                                                                ...i, 
                                                                                damagedQuantity: qty,
                                                                                refundAmount: qty * pricePerUnit
                                                                            }
                                                                            : i
                                                                    ));
                                                                }}
                                                                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-cyan-500"
                                                            />
                                                            <p className="text-xs text-slate-500 mt-1">
                                                                Max: {item.quantity} {item.unit || 'pieces'}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-slate-700 mb-1">
                                                                Refund Amount
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                step="any"
                                                                max={item.subtotal}
                                                                value={isSelected.refundAmount || 0}
                                                                onChange={(e) => {
                                                                    setSelectedItems(selectedItems.map(i =>
                                                                        i.itemId === item._id
                                                                            ? { ...i, refundAmount: Number(e.target.value) }
                                                                            : i
                                                                    ));
                                                                }}
                                                                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-cyan-500"
                                                            />
                                                            <p className="text-xs text-slate-500 mt-1">
                                                                Max: {currency}{item.subtotal.toLocaleString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-700 mb-1">
                                                            Damage Details *
                                                        </label>
                                                        <textarea
                                                            value={isSelected.damageDetails || ''}
                                                            onChange={(e) => {
                                                                setSelectedItems(selectedItems.map(i =>
                                                                    i.itemId === item._id
                                                                        ? { ...i, damageDetails: e.target.value }
                                                                        : i
                                                                ));
                                                            }}
                                                            placeholder="Describe the damage (e.g., stain, tear, color fade) *"
                                                            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-cyan-500 resize-none"
                                                            rows={2}
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-700 mb-1">
                                                            Reason
                                                        </label>
                                                        <select
                                                            value={isSelected.reason || ''}
                                                            onChange={(e) => {
                                                                setSelectedItems(selectedItems.map(i =>
                                                                    i.itemId === item._id
                                                                        ? { ...i, reason: e.target.value }
                                                                        : i
                                                                ));
                                                            }}
                                                            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-cyan-500"
                                                        >
                                                            {reasons.map((r) => (
                                                                <option key={r.value} value={r.value}>{r.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    {isSelected.reason === 'Other' && (
                                                        <div>
                                                            <label className="block text-xs font-medium text-slate-700 mb-1">
                                                                Description
                                                            </label>
                                                            <textarea
                                                                value={isSelected.reasonDescription || ''}
                                                                onChange={(e) => {
                                                                    setSelectedItems(selectedItems.map(i =>
                                                                        i.itemId === item._id
                                                                            ? { ...i, reasonDescription: e.target.value }
                                                                            : i
                                                                    ));
                                                                }}
                                                                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-cyan-500 resize-none"
                                                                rows={2}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* No manual items message */}
                    {order.items.filter(item => item.serviceType === 'manual' || !item.service).length === 0 && (
                        <div className="text-center py-8">
                            <p className="text-slate-500 text-sm">No individual items available for refund.</p>
                            <p className="text-slate-400 text-xs mt-1">Use "Full Refund" to refund the entire order including services.</p>
                        </div>
                    )}

                    {selectedItems.length > 0 && (
                        <div className="mt-4 p-4 bg-slate-50 rounded-xl">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-slate-600">Total Refund Amount:</span>
                                <span className="text-lg font-bold text-slate-900">
                                    {currency}{selectedItems.reduce((sum, i) => sum + i.refundAmount, 0).toLocaleString()}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                💡 If the order hasn't been paid yet, damage details will be recorded for future refund processing.
                            </p>
                        </div>
                    )}

                    <button
                        onClick={handlePartialRefund}
                        disabled={loading || selectedItems.length === 0 || order.items.filter(item => item.serviceType === 'manual' || !item.service).length === 0}
                        className="w-full mt-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl hover:from-orange-400 hover:to-orange-500 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Processing...' : 
                         order.items.filter(item => item.serviceType === 'manual' || !item.service).length === 0 
                         ? 'No Items Available for Partial Refund'
                         : `Record Damage & Process Refund (${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''})`}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProcessRefund;
