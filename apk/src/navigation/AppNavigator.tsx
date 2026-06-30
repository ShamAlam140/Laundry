import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import OrdersScreen from '../screens/OrdersScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';
import InvoicesScreen from '../screens/InvoicesScreen';
import InvoiceDetailScreen from '../screens/InvoiceDetailScreen';
import InvoicePreviewScreen from '../screens/InvoicePreviewScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CreateOrderScreen from '../screens/CreateOrderScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

const AuthStack = createNativeStackNavigator();
const MainTab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const OrderStack = createNativeStackNavigator();
const InvoiceStack = createNativeStackNavigator();

function HomeStackNavigator() {
    return (
        <HomeStack.Navigator screenOptions={{ headerShown: false }}>
            <HomeStack.Screen name="HomeMain" component={HomeScreen} />
            <HomeStack.Screen name="CreateOrder" component={CreateOrderScreen} />
            <HomeStack.Screen name="Notifications" component={NotificationsScreen} />
        </HomeStack.Navigator>
    );
}

function OrdersStackNavigator() {
    return (
        <OrderStack.Navigator screenOptions={{ headerShown: false }}>
            <OrderStack.Screen name="OrdersList" component={OrdersScreen} />
            <OrderStack.Screen name="OrderDetail" component={OrderDetailScreen} />
            <OrderStack.Screen name="CreateOrder" component={CreateOrderScreen} />
        </OrderStack.Navigator>
    );
}

function InvoicesStackNavigator() {
    return (
        <InvoiceStack.Navigator screenOptions={{ headerShown: false }}>
            <InvoiceStack.Screen name="InvoicesList" component={InvoicesScreen} />
            <InvoiceStack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} />
            <InvoiceStack.Screen name="InvoicePreview" component={InvoicePreviewScreen} />
        </InvoiceStack.Navigator>
    );
}

function MainTabNavigator() {
    const insets = useSafeAreaInsets();
    return (
        <MainTab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName = 'home-outline';
                    if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
                    else if (route.name === 'Orders') iconName = focused ? 'receipt' : 'receipt-outline';
                    else if (route.name === 'Invoices') iconName = focused ? 'document-text' : 'document-text-outline';
                    else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
                    return <Icon name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: '#06b6d4',
                tabBarInactiveTintColor: '#475569',
                tabBarStyle: {
                    backgroundColor: '#0f172a',
                    borderTopColor: '#1e293b',
                    borderTopWidth: 1,
                    paddingBottom: insets.bottom > 0 ? insets.bottom : 6,
                    paddingTop: 6,
                    height: 60 + (insets.bottom > 0 ? insets.bottom : 0),
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                },
            })}
        >
            <MainTab.Screen name="Home" component={HomeStackNavigator} />
            <MainTab.Screen name="Orders" component={OrdersStackNavigator} />
            <MainTab.Screen name="Invoices" component={InvoicesStackNavigator} />
            <MainTab.Screen name="Profile" component={ProfileScreen} />
        </MainTab.Navigator>
    );
}

export default function AppNavigator() {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }}>
                <ActivityIndicator size="large" color="#06b6d4" />
            </View>
        );
    }

    if (!isAuthenticated) {
        return (
            <AuthStack.Navigator screenOptions={{ headerShown: false }}>
                <AuthStack.Screen name="Login" component={LoginScreen} />
                <AuthStack.Screen name="Register" component={RegisterScreen} />
            </AuthStack.Navigator>
        );
    }

    return <MainTabNavigator />;
}
