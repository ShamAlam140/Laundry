import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useSettings } from '../context/SettingsContext';
import {
    HiOutlinePlusCircle,
    HiOutlineTruck,
    HiOutlineCalendar,
    HiOutlineUser,
    HiOutlineShieldCheck,
    HiOutlineRefresh,
} from 'react-icons/hi';

interface DeliveryItem {
    _id: string;
    deliveryId: string;
    type: 'pickup' | 'delivery';
    scheduledDate: string;
    scheduledTime?: string;
    status: string;
    address?: string;
    notes?: string;
    completedAt?: string;
    otpVerified?: boolean;
    signature?: string;
    deliveryOtp?: string;
    order?: { _id: string; orderId: string; status: string; totalAmount: number };
    customer?: { customerId: string; name: string; phone: string; address?: string };
    assignedStaff?: { _id: string; name: string };
    confirmedBy?: { name: string };
}

const statusColors: Record<string, string> = {
    scheduled: 'bg-blue-50 text-blue-600 border-blue-200',
    'in-transit': 'bg-amber-50 text-amber-600 border-amber-200',
    completed: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    cancelled: 'bg-red-50 text-red-600 border-red-200',
};

const typeColors: Record<string, string> = {
    pickup: 'bg-purple-50 text-purple-600 border-purple-200',
    delivery: 'bg-cyan-50 text-cyan-600 border-cyan-200',
};

const timeSlots = [
    '08:00 AM - 10:00 AM',
    '10:00 AM - 12:00 PM',
    '12:00 PM - 02:00 PM',
    '02:00 PM - 04:00 PM',
    '04:00 PM - 06:00 PM',
    '06:00 PM - 08:00 PM',
];

