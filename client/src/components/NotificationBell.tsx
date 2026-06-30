import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { HiOutlineBell, HiOutlineCheckCircle } from 'react-icons/hi';

interface Notification {
    _id: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
    relatedOrder?: { _id: string; orderId: string };
}

const typeIcons: Record<string, string> = {
    'order-created': '📦',
    'order-status-update': '🔄',
    'order-ready': '✅',
    'order-delivered': '🚚',
    'payment-received': '💰',
    'low-stock': '⚠️',
    'new-customer': '👤',
    'system': '🔔',
};

const NotificationBell = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    const fetchUnreadCount = async () => {
        try {
            const res = await api.get('/notifications/unread-count');
            setUnreadCount(res.data.data.count);
        } catch { /* ignore */ }
    };

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const res = await api.get('/notifications', { params: { limit: 15 } });
            setNotifications(res.data.data);
            setUnreadCount(res.data.unreadCount);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    };

    // Poll for unread count every 60 seconds
    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 60000);
        return () => clearInterval(interval);
    }, []);

    // Load full list when dropdown opens
    useEffect(() => {
        if (isOpen) fetchNotifications();
    }, [isOpen]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const markAsRead = async (id: string) => {
        try {
            await api.patch(`/notifications/${id}/read`);
            setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true } : n));
            setUnreadCount((c) => Math.max(0, c - 1));
        } catch { /* ignore */ }
    };

    const markAllRead = async () => {
        try {
            await api.patch('/notifications/read-all');
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch { /* ignore */ }
    };

    const handleClick = (n: Notification) => {
        if (!n.isRead) markAsRead(n._id);
        if (n.relatedOrder?._id) {
            navigate(`/orders/${n.relatedOrder._id}`);
            setIsOpen(false);
        }
    };

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-white transition-colors"
            >
                <HiOutlineBell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-slate-900 text-[10px] font-bold rounded-full px-1 animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 top-12 w-[360px] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fadeIn">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                        {unreadCount > 0 && (
                            <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-cyan-600 hover:text-cyan-700">
                                <HiOutlineCheckCircle className="w-3.5 h-3.5" /> Mark all read
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-10">
                                <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="text-center py-10 text-slate-500 text-sm">No notifications yet</div>
                        ) : (
                            notifications.map((n) => (
                                <button
                                    key={n._id}
                                    onClick={() => handleClick(n)}
                                    className={`w-full px-4 py-3 text-left flex gap-3 hover:bg-slate-100 transition-colors border-b border-slate-200 ${!n.isRead ? 'bg-cyan-500/[0.04]' : ''
                                        }`}
                                >
                                    {/* Icon */}
                                    <span className="text-lg flex-shrink-0 mt-0.5">{typeIcons[n.type] || '🔔'}</span>
                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm font-medium truncate ${!n.isRead ? 'text-slate-900' : 'text-slate-500'}`}>
                                                {n.title}
                                            </span>
                                            {!n.isRead && <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0"></span>}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                                        <p className="text-[10px] text-slate-600 mt-1">{timeAgo(n.createdAt)}</p>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
