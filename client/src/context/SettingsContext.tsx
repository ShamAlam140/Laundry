import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import api from '../services/api';

interface SettingsContextType {
    currency: string;
    settings: any;
    refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
    const [settings, setSettings] = useState<any>({});
    const [currency, setCurrency] = useState('AUD$');

    const fetchSettings = useCallback(async () => {
        try {
            const res = await api.get('/settings');
            const data = res.data.data;
            setSettings(data);
            if (data.currency) {
                setCurrency(data.currency);
            }
        } catch {
            // fallback to AUD$
        }
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            fetchSettings();
        }
    }, []);

    // Listen for login - refetch settings when token changes, and on window focus
    useEffect(() => {
        const handleStorage = () => {
            const token = localStorage.getItem('token');
            if (token) fetchSettings();
        };
        const handleFocus = () => {
            const token = localStorage.getItem('token');
            if (token) fetchSettings();
        };

        window.addEventListener('storage', handleStorage);
        window.addEventListener('focus', handleFocus);

        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('focus', handleFocus);
        };
    }, [fetchSettings]);

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
