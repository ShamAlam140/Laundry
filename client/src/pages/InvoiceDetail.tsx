import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useSettings } from '../context/SettingsContext';
import type { IInvoice } from '../types';

const InvoiceDetail = () => {
    const { invoiceId } = useParams();
    const navigate = useNavigate();
    const { currency } = useSettings();
    const [invoice, setInvoice] = useState<IInvoice | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchInvoice();
    }, [invoiceId]);

    const fetchInvoice = async () => {
        try {
            const res = await api.get(`/invoices/${invoiceId}`);
            setInvoice(res.data.data);
        } catch (err) {
            toast.error('Failed to load invoice');
            navigate('/invoices');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    if (!invoice) return null;

    // Filter items into services, manual items, and refunded categories
    const allItems = [...(invoice.order?.items || [])];
    const services = allItems.filter(item => !item.isRefunded && item.serviceType !== 'manual' && item.service);

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn bg-white min-h-screen">
            {/* Header - Compact */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
                <div>
                    <h1 className="text-lg font-bold text-slate-900">Invoice Details</h1>
                    <p className="text-xs text-slate-500 mt-1">Invoice {invoice.invoiceId}</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => navigate('/invoices')}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                    >
                        ← Back
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs flex items-center gap-1"
                    >
                        📄 PDF
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="px-3 py-1.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-xs flex items-center gap-1"
                    >
                        🖨️ Print
                    </button>
                </div>
            </div>

            {/* Invoice Content - Compact Version */}
            <div className="p-4">
                {/* Company Header - Compact */}
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                                <span className="text-sm font-bold text-slate-600">PL</span>
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-slate-900">Peninsula Laundries</h1>
                                <p className="text-xs text-slate-600">{invoice.invoiceId}</p>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-lg font-bold text-slate-900">31647801045</div>
                    </div>
                </div>

                {/* Company Details - Compact */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-xs">
                    <div className="text-slate-600 space-y-0.5">
                        <p className="font-semibold text-slate-900">JSP Corporation Pty Ltd T/A Peninsula Laundries</p>
                        <p>Tangalooma Island Resort 220 Holt St, Pinkenba, QLD 4008</p>
                        <p>📧 invoices@tangalooma.com | 📞 61475902921</p>
                        <p>🌐 peninsulalaundries.com.au</p>
                    </div>
                    <div className="text-right">
                        <h3 className="text-xs font-semibold text-slate-700 mb-1">Bill To</h3>
                        <p className="font-semibold text-slate-900 text-sm">{invoice.customer?.name}</p>
                        <p className="text-xs text-slate-600">{invoice.customer?.phone}</p>
                        <p className="text-xs text-slate-600">{invoice.customer?.email}</p>
                    </div>
                </div>

                {/* Invoice Info - Compact */}
                <div className="mb-4">
                    <div className="bg-[#1c2a5e] text-white p-2 rounded-t-lg">
                        <h2 className="text-sm font-bold">+ Tax Invoice</h2>
                    </div>
                    <div className="border border-t-0 border-slate-200 p-3 rounded-b-lg bg-slate-50">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div>
                                <p className="text-slate-600 font-medium">INVOICE #</p>
                                <p className="font-bold text-slate-900 text-sm">{invoice.invoiceId}</p>
                            </div>
                            <div>
                                <p className="text-slate-600 font-medium">DATE</p>
                                <p className="font-bold text-slate-900 text-sm">{new Date(invoice.createdAt).toLocaleDateString('en-GB').toUpperCase()}</p>
                            </div>
                            <div>
                                <p className="text-slate-600 font-medium">DUE DATE</p>
                                <p className="font-bold text-slate-900 text-sm">
                                    {invoice.dueDate 
                                        ? new Date(invoice.dueDate).toLocaleDateString('en-GB').toUpperCase() 
                                        : (invoice.customer?.creditDays 
                                            ? new Date(new Date(invoice.createdAt).setDate(new Date(invoice.createdAt).getDate() + invoice.customer.creditDays)).toLocaleDateString('en-GB').toUpperCase() 
                                            : 'DUE ON RECEIPT')}
                                </p>
                            </div>
                            <div>
                                <p className="text-slate-600 font-medium">TOTAL</p>
                                <p className="font-bold text-slate-900 text-sm">{currency}{invoice.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Compact Items Table */}
                <div className="mb-4">
                    <div className="bg-[#1c2a5e] text-white p-2 rounded-t-lg">
                        <h3 className="text-sm font-bold">Items & Services</h3>
                    </div>
                    <div className="border border-t-0 border-slate-200 bg-white rounded-b-lg overflow-hidden">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-100">
                                <tr>
                                    <th className="text-left py-2 px-3 font-semibold text-slate-700">Delivery Date</th>
                                    <th className="text-left py-2 px-3 font-semibold text-slate-700">Item Name</th>
                                    <th className="text-center py-2 px-3 font-semibold text-slate-700">Qty</th>
                                    <th className="text-right py-2 px-3 font-semibold text-slate-700">Rate</th>
                                    <th className="text-right py-2 px-3 font-semibold text-slate-700">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Services - Billable */}
                                {services.map((item, idx) => {
                                    const qty = item.shippedQuantity !== null && item.shippedQuantity !== undefined ? item.shippedQuantity : item.quantity;
                                    return (
                                        <tr key={`service-${idx}`} className="border-b border-slate-100 hover:bg-blue-25">
                                            <td className="py-2 px-3 text-slate-700">
                                                {invoice.order?.deliveryDate ? new Date(invoice.order.deliveryDate).toLocaleDateString() : '02 MAY 2026'}
                                            </td>
                                            <td className="py-2 px-3">
                                                <div>
                                                    <p className="font-medium text-slate-900">{item.serviceName}</p>
                                                    <p className="text-xs text-blue-600">🔧 Service - Billable</p>
                                                </div>
                                            </td>
                                            <td className="text-center py-2 px-3">
                                                 <div className="flex flex-col items-center gap-1">
                                                     <span className="text-[12px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                                         {qty} {item.unit}
                                                     </span>
                                                     {item.shippedQuantity !== null && item.shippedQuantity !== undefined && item.shippedQuantity !== item.quantity && (
                                                         <span className="text-[10px] text-slate-500 font-medium bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                                                             Ordered: {item.quantity}
                                                         </span>
                                                     )}
                                                 </div>
                                            </td>
                                            <td className="text-right py-2 px-3 text-slate-900">{currency}{item.pricePerUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td className="text-right py-2 px-3 font-bold text-slate-900">{currency}{item.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                    );
                                })}

                            </tbody>
                        </table>
                        

                    </div>
                </div>

                {/* Amount Due Section - Compact */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                    <div></div> {/* Empty space */}
                    <div>
                        <div className="bg-[#1c2a5e] text-white p-2 rounded-t-lg">
                            <h3 className="font-bold text-sm">AMOUNT DUE</h3>
                        </div>
                        <div className="border border-t-0 border-slate-300 bg-white rounded-b-lg">
                            <div className="p-3 space-y-2 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-700">Sub Total</span>
                                    <span className="font-medium text-slate-900">{currency}{invoice.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-700">Sales Tax</span>
                                    <span className="font-medium text-slate-900">{currency}{(invoice.totalAmount * 0.05).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                {(invoice.totalRefundAmount || 0) > 0 && (
                                    <div className="flex justify-between text-red-600">
                                        <span>Total Refunded</span>
                                        <span className="font-medium">-{currency}{(invoice.totalRefundAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                <hr className="border-slate-300" />
                                <div className="flex justify-between font-bold text-sm bg-[#1c2a5e] text-white p-2 -m-3 mb-2 rounded bg-opacity-100">
                                    <span>TOTAL</span>
                                    <span>{currency}{(invoice.totalAmount * 1.05 - (invoice.totalRefundAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-700">Paid</span>
                                    <span className="font-medium text-green-600">{currency}{invoice.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between font-bold text-sm">
                                    <span className="text-slate-900">Balance Due</span>
                                    <span className={`${invoice.balanceDue < 0 ? 'text-green-600' : invoice.balanceDue > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                                        {currency}{Math.abs(invoice.balanceDue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Payment Information - Compact */}
                <div className="mb-4">
                    <div className="bg-slate-100 p-3 rounded-lg">
                        <h3 className="font-bold text-slate-900 mb-2 text-sm flex items-center gap-2">
                            🏦 PAYMENT
                        </h3>
                        <div className="text-xs text-slate-700 space-y-0.5">
                            <p><span className="font-medium">Direct Deposit:</span> JSP CORPORATION PTY LTD</p>
                            <p><span className="font-medium">Bank:</span> ANZ BSB: 012787</p>
                        </div>
                    </div>
                </div>


            </div>
        </div>
    );
};

export default InvoiceDetail;