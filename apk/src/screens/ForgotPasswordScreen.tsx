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
import api from '../services/api';

export default function ForgotPasswordScreen({ navigation }: any) {
    const [phone, setPhone] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleReset = async () => {
        if (!phone) {
            Alert.alert('Error', 'Please enter your phone number');
            return;
        }

        setIsLoading(true);
        try {
            const res = await api.post('/customer-auth/forgot-password', { phone });
            Alert.alert('Success', res.data.message || 'Your password has been reset to the default.', [
                { text: 'OK', onPress: () => navigation.navigate('Login') }
            ]);
        } catch (err: any) {
            Alert.alert('Reset Failed', err.response?.data?.message || 'An error occurred while resetting your password');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                    {/* Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 20 }}>
                        <TouchableOpacity 
                            onPress={() => navigation.goBack()}
                            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Text style={{ color: '#ffffff', fontSize: 24, lineHeight: 28 }}>‹</Text>
                        </TouchableOpacity>
                        <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '600', marginLeft: 16 }}>Forgot Password</Text>
                    </View>

                    <View style={{ paddingHorizontal: 24, paddingVertical: 20 }}>
                        <View style={{ alignItems: 'center', marginBottom: 32 }}>
                            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(6, 182, 212, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                                <Text style={{ fontSize: 32 }}>🤔</Text>
                            </View>
                            <Text style={{ fontSize: 24, fontWeight: '800', color: '#ffffff', textAlign: 'center', marginBottom: 12 }}>
                                Reset Password
                            </Text>
                            <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 22 }}>
                                Enter your phone number below. If an account exists, your password will be reset to the default password.
                            </Text>
                        </View>

                        <View style={{ backgroundColor: '#121212', padding: 24, borderRadius: 24 }}>
                            <View style={{ marginBottom: 32 }}>
                                <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 8, letterSpacing: 1 }}>PHONE NUMBER</Text>
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: 'rgba(255,255,255,0.05)',
                                        borderRadius: 12,
                                        paddingHorizontal: 16,
                                        paddingVertical: 12,
                                    }}
                                >
                                    <Text style={{ fontSize: 18, marginRight: 10, color: '#64748b' }}>📱</Text>
                                    <TextInput
                                        style={{ flex: 1, color: '#ffffff', fontSize: 16, paddingVertical: 0 }}
                                        placeholder="Enter your phone number"
                                        placeholderTextColor="#475569"
                                        value={phone}
                                        onChangeText={setPhone}
                                        keyboardType="phone-pad"
                                    />
                                </View>
                            </View>

                            <TouchableOpacity onPress={handleReset} disabled={isLoading} activeOpacity={0.8}>
                                <LinearGradient
                                    colors={isLoading ? ['#475569', '#262626'] : ['#06b6d4', '#0ea5e9']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={{ paddingVertical: 16, borderRadius: 100, alignItems: 'center' }}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="#ffffff" />
                                    ) : (
                                        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16 }}>Reset Password</Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
