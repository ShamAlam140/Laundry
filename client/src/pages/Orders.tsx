import { useState, useEffect, useCallback, useRef } from 'react';
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
    HiOutlinePlusCircle,
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
import { HiMinus, HiPlus, HiOutlineTruck } from 'react-icons/hi2';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
    received: 'bg-blue-50 text-blue-600 border-blue-200',
    washing: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    packed: 'bg-amber-50 text-amber-600 border-amber-200',
    cancelled: 'bg-red-50 text-red-600 border-red-200',
};

const allStatuses: OrderStatus[] = ['received', 'washing', 'packed', 'cancelled'];

type DatePreset = 'today' | 'yesterday' | 'tomorrow' | 'last7' | '';

function toLocalISO(date: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getPresetRange(preset: DatePreset): { from: string; to: string } {
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

// ─── Component ────────────────────────────────────────────────────────────────

const Orders = () => {
    const [allOrders, setAllOrders] = useState<IOrder[]>([]);   // raw from API
    const [orders, setOrders] = useState<IOrder[]>([]);          // after client filter
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { currency, settings } = useSettings();
    const { user } = useAuth();

    // Edit Order Modal States
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingOrder, setEditingOrder] = useState<IOrder | null>(null);
    const [editForm, setEditForm] = useState<{
        deliveryDate: string;
        specialInstructions: string;
        discountPercent: number;
        taxPercent: number;
        serviceCharge: number;
        items: any[];
    }>({
        deliveryDate: '',
        specialInstructions: '',
        discountPercent: 0,
        taxPercent: 5,
        serviceCharge: 0,
        items: [],
    });
    const [masterServices, setMasterServices] = useState<any[]>([]);
    const [savingEdits, setSavingEdits] = useState(false);

    // Searchable Service Dropdown States
    const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);
    const [serviceSearchQuery, setServiceSearchQuery] = useState('');
    const serviceDropdownRef = useRef<HTMLDivElement>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const itemsPerPage = 20;

    // Basic filters (sent to server)
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // Date filters (client-side)
    const [datePreset, setDatePreset] = useState<DatePreset>('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Amount filters (client-side)
    const [amountMin, setAmountMin] = useState('');
    const [amountMax, setAmountMax] = useState('');

    // Advanced panel
    const [showAdvanced, setShowAdvanced] = useState(false);

    // ── Derived active filter count ──────────────────────────────────────────
    const activeFiltersCount = [
        statusFilter,
        datePreset || dateFrom || dateTo,
        amountMin,
        amountMax,
    ].filter(Boolean).length;

    // ── Fetch from server (only search + status — server does not support date/amount) ──
    const fetchOrders = useCallback(async () => {
        try {
            setLoading(true);
            const params: Record<string, any> = { page: currentPage, limit: itemsPerPage };
            if (search) params.search = search;
            if (statusFilter) params.status = statusFilter;

            const res = await api.get('/orders', { params });
            setAllOrders(res.data.data);
            setTotalPages(res.data.totalPages || 1);
            setTotalItems(res.data.total || 0);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to fetch orders');
        } finally {
            setLoading(false);
        }
    }, [search, statusFilter, currentPage]);

    // ── Client-side filter (date + amount) applied on top of server results ──
    useEffect(() => {
        let result = [...allOrders];

        // Resolve date range
        let resolvedFrom = dateFrom;
        let resolvedTo = dateTo;
        if (datePreset) {
            const range = getPresetRange(datePreset);
            resolvedFrom = range.from;
            resolvedTo = range.to;
        }

        if (resolvedFrom) {
            const from = new Date(resolvedFrom);
            from.setHours(0, 0, 0, 0);
            result = result.filter((o) => new Date(o.createdAt) >= from);
        }
        if (resolvedTo) {
            const to = new Date(resolvedTo);
            to.setHours(23, 59, 59, 999);
            result = result.filter((o) => new Date(o.createdAt) <= to);
        }
        if (amountMin !== '') {
            result = result.filter((o) => o.totalAmount >= Number(amountMin));
        }
        if (amountMax !== '') {
            result = result.filter((o) => o.totalAmount <= Number(amountMax));
        }

        setOrders(result);
    }, [allOrders, datePreset, dateFrom, dateTo, amountMin, amountMax]);

    // Debounced search → refetch server
    useEffect(() => {
        setCurrentPage(1); // Reset to page 1 when search changes
        const t = setTimeout(() => fetchOrders(), 400);
        return () => clearTimeout(t);
    }, [search]);

    // Instant refetch on status change or page change
    useEffect(() => {
        fetchOrders();
    }, [statusFilter, currentPage]);

    // Click outside listener for searchable dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (serviceDropdownRef.current && !serviceDropdownRef.current.contains(event.target as Node)) {
                setServiceDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Reset dropdown states when modal closes
    useEffect(() => {
        if (!showEditModal) {
            setServiceDropdownOpen(false);
            setServiceSearchQuery('');
        }
    }, [showEditModal]);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handlePreset = (preset: DatePreset) => {
        // Toggle off if same preset clicked
        if (datePreset === preset) {
            setDatePreset('');
        } else {
            setDatePreset(preset);
            // Clear manual date when preset chosen
            setDateFrom('');
            setDateTo('');
        }
    };

    const handleManualDate = (field: 'from' | 'to', val: string) => {
        setDatePreset(''); // clear preset when manual chosen
        if (field === 'from') setDateFrom(val);
        else setDateTo(val);
    };

    const clearAll = () => {
        setSearch('');
        setStatusFilter('');
        setDatePreset('');
        setDateFrom('');
        setDateTo('');
        setAmountMin('');
        setAmountMax('');
    };

    const updateStatus = async (orderId: string, newStatus: string) => {
        try {
            await api.patch(`/orders/${orderId}/status`, { status: newStatus });
            toast.success(`Status updated to ${newStatus.replace('-', ' ')}`);
            fetchOrders();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update status');
        }
    };

    const cancelOrder = async (orderId: string) => {
        if (user?.role !== 'admin') {
            toast.error('Only Admins can cancel/delete orders');
            return;
        }
        if (!confirm('Are you sure you want to cancel/delete this order?')) return;
        try {
            await api.delete(`/orders/${orderId}`);
            toast.success('Order cancelled/deleted successfully');
            fetchOrders();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to cancel/delete order');
        }
     };

    const handleExportOrders = async (format: 'xlsx' | 'csv') => {
        try {
            toast.loading(`Preparing order export...`, { id: 'order-export-toast' });
            
            const params: Record<string, any> = { limit: 100000 };
            if (search) params.search = search;
            if (statusFilter) params.status = statusFilter;
            
            const res = await api.get('/orders', { params });
            let result = [...res.data.data];

            let resolvedFrom = dateFrom;
            let resolvedTo = dateTo;
            if (datePreset) {
                const range = getPresetRange(datePreset);
                resolvedFrom = range.from;
                resolvedTo = range.to;
            }

            if (resolvedFrom) {
                const from = new Date(resolvedFrom);
                from.setHours(0, 0, 0, 0);
                result = result.filter((o) => new Date(o.createdAt) >= from);
            }
            if (resolvedTo) {
                const to = new Date(resolvedTo);
                to.setHours(23, 59, 59, 999);
                result = result.filter((o) => new Date(o.createdAt) <= to);
            }
            if (amountMin !== '') {
                result = result.filter((o) => o.totalAmount >= Number(amountMin));
            }
            if (amountMax !== '') {
                result = result.filter((o) => o.totalAmount <= Number(amountMax));
            }

            if (result.length === 0) {
                toast.error('No orders to export.', { id: 'order-export-toast' });
                return;
            }

            const exportData: any[] = [];
            
            result.forEach((o: any) => {
                const baseInfo = {
                    'Order ID': o.orderId,
                    'Customer Name': o.customer?.name || '—',
                    'Customer Phone': o.customer?.phone || '—',
                    'Order Status': o.status || 'received',
                    'Payment Status': o.paymentStatus || 'unpaid',
                    'Date Created': o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
                    'Created By': o.createdBy?.name || '—',
                    'Assigned Staff': o.assignedStaff?.name || '—',
                    'Special Instructions': o.specialInstructions || '',
                    'Delivery Date': o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
                    'Order Subtotal': o.subtotal || 0,
                    'Order Tax (%)': o.taxPercent || 0,
                    'Order Discount (%)': o.discountPercent || 0,
                    'Order Service Charge': o.serviceCharge || 0,
                    'Order Total Amount': o.totalAmount || 0,
                    'Order Paid Amount': o.paidAmount || 0,
                    'Order Balance Due': o.balanceDue || 0,
                };

                if (o.items && o.items.length > 0) {
                    o.items.forEach((item: any) => {
                        exportData.push({
                            ...baseInfo,
                            'Item Service Name': item.serviceName || '—',
                            'Item Detail / Name': item.itemName || '—',
                            'Item Service Type': item.serviceType || '—',
                            'Item Quantity': Number(item.quantity) || 0,
                            'Item Price Per Unit': item.pricePerUnit || 0,
                            'Item Subtotal': item.subtotal || 0,
                        });
                    });
                } else {
                    exportData.push({
                        ...baseInfo,
                        'Item Service Name': '—',
                        'Item Detail / Name': '—',
                        'Item Service Type': '—',
                        'Item Quantity': 0,
                        'Item Price Per Unit': 0,
                        'Item Subtotal': 0,
                    });
                }
            });

            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');

            if (format === 'xlsx') {
                XLSX.writeFile(workbook, `orders_detailed_${Date.now()}.xlsx`);
            } else {
                XLSX.writeFile(workbook, `orders_detailed_${Date.now()}.csv`, { bookType: 'csv' });
            }

            toast.success(`Exported ${result.length} orders successfully!`, { id: 'order-export-toast' });
        } catch (err: any) {
            toast.error(`Export failed: ${err.message || err}`, { id: 'order-export-toast' });
        }
    };

    const openEditOrder = async (order: IOrder) => {
        setEditingOrder(order);
        setEditForm({
            deliveryDate: order.deliveryDate ? toLocalISO(new Date(order.deliveryDate)) : '',
            specialInstructions: order.specialInstructions || '',
            discountPercent: settings?.defaultDiscountPercent ?? 0,
            taxPercent: settings?.taxPercent ?? 5,
            serviceCharge: order.serviceCharge || 0,
            items: (order.items || []).map((item) => ({ ...item })),
        });

        // Fetch general active services AND customer specific services, and merge them
        try {
            const customerId = order.customer?._id || (typeof order.customer === 'string' ? order.customer : undefined);
            const generalRes = await api.get('/services', { params: { isActive: true } });
            let mergedServices = generalRes.data.data || [];

            if (customerId) {
                try {
                    const customerRes = await api.get('/services', {
                        params: { customer: customerId, isActive: true }
                    });
                    const customerServices = customerRes.data.data || [];
                    const customerServiceIds = new Set(customerServices.map((s: any) => s._id));
                    mergedServices = [
                        ...customerServices,
                        ...mergedServices.filter((s: any) => !customerServiceIds.has(s._id))
                    ];
                } catch (cErr) {
                    console.error('Failed to fetch customer specific services', cErr);
                }
            }
            setMasterServices(mergedServices);
        } catch (err) {
            console.error('Failed to fetch master services', err);
        }
        setShowEditModal(true);
    };

    const saveOrderEdits = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingOrder) return;
        if (editForm.items.length === 0) {
            toast.error('Order must have at least one item');
            return;
        }

        try {
            setSavingEdits(true);
            await api.put(`/orders/${editingOrder._id}`, {
                deliveryDate: editForm.deliveryDate || undefined,
                specialInstructions: editForm.specialInstructions,
                discountPercent: editForm.discountPercent,
                taxPercent: editForm.taxPercent,
                serviceCharge: editForm.serviceCharge,
                items: editForm.items,
            });
            toast.success('Order updated successfully!');
            setShowEditModal(false);
            setEditingOrder(null);
            fetchOrders();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update order');
        } finally {
            setSavingEdits(false);
        }
    };

    const addEditItem = (service: any) => {
        const exists = editForm.items.find((item) => item.service === service._id);
        if (exists) {
            setEditForm((prev) => ({
                ...prev,
                items: prev.items.map((item) =>
                    item.service === service._id
                        ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.pricePerUnit }
                        : item
                ),
            }));
        } else {
            setEditForm((prev) => ({
                ...prev,
                items: [
                    ...prev.items,
                    {
                        service: service._id,
                        serviceName: service.name,
                        serviceType: service.serviceType,
                        itemType: 'Clothing',
                        itemName: service.name,
                        quantity: 1,
                        unit: service.unit,
                        pricePerUnit: service.pricePerUnit,
                        subtotal: service.pricePerUnit,
                    },
                ],
            }));
        }
        toast.success(`"${service.name}" added to order`);
    };

    const addEditManualItem = () => {
        setEditForm((prev) => ({
            ...prev,
            items: [
                ...prev.items,
                {
                    service: null,
                    serviceName: 'Manual Item',
                    serviceType: 'manual',
                    itemType: 'Clothing',
                    itemName: '',
                    quantity: 1,
                    unit: 'piece',
                    pricePerUnit: 0,
                    subtotal: 0,
                },
            ],
        }));
    };

    const updateEditItemQuantity = (index: number, delta: number) => {
        setEditForm((prev) => ({
            ...prev,
            items: prev.items.map((item, i) => {
                if (i !== index) return item;
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty, subtotal: newQty * item.pricePerUnit };
            }),
        }));
    };

    const updateEditItemField = (index: number, field: string, value: any) => {
        setEditForm((prev) => ({
            ...prev,
            items: prev.items.map((item, i) => {
                if (i !== index) return item;
                const updated = { ...item, [field]: value };
                if (field === 'pricePerUnit' || field === 'quantity') {
                    updated.subtotal = Number(updated.quantity || 0) * Number(updated.pricePerUnit || 0);
                }
                return updated;
            }),
        }));
    };

    const removeEditItem = (index: number) => {
        setEditForm((prev) => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index),
        }));
    };

    // ── Active filter badge labels ────────────────────────────────────────────
    const filterBadges: { label: string; onRemove: () => void }[] = [];
    if (statusFilter) filterBadges.push({ label: statusFilter.replace(/\b\w/g, l => l.toUpperCase()), onRemove: () => setStatusFilter('') });
    if (datePreset === 'today') filterBadges.push({ label: 'Today', onRemove: () => setDatePreset('') });
    if (datePreset === 'yesterday') filterBadges.push({ label: 'Yesterday', onRemove: () => setDatePreset('') });
    if (datePreset === 'tomorrow') filterBadges.push({ label: 'Tomorrow', onRemove: () => setDatePreset('') });
    if (datePreset === 'last7') filterBadges.push({ label: 'Last 7 Days', onRemove: () => setDatePreset('') });
    if (!datePreset && dateFrom) filterBadges.push({ label: `From: ${dateFrom}`, onRemove: () => setDateFrom('') });
    if (!datePreset && dateTo) filterBadges.push({ label: `To: ${dateTo}`, onRemove: () => setDateTo('') });
    if (amountMin) filterBadges.push({ label: `Min: ${currency}${amountMin}`, onRemove: () => setAmountMin('') });
    if (amountMax) filterBadges.push({ label: `Max: ${currency}${amountMax}`, onRemove: () => setAmountMax('') });

    // ── JSX ──────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-5 animate-fadeIn">

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
                    <p className="text-sm text-slate-500 mt-1">{orders.length} orders found</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => handleExportOrders('xlsx')}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700 text-xs font-bold rounded-xl transition-all cursor-pointer border border-indigo-200"
                        title="Export filtered orders to Excel"
                    >
                        <HiOutlineDownload className="w-3.5 h-3.5" /> Export Excel
                    </button>
                    <button
                        onClick={() => handleExportOrders('csv')}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-600 hover:text-cyan-700 text-xs font-bold rounded-xl transition-all cursor-pointer border border-cyan-200"
                        title="Export filtered orders to CSV"
                    >
                        <HiOutlineDownload className="w-3.5 h-3.5" /> Export CSV
                    </button>
                    <button
                        onClick={() => navigate('/orders/new')}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/30"
                    >
                        <HiOutlinePlusCircle className="w-5 h-5" /> New Order
                    </button>
                </div>
            </div>

            {/* ── Search + Status + Advanced toggle ── */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
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

                {/* Status filter */}
                <div className="relative">
                    <HiOutlineFilter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer min-w-[160px]"
                    >
                        <option value="">All Status</option>
                        {allStatuses.map((s) => (
                            <option key={s} value={s}>{s.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                        ))}
                    </select>
                </div>

                {/* Advanced toggle button */}
                <button
                    onClick={() => setShowAdvanced(v => !v)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${showAdvanced ? 'bg-cyan-50 border-cyan-400 text-cyan-700' : 'bg-white border-slate-200 text-slate-600 hover:border-cyan-400 hover:text-cyan-600'}`}
                >
                    <HiOutlineCalendar className="w-4 h-4" />
                    Advanced
                    {activeFiltersCount > 0 && (
                        <span className="ml-1 bg-cyan-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
                            {activeFiltersCount}
                        </span>
                    )}
                    {showAdvanced ? <HiOutlineChevronUp className="w-3.5 h-3.5" /> : <HiOutlineChevronDown className="w-3.5 h-3.5" />}
                </button>
            </div>

            {/* ── Quick date chips ── */}
            <div className="flex flex-wrap items-center gap-2">
                {(['today', 'yesterday', 'tomorrow', 'last7'] as DatePreset[]).map((preset) => {
                    const labels: Record<string, string> = { today: 'Today', yesterday: 'Yesterday', tomorrow: 'Tomorrow', last7: 'Last 7 Days' };
                    const active = datePreset === preset;
                    return (
                        <button
                            key={preset}
                            onClick={() => handlePreset(preset)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${active
                                ? 'bg-cyan-500 text-white border-cyan-500 shadow-md shadow-cyan-200'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-cyan-400 hover:text-cyan-600'
                                }`}
                        >
                            {labels[preset!]}
                        </button>
                    );
                })}

                {/* Active filter badges */}
                {filterBadges.map((b) => (
                    <span key={b.label} className="flex items-center gap-1 px-3 py-1.5 bg-cyan-50 border border-cyan-200 text-cyan-700 rounded-lg text-xs font-medium">
                        {b.label}
                        <button onClick={b.onRemove} className="ml-0.5 hover:text-red-500 transition-colors">
                            <HiOutlineX className="w-3 h-3" />
                        </button>
                    </span>
                ))}

                {/* Clear all */}
                {(activeFiltersCount > 0 || search) && (
                    <button
                        onClick={clearAll}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition-all"
                    >
                        Clear All
                    </button>
                )}
            </div>

            {/* ── Advanced filter panel ── */}
            {showAdvanced && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm animate-fadeIn">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Advanced Filters</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Date From */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                <HiOutlineCalendar className="w-3.5 h-3.5" /> Date From
                            </label>
                            <input
                                type="date"
                                value={datePreset ? getPresetRange(datePreset).from : dateFrom}
                                onChange={(e) => handleManualDate('from', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                            />
                        </div>

                        {/* Date To */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                <HiOutlineCalendar className="w-3.5 h-3.5" /> Date To
                            </label>
                            <input
                                type="date"
                                value={datePreset ? getPresetRange(datePreset).to : dateTo}
                                onChange={(e) => handleManualDate('to', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                            />
                        </div>

                        {/* Min Amount */}
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
                                    value={amountMin}
                                    onChange={(e) => setAmountMin(e.target.value)}
                                    className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                                />
                            </div>
                        </div>

                        {/* Max Amount */}
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
                                    value={amountMax}
                                    onChange={(e) => setAmountMax(e.target.value)}
                                    className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={clearAll}
                            className="px-4 py-2 text-xs font-semibold text-red-500 border border-red-200 bg-red-50 rounded-xl hover:bg-red-100 transition-all"
                        >
                            Reset all filters
                        </button>
                    </div>
                </div>
            )}

            {/* ── Grid of Cards ── */}
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
                            {orders.map((o) => (
                                <div key={o._id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-full gap-4 animate-fadeIn">
                                    <div className="space-y-4">
                                        {/* Header Row */}
                                        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                            <div>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Order ID</span>
                                                <span className="text-base font-extrabold text-cyan-600 block mt-0.5">{o.orderId}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Date</span>
                                                <span className="text-sm font-semibold text-slate-50 block mt-0.5">{new Date(o.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>

                                        {/* Customer Row */}
                                        <div className="pb-3 border-b border-slate-100">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Customer</span>
                                            <span className="text-base font-bold text-slate-900 block mt-0.5">{o.customer?.name}</span>
                                            <span className="text-xs text-slate-400 font-medium block mt-0.5">{o.customer?.customerId}</span>
                                        </div>

                                        {/* Status & Total Row */}
                                        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                            <div>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Status</span>
                                                <select
                                                    value={o.status}
                                                    onChange={(e) => updateStatus(o._id, e.target.value)}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border capitalize cursor-pointer focus:outline-none bg-transparent ${statusColors[o.status] || ''}`}
                                                >
                                                    {allStatuses.map((s) => (
                                                        <option key={s} value={s} className="bg-white text-slate-900">
                                                            {s.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
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
                                                                        <span className="text-[10px] font-semibold text-slate-505 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-lg">
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
                                            <button
                                                onClick={() => openEditOrder(o)}
                                                className="flex items-center gap-1 px-3 py-2 border border-slate-200 rounded-xl text-slate-600 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50 text-xs font-semibold transition-all"
                                                title="Edit Order"
                                            >
                                                <HiOutlinePencil className="w-3.5 h-3.5" />
                                                Edit
                                            </button>
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

                        {/* Pagination */}
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

            {/* Edit Order Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-[95vw] h-[95vh] max-h-[95vh] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900">Edit Order: #{editingOrder?.orderId || ''}</h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Customer: <span className="font-semibold text-slate-700">{editingOrder?.customer?.name}</span> ({editingOrder?.customer?.customerId})
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setShowEditModal(false); setEditingOrder(null); }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            >
                                <HiOutlineX className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Content - Scrollable */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                {/* Left Column (3 cols) */}
                                <div className="lg:col-span-3 space-y-6">

                                    {/* ─── SECTION 1A: Service Items (Standard) ─── */}
                                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                                        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                                            <h2 className="text-base font-semibold text-slate-900">
                                                Service Items (Standard)
                                                <span className="ml-2 text-xs font-normal text-slate-500">
                                                    ({editForm.items.filter(item => item.serviceType !== 'manual').length} items)
                                                </span>
                                            </h2>
                                        </div>

                                        <div className="max-h-[35vh] overflow-y-auto">
                                            <table className="w-full text-left border-collapse text-xs">
                                                <thead>
                                                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider sticky top-0 z-10">
                                                        <th className="p-3">Service / Type</th>
                                                        <th className="p-3 w-[25%]">Item Name</th>
                                                        <th className="p-3 w-[18%]">Category</th>
                                                        <th className="p-3 w-[16%] text-center">Qty</th>
                                                        <th className="p-3 w-[14%]">Price</th>
                                                        <th className="p-3 text-right">Subtotal</th>
                                                        <th className="p-3 w-[40px] text-center"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {editForm.items.filter(item => item.serviceType !== 'manual').length === 0 ? (
                                                        <tr>
                                                            <td colSpan={7} className="text-sm text-slate-500 text-center py-6 bg-slate-50">
                                                                No standard service items in this order. Choose a service below to add.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        editForm.items
                                                            .map((item, originalIndex) => ({ ...item, originalIndex }))
                                                            .filter(item => item.serviceType !== 'manual')
                                                            .map((item) => (
                                                                <tr key={item.originalIndex} className="hover:bg-slate-50/50 transition-colors">
                                                                    {/* Service Name & Type */}
                                                                    <td className="p-3">
                                                                        <div className="flex flex-col gap-0.5">
                                                                            <span className="font-semibold text-slate-800">{item.serviceName}</span>
                                                                            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider bg-cyan-100 text-cyan-700 border border-cyan-200" style={{ width: 'fit-content' }}>
                                                                                {item.serviceType || 'Standard'}
                                                                            </span>
                                                                        </div>
                                                                    </td>

                                                                    {/* Item Name Input */}
                                                                    <td className="p-2">
                                                                        <input
                                                                            type="text"
                                                                            value={item.itemName || ''}
                                                                            onChange={(e) => updateEditItemField(item.originalIndex, 'itemName', e.target.value)}
                                                                            placeholder="e.g. Shirt, Jeans"
                                                                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-cyan-500 text-xs"
                                                                        />
                                                                    </td>

                                                                    {/* Category Select */}
                                                                    <td className="p-2">
                                                                        <select
                                                                            value={item.itemType || 'Clothing'}
                                                                            onChange={(e) => updateEditItemField(item.originalIndex, 'itemType', e.target.value)}
                                                                            className="w-full px-1.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-cyan-500 text-xs"
                                                                        >
                                                                            <option value="Clothing">👕 Clothing</option>
                                                                            <option value="Linen">🛏️ Linen</option>
                                                                            <option value="Accessories">👜 Accessories</option>
                                                                            <option value="Special_Items">⭐ Special Items</option>
                                                                        </select>
                                                                    </td>

                                                                    {/* Quantity adjustment */}
                                                                    <td className="p-2">
                                                                        <div className="flex items-center justify-center gap-1">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => updateEditItemQuantity(item.originalIndex, -1)}
                                                                                className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
                                                                            >
                                                                                <HiMinus className="w-2.5 h-2.5" />
                                                                            </button>
                                                                            <input
                                                                                type="number"
                                                                                min="1"
                                                                                step="any"
                                                                                value={item.quantity}
                                                                                onChange={(e) => updateEditItemField(item.originalIndex, 'quantity', Math.max(1, Number(e.target.value)))}
                                                                                className="w-10 py-0.5 text-center bg-white border border-slate-200 rounded text-slate-900 focus:outline-none focus:border-cyan-500 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                            />
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => updateEditItemQuantity(item.originalIndex, 1)}
                                                                                className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
                                                                            >
                                                                                <HiPlus className="w-2.5 h-2.5" />
                                                                            </button>
                                                                        </div>
                                                                    </td>

                                                                    {/* Price input */}
                                                                    <td className="p-2">
                                                                        <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden focus-within:border-cyan-500">
                                                                            <span className="bg-slate-50 border-r border-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400 select-none">
                                                                                {currency.replace('$', '')}
                                                                            </span>
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                step="any"
                                                                                value={item.pricePerUnit}
                                                                                onChange={(e) => updateEditItemField(item.originalIndex, 'pricePerUnit', Number(e.target.value))}
                                                                                className="w-full px-1.5 py-0.5 outline-none text-slate-900 border-none bg-transparent text-xs"
                                                                            />
                                                                        </div>
                                                                    </td>

                                                                    {/* Subtotal */}
                                                                    <td className="p-3 text-right font-bold text-slate-900">
                                                                        {currency}{(item.quantity * item.pricePerUnit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </td>

                                                                    {/* Remove Button */}
                                                                    <td className="p-3 text-center">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeEditItem(item.originalIndex)}
                                                                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                                            title="Remove item"
                                                                        >
                                                                            <HiOutlineTrash className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* ─── SECTION 1B: Custom / Manual Items ─── */}
                                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                                        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                                            <h2 className="text-base font-semibold text-slate-900">
                                                Custom / Manual Items
                                                <span className="ml-2 text-xs font-normal text-slate-500">
                                                    ({editForm.items.filter(item => item.serviceType === 'manual').length} items)
                                                </span>
                                            </h2>
                                            <button
                                                type="button"
                                                onClick={addEditManualItem}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
                                            >
                                                <HiOutlinePlusCircle className="w-4 h-4" /> Add Custom Item (Bedsheet, Towel, etc.)
                                            </button>
                                        </div>

                                        <div className="max-h-[35vh] overflow-y-auto">
                                            <table className="w-full text-left border-collapse text-xs">
                                                <thead>
                                                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider sticky top-0 z-10">
                                                        <th className="p-3">Item Name / Details</th>
                                                        <th className="p-3 w-[22%]">Category</th>
                                                        <th className="p-3 w-[16%] text-center">Qty</th>
                                                        <th className="p-3 w-[16%]">Price</th>
                                                        <th className="p-3 text-right">Subtotal</th>
                                                        <th className="p-3 w-[40px] text-center"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {editForm.items.filter(item => item.serviceType === 'manual').length === 0 ? (
                                                        <tr>
                                                            <td colSpan={6} className="text-sm text-slate-500 text-center py-6 bg-slate-50">
                                                                No manual/custom items in this order. Click "Add Custom Item" above to add.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        editForm.items
                                                            .map((item, originalIndex) => ({ ...item, originalIndex }))
                                                            .filter(item => item.serviceType === 'manual')
                                                            .map((item) => (
                                                                <tr key={item.originalIndex} className="hover:bg-slate-50/50 transition-colors bg-emerald-50/10">
                                                                    {/* Item Name */}
                                                                    <td className="p-2">
                                                                        <input
                                                                            type="text"
                                                                            value={item.itemName || ''}
                                                                            onChange={(e) => updateEditItemField(item.originalIndex, 'itemName', e.target.value)}
                                                                            placeholder="e.g. towel, bedsheet"
                                                                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-cyan-500 text-xs font-medium"
                                                                        />
                                                                    </td>

                                                                    {/* Category */}
                                                                    <td className="p-2">
                                                                        <select
                                                                            value={item.itemType || 'Clothing'}
                                                                            onChange={(e) => updateEditItemField(item.originalIndex, 'itemType', e.target.value)}
                                                                            className="w-full px-1.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-cyan-500 text-xs"
                                                                        >
                                                                            <option value="Clothing">👕 Clothing</option>
                                                                            <option value="Linen">🛏️ Linen</option>
                                                                            <option value="Accessories">👜 Accessories</option>
                                                                            <option value="Special_Items">⭐ Special Items</option>
                                                                        </select>
                                                                    </td>

                                                                    {/* Qty Adjusters */}
                                                                    <td className="p-2">
                                                                        <div className="flex items-center justify-center gap-1">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => updateEditItemQuantity(item.originalIndex, -1)}
                                                                                className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
                                                                            >
                                                                                <HiMinus className="w-2.5 h-2.5" />
                                                                            </button>
                                                                            <input
                                                                                type="number"
                                                                                min="1"
                                                                                step="any"
                                                                                value={item.quantity}
                                                                                onChange={(e) => updateEditItemField(item.originalIndex, 'quantity', Math.max(1, Number(e.target.value)))}
                                                                                className="w-10 py-0.5 text-center bg-white border border-slate-200 rounded text-slate-900 focus:outline-none focus:border-cyan-500 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                            />
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => updateEditItemQuantity(item.originalIndex, 1)}
                                                                                className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
                                                                            >
                                                                                <HiPlus className="w-2.5 h-2.5" />
                                                                            </button>
                                                                        </div>
                                                                    </td>

                                                                    {/* Price Input */}
                                                                    <td className="p-2">
                                                                        <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden focus-within:border-cyan-500">
                                                                            <span className="bg-slate-50 border-r border-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400 select-none">
                                                                                {currency.replace('$', '')}
                                                                            </span>
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                step="any"
                                                                                value={item.pricePerUnit}
                                                                                onChange={(e) => updateEditItemField(item.originalIndex, 'pricePerUnit', Number(e.target.value))}
                                                                                className="w-full px-1.5 py-0.5 outline-none text-slate-900 border-none bg-transparent text-xs"
                                                                            />
                                                                        </div>
                                                                    </td>

                                                                    {/* Subtotal */}
                                                                    <td className="p-3 text-right font-bold text-slate-900">
                                                                        {currency}{(item.quantity * item.pricePerUnit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </td>

                                                                    {/* Action Remove */}
                                                                    <td className="p-3 text-center">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeEditItem(item.originalIndex)}
                                                                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                                            title="Remove item"
                                                                        >
                                                                            <HiOutlineTrash className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* ─── SECTION 2: Add Services (Searchable Dropdown) ─── */}
                                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                         <h2 className="text-base font-semibold text-slate-900 mb-3">Add Services</h2>
                                         <div className="relative" ref={serviceDropdownRef}>
                                             <button
                                                 type="button"
                                                 onClick={() => setServiceDropdownOpen(!serviceDropdownOpen)}
                                                 className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 text-sm text-left focus:outline-none focus:border-cyan-500 flex items-center justify-between shadow-sm hover:bg-slate-50 transition-colors"
                                             >
                                                 <span className="truncate">-- Select a service to add to this order --</span>
                                                 <HiOutlineChevronDown className="w-4 h-4 text-slate-400" />
                                             </button>

                                             {serviceDropdownOpen && (
                                                 <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl p-2.5 animate-fadeIn">
                                                     {/* Search Input inside Dropdown */}
                                                     <div className="relative mb-2">
                                                         <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                         <input
                                                             type="text"
                                                             placeholder="Search services by name or type..."
                                                             value={serviceSearchQuery}
                                                             onChange={(e) => setServiceSearchQuery(e.target.value)}
                                                             className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-cyan-500 focus:bg-white transition-all"
                                                             autoFocus
                                                         />
                                                         {serviceSearchQuery && (
                                                             <button
                                                                 type="button"
                                                                 onClick={() => setServiceSearchQuery('')}
                                                                 className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                             >
                                                                 <HiOutlineX className="w-3.5 h-3.5" />
                                                             </button>
                                                         )}
                                                     </div>

                                                     {/* Service List */}
                                                     <div className="max-h-48 overflow-y-auto space-y-1">
                                                         {(() => {
                                                             const filtered = masterServices.filter(s => {
                                                                 const q = serviceSearchQuery.toLowerCase();
                                                                 const name = (s.name || '').toLowerCase();
                                                                 const type = (s.serviceType || '').toLowerCase();
                                                                 return name.includes(q) || type.includes(q);
                                                             });

                                                             if (filtered.length === 0) {
                                                                 return (
                                                                     <div className="text-center py-4 text-slate-400 text-xs">
                                                                         No services found
                                                                     </div>
                                                                 );
                                                             }

                                                             return filtered.map((s) => (
                                                                 <button
                                                                     key={s._id}
                                                                     type="button"
                                                                     onClick={() => {
                                                                         addEditItem(s);
                                                                         setServiceDropdownOpen(false);
                                                                         setServiceSearchQuery('');
                                                                     }}
                                                                     className="w-full px-3 py-2 text-left hover:bg-cyan-50 hover:text-cyan-700 rounded-lg transition-colors flex justify-between items-center text-xs text-slate-700 font-medium group"
                                                                 >
                                                                     <div className="min-w-0 pr-2">
                                                                         <span className="truncate block font-semibold text-slate-900 group-hover:text-cyan-700">
                                                                             {s.name}
                                                                         </span>
                                                                         <span className="text-[10px] text-slate-400 uppercase tracking-wide group-hover:text-cyan-600/70">
                                                                             {s.serviceType}
                                                                         </span>
                                                                     </div>
                                                                     <span className="shrink-0 text-slate-950 font-bold bg-slate-50 group-hover:bg-cyan-100/50 px-2 py-1 rounded text-[10px]">
                                                                         {currency}{s.pricePerUnit}/{s.unit}
                                                                     </span>
                                                                 </button>
                                                             ));
                                                         })()}
                                                     </div>
                                                 </div>
                                             )}
                                         </div>
                                     </div>
                                </div>

                                {/* Right Column: Details & Totals (1 col) */}
                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4 flex flex-col justify-between h-full">
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2 mb-3">Order Details</h4>
                                            
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="col-span-2">
                                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Delivery Date</label>
                                                    <input 
                                                        type="date" 
                                                        value={editForm.deliveryDate} 
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, deliveryDate: e.target.value }))}
                                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-cyan-500 transition-colors" 
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Discount %</label>
                                                    <input 
                                                        type="number" min={0} max={100} step="any" 
                                                        value={editForm.discountPercent} 
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, discountPercent: Number(e.target.value) }))}
                                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-cyan-500 transition-colors" 
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Tax %</label>
                                                    <input 
                                                        type="number" min={0} max={100} step="any" 
                                                        value={editForm.taxPercent} 
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, taxPercent: Number(e.target.value) }))}
                                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-cyan-500 transition-colors" 
                                                    />
                                                </div>

                                                <div className="col-span-2">
                                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Service Charge</label>
                                                    <input 
                                                        type="number" min={0} step="any" 
                                                        value={editForm.serviceCharge} 
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, serviceCharge: Number(e.target.value) }))}
                                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-cyan-500 transition-colors" 
                                                    />
                                                </div>

                                                <div className="col-span-2">
                                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Special Instructions</label>
                                                    <textarea 
                                                        rows={3} 
                                                        value={editForm.specialInstructions} 
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, specialInstructions: e.target.value }))}
                                                        placeholder="Instructions for handling, stains, etc."
                                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-cyan-500 resize-none transition-colors" 
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Order Preview Totals */}
                                        <div className="border-t border-slate-100 pt-3 mt-2 space-y-2">
                                            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Total Summary</h4>
                                            
                                            {(() => {
                                                const subtotal = editForm.items
                                                    .filter(item => item.serviceType !== 'manual')
                                                    .reduce((sum, item) => sum + (Number(item.quantity) * Number(item.pricePerUnit)), 0);
                                                const taxAmount = (subtotal * editForm.taxPercent) / 100;
                                                const discountAmount = (subtotal * editForm.discountPercent) / 100;
                                                const totalAmount = subtotal + taxAmount - discountAmount + editForm.serviceCharge;

                                                return (
                                                    <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-slate-500">Subtotal</span>
                                                            <span className="text-slate-900 font-semibold">{currency}{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-slate-500">Tax ({editForm.taxPercent}%)</span>
                                                            <span className="text-slate-900 font-semibold">+{currency}{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                        </div>
                                                        {editForm.discountPercent > 0 && (
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-slate-500">Discount ({editForm.discountPercent}%)</span>
                                                                <span className="text-emerald-600 font-semibold">-{currency}{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                            </div>
                                                        )}
                                                        {editForm.serviceCharge > 0 && (
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-slate-500">Service Charge</span>
                                                                <span className="text-slate-900 font-semibold">+{currency}{editForm.serviceCharge.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-slate-200">
                                                            <span className="text-slate-900">Total</span>
                                                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-600">
                                                                {currency}{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
                            <button
                                type="button"
                                onClick={() => { setShowEditModal(false); setEditingOrder(null); }}
                                className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={saveOrderEdits}
                                disabled={savingEdits || editForm.items.length === 0}
                                className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {savingEdits ? 'Saving Changes...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Orders;