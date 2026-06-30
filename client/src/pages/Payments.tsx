import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useSettings } from '../context/SettingsContext';
import Pagination from '../components/Pagination';
import {
    HiOutlineFilter,
    HiOutlinePlusCircle,
    HiOutlineX,
    HiOutlineSearch,
    HiOutlineCalendar,
    HiOutlineCash,
    HiOutlineChevronDown,
    HiOutlineDocumentText,
} from 'react-icons/hi';

const paymentMethodLabels: Record<string, { label: string; color: string }> = {
    cash:             { label: '💵 Cash',          color: 'bg-emerald-50 text-emerald-700' },
    card:             { label: '💳 Card',           color: 'bg-blue-50 text-blue-700' },
    mobile:           { label: '📱 Mobile',         color: 'bg-purple-50 text-purple-700' },
    'bank-transfer':  { label: '🏦 Bank Transfer',  color: 'bg-amber-50 text-amber-700' },
    'credit-account': { label: '📒 Credit Account', color: 'bg-slate-100 text-slate-700' },
};

const Payments = () => {
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [form, setForm] = useState({ invoice: '', paymentMethod: 'cash', amount: '', note: '' });
    const { currency } = useSettings();

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const itemsPerPage = 20;

    // ── Filters ──
    const [filterMethod, setFilterMethod] = useState('');
    const [filterCustomer, setFilterCustomer] = useState('');
    const [filterInvoiceId, setFilterInvoiceId] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    const fetchPayments = async () => {
        try {
            setLoading(true);
            const params: any = { page: currentPage, limit: itemsPerPage };
            if (filterMethod) params.paymentMethod = filterMethod;
            if (filterDateFrom) params.startDate = filterDateFrom;
            if (filterDateTo) params.endDate = filterDateTo;
            
            const res = await api.get('/payments', { params });
            setPayments(res.data.data);
            setTotalPages(res.data.totalPages || 1);
            setTotalItems(res.data.total || 0);
        } catch {
            toast.error('Failed to fetch payments');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPayments(); }, [currentPage, filterMethod, filterDateFrom, filterDateTo]);

    // ── Client-side filtering ──
    const filteredPayments = useMemo(() => {
        return payments.filter((p) => {
            if (filterMethod && p.paymentMethod !== filterMethod) return false;
            if (filterCustomer) {
                const q = filterCustomer.toLowerCase();
                const name = (p.invoice?.customer?.name || '').toLowerCase();
                const phone = (p.invoice?.customer?.phone || '').toLowerCase();
                if (!name.includes(q) && !phone.includes(q)) return false;
            }
            if (filterInvoiceId) {
                const q = filterInvoiceId.toLowerCase();
                if (!(p.invoice?.invoiceId || '').toLowerCase().includes(q) &&
                    !(p.invoice?.order?.orderId || '').toLowerCase().includes(q)) return false;
            }
            if (filterDateFrom) {
                const pDate = new Date(p.createdAt);
                const from = new Date(filterDateFrom);
                from.setHours(0, 0, 0, 0);
                if (pDate < from) return false;
            }
            if (filterDateTo) {
                const pDate = new Date(p.createdAt);
                const to = new Date(filterDateTo);
                to.setHours(23, 59, 59, 999);
                if (pDate > to) return false;
            }
            return true;
        });
    }, [payments, filterMethod, filterCustomer, filterInvoiceId, filterDateFrom, filterDateTo]);

    const activeFilterCount = [filterMethod, filterCustomer, filterInvoiceId, filterDateFrom, filterDateTo].filter(Boolean).length;

    const clearFilters = () => {
        setFilterMethod('');
        setFilterCustomer('');
        setFilterInvoiceId('');
        setFilterDateFrom('');
        setFilterDateTo('');
    };

    // ── Total amount of filtered payments ──
    const totalFiltered = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const searchInvoices = async () => {
        try {
            const res = await api.get('/invoices', { params: { paymentStatus: 'unpaid' } });
            const partialRes = await api.get('/invoices', { params: { paymentStatus: 'partial' } });
            setInvoices([...res.data.data, ...partialRes.data.data]);
        } catch { /* ignore */ }
    };

    const openPaymentModal = () => {
        searchInvoices();
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/payments', {
                invoice: form.invoice,
                paymentMethod: form.paymentMethod,
                amount: Number(form.amount),
                note: form.note,
            });
            toast.success('Payment recorded successfully');
            setShowModal(false);
            setForm({ invoice: '', paymentMethod: 'cash', amount: '', note: '' });
            fetchPayments();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to record payment');
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn">

            {/* ── PAGE HEADER ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <HiOutlineCash className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Payments</h1>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {filteredPayments.length} of {payments.length} transactions
                            {activeFilterCount > 0 && <span className="ml-1 text-emerald-500">(filtered)</span>}
                            {activeFilterCount > 0 && (
                                <span className="ml-2 font-semibold text-slate-600">
                                    · Total: {currency}{totalFiltered.toLocaleString()}
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Filter toggle */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium shadow-sm transition-all ${
                            showFilters || activeFilterCount > 0
                                ? 'bg-emerald-500 text-white border-emerald-500 shadow-emerald-100'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                        }`}
                    >
                        <HiOutlineFilter className="w-4 h-4" />
                        Filters
                        {activeFilterCount > 0 && (
                            <span className="ml-0.5 w-5 h-5 rounded-full bg-white text-emerald-600 text-xs font-bold flex items-center justify-center">
                                {activeFilterCount}
                            </span>
                        )}
                        <HiOutlineChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Record Payment button */}
                    <button
                        onClick={openPaymentModal}
                        className="flex items-center gap-2 px-5 py-2 bg-[#1c2a5e] hover:bg-[#253570] text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-slate-400/20"
                    >
                        <HiOutlinePlusCircle className="w-4 h-4" /> Record Payment
                    </button>
                </div>
            </div>

            {/* ── ADVANCED FILTER PANEL ── */}
            {showFilters && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">

                        {/* Customer Search */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Customer</label>
                            <div className="relative">
                                <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Name or phone…"
                                    value={filterCustomer}
                                    onChange={(e) => setFilterCustomer(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent placeholder:text-slate-300"
                                />
                            </div>
                        </div>

                        {/* Invoice / Order ID */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Invoice / Order ID</label>
                            <div className="relative">
                                <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="INV-001 or ORD-001…"
                                    value={filterInvoiceId}
                                    onChange={(e) => setFilterInvoiceId(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent placeholder:text-slate-300"
                                />
                            </div>
                        </div>

                        {/* Date From */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Date From</label>
                            <div className="relative">
                                <HiOutlineCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                <input
                                    type="date"
                                    value={filterDateFrom}
                                    onChange={(e) => setFilterDateFrom(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Date To */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Date To</label>
                            <div className="relative">
                                <HiOutlineCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                <input
                                    type="date"
                                    value={filterDateTo}
                                    onChange={(e) => setFilterDateTo(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Payment Method */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Method</label>
                            <div className="relative">
                                <HiOutlineFilter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                <select
                                    value={filterMethod}
                                    onChange={(e) => setFilterMethod(e.target.value)}
                                    className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent appearance-none cursor-pointer"
                                >
                                    <option value="">All Methods</option>
                                    <option value="cash">Cash</option>
                                    <option value="card">Card</option>
                                    <option value="mobile">Mobile</option>
                                    <option value="bank-transfer">Bank Transfer</option>
                                    <option value="credit-account">Credit Account</option>
                                </select>
                                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                            </div>
                        </div>
                    </div>

                    {/* Clear filters row */}
                    {activeFilterCount > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                            <p className="text-xs text-slate-400">
                                Showing <span className="font-semibold text-slate-700">{filteredPayments.length}</span> of {payments.length} transactions
                                <span className="ml-2 font-semibold text-emerald-600">· {currency}{totalFiltered.toLocaleString()}</span>
                            </p>
                            <button
                                onClick={clearFilters}
                                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                            >
                                <HiOutlineX className="w-3.5 h-3.5" />
                                Clear all filters
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── TABLE CARD ── */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <div className="w-10 h-10 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-slate-400">Loading payments…</p>
                    </div>
                ) : filteredPayments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
                        <HiOutlineCash className="w-12 h-12 opacity-30" />
                        <p className="text-sm font-medium">
                            {activeFilterCount > 0 ? 'No payments match your filters' : 'No payments found'}
                        </p>
                        {activeFilterCount > 0 && (
                            <button onClick={clearFilters} className="text-xs text-emerald-500 hover:text-emerald-700 font-medium underline underline-offset-2">
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Invoice</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Order</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Method</th>
                                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">By</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredPayments.map((p) => {
                                    const method = paymentMethodLabels[p.paymentMethod] || { label: p.paymentMethod, color: 'bg-slate-100 text-slate-600' };
                                    return (
                                        <tr key={p._id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-5 py-4">
                                                <span className="font-semibold text-cyan-600 group-hover:text-cyan-700 transition-colors">
                                                    {p.invoice?.invoiceId || '—'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-slate-500 font-mono text-xs">
                                                {p.invoice?.order?.orderId || '—'}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="font-medium text-slate-800">{p.invoice?.customer?.name || '—'}</div>
                                                {p.invoice?.customer?.phone && (
                                                    <div className="text-xs text-slate-400 mt-0.5">{p.invoice.customer.phone}</div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${method.color}`}>
                                                    {method.label}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <span className="font-bold text-emerald-600 text-sm">
                                                    {currency}{p.amount?.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-slate-500 text-xs">
                                                {p.processedBy?.name || '—'}
                                            </td>
                                            <td className="px-5 py-4 text-slate-500 text-xs whitespace-nowrap">
                                                {p.createdAt
                                                    ? new Date(p.createdAt).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                                    : '—'}
                                                <div className="text-slate-400 text-[10px] mt-0.5">
                                                    {p.createdAt
                                                        ? new Date(p.createdAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
                                                        : ''}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {/* Total row */}
                            {filteredPayments.length > 0 && (
                                <tfoot>
                                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                                        <td colSpan={4} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            Total ({filteredPayments.length} transactions)
                                        </td>
                                        <td className="px-5 py-3 text-right font-bold text-emerald-600">
                                            {currency}{totalFiltered.toLocaleString()}
                                        </td>
                                        <td colSpan={2} />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                )}
                
                {/* Pagination */}
                {!loading && filteredPayments.length > 0 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                    />
                )}
            </div>

            {/* ── RECORD PAYMENT MODAL ── */}
            {showModal && (
                <PaymentModal
                    currency={currency}
                    invoices={invoices}
                    form={form}
                    setForm={setForm}
                    onSubmit={handleSubmit}
                    onClose={() => setShowModal(false)}
                />
            )}
        </div>
    );
};

