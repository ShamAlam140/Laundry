import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, StatusBar } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useSettings } from '../context/SettingsContext';

const psColors: Record<string, { bg: string; text: string; icon: string }> = {
    paid: { bg: '#14532d', text: '#4ade80', icon: '✅' },
    partial: { bg: '#451a03', text: '#fbbf24', icon: '⏳' },
    unpaid: { bg: '#450a0a', text: '#fca5a5', icon: '⚠️' },
};

export default function InvoicesScreen({ navigation }: any) {
    const { currency } = useSettings();
    const [invoices, setInvoices] = useState<any[]>([]);
    const [cycleData, setCycleData] = useState<{
        frequency: string;
        frequencyLabel: string;
        startDate: string | null;
        endDate: string | null;
        invoices: any[];
    } | null>(null);
    const [activeTab, setActiveTab] = useState<'all' | 'cycle'>('all');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        try {
            const [allRes, cycleRes] = await Promise.all([
                api.get('/customer-portal/invoices', { params: { limit: 50 } }),
                api.get('/customer-portal/invoices/filtered')
            ]);
            setInvoices(allRes.data.data);
            setCycleData(cycleRes.data.data);
        } catch (error) {
            console.error('Error fetching invoices:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchData(); }, []));

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }}>
                <ActivityIndicator size="large" color="#06b6d4" />
            </View>
        );
    }

    const currentInvoicesList = activeTab === 'all' ? invoices : (cycleData?.invoices || []);

    const handlePrintAll = () => {
        if (currentInvoicesList.length === 0) return;
        navigation.navigate('InvoicePreview', {
            invoices: currentInvoicesList,
            cycleLabel: activeTab === 'cycle' ? (cycleData?.frequencyLabel || 'Cycle') : 'All Invoices',
            periodStart: activeTab === 'cycle' ? cycleData?.startDate : null,
            periodEnd: activeTab === 'cycle' ? cycleData?.endDate : null,
        });
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            <View style={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, backgroundColor: '#0f172a', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ fontSize: 26, fontWeight: '800', color: '#f1f5f9' }}>My Invoices</Text>
                    <Text style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>Track your laundry billing & payments</Text>
                </View>
                {currentInvoicesList.length > 0 && (
                    <TouchableOpacity
                        onPress={handlePrintAll}
                        style={{
                            backgroundColor: '#0e7490',
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 12,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 4,
                        }}
                    >
                        <Text style={{ fontSize: 14 }}>🖨️</Text>
                        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 12 }}>Print All</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Tabs Segmented Control */}
            <View style={{ flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, backgroundColor: '#1e293b', borderRadius: 14, padding: 4, borderWidth: 1, borderColor: '#334155' }}>
                <TouchableOpacity
                    onPress={() => setActiveTab('all')}
                    style={{
                        flex: 1,
                        paddingVertical: 10,
                        alignItems: 'center',
                        backgroundColor: activeTab === 'all' ? '#06b6d4' : 'transparent',
                        borderRadius: 10,
                    }}
                >
                    <Text style={{ color: activeTab === 'all' ? '#ffffff' : '#94a3b8', fontSize: 13, fontWeight: '700' }}>
                        All Invoices
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('cycle')}
                    style={{
                        flex: 1,
                        paddingVertical: 10,
                        alignItems: 'center',
                        backgroundColor: activeTab === 'cycle' ? '#06b6d4' : 'transparent',
                        borderRadius: 10,
                    }}
                >
                    <Text style={{ color: activeTab === 'cycle' ? '#ffffff' : '#94a3b8', fontSize: 13, fontWeight: '700' }}>
                        {cycleData && cycleData.frequency !== 'none' ? cycleData.frequencyLabel : 'Cycle Invoices'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Summary Banner */}
            {activeTab === 'all' ? (
                invoices.length > 0 && (
                    <View
                        style={{
                            marginHorizontal: 20,
                            marginBottom: 20,
                            padding: 20,
                            borderRadius: 24,
                            backgroundColor: '#1e293b',
                            borderWidth: 1,
                            borderColor: '#334155',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <View>
                            <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>Total Balance</Text>
                            <Text style={{ color: '#f1f5f9', fontSize: 24, fontWeight: '800', marginTop: 4 }}>
                                {currency}{invoices.reduce((sum, i) => sum + (i.balanceDue || 0), 0).toFixed(2)}
                            </Text>
                        </View>
                        <View style={{ backgroundColor: 'rgba(6, 182, 212, 0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}>
                            <Text style={{ color: '#06b6d4', fontSize: 13, fontWeight: '700' }}>
                                {invoices.filter(i => (i.balanceDue || 0) > 0).length} Pending
                            </Text>
                        </View>
                    </View>
                )
            ) : (
                cycleData && cycleData.frequency !== 'none' && cycleData.invoices.length > 0 && (
                    <View
                        style={{
                            marginHorizontal: 20,
                            marginBottom: 20,
                            padding: 20,
                            borderRadius: 24,
                            backgroundColor: '#111827',
                            borderWidth: 1,
                            borderColor: '#06b6d4',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <View>
                            <Text style={{ color: '#06b6d4', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>{cycleData.frequencyLabel} Total Due</Text>
                            <Text style={{ color: '#f1f5f9', fontSize: 24, fontWeight: '800', marginTop: 4 }}>
                                {currency}{cycleData.invoices.reduce((sum, i) => sum + (i.balanceDue || 0), 0).toFixed(2)}
                            </Text>
                        </View>
                        <View style={{ backgroundColor: 'rgba(6, 182, 212, 0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}>
                            <Text style={{ color: '#06b6d4', fontSize: 13, fontWeight: '700' }}>
                                {cycleData.invoices.filter(i => (i.balanceDue || 0) > 0).length} Pending
                            </Text>
                        </View>
                    </View>
                )
            )}

            {/* Active Cycle Period Info */}
            {activeTab === 'cycle' && cycleData && cycleData.frequency !== 'none' && cycleData.startDate && (
                <View
                    style={{
                        marginHorizontal: 20,
                        marginBottom: 16,
                        padding: 14,
                        borderRadius: 16,
                        backgroundColor: '#1e293b',
                        borderLeftWidth: 4,
                        borderLeftColor: '#06b6d4',
                    }}
                >
                    <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>Active Cycle Duration</Text>
                    <Text style={{ color: '#f1f5f9', fontSize: 13, fontWeight: '600', marginTop: 4 }}>
                        {new Date(cycleData.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - {new Date(cycleData.endDate || '').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                </View>
            )}

            <FlatList
                data={currentInvoicesList}
                keyExtractor={(i) => i._id}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); fetchData(); }}
                        tintColor="#06b6d4"
                        colors={['#06b6d4']}
                    />
                }
                contentContainerStyle={{ paddingTop: 8, paddingBottom: 20 }}
                ListEmptyComponent={
                    activeTab === 'cycle' && cycleData?.frequency === 'none' ? (
                        <View style={{ alignItems: 'center', paddingVertical: 40, marginHorizontal: 20, backgroundColor: '#1e293b', padding: 24, borderRadius: 24, borderWidth: 1, borderColor: '#334155' }}>
                            <Text style={{ fontSize: 44, marginBottom: 16 }}>🗓️</Text>
                            <Text style={{ color: '#f1f5f9', fontSize: 16, fontWeight: '800', textAlign: 'center' }}>No Active Billing Cycle</Text>
                            <Text style={{ color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 }}>
                                Your profile does not have a configured billing/reminder cycle. Please contact the store administrator to set your invoice reminder frequency.
                            </Text>
                        </View>
                    ) : (
                        <View style={{ alignItems: 'center', paddingVertical: 64 }}>
                            <Text style={{ fontSize: 40, marginBottom: 12 }}>🧾</Text>
                            <Text style={{ color: '#64748b', fontSize: 15 }}>
                                {activeTab === 'all' ? 'No invoices' : `No invoices in this ${cycleData?.frequencyLabel || 'cycle'}`}
                            </Text>
                        </View>
                    )
                }
                renderItem={({ item }) => {
                    const c = psColors[item.paymentStatus] || { bg: '#1e293b', text: '#94a3b8', icon: '📋' };
                    const isUnpaid = item.paymentStatus === 'unpaid' || item.paymentStatus === 'partial';

                    return (
                        <TouchableOpacity
                            onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: item._id, fromCycle: activeTab === 'cycle' })}
                            style={{
                                backgroundColor: isUnpaid ? '#111827' : '#1e293b',
                                borderRadius: 20,
                                padding: 18,
                                marginBottom: 12,
                                marginHorizontal: 20,
                                borderWidth: 1,
                                borderColor: isUnpaid ? '#ef4444' : '#334155',
                                shadowColor: isUnpaid ? '#ef4444' : '#000',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: isUnpaid ? 0.1 : 0,
                                shadowRadius: 10,
                                elevation: isUnpaid ? 3 : 0,
                            }}
                            activeOpacity={0.7}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isUnpaid ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                                        <Text style={{ fontSize: 18 }}>{c.icon}</Text>
                                    </View>
                                    <View>
                                        <Text style={{ color: '#f1f5f9', fontWeight: '700', fontSize: 15 }}>{item.invoiceId}</Text>
                                        <Text style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
                                            {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </Text>
                                    </View>
                                </View>
                                <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: c.bg }}>
                                    <Text style={{ color: c.text, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        {item.paymentStatus}
                                    </Text>
                                </View>
                            </View>
                            
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTopWidth: 1, borderTopColor: isUnpaid ? 'rgba(239, 68, 68, 0.1)' : '#334155' }}>
                                <View>
                                    <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '600' }}>Total Amount</Text>
                                    <Text style={{ color: '#f1f5f9', fontWeight: '800', fontSize: 20, marginTop: 2 }}>{currency}{Number(item.totalAmount || 0).toFixed(2)}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    {item.balanceDue > 0 ? (
                                        <>
                                            <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '700' }}>BALANCE DUE</Text>
                                            <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: '800', marginTop: 2 }}>{currency}{Number(item.balanceDue || 0).toFixed(2)}</Text>
                                        </>
                                    ) : (
                                        <Text style={{ color: '#4ade80', fontSize: 12, fontWeight: '700' }}>FULLY PAID</Text>
                                    )}
                                </View>
                            </View>

                            {isUnpaid && (
                                <View style={{ marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={{ fontSize: 12 }}>💳</Text>
                                        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '500' }}>Pay via Cash on delivery</Text>
                                    </View>
                                    {(item.terms || item.dueDate) && (
                                        <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                                            <Text style={{ color: '#fca5a5', fontSize: 10, fontWeight: '700' }}>
                                                {item.terms ? `Term: ${item.terms}` : `Due: ${new Date(item.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                }}
            />
        </View>
    );
}
