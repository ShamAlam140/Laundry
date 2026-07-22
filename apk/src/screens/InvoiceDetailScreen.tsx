import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, Platform } from 'react-native';
import api from '../services/api';
import { useSettings } from '../context/SettingsContext';

export default function InvoiceDetailScreen({ route, navigation }: any) {
    const { invoiceId, fromCycle } = route.params || {};
    const { currency } = useSettings();
    const [invoice, setInvoice] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get(`/customer-portal/invoices/${invoiceId}`);
                setInvoice(res.data.data);
            } catch { }
            finally { setLoading(false); }
        })();
    }, []);

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' }}>
                <ActivityIndicator size="large" color="#06b6d4" />
            </View>
        );
    }
    if (!invoice) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' }}>
                <Text style={{ color: '#64748b' }}>Invoice not found</Text>
            </View>
        );
    }

    const psColor = invoice.paymentStatus === 'paid' ? '#4ade80' : invoice.paymentStatus === 'partial' ? '#fbbf24' : '#fca5a5';
    const psBg = invoice.paymentStatus === 'paid' ? '#14532d' : invoice.paymentStatus === 'partial' ? '#451a03' : '#450a0a';

    return (
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />

            {/* Header */}
            <View
                style={{
                    paddingHorizontal: 20,
                    paddingTop: 56,
                    paddingBottom: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                }}
            >
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: '#121212',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 14,
                        borderWidth: 1,
                        borderColor: '#262626',
                    }}
                >
                    <Text style={{ color: '#06b6d4', fontSize: 18, fontWeight: '700' }}>←</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: '#f1f5f9' }}>{invoice.invoiceId}</Text>
                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        {new Date(invoice.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                </View>
                <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: psBg }}>
                    <Text style={{ color: psColor, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>
                        {invoice.paymentStatus}
                    </Text>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Amount Card */}
                <View
                    style={{
                        backgroundColor: '#121212',
                        marginHorizontal: 20,
                        marginTop: 12,
                        borderRadius: 20,
                        padding: 20,
                        borderWidth: 1,
                        borderColor: '#262626',
                    }}
                >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#94a3b8', marginBottom: 14, letterSpacing: 1, textTransform: 'uppercase' }}>
                        Amount Summary
                    </Text>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                        <Text style={{ color: '#64748b', fontSize: 14 }}>Subtotal</Text>
                        <Text style={{ color: '#94a3b8', fontSize: 14 }}>{currency}{Number(invoice.subtotal || 0).toFixed(2)}</Text>
                    </View>
                    {invoice.taxAmount > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                            <Text style={{ color: '#64748b', fontSize: 14 }}>Tax</Text>
                            <Text style={{ color: '#94a3b8', fontSize: 14 }}>{currency}{Number(invoice.taxAmount || 0).toFixed(2)}</Text>
                        </View>
                    )}
                    {invoice.discountAmount > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                            <Text style={{ color: '#4ade80', fontSize: 14 }}>Discount</Text>
                            <Text style={{ color: '#4ade80', fontSize: 14 }}>-{currency}{Number(invoice.discountAmount || 0).toFixed(2)}</Text>
                        </View>
                    )}
                    {invoice.serviceCharge > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                            <Text style={{ color: '#64748b', fontSize: 14 }}>Service Charge</Text>
                            <Text style={{ color: '#94a3b8', fontSize: 14 }}>{currency}{Number(invoice.serviceCharge || 0).toFixed(2)}</Text>
                        </View>
                    )}

                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            paddingVertical: 12,
                            marginTop: 8,
                            borderTopWidth: 1,
                            borderTopColor: '#262626',
                        }}
                    >
                        <Text style={{ color: '#f1f5f9', fontSize: 18, fontWeight: '800' }}>Total</Text>
                        <Text style={{ color: '#06b6d4', fontSize: 18, fontWeight: '800' }}>{currency}{Number(invoice.totalAmount || 0).toFixed(2)}</Text>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                        <Text style={{ color: '#64748b', fontSize: 14 }}>Paid</Text>
                        <Text style={{ color: '#4ade80', fontSize: 14, fontWeight: '600' }}>{currency}{Number(invoice.paidAmount || 0).toFixed(2)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                        <Text style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '700' }}>Balance Due</Text>
                        <Text
                            style={{
                                fontSize: 16,
                                fontWeight: '800',
                                color: invoice.balanceDue > 0 ? '#fca5a5' : '#4ade80',
                            }}
                        >
                            {currency}{Number(invoice.balanceDue || 0).toFixed(2)}
                        </Text>
                    </View>
                    {(invoice.terms || invoice.dueDate) && invoice.balanceDue > 0 && (
                        <View
                            style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                paddingVertical: 8,
                                marginTop: 6,
                                borderTopWidth: 1,
                                borderTopColor: 'rgba(255,255,255,0.05)',
                                alignItems: 'center',
                            }}
                        >
                            <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '600' }}>PAYMENT TERM</Text>
                            <Text style={{ color: '#fca5a5', fontSize: 13, fontWeight: '700' }}>
                                {invoice.terms ? `${invoice.terms}` : `Due: ${new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Payment History */}
                <View
                    style={{
                        backgroundColor: '#121212',
                        marginHorizontal: 20,
                        marginTop: 10,
                        borderRadius: 20,
                        padding: 20,
                        borderWidth: 1,
                        borderColor: '#262626',
                    }}
                >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#94a3b8', marginBottom: 14, letterSpacing: 1, textTransform: 'uppercase' }}>
                        Payment History
                    </Text>
                    {invoice.payments?.length === 0 ? (
                        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                            <Text style={{ fontSize: 32, marginBottom: 8 }}>💳</Text>
                            <Text style={{ color: '#475569', fontSize: 14 }}>No payments recorded</Text>
                        </View>
                    ) : (
                        invoice.payments?.map((p: any) => (
                            <View
                                key={p._id}
                                style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    paddingVertical: 12,
                                    borderBottomWidth: 1,
                                    borderBottomColor: '#262626',
                                }}
                            >
                                <View>
                                    <Text style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '600', textTransform: 'capitalize' }}>
                                        {p.paymentMethod?.replace('-', ' ')}
                                    </Text>
                                    <Text style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                                        {new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </View>
                                <Text style={{ color: '#4ade80', fontSize: 15, fontWeight: '700' }}>+{currency}{Number(p.amount || 0).toFixed(2)}</Text>
                            </View>
                        ))
                    )}
                </View>

                {/* Offline Payment Information */}
                <View
                    style={{
                        backgroundColor: 'rgba(6, 182, 212, 0.1)',
                        marginHorizontal: 20,
                        marginTop: 10,
                        borderRadius: 20,
                        padding: 20,
                        borderWidth: 1,
                        borderColor: '#06b6d4',
                        flexDirection: 'row',
                        gap: 14,
                    }}
                >
                    <Text style={{ fontSize: 24 }}>ℹ️</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: '#06b6d4', fontSize: 14, fontWeight: '800', marginBottom: 4 }}>OFFLINE PAYMENT INFO</Text>
                        <Text style={{ color: '#94a3b8', fontSize: 13, lineHeight: 18 }}>
                            Payments are collected offline at the time of pickup or delivery. You can pay via <Text style={{ color: '#f1f5f9', fontWeight: '700' }}>Cash</Text> to our service partner.
                        </Text>
                    </View>
                </View>

                {/* ── View / Download PDF ── */}
                {!fromCycle && (
                    <View
                        style={{
                            marginHorizontal: 20,
                            marginTop: 10,
                            marginBottom: 8,
                        }}
                    >
                        <TouchableOpacity
                            onPress={() =>
                                navigation.navigate('InvoicePreview', { invoice })
                            }
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 10,
                                backgroundColor: '#0e7490',
                                borderRadius: 16,
                                paddingVertical: 16,
                                borderWidth: 1,
                                borderColor: '#06b6d4',
                            }}
                        >
                            <Text style={{ fontSize: 20 }}>📄</Text>
                            <View>
                                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                                    View &amp; Download PDF
                                </Text>
                                <Text style={{ color: '#a5f3fc', fontSize: 11, marginTop: 1 }}>
                                    Preview invoice · Share or Save
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={{ height: Platform.OS === 'ios' ? 32 : 20 }} />

            </ScrollView>
        </View>
    );
}