/* ─────────────────────────────────────────────────────
   PAYMENT MODAL COMPONENT
───────────────────────────────────────────────────── */
const DATE_CHIPS = [
    { label: 'Today', key: 'today' },
    { label: 'Yesterday', key: 'yesterday' },
    { label: 'This Week', key: 'week' },
    { label: 'Custom', key: 'custom' },
];

const PaymentModal = ({
    currency, invoices, form, setForm, onSubmit, onClose,
}: {
    currency: string;
    invoices: any[];
    form: any;
    setForm: (f: any) => void;
    onSubmit: (e: React.FormEvent) => void;
    onClose: () => void;
}) => {
    const [dateChip, setDateChip] = useState('all');
    const [customDate, setCustomDate] = useState('');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'unpaid', 'partial'

    const filteredInvoices = useMemo(() => {
        // Filter out invoices with zero or negative balance due
        let list = invoices.filter(inv => (inv.balanceDue || 0) > 0);

        // Date filter
        const now = new Date();
        if (dateChip === 'today') {
            const start = new Date(now); start.setHours(0, 0, 0, 0);
            list = list.filter(inv => new Date(inv.createdAt) >= start);
        } else if (dateChip === 'yesterday') {
            const start = new Date(now); start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0);
            const end = new Date(now); end.setHours(0, 0, 0, 0);
            list = list.filter(inv => new Date(inv.createdAt) >= start && new Date(inv.createdAt) < end);
        } else if (dateChip === 'week') {
            const start = new Date(now); start.setDate(start.getDate() - 7); start.setHours(0, 0, 0, 0);
            list = list.filter(inv => new Date(inv.createdAt) >= start);
        } else if (dateChip === 'custom' && customDate) {
            const start = new Date(customDate); start.setHours(0, 0, 0, 0);
            const end = new Date(customDate); end.setHours(23, 59, 59, 999);
            list = list.filter(inv => new Date(inv.createdAt) >= start && new Date(inv.createdAt) <= end);
        }

        // Status filter
        if (statusFilter === 'unpaid') {
            list = list.filter(inv => inv.paymentStatus === 'unpaid');
        } else if (statusFilter === 'partial') {
            list = list.filter(inv => inv.paymentStatus === 'partial');
        }

        // Search filter
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(inv =>
                (inv.invoiceId || '').toLowerCase().includes(q) ||
                (inv.customer?.name || '').toLowerCase().includes(q) ||
                (inv.order?.orderId || '').toLowerCase().includes(q)
            );
        }
        return list;
    }, [invoices, dateChip, customDate, search, statusFilter]);

    const selectedInv = invoices.find(i => i._id === form.invoice);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl animate-fadeIn overflow-hidden flex flex-col max-h-[92vh]">

                {/* Header */}
                <div className="bg-[#1c2a5e] px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2 text-white">
                        <HiOutlineCash className="w-5 h-5" />
                        <h3 className="text-base font-bold">Record Payment</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-red-500/60 text-white transition-all">
                        <HiOutlineX className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">

                        {/* LEFT COLUMN — Invoice Picker */}
                        <div className="lg:w-[55%] flex flex-col border-b lg:border-b-0 lg:border-r border-slate-100 overflow-hidden">
                            <div className="px-5 pt-5 pb-3 flex-shrink-0">
                                <div className="flex items-center justify-between mb-2.5">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                        Select Invoice
                                    </label>
                                    <span className="text-[10px] text-slate-400 font-semibold">{filteredInvoices.length} invoices pending</span>
                                </div>

                                {/* Date Chip Filters */}
                                <div className="flex flex-wrap gap-1.5 mb-2.5">
                                    {DATE_CHIPS.map(chip => (
                                        <button
                                            key={chip.key}
                                            type="button"
                                            onClick={() => setDateChip(chip.key)}
                                            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                                                dateChip === chip.key
                                                    ? 'bg-[#1c2a5e] text-white shadow-sm shadow-[#1c2a5e]/20'
                                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                            }`}
                                        >
                                            {chip.label}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setDateChip('all')}
                                        className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                                            dateChip === 'all'
                                                ? 'bg-[#1c2a5e] text-white shadow-sm'
                                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                        }`}
                                    >
                                        All
                                    </button>
                                </div>

                                {/* Status Segment Control */}
                                <div className="flex gap-1 mb-3 bg-slate-100 p-0.5 rounded-xl border border-slate-200/50">
                                    {[
                                        { label: 'All Pending', key: 'all' },
                                        { label: 'Unpaid Only', key: 'unpaid' },
                                        { label: 'Partial Only', key: 'partial' },
                                    ].map(tab => (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            onClick={() => setStatusFilter(tab.key)}
                                            className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                                                statusFilter === tab.key
                                                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200/20'
                                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/30'
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Custom date input */}
                                {dateChip === 'custom' && (
                                    <input
                                        type="date"
                                        value={customDate}
                                        onChange={(e) => setCustomDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1c2a5e]/30 mb-2"
                                    />
                                )}

                                {/* Search */}
                                <div className="relative">
                                    <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder="Search invoice, customer, order…"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1c2a5e]/30 placeholder:text-slate-300"
                                    />
                                </div>
                            </div>

                            {/* Invoice List */}
                            <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2.5">
                                {filteredInvoices.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 mx-1">
                                        <HiOutlineDocumentText className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                                        <p className="text-xs font-semibold">No pending invoices found</p>
                                        <button type="button" onClick={() => { setDateChip('all'); setStatusFilter('all'); setSearch(''); }}
                                            className="text-xs text-cyan-600 hover:text-cyan-700 font-bold mt-1.5 underline underline-offset-2 cursor-pointer">Clear filters</button>
                                    </div>
                               ) : (
                                    filteredInvoices.map((inv) => {
                                        const isSelected = form.invoice === inv._id;
                                        return (
                                            <button
                                                key={inv._id}
                                                type="button"
                                                onClick={() => setForm({ ...form, invoice: inv._id, amount: String(inv.balanceDue || '') })}
                                                className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                                                    isSelected
                                                        ? 'border-[#1c2a5e] bg-indigo-50/40 shadow-sm ring-1 ring-[#1c2a5e]/30 scale-[1.01]'
                                                        : 'border-slate-100 bg-white hover:border-slate-300 hover:shadow-sm hover:bg-slate-50/50'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        {isSelected ? (
                                                            <span className="w-4 h-4 rounded-full bg-[#1c2a5e] flex items-center justify-center shrink-0">
                                                                <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                                            </span>
                                                        ) : (
                                                            <span className="w-4 h-4 rounded-full border border-slate-300 bg-slate-50 flex items-center justify-center shrink-0" />
                                                        )}
                                                        <span className={`text-xs font-bold font-mono ${isSelected ? 'text-[#1c2a5e]' : 'text-slate-800'}`}>
                                                            {inv.invoiceId}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-mono">({inv.order?.orderId})</span>

                                                        {/* Status Badge */}
                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider ${
                                                            inv.paymentStatus === 'partial' 
                                                                ? 'bg-amber-50 text-amber-700 border border-amber-200/60' 
                                                                : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                                                        }`}>
                                                            {inv.paymentStatus === 'partial' ? 'Partial' : 'Unpaid'}
                                                        </span>
                                                    </div>
                                                    
                                                    {/* Balance Due Amount */}
                                                    <div className="text-right">
                                                        <span className="text-[8px] text-slate-400 font-bold block uppercase tracking-wider leading-none mb-0.5">Due</span>
                                                        <span className={`text-xs font-black ${isSelected ? 'text-[#1c2a5e]' : 'text-rose-600'}`}>
                                                            {currency}{Number(inv.balanceDue || 0).toFixed(2)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100/70">
                                                    <div>
                                                        <span className="text-xs text-slate-700 font-semibold">{inv.customer?.name || '—'}</span>
                                                        {inv.customer?.phone && (
                                                            <span className="text-[10px] text-slate-400 ml-1.5">{inv.customer.phone}</span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                                        <span className="font-medium">Bill: {currency}{Number(inv.totalAmount || 0).toFixed(2)}</span>
                                                        <span>•</span>
                                                        <span>{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</span>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN — Payment Details */}
                        <div className="lg:w-[45%] flex flex-col p-5 space-y-4">
                            {/* Selected invoice preview */}
                            {selectedInv ? (
                                <div className="bg-[#1c2a5e]/5 border border-[#1c2a5e]/20 rounded-xl px-4 py-3">
                                    <div className="text-[10px] text-[#1c2a5e] font-bold uppercase tracking-wider mb-1">Selected Invoice</div>
                                    <div className="text-sm font-bold text-[#1c2a5e]">{selectedInv.invoiceId}</div>
                                    <div className="text-xs text-slate-600 mt-0.5">{selectedInv.customer?.name}</div>
                                    <div className="flex justify-between mt-1.5 text-xs">
                                        <span className="text-slate-500">Balance Due</span>
                                        <span className="font-bold text-red-600">{currency}{Number(selectedInv.balanceDue || 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl px-4 py-4 text-center">
                                    <p className="text-xs text-slate-400">← Select an invoice from the list</p>
                                </div>
                            )}

                            {/* Payment Method */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                    Payment Method
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { value: 'cash', label: '💵 Cash' },
                                        { value: 'card', label: '💳 Card' },
                                        { value: 'mobile', label: '📱 Mobile' },
                                        { value: 'bank-transfer', label: '🏦 Bank' },
                                        { value: 'credit-account', label: '📒 Credit' },
                                    ].map(m => (
                                        <button
                                            key={m.value}
                                            type="button"
                                            onClick={() => setForm({ ...form, paymentMethod: m.value })}
                                            className={`px-3 py-2 rounded-xl text-xs font-semibold text-left border-2 transition-all ${
                                                form.paymentMethod === m.value
                                                    ? 'border-[#1c2a5e] bg-[#1c2a5e]/5 text-[#1c2a5e]'
                                                    : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200'
                                            }`}
                                        >
                                            {m.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Amount */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                                    Amount ({currency})
                                </label>
                                <input
                                    type="number"
                                    required
                                    min={0.01}
                                    step="any"
                                    value={form.amount}
                                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                    placeholder="0.00"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#1c2a5e]/30 placeholder:text-slate-300"
                                />
                            </div>

                            {/* Note */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                                    Note <span className="normal-case text-slate-400 font-normal text-xs">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.note}
                                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                                    placeholder="Add a note…"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1c2a5e]/30"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-1">
                                <button type="button" onClick={onClose}
                                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={!form.invoice}
                                    className="flex-1 py-2.5 bg-[#1c2a5e] hover:bg-[#253570] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-slate-400/20">
                                    Record Payment
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Payments;
