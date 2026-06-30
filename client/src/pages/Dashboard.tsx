import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import {
    HiOutlineShoppingCart,
    HiOutlineCurrencyRupee,
    HiOutlineClock,
    HiOutlineCheckCircle,
    HiOutlineUsers,
    HiOutlinePlusCircle,
    HiOutlineClipboardList,
    HiOutlineDocumentText,
    HiOutlineCreditCard,
    HiOutlineHome,
} from 'react-icons/hi';
import { HiOutlineCube, HiOutlineTruck } from 'react-icons/hi2';

// Import page components for tabs
import Orders from './Orders';
import Customers from './Customers';
import Invoices from './Invoices';
import Payments from './Payments';
import Deliveries from './Deliveries';
import Inventory from './Inventory';

const statusColors: Record<string, string> = {
    received: 'bg-blue-50 text-blue-600 border-blue-200',
    washing: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    packed: 'bg-amber-50 text-amber-600 border-amber-200',
    cancelled: 'bg-red-50 text-red-600 border-red-200',
};

type TabKey = 'overview' | 'orders' | 'customers' | 'invoices' | 'payments' | 'deliveries' | 'inventory';

interface TabItem {
    key: TabKey;
    label: string;
    icon: any;
    roles: string[];
}

const tabConfig: TabItem[] = [
    { key: 'overview', label: 'Overview', icon: HiOutlineHome, roles: ['admin', 'manager', 'cashier', 'staff'] },
    { key: 'orders', label: 'Orders', icon: HiOutlineClipboardList, roles: ['admin', 'manager', 'cashier', 'staff'] },
    { key: 'customers', label: 'Customers', icon: HiOutlineUsers, roles: ['admin', 'manager', 'cashier'] },
    { key: 'invoices', label: 'Invoices', icon: HiOutlineDocumentText, roles: ['admin', 'manager', 'cashier'] },
    { key: 'payments', label: 'Payments', icon: HiOutlineCreditCard, roles: ['admin', 'manager', 'cashier'] },
    { key: 'deliveries', label: 'Deliveries', icon: HiOutlineTruck, roles: ['admin', 'manager', 'staff'] },
    { key: 'inventory', label: 'Inventory', icon: HiOutlineCube, roles: ['admin', 'manager'] },
];

