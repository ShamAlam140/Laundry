import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import type { IOrder, OrderStatus } from '../types';
import Pagination from '../components/Pagination';
import * as XLSX from 'xlsx';
import {
    HiOutlineSearch,
    HiOutlineEye,
    HiOutlineFilter,
    HiOutlineCalendar,
    HiOutlineX,
    HiOutlineChevronDown,
    HiOutlineChevronUp,
    HiOutlineCurrencyDollar,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineCheck,
    HiOutlineDownload,
} from 'react-icons/hi';
import { HiOutlineTruck } from 'react-icons/hi2';

const statusColors: Record<string, string> = {
    received: 'bg-blue-50 text-blue-600 border-blue-200',
    washing: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    packed: 'bg-amber-50 text-amber-600 border-amber-200',
    cancelled: 'bg-red-50 text-red-600 border-red-200',
};

const allStatuses: OrderStatus[] = ['received', 'washing', 'packed', 'cancelled'];

function toLocalISO(date: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getPresetRange(preset: string): { from: string; to: string } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (preset === 'today') {
        return { from: toLocalISO(today), to: toLocalISO(today) };
    }
    if (preset === 'yesterday') {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        return { from: toLocalISO(y), to: toLocalISO(y) };
    }
    if (preset === 'tomorrow') {
        const t = new Date(today);
        t.setDate(t.getDate() + 1);
        return { from: toLocalISO(t), to: toLocalISO(t) };
    }
    if (preset === 'last7') {
        const w = new Date(today);
        w.setDate(w.getDate() - 6);
        return { from: toLocalISO(w), to: toLocalISO(today) };
    }
    return { from: '', to: '' };
}

