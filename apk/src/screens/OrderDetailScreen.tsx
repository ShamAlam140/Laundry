import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    StatusBar,
} from 'react-native';
import api from '../services/api';
import { useSettings } from '../context/SettingsContext';

const statusColors: Record<string, { bg: string; text: string; icon: string }> = {
    received: { bg: '#1e3a5f', text: '#60a5fa', icon: '📥' },
    washing: { bg: '#164e63', text: '#22d3ee', icon: '🫧' },
    packed: { bg: '#3b0764', text: '#c084fc', icon: '📦' },
    cancelled: { bg: '#450a0a', text: '#fca5a5', icon: '❌' },
};

const statusOrder = ['received', 'washing', 'packed'];

export default function OrderDetailScreen({ route, navigation }: any) {
    const { orderId } = route.params;
    const { currency } = useSettings();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrder();
    }, []);

    const fetchOrder = async () => {
        try {
            const res = await api.get(`/customer-portal/orders/${orderId}`);
            setOrder(res.data.data);
        } catch (err) {
            console.error('Failed to load order:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }}>
                <ActivityIndicator size="large" color="#06b6d4" />
            </View>
        );
    }

    if (!order) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }}>
                <Text style={{ color: '#64748b' }}>Order not found</Text>
            </View>
        );
    }

    const colors = statusColors[order.status] || { bg: '#1e293b', text: '#94a3b8', icon: '📋' };
    const currentStatusIndex = statusOrder.indexOf(order.status);

    return (
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

            {/* Header */}
            <View
                style={{
                    paddingHorizontal: 20,
                    paddingTop: 56,
                    paddingBottom: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#0f172a',
                }}
            >
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: '#1e293b',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 14,
                        borderWidth: 1,
                        borderColor: '#334155',
                    }}
                >
                    <Text style={{ color: '#06b6d4', fontSize: 18, fontWeight: '700' }}>←</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: '#f1f5f9' }}>{order.orderId}</Text>
                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                </View>
                <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.bg }}>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>
                        {order.status}
                    </Text>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Status Timeline */}
                <View
                    style={{
                        backgroundColor: '#1e293b',
                        marginHorizontal: 20,
                        marginTop: 12,
                        borderRadius: 20,
                        padding: 20,
                        borderWidth: 1,
                        borderColor: '#334155',
                    }}
                >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#94a3b8', marginBottom: 18, letterSpacing: 1, textTransform: 'uppercase' }}>
                        Order Progress
                    </Text>
                    {statusOrder.map((status, index) => {
                        const isActive = index <= currentStatusIndex && order.status !== 'cancelled';
                        const isCurrent = status === order.status;
                        const historyEntry = order.statusHistory?.find((h: any) => h.status === status);
                        const sColors = statusColors[status] || { bg: '#1e293b', text: '#94a3b8', icon: '📋' };

                        return (
                            <View key={status} style={{ flexDirection: 'row', marginBottom: 2 }}>
                                {/* Timeline dot + line */}
                                <View style={{ alignItems: 'center', marginRight: 16, width: 28 }}>
                                    <View
                                        style={{
                                            width: isCurrent ? 22 : 14,
                                            height: isCurrent ? 22 : 14,
                                            borderRadius: 11,
                                            backgroundColor: isActive ? sColors.text : '#334155',
                                            borderWidth: isCurrent ? 3 : 0,
                                            borderColor: isCurrent ? sColors.bg : 'transparent',
                                        }}
                                    />
                                    {index < statusOrder.length - 1 && (
                                        <View
                                            style={{
                                                width: 2,
                                                height: 32,
                                                backgroundColor: isActive ? '#06b6d4' : '#334155',
                                            }}
                                        />
                                    )}
                                </View>
                                {/* Label */}
                                <View style={{ flex: 1, paddingBottom: 16 }}>
                                    <Text
                                        style={{
                                            fontSize: 14,
                                            textTransform: 'capitalize',
                                            fontWeight: isCurrent ? '700' : '500',
                                            color: isActive ? '#f1f5f9' : '#475569',
                                        }}
                                    >
                                        {status}
                                    </Text>
                                    {historyEntry && (
                                        <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                            {new Date(historyEntry.timestamp).toLocaleString('en-IN', {
                                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Items */}
                <View
                    style={{
                        backgroundColor: '#1e293b',
                        marginHorizontal: 20,
                        marginTop: 10,
                        borderRadius: 20,
                        padding: 20,
                        borderWidth: 1,
                        borderColor: '#334155',
                    }}
                >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#94a3b8', marginBottom: 14, letterSpacing: 1, textTransform: 'uppercase' }}>
                        Items ({order.items?.length || 0})
                    </Text>
                    {order.items?.map((item: any, index: number) => (
                        <View
                            key={index}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingVertical: 12,
                                borderBottomWidth: index < order.items.length - 1 ? 1 : 0,
                                borderBottomColor: '#334155',
                            }}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '600' }}>{item.serviceName}</Text>
                                <Text style={{ color: '#64748b', fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>
                                    {item.serviceType?.replace('-', ' ')} • {item.quantity} {item.unit}
                                </Text>
                            </View>
                            <Text style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '700' }}>{currency}{Number(item.subtotal || 0).toFixed(2)}</Text>
                        </View>
                    ))}
                </View>

                {/* Amount Breakdown */}
                <View
                    style={{
                        backgroundColor: '#1e293b',
                        marginHorizontal: 20,
                        marginTop: 10,
                        borderRadius: 20,
                        padding: 20,
                        borderWidth: 1,
                        borderColor: '#334155',
                    }}
                >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#94a3b8', marginBottom: 14, letterSpacing: 1, textTransform: 'uppercase' }}>
                        Amount Details
                    </Text>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                        <Text style={{ color: '#64748b', fontSize: 14 }}>Subtotal</Text>
                        <Text style={{ color: '#94a3b8', fontSize: 14 }}>{currency}{Number(order.subtotal || 0).toFixed(2)}</Text>
                    </View>
                    {order.taxAmount > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                            <Text style={{ color: '#64748b', fontSize: 14 }}>Tax ({order.taxPercent}%)</Text>
                            <Text style={{ color: '#94a3b8', fontSize: 14 }}>{currency}{Number(order.taxAmount || 0).toFixed(2)}</Text>
                        </View>
                    )}
                    {order.discountAmount > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                            <Text style={{ color: '#4ade80', fontSize: 14 }}>Discount ({order.discountPercent}%)</Text>
                            <Text style={{ color: '#4ade80', fontSize: 14 }}>-{currency}{Number(order.discountAmount || 0).toFixed(2)}</Text>
                        </View>
                    )}
                    {order.serviceCharge > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                            <Text style={{ color: '#64748b', fontSize: 14 }}>Service Charge</Text>
                            <Text style={{ color: '#94a3b8', fontSize: 14 }}>{currency}{Number(order.serviceCharge || 0).toFixed(2)}</Text>
                        </View>
                    )}
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            paddingVertical: 12,
                            marginTop: 8,
                            borderTopWidth: 1,
                            borderTopColor: '#334155',
                        }}
                    >
                        <Text style={{ color: '#f1f5f9', fontSize: 18, fontWeight: '800' }}>Total</Text>
                        <Text style={{ color: '#06b6d4', fontSize: 18, fontWeight: '800' }}>{currency}{Number(order.totalAmount || 0).toFixed(2)}</Text>
                    </View>

                    {/* Payment Status */}
                    {order.invoice && (
                        <View
                            style={{
                                marginTop: 12,
                                paddingTop: 12,
                                borderTopWidth: 1,
                                borderTopColor: '#334155',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}
                        >
                            <Text style={{ color: '#64748b', fontSize: 12 }}>Payment Status</Text>
                            <View
                                style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    borderRadius: 8,
                                    backgroundColor: order.invoice.paymentStatus === 'paid' ? '#14532d'
                                        : order.invoice.paymentStatus === 'partial' ? '#451a03' : '#450a0a',
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 11,
                                        fontWeight: '700',
                                        textTransform: 'capitalize',
                                        color: order.invoice.paymentStatus === 'paid' ? '#4ade80'
                                            : order.invoice.paymentStatus === 'partial' ? '#fbbf24' : '#fca5a5',
                                    }}
                                >
                                    {order.invoice.paymentStatus}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Special Instructions */}
                {order.specialInstructions ? (
                    <View
                        style={{
                            backgroundColor: '#1e293b',
                            marginHorizontal: 20,
                            marginTop: 10,
                            borderRadius: 20,
                            padding: 20,
                            borderWidth: 1,
                            borderColor: '#334155',
                        }}
                    >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#94a3b8', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' }}>
                            Special Instructions
                        </Text>
                        <Text style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 20 }}>{order.specialInstructions}</Text>
                    </View>
                ) : null}

                {/* Deliveries */}
                {order.deliveries?.length > 0 && (
                    <View
                        style={{
                            backgroundColor: '#1e293b',
                            marginHorizontal: 20,
                            marginTop: 10,
                            borderRadius: 20,
                            padding: 20,
                            borderWidth: 1,
                            borderColor: '#334155',
                        }}
                    >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#94a3b8', marginBottom: 14, letterSpacing: 1, textTransform: 'uppercase' }}>
                            Deliveries
                        </Text>
                        {order.deliveries.map((d: any) => (
                            <View
                                key={d._id}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    paddingVertical: 10,
                                    borderBottomWidth: 1,
                                    borderBottomColor: '#334155',
                                }}
                            >
                                <View>
                                    <Text style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '600', textTransform: 'capitalize' }}>
                                        {d.type}
                                    </Text>
                                    <Text style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                                        {new Date(d.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        {d.scheduledTime ? ` • ${d.scheduledTime}` : ''}
                                    </Text>
                                </View>
                                <View
                                    style={{
                                        paddingHorizontal: 10,
                                        paddingVertical: 4,
                                        borderRadius: 8,
                                        backgroundColor: d.status === 'completed' ? '#14532d' : d.status === 'in-transit' ? '#164e63' : '#1e293b',
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 11,
                                            fontWeight: '600',
                                            textTransform: 'capitalize',
                                            color: d.status === 'completed' ? '#4ade80' : d.status === 'in-transit' ? '#22d3ee' : '#94a3b8',
                                        }}
                                    >
                                        {d.status}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                <View style={{ height: 32 }} />
            </ScrollView>
        </View>
    );
}
