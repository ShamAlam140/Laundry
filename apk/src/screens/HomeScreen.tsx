import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    StatusBar,
    Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import api from '../services/api';

interface Summary {
    totalOrders: number;
    activeOrders: number;
    completedOrders: number;
    totalInvoices: number;
    unpaidBalance: number;
    recentOrders: any[];
    unreadNotifications?: number;
}

const statusColors: Record<string, { bg: string; text: string; icon: string }> = {
    received: { bg: '#1e3a5f', text: '#60a5fa', icon: '📥' },
    washing: { bg: '#164e63', text: '#22d3ee', icon: '🫧' },
    packed: { bg: '#3b0764', text: '#c084fc', icon: '📦' },
    cancelled: { bg: '#450a0a', text: '#fca5a5', icon: '❌' },
};

export default function HomeScreen({ navigation }: any) {
    const { customer } = useAuth();
    const { currency } = useSettings();
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchSummary = async () => {
        try {
            const res = await api.get('/customer-portal/summary');
            setSummary(res.data.data);
        } catch (err) {
            console.error('Failed to load summary:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchSummary();
        }, [])
    );

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' }}>
                <ActivityIndicator size="large" color="#06b6d4" />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            <ScrollView
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); fetchSummary(); }}
                        tintColor="#06b6d4"
                        colors={['#06b6d4']}
                    />
                }
            >
                <LinearGradient
                    colors={['#0e7490', '#000000']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 60 }}
                >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View>
                            <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '800' }}>Peninsula</Text>
                            <Text style={{ color: '#06b6d4', fontSize: 22, fontWeight: '800' }}>Laundries</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity 
                                onPress={() => navigation.navigate('Notifications')}
                                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', position: 'relative' }}
                            >
                                <Text style={{ fontSize: 20 }}>🔔</Text>
                                {(summary?.unreadNotifications || 0) > 0 && (
                                    <View style={{ position: 'absolute', top: -2, right: -2, backgroundColor: '#ef4444', borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                                        <Text style={{ color: '#ffffff', fontSize: 9, fontWeight: '700' }}>{summary?.unreadNotifications}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => navigation.navigate('Profile')}
                                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
                            >
                                <Text style={{ fontSize: 20 }}>👤</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View style={{ marginTop: 24 }}>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Welcome back,</Text>
                        <Text style={{ color: '#ffffff', fontSize: 28, fontWeight: '800', marginTop: 4 }}>
                            {customer?.name} 👋
                        </Text>
                    </View>
                </LinearGradient>

                <View style={{ paddingHorizontal: 20, marginTop: -40 }}>
                    {/* Hero Action */}
                    <TouchableOpacity
                        onPress={() => navigation.navigate('CreateOrder')}
                        activeOpacity={0.9}
                        style={{ marginBottom: 24 }}
                    >
                        <LinearGradient
                            colors={['#0369a1', '#082f49']}
                            style={{
                                borderRadius: 24,
                                padding: 24,
                                height: 160,
                                justifyContent: 'space-between',
                                shadowColor: '#06b6d4',
                                shadowOffset: { width: 0, height: 10 },
                                shadowOpacity: 0.3,
                                shadowRadius: 20,
                                elevation: 8,
                            }}
                        >
                            <View>
                                <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '800' }}>Fresh Clothes{'\n'}Made Easy</Text>
                                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 6 }}>Schedule a pickup in seconds</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 }}>
                                <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>Order Now</Text>
                                <Text style={{ color: '#ffffff', fontSize: 14 }}>→</Text>
                            </View>
                            <View style={{ position: 'absolute', right: 20, bottom: 10, opacity: 0.7 }}>
                                <Text style={{ fontSize: 80 }}>🧺</Text>
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Quick Task Row */}
                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                        {[
                            { label: 'Track', icon: '📍', screen: 'Orders', color: '#60a5fa' },
                            { label: 'Invoices', icon: '🧾', screen: 'Invoices', color: '#c084fc' },
                            { label: 'Support', icon: '📞', screen: 'Profile', color: '#f472b6' },
                        ].map((btn, i) => (
                            <TouchableOpacity
                                key={i}
                                onPress={() => navigation.navigate(btn.screen)}
                                style={{
                                    flex: 1,
                                    backgroundColor: '#1A1A1A',
                                    borderRadius: 24,
                                    paddingVertical: 24,
                                    paddingHorizontal: 8,
                                    alignItems: 'center',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.2,
                                    shadowRadius: 8,
                                    elevation: 3,
                                }}
                            >
                                <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                                    <Text style={{ fontSize: 26 }}>{btn.icon}</Text>
                                </View>
                                <Text style={{ color: '#f1f5f9', fontWeight: '700', fontSize: 13 }}>{btn.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>


                    {/* How it Works / Process */}
                    <View
                        style={{
                            backgroundColor: '#1A1A1A',
                            borderRadius: 24,
                            padding: 20,
                            marginBottom: 16,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.1,
                            shadowRadius: 8,
                            elevation: 3,
                        }}
                    >
                        <Text style={{ color: '#f1f5f9', fontSize: 13, fontWeight: '700', marginBottom: 14, letterSpacing: 1, textTransform: 'uppercase' }}>
                            How it works
                        </Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            {[
                                { step: '1', title: 'Order', icon: '📝' },
                                { step: '2', title: 'Pickup', icon: '🚚' },
                                { step: '3', title: 'Wash', icon: '🫧' },
                                { step: '4', title: 'Pay & Relax', icon: '✅' },
                            ].map((item, index) => (
                                <View key={index} style={{ alignItems: 'center', flex: 1 }}>
                                    <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                                        <Text style={{ fontSize: 22 }}>{item.icon}</Text>
                                    </View>
                                    <Text style={{ color: '#cbd5e1', fontSize: 11, fontWeight: '600' }}>{item.title}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Service Guarantee Banner */}
                    <View
                        style={{
                            backgroundColor: '#083344',
                            borderRadius: 24,
                            padding: 20,
                            marginBottom: 16,
                            flexDirection: 'row',
                            alignItems: 'center',
                            overflow: 'hidden',
                        }}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '800' }}>Premium Service</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>
                                Professional care for your clothes. 100% satisfaction guaranteed.
                            </Text>
                        </View>
                        <Text style={{ fontSize: 32, opacity: 0.8 }}>🌟</Text>
                    </View>

                    {/* Stats Row */}
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                        {[
                            { label: 'Active', value: summary?.activeOrders || 0, color: '#06b6d4' },
                            { label: 'Completed', value: summary?.completedOrders || 0, color: '#22c55e' },
                            { label: 'Total', value: summary?.totalOrders || 0, color: '#f8fafc' },
                        ].map((stat, i) => (
                            <View
                                key={i}
                                style={{
                                    flex: 1,
                                    backgroundColor: '#121212',
                                    borderRadius: 24,
                                    padding: 16,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.1,
                                    shadowRadius: 8,
                                    elevation: 3,
                                }}
                            >
                                <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 }}>
                                    {stat.label}
                                </Text>
                                <Text style={{ color: stat.color, fontSize: 28, fontWeight: '800', marginTop: 4 }}>
                                    {stat.value}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Unpaid Balance */}
                    {(summary?.unpaidBalance || 0) > 0 && (
                        <View
                            style={{
                                backgroundColor: '#451a03',
                                borderRadius: 24,
                                padding: 20,
                                marginBottom: 16,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                shadowColor: '#fbbf24',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.1,
                                shadowRadius: 8,
                                elevation: 3,
                            }}
                        >
                            <View>
                                <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 }}>
                                    OUTSTANDING BALANCE
                                </Text>
                                <Text style={{ color: '#fcd34d', fontSize: 24, fontWeight: '800', marginTop: 4 }}>
                                    {currency}{summary?.unpaidBalance?.toFixed(2)}
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Recent Orders */}
                    <View style={{ marginTop: 8 }}>
                        <Text style={{ color: '#f1f5f9', fontSize: 18, fontWeight: '700', marginBottom: 14 }}>
                            Recent Orders
                        </Text>
                        {summary?.recentOrders?.length === 0 ? (
                            <View
                                style={{
                                    backgroundColor: '#121212',
                                    borderRadius: 24,
                                    padding: 40,
                                    alignItems: 'center',
                                }}
                            >
                                <Text style={{ fontSize: 40, marginBottom: 12 }}>📦</Text>
                                <Text style={{ color: '#64748b', fontSize: 14 }}>No orders yet</Text>
                            </View>
                        ) : (
                            summary?.recentOrders?.map((order: any) => {
                                const colors = statusColors[order.status] || { bg: '#121212', text: '#94a3b8', icon: '📋' };
                                return (
                                    <View
                                        key={order._id}
                                        style={{
                                            backgroundColor: '#121212',
                                            borderRadius: 24,
                                            padding: 20,
                                            marginBottom: 12,
                                        }}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                <Text style={{ fontSize: 20 }}>{colors.icon}</Text>
                                                <View>
                                                    <Text style={{ color: '#f1f5f9', fontWeight: '700', fontSize: 15 }}>
                                                        {order.orderId}
                                                    </Text>
                                                    <Text style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                                                        {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <View
                                                    style={{
                                                        paddingHorizontal: 10,
                                                        paddingVertical: 4,
                                                        borderRadius: 10,
                                                        backgroundColor: colors.bg,
                                                    }}
                                                >
                                                    <Text
                                                        style={{
                                                            color: colors.text,
                                                            fontSize: 11,
                                                            fontWeight: '700',
                                                            textTransform: 'capitalize',
                                                        }}
                                                    >
                                                        {order.status}
                                                    </Text>
                                                </View>
                                                <Text style={{ color: '#f1f5f9', fontWeight: '800', fontSize: 15, marginTop: 6 }}>
                                                    {currency}{Number(order.totalAmount || 0).toFixed(2)}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </View>
                </View>

                <View style={{ height: 24 }} />
            </ScrollView>
        </View>
    );
}
