import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useSettings } from '../context/SettingsContext';

const statusColors: Record<string, { bg: string; text: string; icon: string }> = {
    received: { bg: '#1e3a5f', text: '#60a5fa', icon: '📥' },
    washing: { bg: '#164e63', text: '#22d3ee', icon: '🫧' },
    packed: { bg: '#3b0764', text: '#c084fc', icon: '📦' },
    cancelled: { bg: '#450a0a', text: '#fca5a5', icon: '❌' },
};

const statusFilters = [
    { label: 'All', value: '' },
    { label: 'Active', value: 'active' },
    { label: 'Packed', value: 'packed' },
];

export default function OrdersScreen({ navigation }: any) {
    const { currency } = useSettings();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState('');

    const fetchOrders = async (filter = '') => {
        try {
            const params: any = { limit: 50 };
            if (filter && filter !== 'active') params.status = filter;
            const res = await api.get('/customer-portal/orders', { params });
            let data = res.data.data;
            if (filter === 'active') {
                data = data.filter((o: any) => !['packed', 'cancelled'].includes(o.status));
            }
            setOrders(data);
        } catch (err) {
            console.error('Failed to load orders:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchOrders(activeFilter);
        }, [activeFilter])
    );

    const renderOrder = ({ item }: any) => {
        const colors = statusColors[item.status] || { bg: '#1e293b', text: '#94a3b8', icon: '📋' };
        const itemCount = item.items?.length || 0;

        return (
            <TouchableOpacity
                onPress={() => navigation.navigate('OrderDetail', { orderId: item._id })}
                style={{
                    backgroundColor: '#1e293b',
                    borderRadius: 20,
                    padding: 16,
                    marginBottom: 10,
                    marginHorizontal: 20,
                    borderWidth: 1,
                    borderColor: '#334155',
                }}
                activeOpacity={0.7}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={{ fontSize: 20 }}>{colors.icon}</Text>
                        <Text style={{ color: '#f1f5f9', fontWeight: '700', fontSize: 16 }}>{item.orderId}</Text>
                    </View>
                    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: colors.bg }}>
                        <Text style={{ color: colors.text, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }}>
                            {item.status}
                        </Text>
                    </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View>
                        <Text style={{ color: '#64748b', fontSize: 12 }}>
                            {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Text>
                        <Text style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>
                            {itemCount} item{itemCount !== 1 ? 's' : ''}
                        </Text>
                    </View>
                    <Text style={{ color: '#f1f5f9', fontWeight: '800', fontSize: 18 }}>{currency}{Number(item.totalAmount || 0).toFixed(2)}</Text>
                </View>

                {item.deliveryDate && (
                    <View
                        style={{
                            marginTop: 10,
                            paddingTop: 10,
                            borderTopWidth: 1,
                            borderTopColor: '#334155',
                            flexDirection: 'row',
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{ color: '#64748b', fontSize: 12 }}>📅 Delivery: </Text>
                        <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600' }}>
                            {new Date(item.deliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }}>
                <ActivityIndicator size="large" color="#06b6d4" />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            {/* Header */}
            <View style={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, backgroundColor: '#0f172a', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <View>
                    <Text style={{ fontSize: 26, fontWeight: '800', color: '#f1f5f9' }}>My Orders</Text>
                    <Text style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>Track your laundry orders</Text>
                </View>
                <TouchableOpacity
                    onPress={() => navigation.navigate('CreateOrder')}
                    style={{
                        backgroundColor: '#06b6d4',
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 10,
                    }}
                >
                    <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}>+ New</Text>
                </TouchableOpacity>
            </View>

            {/* Filters */}
            <View style={{ paddingHorizontal: 20, paddingVertical: 8 }}>
                <FlatList
                    data={statusFilters}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.value}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => setActiveFilter(item.value)}
                            style={{
                                marginRight: 8,
                                paddingHorizontal: 16,
                                paddingVertical: 8,
                                borderRadius: 12,
                                backgroundColor: activeFilter === item.value ? '#06b6d4' : '#1e293b',
                                borderWidth: 1,
                                borderColor: activeFilter === item.value ? '#06b6d4' : '#334155',
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 13,
                                    fontWeight: '600',
                                    color: activeFilter === item.value ? '#ffffff' : '#64748b',
                                }}
                            >
                                {item.label}
                            </Text>
                        </TouchableOpacity>
                    )}
                />
            </View>

            {/* Order List */}
            <FlatList
                data={orders}
                renderItem={renderOrder}
                keyExtractor={(item) => item._id}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); fetchOrders(activeFilter); }}
                        tintColor="#06b6d4"
                        colors={['#06b6d4']}
                    />
                }
                contentContainerStyle={{ paddingTop: 4, paddingBottom: 20 }}
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
                        <Text style={{ fontSize: 40, marginBottom: 12 }}>📦</Text>
                        <Text style={{ color: '#64748b', fontSize: 15 }}>No orders found</Text>
                    </View>
                }
            />
        </View>
    );
}
