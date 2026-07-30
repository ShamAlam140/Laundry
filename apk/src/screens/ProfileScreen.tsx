import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StatusBar, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function ProfileScreen() {
    const { customer, logout } = useAuth();
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [isChanging, setIsChanging] = useState(false);

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: logout },
        ]);
    };

    const handleChangePassword = async () => {
        if (!oldPassword || !newPassword) {
            Alert.alert('Error', 'Please enter both old and new passwords.');
            return;
        }
        setIsChanging(true);
        try {
            await api.put('/customer-auth/change-password', { oldPassword, newPassword });
            Alert.alert('Success', 'Your password has been changed successfully.');
            setShowChangePassword(false);
            setOldPassword('');
            setNewPassword('');
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to change password.');
        } finally {
            setIsChanging(false);
        }
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
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />

            {/* Profile Header */}
            <LinearGradient
                colors={['#0e7490', '#000000']}
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
                        backgroundColor: '#121212',
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
                                borderBottomColor: 'rgba(255,255,255,0.05)',
                            }}
                        >
                            <View
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 12,
                                    backgroundColor: '#000000',
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

                {/* Security Card */}
                <View
                    style={{
                        backgroundColor: '#121212',
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
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#94a3b8', marginBottom: 16, letterSpacing: 1, textTransform: 'uppercase' }}>
                        Security
                    </Text>
                    <TouchableOpacity
                        onPress={() => setShowChangePassword(true)}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 14,
                        }}
                    >
                        <View
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 12,
                                backgroundColor: '#000000',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: 14,
                            }}
                        >
                            <Text style={{ fontSize: 18 }}>🔒</Text>
                        </View>
                        <Text style={{ color: '#f1f5f9', fontSize: 15, fontWeight: '600', flex: 1 }}>
                            Change Password
                        </Text>
                        <Text style={{ color: '#64748b', fontSize: 18 }}>›</Text>
                    </TouchableOpacity>
                </View>

                {/* Help & Support Card */}
                <View
                    style={{
                        backgroundColor: '#121212',
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
                                borderBottomColor: 'rgba(255,255,255,0.05)',
                            }}
                        >
                            <View
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 12,
                                    backgroundColor: '#000000',
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
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            borderRadius: 100,
                            padding: 18,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 32,
                            marginTop: 10,
                        }}
                    >
                        <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 }}>Logout</Text>
                    </View>
                </TouchableOpacity>
            </ScrollView>

            {/* Change Password Modal */}
            <Modal
                visible={showChangePassword}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowChangePassword(false)}
            >
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
                        <View style={{ backgroundColor: '#121212', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>Change Password</Text>
                                <TouchableOpacity onPress={() => setShowChangePassword(false)}>
                                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                        <Text style={{ color: '#ffffff', fontSize: 16 }}>✕</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>

                            <View style={{ marginBottom: 16 }}>
                                <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 8 }}>OLD PASSWORD</Text>
                                <TextInput
                                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#ffffff', borderRadius: 12, padding: 16, fontSize: 16 }}
                                    secureTextEntry
                                    placeholder="Enter old password"
                                    placeholderTextColor="#475569"
                                    value={oldPassword}
                                    onChangeText={setOldPassword}
                                />
                            </View>

                            <View style={{ marginBottom: 32 }}>
                                <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 8 }}>NEW PASSWORD</Text>
                                <TextInput
                                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#ffffff', borderRadius: 12, padding: 16, fontSize: 16 }}
                                    secureTextEntry
                                    placeholder="Enter new password"
                                    placeholderTextColor="#475569"
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                />
                            </View>

                            <TouchableOpacity onPress={handleChangePassword} disabled={isChanging} activeOpacity={0.8}>
                                <LinearGradient
                                    colors={isChanging ? ['#475569', '#262626'] : ['#06b6d4', '#0ea5e9']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={{ paddingVertical: 16, borderRadius: 100, alignItems: 'center' }}
                                >
                                    {isChanging ? (
                                        <ActivityIndicator color="#ffffff" />
                                    ) : (
                                        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16 }}>Change Password</Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}
