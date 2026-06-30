import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen({ navigation }: any) {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();

    const handleLogin = async () => {
        if (!phone || !password) {
            Alert.alert('Error', 'Please enter phone number and password');
            return;
        }
        setIsLoading(true);
        try {
            await login(phone, password);
        } catch (err: any) {
            Alert.alert('Login Failed', err.response?.data?.message || 'Invalid credentials');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGuestLogin = async () => {
        setIsLoading(true);
        try {
            await login('0400000000', 'guestpassword');
        } catch (err: any) {
            Alert.alert('Login Failed', err.response?.data?.message || 'Could not connect as guest');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={{ paddingHorizontal: 24, paddingVertical: 40 }}>
                        {/* Logo & Branding */}
                        <View style={{ alignItems: 'center', marginBottom: 40 }}>
                            <View
                                style={{
                                    width: 240,
                                    height: 90,
                                    borderRadius: 16,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 20,
                                    backgroundColor: '#ffffff',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.1,
                                    shadowRadius: 10,
                                    elevation: 5,
                                    overflow: 'hidden',
                                }}
                            >
                                <Image
                                    source={require('../../public/logo.png')}
                                    style={{ width: 220, height: 70 }}
                                    resizeMode="contain"
                                />
                            </View>
                            <Text style={{ fontSize: 28, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 }}>
                                Peninsula Laundries
                            </Text>
                            <Text style={{ fontSize: 14, color: '#64748b', marginTop: 6, letterSpacing: 2, textTransform: 'uppercase' }}>
                                Customer Portal
                            </Text>
                        </View>

                        {/* Login Card */}
                        <View
                            style={{
                                backgroundColor: '#1e293b',
                                borderRadius: 24,
                                padding: 24,
                                borderWidth: 1,
                                borderColor: '#334155',
                            }}
                        >
                            <Text style={{ fontSize: 22, fontWeight: '700', color: '#f8fafc', marginBottom: 4 }}>
                                Welcome Back
                            </Text>
                            <Text style={{ fontSize: 14, color: '#64748b', marginBottom: 28 }}>
                                Sign in with your phone number
                            </Text>

                            {/* Phone Input */}
                            <View style={{ marginBottom: 16 }}>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 8, letterSpacing: 0.5 }}>
                                    PHONE NUMBER
                                </Text>
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: '#0f172a',
                                        borderRadius: 16,
                                        paddingHorizontal: 16,
                                        paddingVertical: 14,
                                        borderWidth: 1,
                                        borderColor: '#334155',
                                    }}
                                >
                                    <Text style={{ fontSize: 18, marginRight: 10, color: '#64748b' }}>📱</Text>
                                    <TextInput
                                        style={{ flex: 1, color: '#f1f5f9', fontSize: 16 }}
                                        placeholder="Enter phone number"
                                        placeholderTextColor="#475569"
                                        value={phone}
                                        onChangeText={setPhone}
                                        keyboardType="phone-pad"
                                        autoCapitalize="none"
                                    />
                                </View>
                            </View>

                            {/* Password Input */}
                            <View style={{ marginBottom: 28 }}>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 8, letterSpacing: 0.5 }}>
                                    PASSWORD
                                </Text>
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: '#0f172a',
                                        borderRadius: 16,
                                        paddingHorizontal: 16,
                                        paddingVertical: 14,
                                        borderWidth: 1,
                                        borderColor: '#334155',
                                    }}
                                >
                                    <Text style={{ fontSize: 18, marginRight: 10, color: '#64748b' }}>🔒</Text>
                                    <TextInput
                                        style={{ flex: 1, color: '#f1f5f9', fontSize: 16 }}
                                        placeholder="Enter password"
                                        placeholderTextColor="#475569"
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry={!showPassword}
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                        <Text style={{ color: '#06b6d4', fontSize: 13, fontWeight: '600' }}>
                                            {showPassword ? 'HIDE' : 'SHOW'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Login Button */}
                            <TouchableOpacity onPress={handleLogin} disabled={isLoading} activeOpacity={0.8}>
                                <LinearGradient
                                    colors={isLoading ? ['#475569', '#475569'] : ['#06b6d4', '#0284c7']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={{
                                        paddingVertical: 16,
                                        borderRadius: 16,
                                        alignItems: 'center',
                                    }}
                                >
                                    <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 }}>
                                        {isLoading ? 'Signing in...' : 'Sign In'}
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            {/* Guest/Demo Button */}
                            <TouchableOpacity
                                onPress={handleGuestLogin}
                                disabled={isLoading}
                                activeOpacity={0.8}
                                style={{
                                    marginTop: 12,
                                    paddingVertical: 14,
                                    borderRadius: 16,
                                    alignItems: 'center',
                                    borderWidth: 1.5,
                                    borderColor: '#06b6d4',
                                }}
                            >
                                <Text style={{ color: '#06b6d4', fontWeight: '700', fontSize: 15, letterSpacing: 0.5 }}>
                                    Explore as Guest / Demo
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Register Link */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 28 }}>
                            <Text style={{ color: '#64748b', fontSize: 14 }}>Don't have an account? </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                                <Text style={{ color: '#06b6d4', fontSize: 14, fontWeight: '700' }}>Register</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Powered by */}
                        <Text style={{ color: '#334155', fontSize: 11, textAlign: 'center', marginTop: 32, letterSpacing: 1 }}>
                            Powered by SusaLabs
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
