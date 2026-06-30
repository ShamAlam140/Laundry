import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsContextType {
    currency: string;
    settings: any;
    refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
    const [settings, setSettings] = useState<any>({});
    const [currency, setCurrency] = useState('AUD$'); // Fallback default

    const fetchSettings = async () => {
        try {
            // Unauthenticated endpoint or token is attached via interceptor
            const res = await api.get('/settings');
            const data = res.data.data;
            setSettings(data);
            if (data.currency) {
                setCurrency(data.currency);
            }
        } catch (err) {
            console.log('Failed to fetch settings:', err);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    return (
        <SettingsContext.Provider value={{ currency, settings, refreshSettings: fetchSettings }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = (): SettingsContextType => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
