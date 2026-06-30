import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen() {
    const { customer, logout } = useAuth();

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: logout },
        ]);
    };

    const fields = [
        { label: 'Customer ID', value: customer?.customerId, icon: '🏷️' },
        { label: 'Name', value: customer?.name, icon: '👤' },
        { label: 'Phone', value: customer?.phone, icon: '📱' },
        { label: 'Email', value: customer?.email || 'Not set', icon: '✉️' },
        { label: 'Address', value: customer?.address || 'Not set', icon: '📍' },
        { label: 'Type', value: customer?.customerType, icon: '🏢' },
    ];

    return (
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

            {/* Profile Header */}
            <LinearGradient
                colors={['#0e7490', '#0284c7', '#0f172a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40, alignItems: 'center' }}
            >
                <View
                    style={{
                        width: 88,
                        height: 88,
                        borderRadius: 44,
                        backgroundColor: 'rgba(255,255,255,0.15)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 14,
                        borderWidth: 3,
                        borderColor: 'rgba(255,255,255,0.2)',
                    }}
                >
                    <Text style={{ fontSize: 36, color: '#ffffff', fontWeight: '800' }}>
                        {customer?.name?.charAt(0)?.toUpperCase()}
                    </Text>
                </View>
                <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '800' }}>{customer?.name}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4 }}>{customer?.customerId}</Text>
            </LinearGradient>

            <ScrollView style={{ flex: 1, paddingHorizontal: 20, marginTop: -16 }}>
                {/* Profile Details Card */}
                <View
                    style={{
                        backgroundColor: '#1e293b',
                        borderRadius: 20,
                        padding: 20,
                        borderWidth: 1,
                        borderColor: '#334155',
                        marginBottom: 16,
                    }}
                >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#94a3b8', marginBottom: 16, letterSpacing: 1, textTransform: 'uppercase' }}>
                        Profile Details
                    </Text>
                    {fields.map((f, i) => (
                        <View
                            key={i}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 14,
                                borderBottomWidth: i < fields.length - 1 ? 1 : 0,
                                borderBottomColor: '#334155',
                            }}
                        >
                            <View
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 12,
                                    backgroundColor: '#0f172a',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 14,
                                }}
                            >
                                <Text style={{ fontSize: 18 }}>{f.icon}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 }}>
                                    {f.label}
                                </Text>
                                <Text style={{ color: '#f1f5f9', fontSize: 15, fontWeight: '600', marginTop: 2, textTransform: 'capitalize' }}>
                                    {f.value}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Help & Support Card */}
                <View
                    style={{
                        backgroundColor: '#1e293b',
                        borderRadius: 20,
                        padding: 20,
                        borderWidth: 1,
                        borderColor: '#334155',
                        marginBottom: 16,
                    }}
                >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#94a3b8', marginBottom: 16, letterSpacing: 1, textTransform: 'uppercase' }}>
                        Help & Support
                    </Text>
                    {[
                        { label: 'Contact Support', icon: '✉️', action: () => Alert.alert('Support', 'Please email us at jspcorporationptyltd@gmail.com for any assistance.') },
                        { label: 'FAQ', icon: '❓', action: () => Alert.alert('FAQ', 'Check our FAQ for common questions about service, pricing, and timing.') },
                        { label: 'Privacy Policy', icon: '🛡️', action: () => Alert.alert('Privacy', 'Your data is secured and never shared with third parties.') },
                    ].map((item, i) => (
                        <TouchableOpacity
                            key={i}
                            onPress={item.action}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 14,
                                borderBottomWidth: i < 2 ? 1 : 0,
                                borderBottomColor: '#334155',
                            }}
                        >
                            <View
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 12,
                                    backgroundColor: '#0f172a',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 14,
                                }}
                            >
                                <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                            </View>
                            <Text style={{ color: '#f1f5f9', fontSize: 15, fontWeight: '600', flex: 1 }}>
                                {item.label}
                            </Text>
                            <Text style={{ color: '#64748b', fontSize: 18 }}>›</Text>
                        </TouchableOpacity>
                    ))}
                </View>


                {/* Logout Button */}
                <TouchableOpacity onPress={handleLogout} activeOpacity={0.8}>
                    <View
                        style={{
                            backgroundColor: '#1e293b',
                            borderRadius: 16,
                            padding: 16,
                            borderWidth: 1,
                            borderColor: '#7f1d1d',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 32,
                        }}
                    >
                        <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 16 }}>🚪 Logout</Text>
                    </View>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
