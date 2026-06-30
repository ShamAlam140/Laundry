import { useState, useEffect } from 'react';
import api from '../services/api';
import { useSettings } from '../context/SettingsContext';
import toast from 'react-hot-toast';

const RefundAnalytics = () => {
    const { currency } = useSettings();
    const [analytics, setAnalytics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        fetchAnalytics();
    }, [startDate, endDate]);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const params: any = {};
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            
            const res = await api.get('/refunds/reports/analytics', { params });
            setAnalytics(res.data.data);
        } catch (err) {
            toast.error('Failed to load analytics');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!analytics) return null;

    return (
        <div className="space-y-6 animate-fadeIn">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Refund Analytics</h1>
                <p className="text-sm text-slate-500 mt-1">Track and analyze refund patterns</p>
            </div>

            {/* Date Filters */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-base font-semibold text-slate-900 mb-4">Filter by Date Range</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-slate-600 mb-2">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-600 mb-2">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500"
                        />
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-6">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm text-slate-600">Total Refunds</h3>
                        <span className="text-2xl">📊</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">{analytics.totalRefunds || 0}</p>
                    <p className="text-xs text-slate-500 mt-1">Refund transactions</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-red-50 to-orange-50 p-6">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm text-slate-600">Total Amount</h3>
                        <span className="text-2xl">💰</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">
                        {currency}{(analytics.totalRefundAmount || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Refunded to customers</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-6">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm text-slate-600">Refund Rate</h3>
                        <span className="text-2xl">📈</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">{(analytics.refundRate || 0).toFixed(2)}%</p>
                    <p className="text-xs text-slate-500 mt-1">Of total order value</p>
                </div>
            </div>

            {/* Refund by Reason */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-base font-semibold text-slate-900 mb-4">Refunds by Reason</h2>
                {!analytics.refundByReason || analytics.refundByReason.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">No refund data available</p>
                ) : (
                    <div className="space-y-4">
                        {analytics.refundByReason.map((item: any, idx: number) => {
                            const maxAmount = Math.max(...analytics.refundByReason.map((r: any) => r.amount || 0));
                            const percentage = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
                            
                            return (
                                <div key={idx}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-medium text-slate-700">
                                                {item._id ? String(item._id).replace(/_/g, ' ') : 'Unknown'}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                {item.count || 0} refund{(item.count || 0) > 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        <span className="text-sm font-semibold text-slate-900">
                                            {currency}{(item.amount || 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-500"
                                            style={{ width: `${percentage}%` }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Refund by Item Type */}
            {analytics.refundByItemType && analytics.refundByItemType.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                    <h2 className="text-base font-semibold text-slate-900 mb-4">Refunds by Item Type</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {analytics.refundByItemType.map((item: any, idx: number) => (
                            <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-slate-700">
                                            {item._id ? String(item._id).replace(/_/g, ' ') : 'Unknown'}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {item.count || 0} item{(item.count || 0) > 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    <p className="text-lg font-bold text-slate-900">
                                        {currency}{(item.amount || 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Top Refunded Items */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-base font-semibold text-slate-900 mb-4">Top Refunded Items</h2>
                {!analytics.topRefundedItems || analytics.topRefundedItems.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">No item data available</p>
                ) : (
                    <div className="space-y-3">
                        {analytics.topRefundedItems.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-cyan-200 hover:bg-cyan-50/30 transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center text-cyan-600 font-bold text-sm">
                                        #{idx + 1}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-900">{item._id || 'Unknown Item'}</p>
                                        <p className="text-xs text-slate-500">
                                            Refunded {item.frequency || 0} time{(item.frequency || 0) > 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-slate-900">
                                        {currency}{(item.totalAmount || 0).toLocaleString()}
                                    </p>
                                    <p className="text-xs text-slate-500">Total refunded</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RefundAnalytics;
