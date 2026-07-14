import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import type { IInvoice } from '../types';

const PublicInvoiceDetail = () => {
    const { invoiceId } = useParams();
    const [invoice, setInvoice] = useState<IInvoice | null>(null);
    const [loading, setLoading] = useState(true);

    // Hardcoded currency for public views as context might not load or default
    const currency = '$';

    useEffect(() => {
        fetchInvoice();
    }, [invoiceId]);

    const fetchInvoice = async () => {
        try {
            // Retrieve from backend using public endpoint
            // Base API URL is relative or uses environment default
            const res = await axios.get(`/api/invoices/public/${invoiceId}`);
            setInvoice(res.data.data);
        } catch (err) {
            toast.error('Failed to load invoice. Link might be invalid.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
            </div>
        );
    }

    if (!invoice) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center space-y-4">
                    <span className="text-4xl">⚠️</span>
                    <h1 className="text-xl font-bold text-slate-900">Invoice Not Found</h1>
                    <p className="text-sm text-slate-500">
                        The link you followed may have expired or is incorrect. Please contact support.
                    </p>
                </div>
            </div>
        );
    }

    const allItems = [...(invoice.order?.items || [])];
    const services = allItems.filter(item => !item.isRefunded && item.serviceType !== 'manual' && item.service);

    return (
        <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8 print:bg-white print:py-0 print:px-0">
            <div className="max-w-4xl mx-auto space-y-6 bg-white p-6 sm:p-8 rounded-2xl shadow-xl print:shadow-none print:rounded-none">
                {/* Header Controls */}
                <div className="flex items-center justify-between pb-6 border-b border-slate-200 print:hidden">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Peninsula Laundries</h1>
                        <p className="text-xs text-slate-500 mt-1">Tax Invoice for {invoice.customer?.name}</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => window.print()}
                            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:from-cyan-400 hover:to-blue-500 text-sm font-semibold transition-all shadow-md shadow-cyan-500/20 flex items-center gap-2 cursor-pointer"
                        >
                            <span>🖨️</span> Print / Save PDF
                        </button>
                    </div>
                </div>

                {/* Company Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pt-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-800 text-lg shadow-sm border border-slate-200">
                            PL
                        </div>
                        <div>
                            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Peninsula Laundries</h1>
                            <p className="text-xs text-slate-500">Tax Invoice {invoice.invoiceId}</p>
                        </div>
                    </div>
                    <div className="text-left sm:text-right">
                        <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">ABN</span>
                        <span className="text-sm font-bold text-slate-900">31647801045</span>
                    </div>
                </div>

                {/* Billing Addresses Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 text-sm border-t border-slate-100">
                    <div className="text-slate-600 space-y-1">
                        <p className="font-bold text-slate-900">JSP Corporation Pty Ltd T/A Peninsula Laundries</p>
                        <p>Tangalooma Island Resort 220 Holt St, Pinkenba, QLD 4008</p>
                        <p>📧 invoices@tangalooma.com | 📞 61475902921</p>
                        <p className="text-cyan-600 font-medium">🌐 peninsulalaundries.com.au</p>
                    </div>
                    <div className="text-left md:text-right space-y-1">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bill To</h3>
                        <p className="font-bold text-slate-900 text-base">{invoice.customer?.name}</p>
                        <p className="text-slate-600">{invoice.customer?.phone}</p>
                        <p className="text-slate-600">{invoice.customer?.email}</p>
                        {invoice.customer?.address && <p className="text-xs text-slate-500 max-w-xs md:ml-auto">{invoice.customer.address}</p>}
                    </div>
                </div>

                {/* Invoice Metadata */}
                <div>
                    <div className="bg-[#1c2a5e] text-white p-3 rounded-t-xl">
                        <h2 className="text-sm font-bold tracking-wide uppercase">+ Tax Invoice Details</h2>
                    </div>
                    <div className="border border-t-0 border-slate-200 p-4 rounded-b-xl bg-slate-50/50">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-slate-400 font-medium text-xs uppercase tracking-wider">Invoice #</p>
                                <p className="font-bold text-slate-900 mt-1">{invoice.invoiceId}</p>
                            </div>
                            <div>
                                <p className="text-slate-400 font-medium text-xs uppercase tracking-wider">Date</p>
                                <p className="font-bold text-slate-900 mt-1">{new Date(invoice.createdAt).toLocaleDateString('en-GB').toUpperCase()}</p>
                            </div>
                            <div>
                                <p className="text-slate-400 font-medium text-xs uppercase tracking-wider">Due Date</p>
                                <p className="font-bold text-slate-900 mt-1">
                                    {invoice.dueDate 
                                        ? new Date(invoice.dueDate).toLocaleDateString('en-GB').toUpperCase() 
                                        : (invoice.customer?.creditDays 
                                            ? new Date(new Date(invoice.createdAt).setDate(new Date(invoice.createdAt).getDate() + invoice.customer.creditDays)).toLocaleDateString('en-GB').toUpperCase() 
                                            : 'DUE ON RECEIPT')}
                                </p>
                            </div>
                            <div>
                                <p className="text-slate-400 font-medium text-xs uppercase tracking-wider">Total Amount</p>
                                <p className="font-extrabold text-cyan-600 mt-1">{currency}{invoice.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div>
                    <div className="bg-[#1c2a5e] text-white p-3 rounded-t-xl">
                        <h3 className="text-sm font-bold tracking-wide uppercase">Items & Services</h3>
                    </div>
                    <div className="border border-t-0 border-slate-200 bg-white rounded-b-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left py-3 px-4 font-semibold text-slate-600">Delivery Date</th>
                                        <th className="text-left py-3 px-4 font-semibold text-slate-600">Item Name</th>
                                        <th className="text-center py-3 px-4 font-semibold text-slate-600">Quantity</th>
                                        <th className="text-right py-3 px-4 font-semibold text-slate-600">Rate</th>
                                        <th className="text-right py-3 px-4 font-semibold text-slate-600">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {services.map((item, idx) => {
                                        const qty = item.shippedQuantity !== null && item.shippedQuantity !== undefined ? item.shippedQuantity : item.quantity;
                                        return (
                                            <tr key={`service-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="py-3 px-4 text-slate-600">
                                                    {invoice.order?.deliveryDate ? new Date(invoice.order.deliveryDate).toLocaleDateString() : '02 MAY 2026'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <p className="font-semibold text-slate-900">{item.serviceName}</p>
                                                    <span className="inline-block mt-0.5 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">🔧 Service</span>
                                                </td>
                                                <td className="text-center py-3 px-4">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                                            {qty} {item.unit}
                                                        </span>
                                                        {item.shippedQuantity !== null && item.shippedQuantity !== undefined && item.shippedQuantity !== item.quantity && (
                                                            <span className="text-[10px] text-slate-500 font-medium bg-slate-50 border border-slate-150 px-1.5 py-0.5 rounded">
                                                                Ordered: {item.quantity}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="text-right py-3 px-4 text-slate-900 font-medium">{currency}{item.pricePerUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td className="text-right py-3 px-4 font-bold text-slate-900">{currency}{item.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Amount Due Details */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="hidden lg:block"></div> {/* Spacer */}
                    <div>
                        <div className="bg-[#1c2a5e] text-white p-3 rounded-t-xl">
                            <h3 className="font-bold text-sm tracking-wide uppercase">Amount Due</h3>
                        </div>
                        <div className="border border-t-0 border-slate-200 bg-white rounded-b-xl overflow-hidden">
                            <div className="p-4 space-y-3 text-sm">
                                <div className="flex justify-between text-slate-600">
                                    <span>Sub Total</span>
                                    <span className="font-semibold text-slate-900">{currency}{invoice.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span>Sales Tax (GST 5%)</span>
                                    <span className="font-semibold text-slate-900">{currency}{(invoice.totalAmount * 0.05).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                {(invoice.totalRefundAmount || 0) > 0 && (
                                    <div className="flex justify-between text-red-600">
                                        <span>Total Refunded</span>
                                        <span className="font-semibold">-{currency}{(invoice.totalRefundAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                <hr className="border-slate-200" />
                                <div className="flex justify-between font-bold text-base bg-[#1c2a5e] text-white p-3 rounded-lg shadow-sm">
                                    <span>TOTAL</span>
                                    <span>{currency}{(invoice.totalAmount * 1.05 - (invoice.totalRefundAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-slate-600 pt-1">
                                    <span>Paid Amount</span>
                                    <span className="font-bold text-green-600">{currency}{invoice.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <hr className="border-slate-100" />
                                <div className="flex justify-between font-bold text-base pt-1">
                                    <span className="text-slate-900">Balance Due</span>
                                    <span className={`text-lg ${invoice.balanceDue < 0 ? 'text-green-600' : invoice.balanceDue > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                                        {currency}{Math.abs(invoice.balanceDue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Payment Banking Information */}
                <div>
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                        <h3 className="font-bold text-slate-900 mb-2 text-sm flex items-center gap-2">
                            🏦 Bank Payment Info
                        </h3>
                        <div className="text-xs text-slate-600 space-y-1">
                            <p><span className="font-medium text-slate-900">Direct Deposit:</span> JSP CORPORATION PTY LTD</p>
                            <p><span className="font-medium text-slate-900">Bank:</span> ANZ BANK | <span className="font-medium text-slate-900">BSB:</span> 012787</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicInvoiceDetail;