const Orders = () => {
    const [allOrders, setAllOrders] = useState<IOrder[]>([]);
    const [orders, setOrders] = useState<IOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { currency } = useSettings();
    const { user } = useAuth();

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const itemsPerPage = 20;

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [datePreset, setDatePreset] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);

    const activeFiltersCount = [statusFilter, datePreset || dateFrom || dateTo, minAmount, maxAmount].filter(Boolean).length;

    const fetchOrders = useCallback(async () => {
        try {
            setLoading(true);
            const params: any = { page: currentPage, limit: itemsPerPage };
            if (search) params.search = search;
            if (statusFilter) params.status = statusFilter;
            
            const res = await api.get('/orders', { params });
            setAllOrders(res.data.data);
            setTotalPages(res.data.totalPages || 1);
            setTotalItems(res.data.total || 0);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to fetch orders');
        } finally {
            setLoading(false);
        }
    }, [search, statusFilter, currentPage]);

    useEffect(() => {
        let filtered = [...allOrders];
        let from = dateFrom;
        let to = dateTo;

        if (datePreset) {
            const range = getPresetRange(datePreset);
            from = range.from;
            to = range.to;
        }

        if (from) {
            const fd = new Date(from);
            fd.setHours(0, 0, 0, 0);
            filtered = filtered.filter(o => new Date(o.createdAt!) >= fd);
        }
        if (to) {
            const td = new Date(to);
            td.setHours(23, 59, 59, 999);
            filtered = filtered.filter(o => new Date(o.createdAt!) <= td);
        }
        if (minAmount !== '') {
            filtered = filtered.filter(o => o.totalAmount! >= Number(minAmount));
        }
        if (maxAmount !== '') {
            filtered = filtered.filter(o => o.totalAmount! <= Number(maxAmount));
        }
        setOrders(filtered);
    }, [allOrders, datePreset, dateFrom, dateTo, minAmount, maxAmount]);

    useEffect(() => {
        setCurrentPage(1);
        const t = setTimeout(() => fetchOrders(), 400);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        fetchOrders();
    }, [statusFilter, currentPage]);

    const handlePresetChange = (preset: string) => {
        if (datePreset === preset) {
            setDatePreset('');
        } else {
            setDatePreset(preset);
            setDateFrom('');
            setDateTo('');
        }
    };

    const handleDateCustom = (type: 'from' | 'to', val: string) => {
        setDatePreset('');
        if (type === 'from') setDateFrom(val);
        else setDateTo(val);
    };

    const clearFilters = () => {
        setSearch('');
        setStatusFilter('');
        setDatePreset('');
        setDateFrom('');
        setDateTo('');
        setMinAmount('');
        setMaxAmount('');
    };

    const updateStatus = async (id: string, newStatus: string) => {
        try {
            await api.patch(`/orders/${id}/status`, { status: newStatus });
            toast.success(`Status updated to ${newStatus.replace('-', ' ')}`);
            fetchOrders();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to update status');
        }
    };

    const cancelOrder = async (id: string) => {
        if (user?.role !== 'admin') {
            toast.error('Only Admins can cancel/delete orders');
            return;
        }
        if (confirm('Are you sure you want to cancel/delete this order?')) {
            try {
                await api.delete(`/orders/${id}`);
                toast.success('Order cancelled/deleted successfully');
                fetchOrders();
            } catch (err: any) {
                toast.error(err.response?.data?.message || 'Failed to cancel/delete order');
            }
        }
    };

    const exportToExcel = async (format: 'xlsx' | 'csv') => {
        try {
            toast.loading('Preparing order export...', { id: 'order-export-toast' });
            const params: any = { limit: 100000 };
            if (search) params.search = search;
            if (statusFilter) params.status = statusFilter;
            
            const res = await api.get('/orders', { params });
            let exportedOrders = [...res.data.data];
            let from = dateFrom;
            let to = dateTo;

            if (datePreset) {
                const range = getPresetRange(datePreset);
                from = range.from;
                to = range.to;
            }

            if (from) {
                const fd = new Date(from);
                fd.setHours(0, 0, 0, 0);
                exportedOrders = exportedOrders.filter(o => new Date(o.createdAt) >= fd);
            }
            if (to) {
                const td = new Date(to);
                td.setHours(23, 59, 59, 999);
                exportedOrders = exportedOrders.filter(o => new Date(o.createdAt) <= td);
            }
            if (minAmount !== '') {
                exportedOrders = exportedOrders.filter(o => o.totalAmount >= Number(minAmount));
            }
            if (maxAmount !== '') {
                exportedOrders = exportedOrders.filter(o => o.totalAmount <= Number(maxAmount));
            }

            if (exportedOrders.length === 0) {
                toast.error('No orders to export.', { id: 'order-export-toast' });
                return;
            }

            const rows: any[] = [];
            exportedOrders.forEach(o => {
                const baseRow = {
                    "Order ID": o.orderId,
                    "Customer Name": o.customer?.name || "—",
                    "Customer Phone": o.customer?.phone || "—",
                    "Order Status": o.status || "received",
                    "Payment Status": o.paymentStatus || "unpaid",
                    "Date Created": o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : "—",
                    "Created By": o.createdBy?.name || "—",
                    "Assigned Staff": o.assignedStaff?.name || "—",
                    "Special Instructions": o.specialInstructions || "",
                    "Delivery Date": o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : "—",
                    "Order Subtotal": o.subtotal || 0,
                    "Order Tax (%)": o.taxPercent || 0,
                    "Order Discount (%)": o.discountPercent || 0,
                    "Order Service Charge": o.serviceCharge || 0,
                    "Order Total Amount": o.totalAmount || 0,
                    "Order Paid Amount": o.paidAmount || 0,
                    "Order Balance Due": o.balanceDue || 0,
                };
                if (o.items && o.items.length > 0) {
                    o.items.forEach((item: any) => {
                        rows.push({
                            ...baseRow,
                            "Item Service Name": item.serviceName || "—",
                            "Item Detail / Name": item.itemName || "—",
                            "Item Service Type": item.serviceType || "—",
                            "Item Quantity": Number(item.quantity) || 0,
                            "Item Price Per Unit": item.pricePerUnit || 0,
                            "Item Subtotal": item.subtotal || 0,
                        });
                    });
                } else {
                    rows.push({
                        ...baseRow,
                        "Item Service Name": "—",
                        "Item Detail / Name": "—",
                        "Item Service Type": "—",
                        "Item Quantity": 0,
                        "Item Price Per Unit": 0,
                        "Item Subtotal": 0,
                    });
                }
            });

            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Orders");
            if (format === 'xlsx') {
                XLSX.writeFile(wb, `orders_detailed_${Date.now()}.xlsx`);
            } else {
                XLSX.writeFile(wb, `orders_detailed_${Date.now()}.csv`, { bookType: 'csv' });
            }
            toast.success(`Exported ${exportedOrders.length} orders successfully!`, { id: 'order-export-toast' });
        } catch (err: any) {
            toast.error(`Export failed: ${err.message || err}`, { id: 'order-export-toast' });
        }
    };

    const activeFilterTags = [];
    if (statusFilter) {
        activeFilterTags.push({ label: statusFilter.replace(/\b\w/g, l => l.toUpperCase()), onRemove: () => setStatusFilter('') });
    }
    if (datePreset === 'today') activeFilterTags.push({ label: 'Today', onRemove: () => setDatePreset('') });
    if (datePreset === 'yesterday') activeFilterTags.push({ label: 'Yesterday', onRemove: () => setDatePreset('') });
    if (datePreset === 'tomorrow') activeFilterTags.push({ label: 'Tomorrow', onRemove: () => setDatePreset('') });
    if (datePreset === 'last7') activeFilterTags.push({ label: 'Last 7 Days', onRemove: () => setDatePreset('') });
    if (!datePreset && dateFrom) activeFilterTags.push({ label: `From: ${dateFrom}`, onRemove: () => setDateFrom('') });
    if (!datePreset && dateTo) activeFilterTags.push({ label: `To: ${dateTo}`, onRemove: () => setDateTo('') });
    if (minAmount) activeFilterTags.push({ label: `Min: ${currency}${minAmount}`, onRemove: () => setMinAmount('') });
    if (maxAmount) activeFilterTags.push({ label: `Max: ${currency}${maxAmount}`, onRemove: () => setMaxAmount('') });

    return (
        <div className="space-y-5 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
                    <p className="text-sm text-slate-500 mt-1">{orders.length} orders found</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => exportToExcel('xlsx')}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700 text-xs font-bold rounded-xl transition-all cursor-pointer border border-indigo-200"
                        title="Export filtered orders to Excel"
                    >
                        <HiOutlineDownload className="w-3.5 h-3.5" /> Export Excel
                    </button>
                    <button
                        onClick={() => exportToExcel('csv')}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-600 hover:text-cyan-700 text-xs font-bold rounded-xl transition-all cursor-pointer border border-cyan-200"
                        title="Export filtered orders to CSV"
                    >
                        <HiOutlineDownload className="w-3.5 h-3.5" /> Export CSV
                    </button>
                    <button
                        onClick={() => navigate('/orders/new')}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/30"
                    >
                        <HiOutlineSearch className="w-5 h-5" /> New Order
                    </button>
                </div>
            </div>

            {/* Quick Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by Order ID or customer..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <HiOutlineX className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <div className="relative">
                    <HiOutlineFilter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer min-w-[160px]"
                    >
                        <option value="">All Status</option>
                        {allStatuses.map(s => (
                            <option key={s} value={s}>{s.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${showAdvanced ? "bg-cyan-50 border-cyan-400 text-cyan-700" : "bg-white border-slate-200 text-slate-600 hover:border-cyan-400 hover:text-cyan-600"}`}
                >
                    <HiOutlineFilter className="w-4 h-4" /> Advanced
                    {activeFiltersCount > 0 && (
                        <span className="ml-1 bg-cyan-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
                            {activeFiltersCount}
                        </span>
                    )}
                    {showAdvanced ? <HiOutlineChevronUp className="w-3.5 h-3.5" /> : <HiOutlineChevronDown className="w-3.5 h-3.5" />}
                </button>
            </div>

            {/* Filter Tags */}
            <div className="flex flex-wrap items-center gap-2">
                {['today', 'yesterday', 'tomorrow', 'last7'].map(preset => {
                    const labels: any = { today: 'Today', yesterday: 'Yesterday', tomorrow: 'Tomorrow', last7: 'Last 7 Days' };
                    const isActive = datePreset === preset;
                    return (
                        <button
                            key={preset}
                            onClick={() => handlePresetChange(preset)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${isActive ? "bg-cyan-500 text-white border-cyan-500 shadow-md shadow-cyan-200" : "bg-white text-slate-600 border-slate-200 hover:border-cyan-400 hover:text-cyan-600"}`}
                        >
                            {labels[preset]}
                        </button>
                    );
                })}
                {activeFilterTags.map(tag => (
                    <span key={tag.label} className="flex items-center gap-1 px-3 py-1.5 bg-cyan-50 border border-cyan-200 text-cyan-700 rounded-lg text-xs font-medium">
                        {tag.label}
                        <button onClick={tag.onRemove} className="ml-0.5 hover:text-red-500 transition-colors">
                            <HiOutlineX className="w-3 h-3" />
                        </button>
                    </span>
                ))}
                {(activeFiltersCount > 0 || search) && (
                    <button onClick={clearFilters} className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition-all">
                        Clear All
                    </button>
                )}
            </div>

            {/* Advanced Filters Panel */}
            {showAdvanced && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm animate-fadeIn">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Advanced Filters</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                <HiOutlineCalendar className="w-3.5 h-3.5" /> Date From
                            </label>
                            <input
                                type="date"
                                value={datePreset ? getPresetRange(datePreset).from : dateFrom}
                                onChange={(e) => handleDateCustom('from', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                <HiOutlineCalendar className="w-3.5 h-3.5" /> Date To
                            </label>
                            <input
                                type="date"
                                value={datePreset ? getPresetRange(datePreset).to : dateTo}
                                onChange={(e) => handleDateCustom('to', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                <HiOutlineCurrencyDollar className="w-3.5 h-3.5" /> Min Amount
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{currency}</span>
                                <input
                                    type="number"
                                    min={0}
                                    step="any"
                                    placeholder="0"
                                    value={minAmount}
                                    onChange={(e) => setMinAmount(e.target.value)}
                                    className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                <HiOutlineCurrencyDollar className="w-3.5 h-3.5" /> Max Amount
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{currency}</span>
                                <input
                                    type="number"
                                    min={0}
                                    step="any"
                                    placeholder="∞"
                                    value={maxAmount}
                                    onChange={(e) => setMaxAmount(e.target.value)}
                                    className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button onClick={clearFilters} className="px-4 py-2 text-xs font-semibold text-red-500 border border-red-200 bg-red-50 rounded-xl hover:bg-red-100 transition-all">
                            Reset all filters
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            <div>
                {loading ? (
                    <div className="flex items-center justify-center py-20 bg-white border border-slate-200 rounded-2xl">
                        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-20 text-slate-500 text-sm bg-white border border-slate-200 rounded-2xl animate-fadeIn">
                        No orders found
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {orders.map(o => (
                                <div key={o._id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-full gap-4 animate-fadeIn">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                            <div>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Order ID</span>
                                                <span className="text-base font-extrabold text-cyan-600 block mt-0.5">{o.orderId}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Date</span>
                                                <span className="text-sm font-semibold text-slate-500 block mt-0.5">{new Date(o.createdAt!).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="pb-3 border-b border-slate-100">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Customer</span>
                                            <span className="text-base font-bold text-slate-900 block mt-0.5">{o.customer?.name}</span>
                                            <span className="text-xs text-slate-400 font-medium block mt-0.5">{o.customer?.customerId}</span>
                                        </div>

                                        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                            <div>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Status</span>
                                                <select
                                                    value={o.status}
                                                    onChange={(e) => updateStatus(o._id, e.target.value)}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border capitalize cursor-pointer focus:outline-none bg-transparent ${statusColors[o.status] || ''}`}
                                                >
                                                    {allStatuses.map(s => (
                                                        <option key={s} value={s} className="bg-white text-slate-900">
                                                            {s.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Amount</span>
                                                <span className="text-lg font-black text-slate-900 block mt-0.5">
                                                    {currency}{o.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Items list */}
                                        <div>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-2">Items</span>
                                            <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                                                {o.items?.map((item: any, idx: number) => {
                                                    const qty = item.shippedQuantity !== null && item.shippedQuantity !== undefined ? item.shippedQuantity : item.quantity;
                                                    const hasDiff = item.shippedQuantity !== null && item.shippedQuantity !== undefined && item.shippedQuantity !== item.quantity;
                                                    return (
                                                        <div key={idx} className="text-xs text-slate-600 flex items-center justify-between border-b border-dashed border-slate-100 pb-1.5 last:border-0 last:pb-0">
                                                            <span className="font-medium text-slate-800">{item.itemName || item.serviceName}</span>
                                                            <div className="flex items-center gap-1.5 shrink-0 ml-4">
                                                                {hasDiff ? (
                                                                    <>
                                                                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-lg">
                                                                            {qty} {item.unit}
                                                                        </span>
                                                                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-lg">
                                                                            ord: {item.quantity}
                                                                        </span>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                                                                        {qty} {item.unit}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions Footer */}
                                    <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3.5 mt-auto">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => navigate(`/orders/${o._id}`)}
                                                className="flex items-center gap-1 px-3 py-2 border border-slate-200 rounded-xl text-slate-600 hover:text-cyan-600 hover:border-cyan-200 hover:bg-cyan-50 text-xs font-semibold transition-all"
                                                title="View Details"
                                            >
                                                <HiOutlineEye className="w-3.5 h-3.5" />
                                                View
                                            </button>
                                            {!o.isShipped && o.status !== 'cancelled' && (
                                                <button
                                                    onClick={() => navigate(`/orders/${o._id}`, { state: { openEdit: true } })}
                                                    className="flex items-center gap-1 px-3 py-2 border border-slate-200 rounded-xl text-slate-600 hover:text-cyan-600 hover:border-cyan-200 hover:bg-cyan-50 text-xs font-semibold transition-all cursor-pointer"
                                                    title="Edit Items"
                                                >
                                                    <HiOutlinePencil className="w-3.5 h-3.5" />
                                                    Edit
                                                </button>
                                            )}
                                            {o.status === 'packed' && !o.isShipped && (
                                                <button
                                                    onClick={() => navigate(`/orders/${o._id}`, { state: { openShip: true } })}
                                                    className="flex items-center gap-1 px-3 py-2 bg-[#1c2a5e] text-white hover:bg-[#2e3e78] rounded-xl text-xs font-semibold transition-all shadow"
                                                    title="Ship & Create Invoice"
                                                >
                                                    <HiOutlineTruck className="w-3.5 h-3.5" />
                                                    Ship
                                                </button>
                                            )}
                                            {o.isShipped && (
                                                <span className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-xs font-semibold select-none">
                                                    <HiOutlineCheck className="w-3.5 h-3.5" />
                                                    Invoiced
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => cancelOrder(o._id)}
                                            disabled={user?.role !== 'admin'}
                                            className="p-2 rounded-xl text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-50 disabled:hover:text-red-500"
                                            title={user?.role !== 'admin' ? "Only Admin can Cancel/Delete Order" : "Cancel/Delete Order"}
                                        >
                                            <HiOutlineTrash className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6">
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                totalItems={totalItems}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Orders;
