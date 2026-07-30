import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    StatusBar,
    ScrollView
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ForceChangePasswordScreen() {
    const { customer, setCustomer, logout } = useAuth();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'New password and confirm password do not match');
            return;
        }

        if (newPassword.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters long');
            return;
        }

        setIsLoading(true);
        try {
            const res = await api.put('/customer-auth/change-password', {
                oldPassword: currentPassword,
                newPassword: newPassword,
            });
            
            // Update token if returned
            if (res.data.token) {
                await AsyncStorage.setItem('customerToken', res.data.token);
            }

            // Update customer context so AppNavigator redirects to MainTab
            if (customer) {
                const updatedCustomer = { ...customer, mustChangePassword: false };
                await AsyncStorage.setItem('customerData', JSON.stringify(updatedCustomer));
                setCustomer(updatedCustomer);
            }
        } catch (err: any) {
            Alert.alert('Change Failed', err.response?.data?.message || 'Invalid current password');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
                    <View style={{ paddingHorizontal: 24, paddingVertical: 40 }}>
                        <View style={{ alignItems: 'center', marginBottom: 40 }}>
                            <Text style={{ fontSize: 48, marginBottom: 16 }}>🔒</Text>
                            <Text style={{ fontSize: 24, fontWeight: '800', color: '#ffffff', textAlign: 'center', marginBottom: 8 }}>
                                Action Required
                            </Text>
                            <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 22 }}>
                                For your security, please change your default password before accessing your account.
                            </Text>
                        </View>

                        <View style={{ backgroundColor: '#121212', padding: 24, borderRadius: 24 }}>
                            <View style={{ marginBottom: 16 }}>
                                <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 8, letterSpacing: 1 }}>CURRENT PASSWORD</Text>
                                <TextInput
                                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#ffffff', borderRadius: 12, padding: 16, fontSize: 16 }}
                                    secureTextEntry
                                    placeholder="Enter your current password"
                                    placeholderTextColor="#475569"
                                    value={currentPassword}
                                    onChangeText={setCurrentPassword}
                                />
                            </View>

                            <View style={{ marginBottom: 16 }}>
                                <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 8, letterSpacing: 1 }}>NEW PASSWORD</Text>
                                <TextInput
                                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#ffffff', borderRadius: 12, padding: 16, fontSize: 16 }}
                                    secureTextEntry
                                    placeholder="Enter new password (min 6 chars)"
                                    placeholderTextColor="#475569"
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                />
                            </View>

                            <View style={{ marginBottom: 32 }}>
                                <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 8, letterSpacing: 1 }}>CONFIRM NEW PASSWORD</Text>
                                <TextInput
                                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#ffffff', borderRadius: 12, padding: 16, fontSize: 16 }}
                                    secureTextEntry
                                    placeholder="Confirm new password"
                                    placeholderTextColor="#475569"
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                />
                            </View>

                            <TouchableOpacity onPress={handleChangePassword} disabled={isLoading} activeOpacity={0.8}>
                                <LinearGradient
                                    colors={isLoading ? ['#475569', '#262626'] : ['#06b6d4', '#0ea5e9']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={{ paddingVertical: 16, borderRadius: 100, alignItems: 'center' }}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="#ffffff" />
                                    ) : (
                                        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16 }}>Update Password</Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={logout} style={{ marginTop: 24, alignItems: 'center' }}>
                                <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '600' }}>Cancel & Logout</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
