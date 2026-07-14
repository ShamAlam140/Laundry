import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import {
    HiOutlineSearch,
    HiOutlineEye,
    HiOutlineX,
    HiOutlineCheck,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlinePlus,
} from 'react-icons/hi';

const cycleLabels: Record<string, string> = {
    '1_day': 'Daily Cycle',
    '3_days': '3-Day Cycle',
    '5_days': '5-Day Cycle',
    '1_week': 'Weekly Cycle',
    '15_days': '15-Day Cycle',
    '1_month': 'Monthly Cycle',
    'none': 'No Cycle Filter',
};

const InvoiceApproval = () => {
    const { currency } = useSettings();
    const { user } = useAuth();
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [viewInvoice, setViewInvoice] = useState<any>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [approvingId, setApprovingId] = useState<string | null>(null);

    // Edit states
    const [isEditMode, setIsEditMode] = useState(false);
    const [editItems, setEditItems] = useState<any[]>([]);
    const [editDiscountPercent, setEditDiscountPercent] = useState(0);
    const [editTaxPercent, setEditTaxPercent] = useState(0);
    const [editServiceCharge, setEditServiceCharge] = useState(0);
    const [editSaving, setEditSaving] = useState(false);

    // Edit calculations
    const editCalc = useMemo(() => {
        if (!isEditMode) return { subtotal: 0, taxAmount: 0, discountAmount: 0, totalAmount: 0, balanceDue: 0 };
        const billable = editItems.filter(item => item.serviceType !== 'manual');
        const subtotal = billable.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.pricePerUnit) || 0), 0);
        const taxAmount = (subtotal * (Number(editTaxPercent) || 0)) / 100;
        const discountAmount = (subtotal * (Number(editDiscountPercent) || 0)) / 100;
        const totalAmount = subtotal + taxAmount - discountAmount + (Number(editServiceCharge) || 0);
        const paidAmount = viewInvoice?.paidAmount || 0;
        const balanceDue = totalAmount - paidAmount;
        return { subtotal, taxAmount, discountAmount, totalAmount, balanceDue };
    }, [isEditMode, editItems, editDiscountPercent, editTaxPercent, editServiceCharge, viewInvoice?.paidAmount]);

    const fetchPendingInvoices = async () => {
        try {
            setLoading(true);
            const res = await api.get('/invoices', { params: { isApproved: false, limit: 100 } });
            setInvoices(res.data.data || []);
        } catch (err: any) {
            toast.error('Failed to load pending invoices');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingInvoices();
    }, []);

    // Filter invoices by search
    const filteredInvoices = useMemo(() => {
        return invoices.filter((inv) => {
            const q = search.toLowerCase();
            const name = (inv.customer?.name || '').toLowerCase();
            const phone = (inv.customer?.phone || '').toLowerCase();
            const customerId = (inv.customer?.customerId || '').toLowerCase();
            const invoiceId = (inv.invoiceId || '').toLowerCase();
            const orderId = (inv.order?.orderId || '').toLowerCase();

            return (
                name.includes(q) ||
                phone.includes(q) ||
                customerId.includes(q) ||
                invoiceId.includes(q) ||
                orderId.includes(q)
            );
        });
    }, [invoices, search]);

    // Fetch full invoice detail (same as Invoices.tsx)
    const viewInvoiceDetail = async (id: string) => {
        try {
            setDetailLoading(true);
            const res = await api.get(`/invoices/${id}`);
            setViewInvoice(res.data.data);
        } catch {
            toast.error('Failed to load invoice details');
        } finally {
            setDetailLoading(false);
        }
    };

    const handleApprove = async (id: string) => {
        try {
            setApprovingId(id);
            await api.put(`/invoices/${id}/approve`);
            toast.success('Invoice approved successfully!');
            setViewInvoice(null);
            fetchPendingInvoices();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to approve invoice');
        } finally {
            setApprovingId(null);
        }
    };

    const enterEditMode = () => {
        if (!viewInvoice) return;
        const orderItems = viewInvoice.order?.items || [];
        setEditItems(orderItems.map((item: any) => ({
            ...item,
            quantity: item.shippedQuantity ?? item.quantity
        })));
        setEditDiscountPercent(viewInvoice.order?.discountPercent || 0);
        setEditTaxPercent(viewInvoice.order?.taxPercent || 0);
        setEditServiceCharge(viewInvoice.order?.serviceCharge || 0);
        setIsEditMode(true);
    };

    const exitEditMode = () => {
        setIsEditMode(false);
        setEditItems([]);
        setEditSaving(false);
    };

    const handleEditItemChange = (index: number, field: string, value: any) => {
        setEditItems(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            if (field === 'quantity' || field === 'pricePerUnit') {
                const qty = Number(field === 'quantity' ? value : updated[index].quantity) || 0;
                const rate = Number(field === 'pricePerUnit' ? value : updated[index].pricePerUnit) || 0;
                updated[index].subtotal = qty * rate;
            }
            return updated;
        });
    };

    const handleRemoveEditItem = (index: number) => {
        setEditItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddEditItem = () => {
        setEditItems(prev => [...prev, {
            serviceName: '',
            serviceType: 'service',
            itemName: '',
            itemType: 'Clothing',
            quantity: 1,
            unit: 'piece',
            pricePerUnit: 0,
            subtotal: 0,
            service: 'custom',
        }]);
    };

    const handleSaveInvoice = async () => {
        if (!viewInvoice || editItems.length === 0) {
            toast.error('At least one item is required');
            return;
        }
        for (const item of editItems) {
            if (!Number(item.quantity) || Number(item.quantity) <= 0) {
                toast.error(`Item "${item.itemName || item.serviceName || 'Unnamed'}" must have quantity > 0`);
                return;
            }
            if (Number(item.pricePerUnit) < 0) {
                toast.error(`Item "${item.itemName || item.serviceName || 'Unnamed'}" has invalid price`);
                return;
            }
        }
        try {
            setEditSaving(true);
            const res = await api.put(`/invoices/${viewInvoice._id}`, {
                items: editItems,
                discountPercent: Number(editDiscountPercent) || 0,
                taxPercent: Number(editTaxPercent) || 0,
                serviceCharge: Number(editServiceCharge) || 0,
            });
            toast.success('Invoice updated successfully');
            setViewInvoice(res.data.data);
            exitEditMode();
            fetchPendingInvoices();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update invoice');
        } finally {
            setEditSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Invoice Approval</h1>
                <p className="text-sm text-slate-500 mt-1">Review and approve cycle-based invoices before they are sent to customers' mobile apps.</p>
            </div>

            {/* Search */}
            <div className="relative">
                <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                    type="text"
                    placeholder="Search by customer name, phone, invoice ID, or order ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                />
            </div>

            {/* Invoices List */}
            <div className="rounded-2xl border border-slate-200 bg-white backdrop-blur-sm overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : filteredInvoices.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">No pending invoices found</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-xs text-slate-500 uppercase border-b border-slate-200">
                                    <th className="px-5 py-3 text-left">Invoice ID</th>
                                    <th className="px-5 py-3 text-left">Order ID</th>
                                    <th className="px-5 py-3 text-left">Customer</th>
                                    <th className="px-5 py-3 text-left">Cycle</th>
                                    <th className="px-5 py-3 text-left">Total</th>
                                    <th className="px-5 py-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredInvoices.map((inv) => (
                                    <tr key={inv._id} className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-5 py-4">
                                            <span className="text-sm font-bold text-slate-950">{inv.invoiceId}</span>
                                            <span className="block text-[10px] text-slate-400 mt-0.5">{new Date(inv.createdAt).toLocaleDateString('en-AU')}</span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="text-sm font-semibold text-cyan-600">{inv.order?.orderId || '-'}</span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="text-sm font-semibold text-slate-900">{inv.customer?.name}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">{inv.customer?.phone} • {inv.customer?.customerId}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-50 border border-cyan-100 text-cyan-700">
                                                {cycleLabels[inv.customer?.notificationFrequency] || 'Custom Cycle'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="text-sm font-bold text-slate-950">{currency}{Number(inv.totalAmount || 0).toLocaleString()}</span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => viewInvoiceDetail(inv._id)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                                                >
                                                    <HiOutlineEye className="w-4 h-4" /> Review
                                                </button>
                                                <button
                                                    onClick={() => handleApprove(inv._id)}
                                                    disabled={approvingId === inv._id}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                                                >
                                                    {approvingId === inv._id ? (
                                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    ) : (
                                                        <HiOutlineCheck className="w-4 h-4" />
                                                    )}
                                                    Approve
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Loading overlay for detail fetch */}
            {detailLoading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-3 shadow-2xl">
                        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm text-slate-600 font-medium">Loading invoice details…</p>
                    </div>
                </div>
            )}

            {/* ── INVOICE DETAIL MODAL (Cloned from Invoices.tsx) ── */}
            {viewInvoice && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) { exitEditMode(); setViewInvoice(null); } }}
                >
                    <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[95vh] animate-fadeIn">

                        {/* ── TOOLBAR ── */}
                        <div className="flex-shrink-0 bg-[#1c2a5e] px-5 py-3 rounded-t-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <img src="/logo.jpeg" alt="Logo" className="h-8 w-auto object-contain rounded opacity-90" />
                                <div>
                                    <p className="text-white font-bold text-sm leading-tight">Peninsula Laundries</p>
                                    <p className="text-blue-300 text-xs font-mono">
                                        {viewInvoice.invoiceId}
                                        {isEditMode && <span className="ml-2 text-amber-300 font-semibold">• Editing</span>}
                                        <span className="ml-2 text-amber-400 text-[10px] font-semibold">⏳ Pending Approval</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {isEditMode ? (
                                    <>
                                        <button
                                            onClick={handleSaveInvoice}
                                            disabled={editSaving || editItems.length === 0}
                                            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded-lg transition-all font-bold shadow-lg"
                                        >
                                            {editSaving ? (
                                                <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
                                            ) : (
                                                <>💾 Save Changes</>
                                            )}
                                        </button>
                                        <button
                                            onClick={exitEditMode}
                                            disabled={editSaving}
                                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white/10 hover:bg-red-500/60 text-white text-xs rounded-lg transition-all font-medium"
                                        >
                                            <HiOutlineX className="w-3.5 h-3.5" /> Cancel
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={enterEditMode}
                                            disabled={viewInvoice.isFinalized && user?.role !== 'admin'}
                                            title={viewInvoice.isFinalized && user?.role !== 'admin' ? "This invoice is finalized. Only Admin can edit." : "Edit Invoice"}
                                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500/90 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded-lg transition-all font-bold shadow"
                                        >
                                            <HiOutlinePencil className="w-3.5 h-3.5" /> Edit
                                        </button>
                                        <button
                                            onClick={() => handleApprove(viewInvoice._id)}
                                            disabled={approvingId === viewInvoice._id}
                                            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs rounded-lg transition-all font-bold shadow-lg"
                                        >
                                            {approvingId === viewInvoice._id ? (
                                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <HiOutlineCheck className="w-3.5 h-3.5" />
                                            )}
                                            Approve & Send
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => { exitEditMode(); setViewInvoice(null); }}
                                    className="p-1.5 rounded-lg bg-white/10 hover:bg-red-500/60 text-white transition-all"
                                    title="Close"
                                >
                                    <HiOutlineX className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* ── SCROLLABLE BODY ── */}
                        <div className="overflow-y-auto flex-1 p-6 space-y-4">

                            {/* ── BUSINESS HEADER: Logo | Contact | ABN ── */}
                            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">

                                {/* LEFT: Logo + Website + Email */}
                                <div className="flex flex-col items-start gap-1">
                                    <img src="/logo.jpeg" alt="Peninsula Laundries" className="max-h-14 max-w-[110px] object-contain mb-1" />
                                    <span className="text-[7px] tracking-[2px] text-slate-400 uppercase font-semibold mb-2">L A U N D R I E S</span>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                        <svg className="w-3 h-3 text-[#1c2a5e] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>
                                        {viewInvoice.business?.website || 'peninsulalaundries.com.au'}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                        <svg className="w-3 h-3 text-[#1c2a5e] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                                        {viewInvoice.business?.email || 'orders@peninsulalaundries.com.au'}
                                    </div>
                                </div>

                                {/* CENTER: Business Name + Address */}
                                <div className="flex-1 text-xs text-slate-700">
                                    <div className="font-bold text-sm text-[#1a1a2e] mb-1">
                                        {viewInvoice.business?.companyName || 'JSP Corporation Pty Ltd'}
                                    </div>
                                    <div className="text-xs text-slate-500 mb-2">T/A Peninsula Laundries</div>
                                    <div className="flex items-start gap-1.5 text-slate-600">
                                        <svg className="w-3.5 h-3.5 mt-0.5 text-[#1c2a5e] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                        <span className="leading-relaxed">
                                            {viewInvoice.business?.address || '13 Redcliffe Gardens Drive'}<br />
                                            {viewInvoice.business?.suburb || 'Clontarf'}, {viewInvoice.business?.state || 'Queensland'} {viewInvoice.business?.postcode || '4019'}, Australia
                                        </span>
                                    </div>
                                </div>

                                {/* RIGHT: ABN + Phone */}
                                <div className="text-right">
                                    <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-1">A.B.N.</div>
                                    <div className="text-lg font-black text-[#1a1a2e] tracking-wider mb-3">
                                        {viewInvoice.business?.taxNumber || viewInvoice.business?.abn || '31647801045'}
                                    </div>
                                    <div className="flex items-center justify-end gap-1.5 text-xs text-slate-600">
                                        <svg className="w-3 h-3 text-[#1c2a5e] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 015.33 12a19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
                                        {viewInvoice.business?.phone || '61475902921'}
                                    </div>
                                </div>
                            </div>

                            {/* ── TAX INVOICE STRIP + BILL TO (side by side) ── */}
                            <div className="grid grid-cols-2 gap-6 items-start">

                                {/* Bill To — Customer */}
                                <div>
                                    <div className="text-[9px] uppercase tracking-widest text-slate-400 font-semibold mb-1.5">Bill To</div>
                                    <div className="font-bold text-[#1a1a2e] text-sm mb-1">{viewInvoice.customer?.name || '—'}</div>
                                    {(viewInvoice.customer?.address || viewInvoice.customer?.suburb) && (
                                        <div className="flex items-start gap-1.5 text-slate-500 text-xs mb-0.5">
                                            <svg className="w-3.5 h-3.5 mt-0.5 text-[#1c2a5e] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                            <span className="leading-relaxed">
                                                {viewInvoice.customer?.address && <>{viewInvoice.customer.address}<br /></>}
                                                {[viewInvoice.customer?.suburb || viewInvoice.customer?.city, viewInvoice.customer?.state, viewInvoice.customer?.postcode, 'Australia'].filter(Boolean).join(', ')}
                                            </span>
                                        </div>
                                    )}
                                    {viewInvoice.customer?.phone && (
                                        <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-0.5">
                                            <svg className="w-3.5 h-3.5 text-[#1c2a5e] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 015.33 12a19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
                                            {viewInvoice.customer.phone}
                                        </div>
                                    )}
                                    {viewInvoice.customer?.email && (
                                        <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                                            <svg className="w-3.5 h-3.5 text-[#1c2a5e] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                                            {viewInvoice.customer.email}
                                        </div>
                                    )}
                                    {/* Cycle badge */}
                                    <div className="mt-2">
                                        <span className="inline-block px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-amber-50 border border-amber-200 text-amber-700">
                                            ⏳ {cycleLabels[viewInvoice.customer?.notificationFrequency] || 'Custom Cycle'} — Pending Approval
                                        </span>
                                    </div>
                                </div>

                                {/* Tax Invoice badge + Invoice # */}
                                <div className="flex flex-col items-end gap-2">
                                    <div className="flex items-center gap-2 bg-[#1c2a5e] text-white text-sm font-bold px-5 py-2 rounded-lg tracking-wide">
                                        <span className="text-xl font-light leading-none">+</span> Tax Invoice
                                    </div>
                                    <div className="text-xs text-slate-500 text-right">
                                        <span className="font-semibold text-slate-700">Invoice #: </span>
                                        {viewInvoice.invoiceNumber || viewInvoice.invoiceId}
                                    </div>
                                </div>
                            </div>

                            {/* Meta Numbers Bar */}
                            <div className="grid grid-cols-5 border border-slate-200 rounded-xl overflow-hidden text-xs">
                                {[
                                    { label: 'INVOICE #', value: viewInvoice.invoiceNumber || viewInvoice.invoiceId, cls: '' },
                                    { label: 'DATE', value: new Date(viewInvoice.createdAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(), cls: '' },
                                    { label: 'DUE DATE', value: viewInvoice.dueDate ? new Date(viewInvoice.dueDate).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : (viewInvoice.customer?.creditDays ? new Date(new Date(viewInvoice.createdAt).setDate(new Date(viewInvoice.createdAt).getDate() + viewInvoice.customer.creditDays)).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : 'DUE ON RECEIPT'), cls: 'text-red-600' },
                                    { label: 'TOTAL', value: `${currency}${Number(viewInvoice.totalAmount || 0).toFixed(2)}`, cls: 'text-[#1c2a5e]' },
                                    { label: 'STATUS', value: 'PENDING APPROVAL', cls: 'text-amber-600' },
                                ].map((cell, i, arr) => (
                                    <div key={i} className={`px-3 py-2.5 ${i < arr.length - 1 ? 'border-r border-slate-200' : ''} ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                        <div className="text-[9px] uppercase tracking-wider text-slate-400 mb-1 font-semibold">{cell.label}</div>
                                        <div className={`font-bold text-[#1a1a2e] truncate ${cell.cls}`}>{cell.value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Unified Invoice Table with 3 Sections */}
                            <div className="rounded-lg overflow-hidden border border-slate-200">
                                {isEditMode ? (
                                    /* ── EDIT MODE TABLE ── */
                                    <>
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-[#1c2a5e] text-white">
                                                    <th className="text-left py-2 px-3 font-semibold w-8">#</th>
                                                    <th className="text-left py-2 px-3 font-semibold">Item Name</th>
                                                    <th className="text-center py-2 px-3 font-semibold w-20">Qty</th>
                                                    <th className="text-right py-2 px-3 font-semibold w-32">Rate</th>
                                                    <th className="text-right py-2 px-3 font-semibold w-28">Total</th>
                                                    <th className="text-center py-2 px-3 font-semibold w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(() => {
                                                    let visibleIndex = 0;
                                                    return editItems.map((item, index) => {
                                                        if (item.serviceType === 'manual') return null;
                                                        visibleIndex++;
                                                        const rowSubtotal = (Number(item.quantity) || 0) * (Number(item.pricePerUnit) || 0);
                                                        return (
                                                            <tr key={index} className={`border-b border-slate-200 ${item.isRefunded ? 'bg-red-50/50' : 'hover:bg-amber-50/30'} transition-colors`}>
                                                                <td className="py-2 px-3 text-slate-400 font-mono text-center">{visibleIndex}</td>
                                                                <td className="py-1.5 px-2">
                                                                    <input
                                                                        type="text"
                                                                        value={item.itemName || item.serviceName || ''}
                                                                        onChange={(e) => {
                                                                            handleEditItemChange(index, 'itemName', e.target.value);
                                                                            handleEditItemChange(index, 'serviceName', e.target.value);
                                                                        }}
                                                                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none text-slate-800 font-medium"
                                                                        placeholder="Item name…"
                                                                    />
                                                                </td>
                                                                <td className="py-1.5 px-2">
                                                                    <input
                                                                        type="number"
                                                                        min="1"
                                                                        value={item.quantity}
                                                                        onChange={(e) => handleEditItemChange(index, 'quantity', e.target.value)}
                                                                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none text-center font-semibold text-slate-800"
                                                                    />
                                                                </td>
                                                                <td className="py-1.5 px-2">
                                                                    <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-amber-400 focus-within:border-transparent transition-all">
                                                                        <span className="bg-slate-50 border-r border-slate-200 px-2 py-1.5 text-[10px] font-bold text-slate-400 select-none">
                                                                            {currency}
                                                                        </span>
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            step="0.01"
                                                                            value={item.pricePerUnit}
                                                                            onChange={(e) => handleEditItemChange(index, 'pricePerUnit', e.target.value)}
                                                                            className="w-full px-2 py-1.5 outline-none text-right font-semibold text-slate-800 text-xs border-none"
                                                                        />
                                                                    </div>
                                                                </td>
                                                                <td className="text-right py-2 px-3 font-bold text-slate-800">
                                                                    {currency}{rowSubtotal.toFixed(2)}
                                                                </td>
                                                                <td className="py-2 px-2 text-center">
                                                                    <button
                                                                        onClick={() => handleRemoveEditItem(index)}
                                                                        className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                                                        title="Remove item"
                                                                    >
                                                                        <HiOutlineTrash className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    });
                                                })()}
                                            </tbody>
                                        </table>
                                        {/* Add Item Button */}
                                        <div className="px-3 py-2.5 bg-slate-50 border-t border-slate-200">
                                            <button
                                                onClick={handleAddEditItem}
                                                className="flex items-center gap-1.5 text-xs font-semibold text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 px-3 py-1.5 rounded-lg transition-all"
                                            >
                                                <HiOutlinePlus className="w-3.5 h-3.5" /> Add New Item
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    /* ── READ-ONLY TABLE ── */
                                    (() => {
                                        const allItems = [...(viewInvoice.order?.items || [])];
                                        const services = allItems.filter(item => !item.isRefunded && item.serviceType !== 'manual' && item.service);
                                        const refundedItems = allItems.filter(item => item.isRefunded);

                                        const formatDate = (dateStr: string) => {
                                            if (!dateStr) return '—';
                                            return new Date(dateStr).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
                                        };

                                        const deliveryDate = viewInvoice.order?.deliveryDate;
                                        const formattedDate = formatDate(deliveryDate);

                                        return (
                                            <table className="w-full text-xs">
                                                {/* Table Header */}
                                                <thead>
                                                    <tr className="bg-[#1c2a5e] text-white">
                                                        <th className="text-left py-2 px-3 font-semibold">Delivery Date</th>
                                                        <th className="text-left py-2 px-3 font-semibold">Item Name</th>
                                                        <th className="text-center py-2 px-3 font-semibold">Qty</th>
                                                        <th className="text-right py-2 px-3 font-semibold">Rate</th>
                                                        <th className="text-right py-2 px-3 font-semibold">Total</th>
                                                    </tr>
                                                </thead>

                                                <tbody>
                                                    {/* SECTION 1: SERVICES - BILLABLE */}
                                                    {services.length > 0 && (
                                                        <>
                                                            <tr className="bg-slate-100">
                                                                <td colSpan={5} className="py-2 px-3 font-bold text-xs uppercase tracking-wide text-slate-700">
                                                                    🔧 Services - Billable
                                                                </td>
                                                            </tr>
                                                            {services.map((item, i) => (
                                                                <tr key={`service-${i}`} className="border-b border-slate-200 hover:bg-slate-50">
                                                                    <td className="py-2 px-3 text-slate-700">
                                                                        {i === 0 ? formattedDate : '—'}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-slate-900 font-medium">{item.serviceName || item.itemName}</td>
                                                                    <td className="text-center py-2 px-3">
                                                                        <div className="flex flex-col items-center gap-1">
                                                                            <span className="text-[12px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                                                                {item.shippedQuantity ?? item.quantity} {item.unit}
                                                                            </span>
                                                                            {item.shippedQuantity !== null && item.shippedQuantity !== undefined && item.shippedQuantity !== item.quantity && (
                                                                                <span className="text-[10px] text-slate-500 font-medium bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                                                                                    Ordered: {item.quantity}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="text-right py-2 px-3 text-slate-900">{currency}{Number(item.pricePerUnit || 0).toFixed(2)}</td>
                                                                    <td className="text-right py-2 px-3 text-slate-900 font-semibold">{currency}{Number(item.subtotal || 0).toFixed(2)}</td>
                                                                </tr>
                                                            ))}
                                                        </>
                                                    )}



                                                    {/* SECTION 3: REFUNDED ITEMS */}
                                                    {refundedItems.length > 0 && (
                                                        <>
                                                            <tr className="bg-slate-100">
                                                                <td colSpan={5} className="py-2 px-3 font-bold text-xs uppercase tracking-wide text-slate-700">
                                                                    🔄 Refunded Items
                                                                </td>
                                                            </tr>
                                                            {refundedItems.map((item, i) => (
                                                                <tr key={`refund-${i}`} className="border-b border-slate-200 hover:bg-slate-50">
                                                                    <td className="py-2 px-3 text-slate-700">
                                                                        {i === 0 ? formattedDate : '—'}
                                                                    </td>
                                                                    <td className="py-2 px-3">
                                                                        <div className="text-slate-900 font-medium">{item.serviceName || item.itemName}</div>
                                                                        {item.refundReason && (
                                                                            <div className="text-red-600 text-xs mt-0.5">Reason: {item.refundReason}</div>
                                                                        )}
                                                                    </td>
                                                                    <td className="text-center py-2 px-3 text-slate-900">{item.damagedQuantity || item.shippedQuantity || item.quantity}</td>
                                                                    <td className="text-right py-2 px-3 text-slate-900">{currency}{Number(item.pricePerUnit || 0).toFixed(2)}</td>
                                                                    <td className="text-right py-2 px-3 text-red-700 font-semibold">-{currency}{Number(item.refundAmount || item.subtotal || 0).toFixed(2)}</td>
                                                                </tr>
                                                            ))}
                                                        </>
                                                    )}
                                                </tbody>
                                            </table>
                                        );
                                    })()
                                )}
                            </div>

                            {/* ── EDIT MODE: Discount / Tax / Service Charge Controls ── */}
                            {isEditMode && (
                                <div className="grid grid-cols-3 gap-3 p-4 bg-amber-50/50 border border-amber-200 rounded-xl">
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1 block">Discount %</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.1"
                                            value={editDiscountPercent}
                                            onChange={(e) => setEditDiscountPercent(Number(e.target.value) || 0)}
                                            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none text-slate-800 font-semibold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1 block">Tax %</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.1"
                                            value={editTaxPercent}
                                            onChange={(e) => setEditTaxPercent(Number(e.target.value) || 0)}
                                            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none text-slate-800 font-semibold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1 block">Service Charge ({currency})</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={editServiceCharge}
                                            onChange={(e) => setEditServiceCharge(Number(e.target.value) || 0)}
                                            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none text-slate-800 font-semibold"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Credited Items */}
                            {viewInvoice.creditedItems?.length > 0 && (
                                <div className="rounded-xl overflow-hidden border border-red-100">
                                    <div className="bg-red-50 border-b border-red-100 px-3 py-2 text-xs font-bold text-red-700 uppercase tracking-wide">
                                        Credited Items
                                    </div>
                                    <table className="w-full text-xs">
                                        <tbody>
                                            {viewInvoice.creditedItems.map((item: any, i: number) => (
                                                <tr key={i} className="border-t border-red-50">
                                                    <td className="px-3 py-2 text-red-600">{item.serviceName || item.name}:</td>
                                                    <td className="px-3 py-2 text-right text-red-600">{item.quantity}</td>
                                                    <td className="px-3 py-2 text-right text-red-600">{currency}{Number(item.pricePerUnit || item.rate || 0).toFixed(2)}</td>
                                                    <td className="px-3 py-2 text-right text-red-600 font-semibold">({currency}{Math.abs(Number(item.subtotal || item.total || 0)).toFixed(2)})</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Amount Due + Summary */}
                            <div className="flex justify-between items-end pt-1">
                                <p className="text-[10px] text-blue-500 italic">* Items marked with * are rental carts.</p>
                                <div className="text-right min-w-[200px]">
                                    <div className="bg-[#1c2a5e] text-white text-sm font-bold px-6 py-2 rounded-lg inline-block mb-3 tracking-widest">
                                        AMOUNT DUE
                                    </div>
                                    <div className="space-y-1.5 text-xs">
                                        <div className="flex justify-between gap-12 text-slate-600">
                                            <span>Sub Total</span>
                                            <span className="font-medium text-slate-800">
                                                {currency}{Number(isEditMode ? editCalc.subtotal : viewInvoice.subtotal || 0).toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between gap-12 text-slate-600">
                                            <span>Sales Tax</span>
                                            <span className="font-medium text-slate-800">
                                                {currency}{Number(isEditMode ? editCalc.taxAmount : viewInvoice.taxAmount || 0).toFixed(2)}
                                            </span>
                                        </div>
                                        {((isEditMode ? editCalc.discountAmount : viewInvoice.discountAmount) || 0) > 0 && (
                                            <div className="flex justify-between gap-12 text-emerald-600">
                                                <span>Discount</span>
                                                <span className="font-medium">
                                                    -{currency}{Number(isEditMode ? editCalc.discountAmount : viewInvoice.discountAmount).toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                        {((isEditMode ? editServiceCharge : viewInvoice.serviceCharge) || 0) > 0 && (
                                            <div className="flex justify-between gap-12 text-slate-600">
                                                <span>Service Charge</span>
                                                <span className="font-medium text-slate-800">
                                                    {currency}{Number(isEditMode ? editServiceCharge : viewInvoice.serviceCharge).toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex justify-between gap-12 bg-[#1c2a5e] text-white font-black text-sm px-4 py-2 rounded-lg mt-2">
                                            <span>TOTAL</span>
                                            <span>
                                                {currency}{Number(isEditMode ? editCalc.totalAmount : viewInvoice.totalAmount || 0).toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between gap-12 text-slate-500 text-[11px] px-1">
                                            <span>Paid</span>
                                            <span className="text-emerald-600 font-semibold">{currency}{Number(viewInvoice.paidAmount || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between gap-12 text-slate-500 text-[11px] px-1">
                                            <span>{(isEditMode ? editCalc.balanceDue : viewInvoice.balanceDue || 0) < 0 ? 'Refund Due to Customer' : 'Balance Due'}</span>
                                            <span className={`font-bold ${(isEditMode ? editCalc.balanceDue : viewInvoice.balanceDue || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                {(isEditMode ? editCalc.balanceDue : viewInvoice.balanceDue || 0) < 0 ? '-' : ''}{currency}{Math.abs(Number(isEditMode ? editCalc.balanceDue : viewInvoice.balanceDue || 0)).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Payment + Disclaimer */}
                            <div className="flex gap-5 pt-4 border-t border-slate-200">
                                <div className="bg-slate-50 rounded-xl p-4 min-w-[220px]">
                                    <div className="flex items-center gap-1.5 font-bold text-[#1a1a2e] text-sm mb-2">
                                        <span>🏦</span> PAYMENT
                                    </div>
                                    <div className="text-xs text-slate-700 font-semibold mb-1">Direct Deposit:</div>
                                    <div className="text-xs text-slate-600 space-y-0.5 leading-relaxed">
                                        <div><span className="text-slate-500">Account Name:</span> {viewInvoice.business?.bankAccountName || 'JSP CORPORATION PTY LTD'}</div>
                                        <div><span className="text-slate-500">Bank:</span> {viewInvoice.business?.bankName || 'ANZ'} &nbsp; <span className="text-slate-500">BSB:</span> {viewInvoice.business?.bankBSB || '012787'}</div>
                                        <div><span className="text-slate-500">Account NO:</span> {viewInvoice.business?.bankAccountNo || '—'}</div>
                                    </div>
                                </div>
                                <div className="text-[10px] text-slate-500 leading-relaxed flex-1 pt-1">
                                    <div className="font-bold text-blue-600 text-xs mb-1.5">Disclaimer:</div>
                                    {viewInvoice.business?.name || 'JSP Corporation Pty Ltd T/as Peninsula Laundries'} reserves the right to claim ownership of any linen that has not been returned. We also reserve the right to seek legal advice and pursue recovery of replacement costs for any unreturned or missing items.
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvoiceApproval;
