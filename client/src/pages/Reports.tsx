import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useSettings } from '../context/SettingsContext';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { HiOutlineCalendar, HiOutlineCurrencyRupee, HiOutlineShoppingCart, HiOutlineUsers } from 'react-icons/hi';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

type Tab = 'sales' | 'orders' | 'customers' | 'staff';

const tabConfig: { key: Tab; label: string; icon: any }[] = [
    { key: 'sales', label: 'Sales', icon: HiOutlineCurrencyRupee },
    { key: 'orders', label: 'Orders', icon: HiOutlineShoppingCart },
    { key: 'customers', label: 'Customers', icon: HiOutlineUsers },
    { key: 'staff', label: 'Staff', icon: HiOutlineCalendar },
];

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 12 } } },
    },
    scales: {
        x: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
    },
};

const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const, labels: { color: '#94a3b8', padding: 15, font: { size: 12 } } } },
};

const Reports = () => {
    const [activeTab, setActiveTab] = useState<Tab>('sales');
    const { currency } = useSettings();
    const [salesData, setSalesData] = useState<any>(null);
    const [ordersData, setOrdersData] = useState<any>(null);
    const [customersData, setCustomersData] = useState<any>(null);
    const [staffData, setStaffData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [period, setPeriod] = useState('daily');

    const fetchReport = async (tab: Tab) => {
        try {
            setLoading(true);
            const params: any = {};
            if (tab === 'sales') params.period = period;
            const res = await api.get(`/reports/${tab}`, { params });
            switch (tab) {
                case 'sales': setSalesData(res.data.data); break;
                case 'orders': setOrdersData(res.data.data); break;
                case 'customers': setCustomersData(res.data.data); break;
                case 'staff': setStaffData(res.data.data); break;
            }
        } catch {
            toast.error('Failed to load report');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchReport(activeTab); }, [activeTab, period]);

    const renderSales = () => {
        if (!salesData) return null;
        const { revenueOverTime, serviceRevenue, summary } = salesData;

        const revenueChart = {
            labels: revenueOverTime.map((d: any) => d._id),
            datasets: [
                {
                    label: `Revenue (${currency})`,
                    data: revenueOverTime.map((d: any) => d.revenue),
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6,182,212,0.15)',
                    fill: true,
                    tension: 0.4,
                },
                {
                    label: 'Orders',
                    data: revenueOverTime.map((d: any) => d.orders),
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139,92,246,0.15)',
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y',
                },
            ],
        };

        const serviceChart = {
            labels: serviceRevenue.map((d: any) => d._id?.replace('-', ' ') || 'Other'),
            datasets: [{
                data: serviceRevenue.map((d: any) => d.revenue),
                backgroundColor: ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6'],
                borderWidth: 0,
            }],
        };

        return (
            <div className="space-y-6">
                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <p className="text-sm text-slate-500">Total Revenue</p>
                        <p className="text-2xl font-bold text-cyan-600 mt-1">{currency}{summary.totalRevenue?.toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <p className="text-sm text-slate-500">Total Orders</p>
                        <p className="text-2xl font-bold text-purple-400 mt-1">{summary.totalOrders}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <p className="text-sm text-slate-500">Avg Order Value</p>
                        <p className="text-2xl font-bold text-emerald-400 mt-1">{currency}{Math.round(summary.avgOrderValue || 0).toLocaleString()}</p>
                    </div>
                </div>

                {/* Period selector */}
                <div className="flex gap-2">
                    {['daily', 'monthly', 'yearly'].map((p) => (
                        <button key={p} onClick={() => setPeriod(p)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${period === p ? 'bg-cyan-500 text-slate-900' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                                }`}>{p}</button>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Revenue chart */}
                    <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
                        <h3 className="text-sm font-semibold text-slate-900 mb-4">Revenue Over Time</h3>
                        <div className="h-72"><Line data={revenueChart} options={chartOptions as any} /></div>
                    </div>
                    {/* Service breakdown */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <h3 className="text-sm font-semibold text-slate-900 mb-4">Revenue by Service</h3>
                        <div className="h-72"><Doughnut data={serviceChart} options={doughnutOptions} /></div>
                    </div>
                </div>
            </div>
        );
    };

    const renderOrders = () => {
        if (!ordersData) return null;
        const { statusDistribution, delayedOrders, ordersPerDay } = ordersData;

        const statusChart = {
            labels: statusDistribution.map((d: any) => d._id?.replace('-', ' ') || 'Unknown'),
            datasets: [{
                data: statusDistribution.map((d: any) => d.count),
                backgroundColor: ['#06b6d4', '#3b82f6', '#f59e0b', '#8b5cf6', '#f97316', '#10b981', '#059669', '#ef4444'],
                borderWidth: 0,
            }],
        };

        const dailyChart = {
            labels: ordersPerDay.map((d: any) => d._id.slice(5)),
            datasets: [{
                label: 'Orders',
                data: ordersPerDay.map((d: any) => d.count),
                backgroundColor: 'rgba(6,182,212,0.6)',
                borderRadius: 6,
            }],
        };

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Status distribution */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <h3 className="text-sm font-semibold text-slate-900 mb-4">Status Distribution</h3>
                        <div className="h-72"><Doughnut data={statusChart} options={doughnutOptions} /></div>
                    </div>
                    {/* Orders per day */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <h3 className="text-sm font-semibold text-slate-900 mb-4">Orders per Day (Last 30 Days)</h3>
                        <div className="h-72"><Bar data={dailyChart} options={chartOptions as any} /></div>
                    </div>
                </div>

                {/* Delayed orders */}
                {delayedOrders.length > 0 && (
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
                        <h3 className="text-sm font-semibold text-red-400 mb-4">⚠️ Delayed Orders ({delayedOrders.length})</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-xs text-slate-500 uppercase border-b border-slate-200">
                                        <th className="px-4 py-2 text-left">Order</th>
                                        <th className="px-4 py-2 text-left">Customer</th>
                                        <th className="px-4 py-2 text-left">Status</th>
                                        <th className="px-4 py-2 text-left">Due Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {delayedOrders.map((o: any) => (
                                        <tr key={o._id} className="border-b border-slate-200">
                                            <td className="px-4 py-2 text-sm text-cyan-600">{o.orderId}</td>
                                            <td className="px-4 py-2 text-sm text-slate-900">{o.customer?.name}</td>
                                            <td className="px-4 py-2 text-sm text-red-400 capitalize">{o.status.replace('-', ' ')}</td>
                                            <td className="px-4 py-2 text-sm text-slate-500">{new Date(o.deliveryDate).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderCustomers = () => {
        if (!customersData) return null;
        const { topCustomers, typeDistribution, outstandingBalances } = customersData;

        const typeChart = {
            labels: typeDistribution.map((d: any) => d._id || 'Unknown'),
            datasets: [{
                data: typeDistribution.map((d: any) => d.count),
                backgroundColor: ['#06b6d4', '#8b5cf6'],
                borderWidth: 0,
            }],
        };

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Top customers */}
                    <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-200">
                            <h3 className="text-sm font-semibold text-slate-900">🏆 Top 10 Customers by Revenue</h3>
                        </div>
                        <table className="w-full">
                            <thead>
                                <tr className="text-xs text-slate-500 uppercase border-b border-slate-200">
                                    <th className="px-5 py-2 text-left">#</th>
                                    <th className="px-5 py-2 text-left">Customer</th>
                                    <th className="px-5 py-2 text-center">Orders</th>
                                    <th className="px-5 py-2 text-right">Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topCustomers.map((c: any, i: number) => (
                                    <tr key={i} className="border-b border-slate-200">
                                        <td className="px-5 py-2.5 text-sm font-bold text-amber-400">{i + 1}</td>
                                        <td className="px-5 py-2.5">
                                            <span className="text-sm text-slate-900">{c.name}</span>
                                            <span className="text-xs text-slate-500 ml-2 capitalize">{c.customerType}</span>
                                        </td>
                                        <td className="px-5 py-2.5 text-center text-sm text-slate-600">{c.totalOrders}</td>
                                        <td className="px-5 py-2.5 text-right text-sm text-emerald-400 font-medium">{currency}{c.totalSpent?.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Type distribution */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <h3 className="text-sm font-semibold text-slate-900 mb-4">Customer Types</h3>
                        <div className="h-64"><Doughnut data={typeChart} options={doughnutOptions} /></div>
                    </div>
                </div>

                {/* Outstanding balances */}
                {outstandingBalances.length > 0 && (
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
                        <div className="px-5 py-4 border-b border-amber-500/10">
                            <h3 className="text-sm font-semibold text-amber-400">💰 Outstanding Balances</h3>
                        </div>
                        <table className="w-full">
                            <thead>
                                <tr className="text-xs text-slate-500 uppercase border-b border-slate-200">
                                    <th className="px-5 py-2 text-left">Customer</th>
                                    <th className="px-5 py-2 text-center">Invoices</th>
                                    <th className="px-5 py-2 text-right">Due</th>
                                </tr>
                            </thead>
                            <tbody>
                                {outstandingBalances.map((b: any, i: number) => (
                                    <tr key={i} className="border-b border-slate-200">
                                        <td className="px-5 py-2.5 text-sm text-slate-900">{b.name} <span className="text-xs text-slate-500">({b.customerId})</span></td>
                                        <td className="px-5 py-2.5 text-center text-sm text-slate-600">{b.invoiceCount}</td>
                                        <td className="px-5 py-2.5 text-right text-sm text-red-400 font-medium">{currency}{b.totalDue?.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    const renderStaff = () => {
        if (!staffData) return null;
        const { staffPerformance, ordersCreated, avgProcessingTime, overallTurnaround } = staffData;

        const createdChart = {
            labels: ordersCreated.map((d: any) => d.name),
            datasets: [
                {
                    label: 'Orders Created',
                    data: ordersCreated.map((d: any) => d.ordersCreated),
                    backgroundColor: 'rgba(6,182,212,0.6)',
                    borderRadius: 6,
                },
                {
                    label: `Revenue (${currency})`,
                    data: ordersCreated.map((d: any) => d.revenue),
                    backgroundColor: 'rgba(139,92,246,0.6)',
                    borderRadius: 6,
                },
            ],
        };

        return (
            <div className="space-y-6">
                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <p className="text-sm text-slate-500">Avg Turnaround Time</p>
                        <p className="text-2xl font-bold text-cyan-600 mt-1">{overallTurnaround?.avgTurnaroundHours || 0}h</p>
                        <p className="text-xs text-slate-400 mt-1">Received → Packed</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <p className="text-sm text-slate-500">Total Packed</p>
                        <p className="text-2xl font-bold text-emerald-500 mt-1">{overallTurnaround?.totalDelivered || 0}</p>
                        <p className="text-xs text-slate-400 mt-1">Completed orders</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <p className="text-sm text-slate-500">Active Staff</p>
                        <p className="text-2xl font-bold text-purple-500 mt-1">{staffPerformance?.length || 0}</p>
                        <p className="text-xs text-slate-400 mt-1">With order activity</p>
                    </div>
                </div>

                {/* Bar chart */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4">Orders Created per Staff</h3>
                    <div className="h-72"><Bar data={createdChart} options={chartOptions as any} /></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Staff performance table */}
                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-200">
                            <h3 className="text-sm font-semibold text-slate-900">Staff Activity (Status Updates)</h3>
                        </div>
                        <table className="w-full">
                            <thead>
                                <tr className="text-xs text-slate-500 uppercase border-b border-slate-200">
                                    <th className="px-5 py-2 text-left">Staff</th>
                                    <th className="px-5 py-2 text-left">Role</th>
                                    <th className="px-5 py-2 text-center">Orders</th>
                                    <th className="px-5 py-2 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {staffPerformance.map((s: any, i: number) => (
                                    <tr key={i} className="border-b border-slate-200">
                                        <td className="px-5 py-2.5 text-sm text-slate-900 font-medium">{s.name}</td>
                                        <td className="px-5 py-2.5 text-sm text-slate-500 capitalize">{s.role}</td>
                                        <td className="px-5 py-2.5 text-center text-sm text-cyan-600 font-medium">{s.ordersProcessed}</td>
                                        <td className="px-5 py-2.5 text-center text-sm text-slate-600">{s.actionsCount}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Average Processing Time table */}
                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-200">
                            <h3 className="text-sm font-semibold text-slate-900">⏱️ Avg Processing Time per Staff</h3>
                        </div>
                        {avgProcessingTime?.length > 0 ? (
                            <table className="w-full">
                                <thead>
                                    <tr className="text-xs text-slate-500 uppercase border-b border-slate-200">
                                        <th className="px-5 py-2 text-left">Staff</th>
                                        <th className="px-5 py-2 text-left">Role</th>
                                        <th className="px-5 py-2 text-center">Orders</th>
                                        <th className="px-5 py-2 text-center">Avg Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {avgProcessingTime.map((s: any, i: number) => (
                                        <tr key={i} className="border-b border-slate-200">
                                            <td className="px-5 py-2.5 text-sm text-slate-900 font-medium">{s.name}</td>
                                            <td className="px-5 py-2.5 text-sm text-slate-500 capitalize">{s.role}</td>
                                            <td className="px-5 py-2.5 text-center text-sm text-slate-600">{s.ordersHandled}</td>
                                            <td className="px-5 py-2.5 text-center">
                                                <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${s.avgProcessingTimeHours <= 2 ? 'bg-emerald-50 text-emerald-600' :
                                                    s.avgProcessingTimeHours <= 8 ? 'bg-amber-50 text-amber-600' :
                                                        'bg-red-50 text-red-600'
                                                    }`}>
                                                    {s.avgProcessingTimeHours}h
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="text-center py-8 text-slate-400 text-sm">No packed orders yet</div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
                {tabConfig.map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => setActiveTab(key)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${activeTab === key
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
                            : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                            }`}>
                        <Icon className="w-4 h-4" /> {label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <>
                    {activeTab === 'sales' && renderSales()}
                    {activeTab === 'orders' && renderOrders()}
                    {activeTab === 'customers' && renderCustomers()}
                    {activeTab === 'staff' && renderStaff()}
                </>
            )}
        </div>
    );
};

export default Reports;
