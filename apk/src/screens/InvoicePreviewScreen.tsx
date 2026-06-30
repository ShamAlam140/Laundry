import React, { useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
    Platform,
    Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import RNPrint from 'react-native-print';
import { generateInvoiceHTML, generateBatchInvoiceHTML } from '../utils/invoiceHTML';
import { useSettings } from '../context/SettingsContext';

export default function InvoicePreviewScreen({ route, navigation }: any) {
    const { invoice, invoices, cycleLabel, periodStart, periodEnd } = route.params || {};
    const { currency } = useSettings();
    const webviewRef = useRef<any>(null);
    const [loading, setLoading] = useState(true);
    const [printing, setPrinting] = useState(false);

    const html = invoices && invoices.length > 0
        ? generateBatchInvoiceHTML(invoices, currency, cycleLabel || 'Cycle', periodStart, periodEnd)
        : generateInvoiceHTML(invoice, currency);

    const handlePrint = async () => {
        setPrinting(true);
        try {
            await RNPrint.print({ html });
        } catch (err: any) {
            Alert.alert('Print Failed', err?.message || 'Something went wrong.');
        } finally {
            setPrinting(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

            {/* ── Header ── */}
            <View
                style={{
                    paddingHorizontal: 20,
                    paddingTop: 52,
                    paddingBottom: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#0f172a',
                    borderBottomWidth: 1,
                    borderBottomColor: '#1e293b',
                }}
            >
                {/* Back */}
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

                {/* Title */}
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 17, fontWeight: '800', color: '#f1f5f9' }}>
                        {invoices && invoices.length > 0 ? 'Invoices Report' : 'Invoice Preview'}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
                        {invoices && invoices.length > 0 ? `${invoices.length} Invoices (${cycleLabel || 'Batch'})` : (invoice?.invoiceId || invoice?.invoiceNumber || '')}
                    </Text>
                </View>

                {/* Print / Save PDF button */}
                <TouchableOpacity
                    onPress={handlePrint}
                    disabled={printing}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: '#0e7490',
                        paddingHorizontal: 16,
                        paddingVertical: 9,
                        borderRadius: 12,
                        opacity: printing ? 0.6 : 1,
                    }}
                >
                    {printing ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={{ fontSize: 16 }}>🖨️</Text>
                    )}
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                        {printing ? 'Opening…' : 'Print / PDF'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* ── WebView ── */}
            <View style={{ flex: 1, backgroundColor: '#f1f5f9' }}>
                {loading && (
                    <View
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10,
                            backgroundColor: '#f1f5f9',
                        }}
                    >
                        <ActivityIndicator size="large" color="#0e7490" />
                        <Text style={{ color: '#64748b', marginTop: 12, fontSize: 13 }}>
                            Loading invoice…
                        </Text>
                    </View>
                )}
                <WebView
                    ref={webviewRef}
                    source={{ html }}
                    style={{ flex: 1 }}
                    onLoadEnd={() => setLoading(false)}
                    originWhitelist={['*']}
                    scalesPageToFit={true}
                    showsVerticalScrollIndicator={false}
                />
            </View>

            {/* ── Bottom action bar ── */}
            <View
                style={{
                    flexDirection: 'row',
                    gap: 12,
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
                    backgroundColor: '#0f172a',
                    borderTopWidth: 1,
                    borderTopColor: '#1e293b',
                }}
            >
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={{
                        flex: 1,
                        paddingVertical: 14,
                        borderRadius: 14,
                        alignItems: 'center',
                        backgroundColor: '#1e293b',
                        borderWidth: 1,
                        borderColor: '#334155',
                    }}
                >
                    <Text style={{ color: '#94a3b8', fontWeight: '700', fontSize: 14 }}>← Close</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handlePrint}
                    disabled={printing}
                    style={{
                        flex: 2,
                        paddingVertical: 14,
                        borderRadius: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 8,
                        backgroundColor: printing ? '#0e7490aa' : '#0e7490',
                    }}
                >
                    {printing ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={{ fontSize: 16 }}>⬇️</Text>
                    )}
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                        {printing ? 'Opening…' : 'Save as PDF / Print'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
