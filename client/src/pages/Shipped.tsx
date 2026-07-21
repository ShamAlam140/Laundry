import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useSettings } from '../context/SettingsContext';
import type { IOrder } from '../types';
import Pagination from '../components/Pagination';
import { generateOrderLabelHTML } from '../utils/orderLabelPrinter';
import {
    HiOutlineSearch,
    HiOutlineEye,
    HiOutlinePrinter,
    HiOutlineX,
} from 'react-icons/hi';
import { HiOutlineTruck } from 'react-icons/hi2';

const Shipped = () => {
    const [orders, setOrders] = useState<IOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { currency } = useSettings();

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const itemsPerPage = 20;

    const [search, setSearch] = useState('');
    const [shipModalOrder, setShipModalOrder] = useState<IOrder | null>(null);
    const [shippedQuantities, setShippedQuantities] = useState<Record<string, number>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchOrders = useCallback(async () => {
        try {
            setLoading(true);
            const params: any = { page: currentPage, limit: itemsPerPage, status: 'packed', isShipped: 'false' };
            if (search) params.search = search;
            
            const res = await api.get('/orders', { params });
            setOrders(res.data.data);
            setTotalPages(res.data.totalPages || 1);
            setTotalItems(res.data.total || 0);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to fetch packed orders');
        } finally {
            setLoading(false);
        }
    }, [search, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
        const t = setTimeout(() => fetchOrders(), 400);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        fetchOrders();
    }, [currentPage]);

    const openShipModal = (order: IOrder) => {
        setShipModalOrder(order);
        const initialQty: Record<string, number> = {};
        order.items?.forEach((item: any) => {
            initialQty[item._id] = item.shippedQuantity ?? item.quantity;
        });
        setShippedQuantities(initialQty);
    };

    const closeShipModal = () => {
        setShipModalOrder(null);
        setShippedQuantities({});
    };

    const handleQtyChange = (itemId: string, val: string) => {
        const parsed = Math.max(0, parseFloat(val) || 0);
        setShippedQuantities(prev => ({ ...prev, [itemId]: parsed }));
    };

    const fillItemQty = (itemId: string, maxQty: number) => {
        setShippedQuantities(prev => {
            const current = prev[itemId] ?? maxQty;
            return { ...prev, [itemId]: current < maxQty ? maxQty : 0 };
        });
    };

    const fillAllServices = () => {
        if (!shipModalOrder) return;
        setShippedQuantities(prev => {
            const next = { ...prev };
            shipModalOrder.items?.forEach((item: any) => {
                if (item.serviceType !== 'manual') {
                    next[item._id] = item.quantity;
                }
            });
            return next;
        });
    };

    const fillAllManual = () => {
        if (!shipModalOrder) return;
        setShippedQuantities(prev => {
            const next = { ...prev };
            shipModalOrder.items?.forEach((item: any) => {
                if (item.serviceType === 'manual') {
                    next[item._id] = item.quantity;
                }
            });
            return next;
        });
    };

    const calculatedTotals = useMemo(() => {
        if (!shipModalOrder) return { subtotal: 0, taxAmount: 0, discountAmount: 0, totalAmount: 0 };
        
        const subtotal = Math.round(shipModalOrder.items!.reduce((sum: number, item: any) => {
            if (item.serviceType === 'manual') return sum;
            const qty = shippedQuantities[item._id] ?? item.quantity;
            return sum + (qty * item.pricePerUnit);
        }, 0) * 100) / 100;

        const taxAmount = Math.round((subtotal * (shipModalOrder.taxPercent || 0) / 100) * 100) / 100;
        const discountAmount = Math.round((subtotal * (shipModalOrder.discountPercent || 0) / 100) * 100) / 100;
        const totalAmount = Math.round((subtotal + taxAmount - discountAmount + (shipModalOrder.serviceCharge || 0)) * 100) / 100;

        return { subtotal, taxAmount, discountAmount, totalAmount };
    }, [shipModalOrder, shippedQuantities]);

    const handleConfirmShipment = async () => {
        if (!shipModalOrder) return;
        try {
            setIsSubmitting(true);
            const payload = {
                items: shipModalOrder.items!.map((item: any) => ({
                    itemId: item._id,
                    shippedQuantity: shippedQuantities[item._id] ?? item.quantity
                }))
            };
            await api.post(`/orders/${shipModalOrder._id}/ship`, payload);
            toast.success(`Order ${shipModalOrder.orderId} shipped & Invoice generated successfully!`);
            closeShipModal();
            fetchOrders();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to complete order shipment');
        } finally {
            setIsSubmitting(false);
        }
    };

    const printLabel = (order: IOrder) => {
        const w = window.open('', '_blank', 'width=900,height=700');
        if (w) {
            w.document.write(generateOrderLabelHTML(order as any));
            w.document.close();
        }
    };

    return (
        <div className="space-y-5 animate-fadeIn">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Shipped / Packed Orders</h1>
                <p className="text-sm text-slate-500 mt-1">{totalItems} packed orders ready to ship</p>
            </div>

            <div className="relative max-w-md">
                <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search packed orders by ID or customer..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                />
                {search && (
                    <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <HiOutlineX className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-20 text-slate-500 text-sm">No packed orders found</div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                        <th className="px-5 py-3 text-left">Order ID</th>
                                        <th className="px-5 py-3 text-left">Customer</th>
                                        <th className="px-5 py-3 text-left">Items Details</th>
                                        <th className="px-5 py-3 text-right">Amount</th>
                                        <th className="px-5 py-3 text-left">Date Completed</th>
                                        <th className="px-5 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map(o => (
                                        <tr key={o._id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <span className="text-sm font-semibold text-cyan-600 cursor-pointer hover:underline" onClick={() => navigate(`/orders/${o._id}`)}>
                                                    {o.orderId}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className="text-sm font-medium text-slate-900">{o.customer?.name}</span>
                                                <p className="text-xs text-slate-400">{o.customer?.customerId}</p>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="space-y-1 my-1">
                                                    {o.items?.filter((i: any) => i.serviceType === 'manual' || !i.service).map((item: any, idx: number) => {
                                                        const qty = item.shippedQuantity !== null && item.shippedQuantity !== undefined ? item.shippedQuantity : item.quantity;
                                                        const hasDiff = item.shippedQuantity !== null && item.shippedQuantity !== undefined && item.shippedQuantity !== item.quantity;
                                                        return (
                                                            <div key={idx} className="text-xs text-slate-600 flex items-center gap-1 flex-wrap">
                                                                <span className="font-semibold text-slate-800">{qty}</span> x {item.itemName || item.serviceName}
                                                                {hasDiff && (
                                                                    <span className="text-[10px] text-slate-400 font-normal">(ordered: {item.quantity})</span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <span className="text-sm font-semibold text-slate-900">{currency}{Number(o.totalAmount || 0).toFixed(2)}</span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className="text-sm text-slate-500">
                                                    {o.serviceEndTime ? new Date(o.serviceEndTime).toLocaleDateString() : new Date(o.updatedAt!).toLocaleDateString()}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button onClick={() => navigate(`/orders/${o._id}`)} title="View Details" className="p-2 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors">
                                                        <HiOutlineEye className="w-4.5 h-4.5" />
                                                    </button>
                                                    <button onClick={() => printLabel(o)} title="Print Label" className="p-2 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors">
                                                        <HiOutlinePrinter className="w-4.5 h-4.5" />
                                                    </button>
                                                    <button onClick={() => openShipModal(o)} title="Ship & Generate Invoice" className="p-2 rounded-lg text-white bg-[#1c2a5e] hover:bg-opacity-90 shadow-sm transition-colors">
                                                        <HiOutlineTruck className="w-4.5 h-4.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
                    </>
                )}
            </div>

            {shipModalOrder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
                    <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden transform transition-all border border-slate-100 flex flex-col max-h-[90vh]">
                        <div className="px-6 py-5 bg-[#1c2a5e] text-white flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold">Confirm Shipment & Bill</h3>
                                <p className="text-xs text-slate-200 mt-1">Order {shipModalOrder.orderId} • Customer: {shipModalOrder.customer?.name}</p>
                            </div>
                            <button onClick={closeShipModal} className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-colors">
                                <HiOutlineX className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-8 flex-1">
                            {(() => {
                                const serviceItems = shipModalOrder.items?.filter((i: any) => i.serviceType !== 'manual') || [];
                                const manualItems = shipModalOrder.items?.filter((i: any) => i.serviceType === 'manual') || [];
                                return (
                                    <>
                                        {serviceItems.length > 0 && (
                                            <div className="space-y-3">
                                                <h4 className="text-xs font-bold text-[#1c2a5e] uppercase tracking-wider">Services & Billing Items</h4>
                                                <div className="bg-white overflow-hidden">
                                                    <table className="w-full border-collapse">
                                                        <thead>
                                                            <tr className="text-slate-600 text-sm font-semibold uppercase border-b border-slate-100">
                                                                <th className="px-4 py-4 text-left font-bold text-slate-800">Item</th>
                                                                <th className="px-4 py-4 text-center font-bold text-slate-800 w-[18%]">
                                                                    <div className="flex flex-col items-center gap-0.5">
                                                                        <span>Fill Items</span>
                                                                        <button type="button" onClick={fillAllServices} className="text-[10px] text-cyan-600 hover:text-cyan-800 hover:underline font-bold transition-all cursor-pointer bg-transparent border-none p-0 focus:outline-none">[Fill All]</button>
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-4 text-center font-bold text-slate-800 w-[18%]">Qty Ordered</th>
                                                                <th className="px-4 py-4 text-center font-bold text-slate-800 w-[18%]">Filled Qty</th>
                                                                <th className="px-4 py-4 text-center font-bold text-slate-800 w-[18%]">Back Order</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white divide-y divide-transparent">
                                                            {serviceItems.map((item: any) => {
                                                                const filled = shippedQuantities[item._id] ?? item.quantity;
                                                                const backorder = Math.max(0, item.quantity - filled);
                                                                return (
                                                                    <tr key={item._id} className="hover:bg-slate-50/40 transition-colors">
                                                                        <td className="px-4 py-4 text-slate-700 font-medium text-base">{item.itemName || item.serviceName}</td>
                                                                        <td className="px-4 py-3 text-center">
                                                                            <button type="button" onClick={() => fillItemQty(item._id, item.quantity)} className="w-24 mx-auto py-2.5 text-center font-bold border border-slate-200 rounded-2xl bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-sm focus:outline-none text-slate-800">
                                                                                {filled}
                                                                            </button>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center">
                                                                            <div className="w-24 mx-auto py-2.5 text-center font-semibold border border-slate-200 rounded-2xl bg-white text-slate-700 shadow-sm">{item.quantity}</div>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center">
                                                                            <input type="number" min={0} value={filled} onChange={(e) => handleQtyChange(item._id, e.target.value)} className="w-24 mx-auto py-2.5 text-center font-bold border border-slate-200 rounded-2xl bg-white text-slate-900 shadow-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500" />
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center">
                                                                            <div className={`w-24 mx-auto py-2.5 text-center font-bold border rounded-2xl shadow-sm ${backorder > 0 ? "text-amber-600 border-amber-200 bg-amber-50/10" : "text-slate-400 border-slate-200 bg-white"}`}>{backorder}</div>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                        {manualItems.length > 0 && (
                                            <div className="space-y-3 pt-6 border-t border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-xs font-bold text-[#1c2a5e] uppercase tracking-wider">Linen / Custom Items Tracking</h4>
                                                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">Not Billed</span>
                                                </div>
                                                <div className="bg-white overflow-hidden">
                                                    <table className="w-full border-collapse">
                                                        <thead>
                                                            <tr className="text-slate-600 text-sm font-semibold uppercase border-b border-slate-100">
                                                                <th className="px-4 py-4 text-left font-bold text-slate-800">Linen / Bag Item</th>
                                                                <th className="px-4 py-4 text-center font-bold text-slate-800 w-[18%]">
                                                                    <div className="flex flex-col items-center gap-0.5">
                                                                        <span>Fill Items</span>
                                                                        <button type="button" onClick={fillAllManual} className="text-[10px] text-cyan-600 hover:text-cyan-800 hover:underline font-bold transition-all cursor-pointer bg-transparent border-none p-0 focus:outline-none">[Fill All]</button>
                                                                    </div>
                                                                </th>
                                                                <th className="px-4 py-4 text-center font-bold text-slate-800 w-[18%]">Qty Ordered</th>
                                                                <th className="px-4 py-4 text-center font-bold text-slate-800 w-[18%]">Filled Qty</th>
                                                                <th className="px-4 py-4 text-center font-bold text-slate-800 w-[18%]">Back Order</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white divide-y divide-transparent">
                                                            {manualItems.map((item: any) => {
                                                                const filled = shippedQuantities[item._id] ?? item.quantity;
                                                                const backorder = Math.max(0, item.quantity - filled);
                                                                return (
                                                                    <tr key={item._id} className="hover:bg-slate-50/40 transition-colors">
                                                                        <td className="px-4 py-4 text-slate-700 font-medium text-base">{item.itemName || item.serviceName}</td>
                                                                        <td className="px-4 py-3 text-center">
                                                                            <button type="button" onClick={() => fillItemQty(item._id, item.quantity)} className="w-24 mx-auto py-2.5 text-center font-bold border border-slate-200 rounded-2xl bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-sm focus:outline-none text-slate-800">
                                                                                {filled}
                                                                            </button>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center">
                                                                            <div className="w-24 mx-auto py-2.5 text-center font-semibold border border-slate-200 rounded-2xl bg-white text-slate-700 shadow-sm">{item.quantity}</div>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center">
                                                                            <input type="number" min={0} value={filled} onChange={(e) => handleQtyChange(item._id, e.target.value)} className="w-24 mx-auto py-2.5 text-center font-bold border border-slate-200 rounded-2xl bg-white text-slate-900 shadow-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500" />
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center">
                                                                            <div className={`w-24 mx-auto py-2.5 text-center font-bold border rounded-2xl shadow-sm ${backorder > 0 ? "text-amber-600 border-amber-200 bg-amber-50/10" : "text-slate-400 border-slate-200 bg-white"}`}>{backorder}</div>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                            <div className="flex justify-end pt-2">
                                <div className="w-full lg:w-80 bg-[#1c2a5e]/5 rounded-2xl p-5 border border-[#1c2a5e]/10 space-y-3">
                                    <div className="flex justify-between text-xs text-slate-600">
                                        <span>Subtotal:</span>
                                        <span className="font-semibold text-slate-900">{currency}{Number(calculatedTotals.subtotal || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-600">
                                        <span>Tax ({shipModalOrder.taxPercent || 0}%):</span>
                                        <span className="font-semibold text-slate-900">{currency}{Number(calculatedTotals.taxAmount || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-600 text-red-600">
                                        <span>Discount ({shipModalOrder.discountPercent || 0}%):</span>
                                        <span className="font-semibold">-{currency}{Number(calculatedTotals.discountAmount || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-600">
                                        <span>Service Charge:</span>
                                        <span className="font-semibold text-slate-900">{currency}{Number(shipModalOrder.serviceCharge || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="border-t border-slate-200 my-2 pt-2 flex justify-between text-sm font-bold text-slate-900">
                                        <span>New Total:</span>
                                        <span className="text-cyan-700">{currency}{Number(calculatedTotals.totalAmount || 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                            <button onClick={closeShipModal} className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm bg-white hover:bg-slate-50 transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleConfirmShipment} disabled={isSubmitting} className="flex items-center gap-2 px-6 py-2.5 bg-[#1c2a5e] text-white text-sm font-bold rounded-xl hover:bg-opacity-90 transition-all shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed">
                                {isSubmitting ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <HiOutlineTruck className="w-4.5 h-4.5" />
                                )}
                                Confirm & Generate Invoice
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Shipped;
