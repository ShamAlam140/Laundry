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
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

const InputField = ({ icon, label, value, onChangeText, placeholder, ...props }: any) => (
    <View style={{ marginBottom: 14 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#94a3b8', marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>
            {label}
        </Text>
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#0f172a',
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: Platform.OS === 'ios' ? 14 : 12,
                borderWidth: 1,
                borderColor: '#334155',
            }}
        >
            <Text style={{ fontSize: 16, marginRight: 10, color: '#64748b' }}>{icon}</Text>
            <TextInput
                style={{ flex: 1, color: '#f1f5f9', fontSize: 15 }}
                placeholder={placeholder}
                placeholderTextColor="#475569"
                value={value}
                onChangeText={onChangeText}
                autoCorrect={false}
                autoCapitalize="none"
                {...props}
            />
        </View>
    </View>
);

export default function RegisterScreen({ navigation }: any) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { register } = useAuth();

    const handleRegister = async () => {
        // Trim all fields
        const trimmedName = name.trim();
        const trimmedPhone = phone.trim();
        const trimmedEmail = email.trim();
        const trimmedAddress = address.trim();
        const trimmedPassword = password.trim();
        const trimmedConfirm = confirmPassword.trim();

        if (!trimmedName) {
            Alert.alert('Missing Field', 'Please enter your full name.');
            return;
        }
        if (!trimmedPhone) {
            Alert.alert('Missing Field', 'Please enter your phone number.');
            return;
        }
        if (trimmedPhone.length < 6) {
            Alert.alert('Invalid Phone', 'Please enter a valid phone number.');
            return;
        }
        if (!trimmedPassword) {
            Alert.alert('Missing Field', 'Please enter a password.');
            return;
        }
        if (trimmedPassword.length < 6) {
            Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
            return;
        }
        if (trimmedPassword !== trimmedConfirm) {
            Alert.alert('Password Mismatch', 'Passwords do not match. Please try again.');
            return;
        }

        setIsLoading(true);
        try {
            await register({
                name: trimmedName,
                phone: trimmedPhone,
                email: trimmedEmail || undefined,
                address: trimmedAddress || undefined,
                password: trimmedPassword,
            });
            // Navigation handled by AuthContext / navigator
        } catch (err: any) {
            const message =
                err?.response?.data?.message ||
                err?.message ||
                'Registration failed. Please check your internet connection and try again.';
            Alert.alert('Registration Failed', message);
        } finally {
            setIsLoading(false);
        }
    };

    const formWidth = isTablet ? Math.min(width * 0.6, 500) : width;

    return (
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, alignItems: 'center', paddingBottom: 40 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={{ width: formWidth, paddingHorizontal: 24, paddingTop: isTablet ? 60 : 40 }}>

                        {/* Header */}
                        <View style={{ alignItems: 'center', marginBottom: 28 }}>
                            <Text style={{ fontSize: isTablet ? 28 : 22, fontWeight: '800', color: '#ffffff' }}>
                                Peninsula Laundries
                            </Text>
                            <Text style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
                                Create your customer account
                            </Text>
                        </View>

                        {/* Form Card */}
                        <View
                            style={{
                                backgroundColor: '#1e293b',
                                borderRadius: 24,
                                padding: 24,
                                borderWidth: 1,
                                borderColor: '#334155',
                            }}
                        >
                            <Text style={{ fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 4 }}>
                                Create Account
                            </Text>
                            <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
                                Fill in your details to get started
                            </Text>

                            <InputField
                                icon="👤"
                                label="Full Name *"
                                value={name}
                                onChangeText={setName}
                                placeholder="Enter your full name"
                                autoCapitalize="words"
                                autoCorrect={false}
                            />
                            <InputField
                                icon="📱"
                                label="Phone Number *"
                                value={phone}
                                onChangeText={setPhone}
                                placeholder="e.g. 0412345678"
                                keyboardType="phone-pad"
                                autoCapitalize="none"
                            />
                            <InputField
                                icon="✉️"
                                label="Email (Optional)"
                                value={email}
                                onChangeText={setEmail}
                                placeholder="Enter your email"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            <InputField
                                icon="📍"
                                label="Address (Optional)"
                                value={address}
                                onChangeText={setAddress}
                                placeholder="Enter your address"
                                autoCapitalize="sentences"
                            />
                            <InputField
                                icon="🔒"
                                label="Password *"
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Minimum 6 characters"
                                secureTextEntry
                            />
                            <InputField
                                icon="🔒"
                                label="Confirm Password *"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                placeholder="Re-enter your password"
                                secureTextEntry
                            />

                            {/* Register Button */}
                            <TouchableOpacity
                                onPress={handleRegister}
                                disabled={isLoading}
                                activeOpacity={0.8}
                                style={{ marginTop: 6 }}
                            >
                                <LinearGradient
                                    colors={isLoading ? ['#475569', '#475569'] : ['#06b6d4', '#0284c7']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={{
                                        paddingVertical: 16,
                                        borderRadius: 16,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexDirection: 'row',
                                        gap: 8,
                                    }}
                                >
                                    {isLoading && (
                                        <ActivityIndicator color="#ffffff" size="small" />
                                    )}
                                    <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 }}>
                                        {isLoading ? 'Creating Account…' : 'Create Account'}
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>

                        {/* Login Link */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24 }}>
                            <Text style={{ color: '#64748b', fontSize: 14 }}>Already have an account? </Text>
                            <TouchableOpacity onPress={() => navigation.goBack()}>
                                <Text style={{ color: '#06b6d4', fontSize: 14, fontWeight: '700' }}>Sign In</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