const Dashboard = () => {
    const { user } = useAuth();
    const { currency } = useSettings();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabKey>('overview');
    const [stats, setStats] = useState<any>(null);
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const [statsRes, ordersRes] = await Promise.all([
                    api.get('/orders/stats/dashboard'),
                    api.get('/orders', { params: { limit: 8 } }),
                ]);
                setStats(statsRes.data.data);
                setRecentOrders(ordersRes.data.data);
            } catch {
                // fallback to empty
            } finally {
                setLoading(false);
            }
        };
        fetchDashboard();
    }, []);

    // Filter tabs based on user role
    const visibleTabs = tabConfig.filter(
        (tab) => user && tab.roles.includes(user.role)
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const kpiCards = [
        { label: "Today's Orders", value: stats?.todayOrders || 0, icon: HiOutlineShoppingCart, gradient: 'from-cyan-500 to-blue-600', bg: 'bg-cyan-500' },
        { label: "Today's Revenue", value: `${currency}${(stats?.todayRevenue || 0).toLocaleString()}`, icon: HiOutlineCurrencyRupee, gradient: 'from-emerald-500 to-green-600', bg: 'bg-emerald-500' },
        { label: 'Pending', value: stats?.pendingOrders || 0, icon: HiOutlineClock, gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-500' },
        { label: 'Completed', value: stats?.completedOrders || 0, icon: HiOutlineCheckCircle, gradient: 'from-purple-500 to-violet-600', bg: 'bg-purple-500' },
    ];

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

    const renderOverview = () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Orders */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-900">Recent Orders</h2>
                    <button onClick={() => setActiveTab('orders')} className="text-xs text-cyan-600 hover:text-cyan-700">View All →</button>
                </div>
                {recentOrders.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-sm">No orders yet. Create your first order!</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-xs text-slate-500 uppercase border-b border-slate-200">
                                    <th className="px-5 py-2.5 text-left">Order</th>
                                    <th className="px-5 py-2.5 text-left">Customer</th>
                                    <th className="px-5 py-2.5 text-right">Amount</th>
                                    <th className="px-5 py-2.5 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.map((o) => (
                                    <tr key={o._id} className="border-b border-slate-200 hover:bg-white transition-colors cursor-pointer"
                                        onClick={() => navigate(`/orders/${o._id}`)}>
                                        <td className="px-5 py-3">
                                            <span className="text-sm text-cyan-600 font-medium">{o.orderId}</span>
                                            <p className="text-xs text-slate-500">{new Date(o.createdAt).toLocaleDateString()}</p>
                                        </td>
                                        <td className="px-5 py-3 text-sm text-slate-900">{o.customer?.name}</td>
                                        <td className="px-5 py-3 text-right text-sm text-slate-900 font-medium">{currency}{o.totalAmount?.toLocaleString()}</td>
                                        <td className="px-5 py-3 text-center">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border capitalize ${statusColors[o.status] || ''}`}>
                                                {o.status?.replace('-', ' ')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Quick Stats */}
            <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <HiOutlineUsers className="w-4 h-4 text-cyan-600" /> Total Customers
                    </h3>
                    <p className="text-3xl font-bold text-slate-900">{stats?.totalCustomers || 0}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <HiOutlineCurrencyRupee className="w-4 h-4 text-emerald-400" /> Total Revenue
                    </h3>
                    <p className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
                        {currency}{(stats?.totalRevenue || 0).toLocaleString()}
                    </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <HiOutlineShoppingCart className="w-4 h-4 text-purple-400" /> Total Orders
                    </h3>
                    <p className="text-3xl font-bold text-slate-900">{stats?.totalOrders || 0}</p>
                </div>
            </div>
        </div>
    );

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return renderOverview();
            case 'orders':
                return <Orders />;
            case 'customers':
                return <Customers />;
            case 'invoices':
                return <Invoices />;
            case 'payments':
                return <Payments />;
            case 'deliveries':
                return <Deliveries />;
            case 'inventory':
                return <Inventory />;
            default:
                return renderOverview();
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Welcome Banner */}
            <div className="rounded-2xl bg-gradient-to-r from-cyan-600/30 to-blue-600/30 border border-cyan-200 p-6">
                <h1 className="text-2xl font-bold text-slate-900">{greeting}, {user?.name?.split(' ')[0]} 👋</h1>
                <p className="text-slate-600 mt-1 text-sm">Here's what's happening at Peninsula Laundries today.</p>
                <div className="flex gap-3 mt-4">
                    <button onClick={() => navigate('/orders/new')}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-md shadow-cyan-500/30">
                        <HiOutlinePlusCircle className="w-4 h-4" /> New Order
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpiCards.map((kpi, i) => (
                    <div key={i} className="rounded-2xl border border-slate-200 bg-white backdrop-blur-sm p-5 hover:border-white/20 transition-colors">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500">{kpi.label}</p>
                                <p className="text-2xl font-bold text-slate-900 mt-1">{kpi.value}</p>
                            </div>
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${kpi.gradient} flex items-center justify-center shadow-lg`}>
                                <kpi.icon className="w-6 h-6 text-slate-900" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tab Bar */}
            <div className="rounded-2xl border border-slate-200 bg-white backdrop-blur-sm overflow-hidden">
                <div className="flex items-center gap-1 px-4 py-3 border-b border-slate-200 overflow-x-auto scrollbar-hide">
                    {visibleTabs.map((tab) => {
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${isActive
                                    ? 'bg-cyan-50 text-cyan-600 border border-cyan-200 shadow-lg shadow-cyan-500/10'
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-white'
                                    }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Tab Content */}
                <div className="p-5">
                    {renderTabContent()}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