const Deliveries = () => {
    const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { currency } = useSettings();
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [orders, setOrders] = useState<any[]>([]);
    const [staffList, setStaffList] = useState<any[]>([]);
    const [todaySummary, setTodaySummary] = useState<any>(null);

    // Confirm delivery modal state
    const [confirmModal, setConfirmModal] = useState<DeliveryItem | null>(null);
    const [otpInput, setOtpInput] = useState(['', '', '', '']);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [showOtp, setShowOtp] = useState(false);
    const [currentOtp, setCurrentOtp] = useState('');
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Signature canvas
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    const [form, setForm] = useState({
        order: '',
        type: 'delivery',
        scheduledDate: '',
        scheduledTime: '',
        assignedStaff: '',
        address: '',
        notes: '',
    });

    const fetchDeliveries = async () => {
        try {
            setLoading(true);
            const params: any = {};
            if (statusFilter) params.status = statusFilter;
            if (typeFilter) params.type = typeFilter;
            if (dateFilter) params.date = dateFilter;

            const [res, todayRes] = await Promise.all([
                api.get('/deliveries', { params }),
                api.get('/deliveries/today'),
            ]);
            setDeliveries(res.data.data);
            setTodaySummary(todayRes.data.summary);
        } catch {
            toast.error('Failed to load deliveries');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDeliveries(); }, [statusFilter, typeFilter, dateFilter]);

    const openCreate = async () => {
        try {
            const [ordersRes, usersRes] = await Promise.all([
                api.get('/orders', { params: { limit: 100 } }),
                api.get('/users'),
            ]);
            setOrders(ordersRes.data.data);
            setStaffList(usersRes.data.data.filter((u: any) => u.isActive));
        } catch { /* ignore */ }
        setForm({ order: '', type: 'delivery', scheduledDate: '', scheduledTime: '', assignedStaff: '', address: '', notes: '' });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/deliveries', form);
            toast.success('Delivery scheduled!');
            setShowModal(false);
            fetchDeliveries();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed');
        }
    };

    const updateStatus = async (id: string, status: string) => {
        try {
            await api.patch(`/deliveries/${id}/status`, { status });
            toast.success(`Status updated to ${status}`);
            fetchDeliveries();
        } catch {
            toast.error('Failed to update');
        }
    };

    // ── Confirm Delivery Modal ──

    const openConfirmModal = async (d: DeliveryItem) => {
        setConfirmModal(d);
        setOtpInput(['', '', '', '']);
        setShowOtp(false);
        setCurrentOtp('');
        setHasSignature(false);
        // Fetch fresh delivery to get OTP for admin view
        try {
            const res = await api.get(`/deliveries/${d._id}`);
            setCurrentOtp(res.data.data.deliveryOtp || '');
        } catch { /* ignore */ }
    };

    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;
        const newOtp = [...otpInput];
        newOtp[index] = value.slice(-1);
        setOtpInput(newOtp);
        // Auto-focus next
        if (value && index < 3) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otpInput[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const regenerateOtp = async () => {
        if (!confirmModal) return;
        try {
            const res = await api.post(`/deliveries/${confirmModal._id}/regenerate-otp`);
            setCurrentOtp(res.data.data.deliveryOtp);
            toast.success('New OTP generated!');
        } catch {
            toast.error('Failed to regenerate OTP');
        }
    };

    // Signature canvas handlers
    const initCanvas = (canvas: HTMLCanvasElement | null) => {
        canvasRef.current = canvas;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#f8fafc';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.strokeStyle = '#0f172a';
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
            }
        }
    };

    const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        if ('touches' in e) {
            return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
        return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const pos = getPos(e, canvas);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        setIsDrawing(true);
        setHasSignature(true);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const pos = getPos(e, canvas);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
    };

    const getSignatureData = () => {
        const canvas = canvasRef.current;
        if (!canvas || !hasSignature) return null;
        return canvas.toDataURL('image/png');
    };

    const handleConfirmDelivery = async () => {
        if (!confirmModal) return;
        const otp = otpInput.join('');
        if (otp.length !== 4) {
            toast.error('Please enter complete 4-digit OTP');
            return;
        }
        setConfirmLoading(true);
        try {
            const payload: any = { otp };
            const sig = getSignatureData();
            if (sig) payload.signature = sig;

            await api.post(`/deliveries/${confirmModal._id}/confirm`, payload);
            toast.success('Delivery confirmed successfully!');
            setConfirmModal(null);
            fetchDeliveries();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Confirmation failed');
        } finally {
            setConfirmLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-2xl font-bold text-slate-900">Deliveries & Pickups</h1>
                <button onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-md shadow-cyan-500/30">
                    <HiOutlinePlusCircle className="w-4 h-4" /> Schedule New
                </button>
            </div>

            {/* Today's Summary */}
            {todaySummary && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {[
                        { label: "Today's Total", value: todaySummary.total, color: 'text-slate-900' },
                        { label: 'Pickups', value: todaySummary.pickups, color: 'text-purple-400' },
                        { label: 'Deliveries', value: todaySummary.deliveriesCount, color: 'text-cyan-600' },
                        { label: 'Completed', value: todaySummary.completed, color: 'text-emerald-400' },
                        { label: 'Pending', value: todaySummary.pending, color: 'text-amber-400' },
                    ].map((s, i) => (
                        <div key={i} className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                            <p className="text-xs text-slate-500">{s.label}</p>
                            <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-cyan-500">
                    <option value="">All Types</option>
                    <option value="pickup">Pickup</option>
                    <option value="delivery">Delivery</option>
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-cyan-500">
                    <option value="">All Status</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="in-transit">In Transit</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
                <div className="flex items-center gap-2">
                    <HiOutlineCalendar className="w-4 h-4 text-slate-500" />
                    <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
                        className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-cyan-500" />
                </div>
                {(typeFilter || statusFilter || dateFilter) && (
                    <button onClick={() => { setTypeFilter(''); setStatusFilter(''); setDateFilter(''); }}
                        className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-white">
                        Clear Filters
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : deliveries.length === 0 ? (
                    <div className="text-center py-16 text-slate-500 text-sm">No deliveries found</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-xs text-slate-500 uppercase border-b border-slate-200">
                                    <th className="px-4 py-3 text-left">ID</th>
                                    <th className="px-4 py-3 text-left">Type</th>
                                    <th className="px-4 py-3 text-left">Order</th>
                                    <th className="px-4 py-3 text-left">Customer</th>
                                    <th className="px-4 py-3 text-left">Date & Time</th>
                                    <th className="px-4 py-3 text-left">Staff</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {deliveries.map((d) => (
                                    <tr key={d._id} className="border-b border-slate-200 hover:bg-white transition-colors">
                                        <td className="px-4 py-3 text-sm text-cyan-600 font-medium">{d.deliveryId}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border capitalize ${typeColors[d.type] || ''}`}>
                                                {d.type === 'pickup' ? '📥 Pickup' : '🚚 Delivery'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-900">{d.order?.orderId}</td>
                                        <td className="px-4 py-3">
                                            <p className="text-sm text-slate-900">{d.customer?.name}</p>
                                            <p className="text-xs text-slate-500">{d.customer?.phone}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-sm text-slate-900">{new Date(d.scheduledDate).toLocaleDateString()}</p>
                                            {d.scheduledTime && <p className="text-xs text-slate-500">{d.scheduledTime}</p>}
                                        </td>
                                        <td className="px-4 py-3">
                                            {d.assignedStaff ? (
                                                <span className="flex items-center gap-1.5 text-sm text-slate-900">
                                                    <HiOutlineUser className="w-3.5 h-3.5 text-slate-500" /> {d.assignedStaff.name}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-500 italic">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border capitalize ${statusColors[d.status] || ''}`}>
                                                {d.status.replace('-', ' ')}
                                            </span>
                                            {d.otpVerified && (
                                                <span className="ml-1 text-emerald-500" title="OTP Verified">✓</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {d.status === 'scheduled' && (
                                                <button onClick={() => updateStatus(d._id, 'in-transit')}
                                                    className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-xs font-medium hover:bg-amber-100 border border-amber-200">
                                                    Start
                                                </button>
                                            )}
                                            {d.status === 'in-transit' && (
                                                <button onClick={() => openConfirmModal(d)}
                                                    className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-medium hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1 mx-auto">
                                                    <HiOutlineShieldCheck className="w-3.5 h-3.5" /> Confirm
                                                </button>
                                            )}
                                            {d.status === 'completed' && (
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <span className="text-xs text-emerald-600 font-medium">✓ Confirmed</span>
                                                    {d.signature && (
                                                        <span className="text-xs text-slate-400" title="Signature captured">✍️</span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-lg mx-4 bg-white border border-slate-200 rounded-2xl p-6 animate-fadeIn max-h-[85vh] overflow-y-auto">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <HiOutlineTruck className="w-5 h-5 text-cyan-600" /> Schedule Delivery / Pickup
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Order */}
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Select Order *</label>
                                <select required value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-cyan-500">
                                    <option value="">Choose order...</option>
                                    {orders.map((o: any) => (
                                        <option key={o._id} value={o._id}>{o.orderId} — {o.customer?.name} ({currency}{o.totalAmount})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Type */}
                            <div className="grid grid-cols-2 gap-3">
                                {(['pickup', 'delivery'] as const).map((t) => (
                                    <button key={t} type="button" onClick={() => setForm({ ...form, type: t })}
                                        className={`py-3 rounded-xl text-sm font-medium border transition-all capitalize ${form.type === t
                                            ? 'bg-cyan-50 text-cyan-600 border-cyan-200'
                                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                                            }`}>
                                        {t === 'pickup' ? '📥 Pickup' : '🚚 Delivery'}
                                    </button>
                                ))}
                            </div>

                            {/* Date & Time */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Date *</label>
                                    <input type="date" required value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500" />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Time Slot</label>
                                    <select value={form.scheduledTime} onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-cyan-500">
                                        <option value="">Any time</option>
                                        {timeSlots.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Staff */}
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Assign Staff</label>
                                <select value={form.assignedStaff} onChange={(e) => setForm({ ...form, assignedStaff: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-cyan-500">
                                    <option value="">Unassigned</option>
                                    {staffList.map((s: any) => (
                                        <option key={s._id} value={s._id}>{s.name} ({s.role})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Address & Notes */}
                            <input type="text" placeholder="Delivery / Pickup Address" value={form.address}
                                onChange={(e) => setForm({ ...form, address: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500" />
                            <textarea rows={2} placeholder="Notes (optional)" value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none" />

                            {/* Buttons */}
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setShowModal(false)}
                                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-white">Cancel</button>
                                <button type="submit"
                                    className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-500">
                                    Schedule
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Confirm Delivery Modal (OTP + Signature) ── */}
            {confirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-6">
                    <div className="w-full max-w-md mx-4 bg-white border border-slate-200 rounded-2xl animate-fadeIn max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                                    <HiOutlineShieldCheck className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900">Confirm Delivery</h3>
                                    <p className="text-xs text-slate-500">{confirmModal.deliveryId} • {confirmModal.customer?.name}</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Delivery Info */}
                            <div className="p-3 bg-slate-50 rounded-xl space-y-1.5">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Order</span>
                                    <span className="font-medium text-slate-900">{confirmModal.order?.orderId}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Customer</span>
                                    <span className="text-slate-900">{confirmModal.customer?.name}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Phone</span>
                                    <span className="text-slate-900">{confirmModal.customer?.phone}</span>
                                </div>
                            </div>

                            {/* OTP Section */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-sm font-semibold text-slate-900">🔐 Enter OTP</label>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setShowOtp(!showOtp)} type="button"
                                            className="text-xs text-cyan-600 hover:text-cyan-700 font-medium">
                                            {showOtp ? 'Hide' : 'Show'} OTP
                                        </button>
                                        <button onClick={regenerateOtp} type="button"
                                            className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium">
                                            <HiOutlineRefresh className="w-3 h-3" /> Resend
                                        </button>
                                    </div>
                                </div>

                                {showOtp && currentOtp && (
                                    <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-center">
                                        <p className="text-xs text-amber-600">Customer OTP:</p>
                                        <p className="text-2xl font-bold text-amber-700 tracking-[0.4em] mt-0.5">{currentOtp}</p>
                                    </div>
                                )}

                                {/* OTP Input Boxes */}
                                <div className="flex justify-center gap-3">
                                    {[0, 1, 2, 3].map((i) => (
                                        <input
                                            key={i}
                                            ref={(el) => { otpRefs.current[i] = el; }}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={otpInput[i]}
                                            onChange={(e) => handleOtpChange(i, e.target.value)}
                                            onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                            className="w-14 h-14 text-center text-2xl font-bold text-slate-900 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-cyan-500 bg-white transition-colors"
                                        />
                                    ))}
                                </div>
                                <p className="text-xs text-slate-400 text-center mt-2">
                                    Share this OTP with the customer for verification
                                </p>
                            </div>

                            {/* Signature Section */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-semibold text-slate-900">✍️ Signature (Optional)</label>
                                    {hasSignature && (
                                        <button onClick={clearSignature} type="button"
                                            className="text-xs text-red-500 hover:text-red-600 font-medium">Clear</button>
                                    )}
                                </div>
                                <div className="border-2 border-dashed border-slate-200 rounded-xl overflow-hidden bg-slate-50 relative">
                                    <canvas
                                        ref={initCanvas}
                                        width={360}
                                        height={150}
                                        className="w-full cursor-crosshair touch-none"
                                        onMouseDown={startDrawing}
                                        onMouseMove={draw}
                                        onMouseUp={stopDrawing}
                                        onMouseLeave={stopDrawing}
                                        onTouchStart={startDrawing}
                                        onTouchMove={draw}
                                        onTouchEnd={stopDrawing}
                                    />
                                    {!hasSignature && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <p className="text-sm text-slate-300">Draw signature here</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setConfirmModal(null)}
                                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
                                    Cancel
                                </button>
                                <button onClick={handleConfirmDelivery} disabled={confirmLoading}
                                    className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-400 hover:to-cyan-500 disabled:opacity-50 flex items-center justify-center gap-2">
                                    {confirmLoading ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <HiOutlineShieldCheck className="w-4 h-4" /> Confirm Delivery
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Deliveries;
