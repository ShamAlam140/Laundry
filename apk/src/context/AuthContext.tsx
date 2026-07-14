import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

interface Customer {
    _id: string;
    customerId: string;
    name: string;
    phone: string;
    email?: string;
    address?: string;
    customerType: string;
    isPremium?: boolean;
    notificationFrequency?: string;
}

interface AuthContextType {
    customer: Customer | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (phone: string, password: string) => Promise<void>;
    register: (data: { name: string; phone: string; email: string; address?: string; password: string }) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadStoredAuth();
    }, []);

    const loadStoredAuth = async () => {
        try {
            const storedToken = await AsyncStorage.getItem('customerToken');
            if (storedToken) {
                setToken(storedToken);
                const res = await api.get('/customer-auth/me');
                setCustomer(res.data.data);
            }
        } catch {
            await AsyncStorage.removeItem('customerToken');
            await AsyncStorage.removeItem('customerData');
            setToken(null);
            setCustomer(null);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (phone: string, password: string) => {
        const res = await api.post('/customer-auth/login', { phone, password });
        const { token: newToken, data } = res.data;
        await AsyncStorage.setItem('customerToken', newToken);
        await AsyncStorage.setItem('customerData', JSON.stringify(data));
        setToken(newToken);
        setCustomer(data);
    };

    const register = async (data: { name: string; phone: string; email: string; address?: string; password: string }) => {
        const res = await api.post('/customer-auth/register', data);
        const { token: newToken, data: customerData } = res.data;
        await AsyncStorage.setItem('customerToken', newToken);
        await AsyncStorage.setItem('customerData', JSON.stringify(customerData));
        setToken(newToken);
        setCustomer(customerData);
    };

    const logout = async () => {
        await AsyncStorage.removeItem('customerToken');
        await AsyncStorage.removeItem('customerData');
        setToken(null);
        setCustomer(null);
    };

    return (
        <AuthContext.Provider
            value={{
                customer,
                token,
                isAuthenticated: !!customer,
                isLoading,
                login,
                register,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
