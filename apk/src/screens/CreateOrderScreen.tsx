import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    StatusBar,
    Modal,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import LinearGradient from 'react-native-linear-gradient';
import api from '../services/api';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';

const serviceTypeLabels: Record<string, { label: string; icon: string; color: string }> = {
    'wash-fold': { label: 'Wash & Fold', icon: '👕', color: '#06b6d4' },
    'dry-cleaning': { label: 'Dry Cleaning', icon: '👔', color: '#8b5cf6' },
    'ironing': { label: 'Ironing', icon: '♨️', color: '#f59e0b' },
    'express': { label: 'Express', icon: '⚡', color: '#ef4444' },
    'bulk-commercial': { label: 'Bulk Commercial', icon: '🏭', color: '#22c55e' },
};

interface ServiceItem {
    _id: string;
    name: string;
    serviceType: string;
    pricePerUnit: number;
    unit: string;
    description?: string;
    isCustomerSpecific?: boolean;
    customer?: string;
    customerId?: string;
    customerPhone?: string;
}

interface CartItem {
    serviceId: string;
    service: ServiceItem;
    quantity: number;
}

interface ManualItem {
    itemType: 'Clothing' | 'Linen' | 'Accessories' | 'Special_Items';
    itemName: string;
    quantity: number;
    pricePerUnit: number;
    subtotal: number;
}

export default function CreateOrderScreen({ navigation }: any) {
    const { currency } = useSettings();
    const { customer } = useAuth();
    const [services, setServices] = useState<ServiceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [manualItems, setManualItems] = useState<ManualItem[]>([]);
    const [specialInstructions, setSpecialInstructions] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showCart, setShowCart] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [lastOrderId, setLastOrderId] = useState('');


    useEffect(() => {
        if (!customer) {
            setLoading(false);
            return;
        }

        fetchServices();
    }, [customer?._id, customer?.customerId, customer?.phone, customer?.isPremium]);

    const fetchServices = async () => {
        setLoading(true);
        try {
            const res = await api.get('/customer-portal/services', {
                params: {
                    customerId: customer?.customerId,
                    phone: customer?.phone,
                },
            });
            const apiServices: ServiceItem[] = Array.isArray(res.data.data) ? res.data.data : [];
            const scopedServices = apiServices.filter((service) => {
                if (customer?.isPremium) {
                    return Boolean(service.isCustomerSpecific) && (
                        service.customerId === customer.customerId ||
                        service.customerPhone === customer.phone ||
                        String(service.customer || '') === String(customer._id)
                    );
                }

                return !service.isCustomerSpecific;
            });
            setServices(scopedServices);
        } catch (err) {
            console.error('Failed to load services:', err);
            setServices([]);
        } finally {
            setLoading(false);
        }
    };


    const addToCart = (service: ServiceItem) => {
        const existing = cart.find(c => c.serviceId === service._id);
        if (existing) {
            setCart(cart.map(c =>
                c.serviceId === service._id ? { ...c, quantity: c.quantity + 1 } : c
            ));
        } else {
            setCart([...cart, { serviceId: service._id, service, quantity: 1 }]);
        }
    };

    const updateQuantity = (serviceId: string, delta: number) => {
        setCart(cart.map(c => {
            if (c.serviceId === serviceId) {
                const newQty = c.quantity + delta;
                return newQty > 0 ? { ...c, quantity: newQty } : c;
            }
            return c;
        }).filter(c => c.quantity > 0));
    };

    const removeFromCart = (serviceId: string) => {
        setCart(cart.filter(c => c.serviceId !== serviceId));
    };

    // Manual Items Functions
    const addManualItem = () => {
        setManualItems([...manualItems, {
            itemType: 'Clothing',
            itemName: '',
            quantity: 1,
            pricePerUnit: 0,
            subtotal: 0,
        }]);
    };

    const updateManualItem = (index: number, field: keyof ManualItem, value: any) => {
        setManualItems(manualItems.map((item, i) => {
            if (i !== index) return item;
            const updated = { ...item, [field]: value };
            // Recalculate subtotal when quantity or price changes
            if (field === 'quantity' || field === 'pricePerUnit') {
                updated.subtotal = updated.quantity * updated.pricePerUnit;
            }
            return updated;
        }));
    };

    const removeManualItem = (index: number) => {
        setManualItems(manualItems.filter((_, i) => i !== index));
    };

    const getCartTotal = () => cart.reduce((sum, c) => sum + (c.service.pricePerUnit * c.quantity), 0);
    const getCartCount = () => {
        const serviceCount = cart.reduce((sum, c) => sum + c.quantity, 0);
        const manualCount = manualItems.reduce((sum, m) => sum + m.quantity, 0);
        return serviceCount + manualCount;
    };

    const placeOrder = async () => {
        // Validation: Check if cart is empty
        if (cart.length === 0 && manualItems.length === 0) {
            Alert.alert('Empty Cart', 'Please add at least one service or item');
            return;
        }

        // Validation: Check manual items for empty itemName
        for (const item of manualItems) {
            if (!item.itemName.trim()) {
                Alert.alert('Validation Error', 'Please provide item name for all manual items');
                return;
            }
        }

        // Validation: Check manual items for quantity < 1
        for (const item of manualItems) {
            if (item.quantity < 1) {
                Alert.alert('Validation Error', 'Quantity must be at least 1 for all items');
                return;
            }
        }

        setSubmitting(true);
        try {
            // Transform service items
            const serviceItems = cart.map(c => ({
                serviceId: c.serviceId,
                quantity: c.quantity,
            }));

            // Transform manual items - match web client format exactly
            const transformedManualItems = manualItems.map(mi => ({
                service: null,
                serviceName: mi.itemName,
                serviceType: 'manual',
                itemType: mi.itemType,
                itemName: mi.itemName,
                quantity: mi.quantity,
                unit: 'piece',
                pricePerUnit: mi.pricePerUnit,
                subtotal: mi.subtotal,
            }));

            // Combine items
            const allItems = [...serviceItems, ...transformedManualItems];

            console.log('Submitting order with items:', JSON.stringify(allItems, null, 2));

            const res = await api.post('/customer-portal/orders', {
                items: allItems,
                specialInstructions: specialInstructions.trim() || undefined,
            });

            setLastOrderId(res.data.data.orderId || 'PENDING');
            setCart([]);
            setManualItems([]); // Clear manual items
            setSpecialInstructions('');
            setShowCart(false);
            setShowSuccess(true);
        } catch (err: any) {
            console.error('Order submission error:', err);
            console.error('Error response:', err.response?.data);
            console.error('Error status:', err.response?.status);
            console.log('Service items count:', cart.length);
            console.log('Manual items count:', manualItems.length);
            console.log('Manual items data:', JSON.stringify(manualItems, null, 2));
            
            if (!err.response) {
                Alert.alert('Network Error', 'Failed to place order. Please check your connection.');
            } else if (err.response?.status === 404) {
                Alert.alert('Error', 'Order endpoint not found. Please contact support.');
            } else {
                Alert.alert('Error', err.response?.data?.message || 'Failed to place order');
            }
        } finally {
            setSubmitting(false);
        }
    };


    // Group services by type
    const grouped = services.reduce<Record<string, ServiceItem[]>>((acc, s) => {
        if (!acc[s.serviceType]) acc[s.serviceType] = [];
        acc[s.serviceType].push(s);
        return acc;
    }, {});

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }}>
                <ActivityIndicator size="large" color="#06b6d4" />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

            {/* Header */}
            <View
                style={{
                    paddingHorizontal: 20,
                    paddingTop: 56,
                    paddingBottom: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                }}
            >
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: '#1e293b',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 14,
                        borderWidth: 1,
                        borderColor: '#334155',
                    }}
                >
                    <Text style={{ color: '#06b6d4', fontSize: 18, fontWeight: '700' }}>←</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: '#f1f5f9' }}>New Order</Text>
                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Choose services to order</Text>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                {customer?.isPremium && (
                    <View
                        style={{
                            marginHorizontal: 20,
                            marginBottom: 16,
                            padding: 12,
                            borderRadius: 14,
                            backgroundColor: 'rgba(245, 158, 11, 0.12)',
                            borderWidth: 1,
                            borderColor: 'rgba(245, 158, 11, 0.35)',
                        }}
                    >
                        <Text style={{ color: '#fbbf24', fontSize: 12, fontWeight: '700' }}>
                            Premium account: only services linked to {customer.phone} are shown.
                        </Text>
                    </View>
                )}

                {services.length === 0 && (
                    <View
                        style={{
                            marginHorizontal: 20,
                            marginBottom: 20,
                            padding: 18,
                            borderRadius: 16,
                            backgroundColor: '#1e293b',
                            borderWidth: 1,
                            borderColor: '#334155',
                        }}
                    >
                        <Text style={{ color: '#f1f5f9', fontSize: 15, fontWeight: '700', marginBottom: 6 }}>
                            No services available
                        </Text>
                        <Text style={{ color: '#94a3b8', fontSize: 12, lineHeight: 18 }}>
                            {customer?.isPremium
                                ? 'No custom services are linked with your phone number yet.'
                                : 'No active services are available right now.'}
                        </Text>
                    </View>
                )}

                {Object.entries(grouped).map(([type, items]) => {
                    const typeInfo = serviceTypeLabels[type] || { label: type, icon: '📋', color: '#94a3b8' };

                    return (
                        <View key={type} style={{ marginBottom: 20 }}>
                            {/* Section Header */}
                            <View style={{ paddingHorizontal: 20, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={{ fontSize: 20 }}>{typeInfo.icon}</Text>
                                <Text style={{ color: typeInfo.color, fontSize: 16, fontWeight: '700' }}>
                                    {typeInfo.label}
                                </Text>
                            </View>

                            {/* Service Cards */}
                            {items.map(service => {
                                const inCart = cart.find(c => c.serviceId === service._id);

                                return (
                                    <View
                                        key={service._id}
                                        style={{
                                            backgroundColor: '#1e293b',
                                            borderRadius: 16,
                                            padding: 16,
                                            marginHorizontal: 20,
                                            marginBottom: 8,
                                            borderWidth: 1,
                                            borderColor: inCart ? typeInfo.color : '#334155',
                                        }}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: '#f1f5f9', fontSize: 15, fontWeight: '600' }}>
                                                    {service.name}
                                                </Text>
                                                {service.isCustomerSpecific ? (
                                                    <Text style={{ color: '#fbbf24', fontSize: 11, marginTop: 2, fontWeight: '700' }}>
                                                        Custom service for {service.customerPhone || customer?.phone}
                                                    </Text>
                                                ) : null}
                                                {service.description ? (
                                                    <Text style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                                                        {service.description}
                                                    </Text>
                                                ) : null}
                                                <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
                                                    {currency}{Number(service.pricePerUnit || 0).toFixed(2)} / {service.unit}
                                                </Text>
                                            </View>

                                            {inCart ? (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <TouchableOpacity
                                                        onPress={() => updateQuantity(service._id, -1)}
                                                        style={{
                                                            width: 32,
                                                            height: 32,
                                                            borderRadius: 10,
                                                            backgroundColor: '#0f172a',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            borderWidth: 1,
                                                            borderColor: '#334155',
                                                        }}
                                                    >
                                                        <Text style={{ color: '#f1f5f9', fontSize: 16, fontWeight: '700' }}>−</Text>
                                                    </TouchableOpacity>
                                                    <Text style={{ color: '#f1f5f9', fontSize: 16, fontWeight: '700', minWidth: 24, textAlign: 'center' }}>
                                                        {inCart.quantity}
                                                    </Text>
                                                    <TouchableOpacity
                                                        onPress={() => updateQuantity(service._id, 1)}
                                                        style={{
                                                            width: 32,
                                                            height: 32,
                                                            borderRadius: 10,
                                                            backgroundColor: '#06b6d4',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                        }}
                                                    >
                                                        <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>+</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            ) : (
                                                <TouchableOpacity
                                                    onPress={() => addToCart(service)}
                                                    style={{
                                                        paddingHorizontal: 16,
                                                        paddingVertical: 8,
                                                        borderRadius: 10,
                                                        backgroundColor: '#06b6d4',
                                                    }}
                                                >
                                                    <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}>Add</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    );
                })}

                {/* Manual Items Section */}
                <View style={{ marginBottom: 20 }}>
                    {/* Section Header */}
                    <View style={{ paddingHorizontal: 20, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ color: '#f1f5f9', fontSize: 16, fontWeight: '700' }}>
                            Add Items (Bedsheet, Towel, etc.)
                        </Text>
                        <TouchableOpacity onPress={addManualItem} activeOpacity={0.8}>
                            <LinearGradient
                                colors={['#06b6d4', '#0284c7']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    borderRadius: 10,
                                    gap: 6,
                                }}
                            >
                                <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>+</Text>
                                <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}>Add Item</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    {/* Empty State or Item Cards */}
                    {manualItems.length === 0 ? (
                        <Text style={{ color: '#64748b', fontSize: 13, textAlign: 'center', paddingVertical: 20, paddingHorizontal: 20 }}>
                            No items added. Click "Add Item" to add bedsheet, towel, etc.
                        </Text>
                    ) : (
                        manualItems.map((item, index) => (
                            <View
                                key={index}
                                style={{
                                    backgroundColor: '#1e293b',
                                    borderRadius: 16,
                                    padding: 16,
                                    marginHorizontal: 20,
                                    marginBottom: 8,
                                    borderWidth: 1,
                                    borderColor: '#334155',
                                }}
                            >
                                {/* Row 1: Item Type & Item Name */}
                                <View style={{ flexDirection: 'column', gap: 10, marginBottom: 10 }}>
                                    <View>
                                        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '600', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                                            Item Type
                                        </Text>
                                        <View style={{ backgroundColor: '#0f172a', borderRadius: 10, borderWidth: 1, borderColor: '#334155', height: 44 }}>
                                            <Picker
                                                selectedValue={item.itemType}
                                                onValueChange={(value) => updateManualItem(index, 'itemType', value)}
                                                style={{ color: '#f1f5f9', height: 44 }}
                                                dropdownIconColor="#f1f5f9"
                                                itemStyle={{ height: 44 }}
                                            >
                                                <Picker.Item label="👕 Clothing" value="Clothing" />
                                                <Picker.Item label="🛏️ Linen" value="Linen" />
                                                <Picker.Item label="👜 Accessories" value="Accessories" />
                                                <Picker.Item label="⭐ Special Items" value="Special_Items" />
                                            </Picker>
                                        </View>
                                    </View>
                                    <View>
                                        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '600', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                                            Item Name
                                        </Text>
                                        <TextInput
                                            value={item.itemName}
                                            onChangeText={(text) => updateManualItem(index, 'itemName', text)}
                                            placeholder="e.g., Bedsheet, Towel"
                                            placeholderTextColor="#475569"
                                            style={{
                                                backgroundColor: '#0f172a',
                                                borderRadius: 10,
                                                borderWidth: 1,
                                                borderColor: '#334155',
                                                color: '#f1f5f9',
                                                fontSize: 13,
                                                paddingHorizontal: 12,
                                                paddingVertical: 10,
                                                height: 44,
                                            }}
                                        />
                                    </View>
                                </View>

                                {/* Row 2: Quantity, Price, Subtotal */}
                                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '600', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                                            Quantity
                                        </Text>
                                        <TextInput
                                            value={String(item.quantity)}
                                            onChangeText={(text) => {
                                                const qty = parseInt(text) || 1;
                                                updateManualItem(index, 'quantity', Math.max(1, qty));
                                            }}
                                            keyboardType="numeric"
                                            style={{
                                                backgroundColor: '#0f172a',
                                                borderRadius: 10,
                                                borderWidth: 1,
                                                borderColor: '#334155',
                                                color: '#f1f5f9',
                                                fontSize: 13,
                                                paddingHorizontal: 12,
                                                paddingVertical: 10,
                                                textAlign: 'center',
                                                height: 44,
                                            }}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '600', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                                            Price/Item
                                        </Text>
                                        <TextInput
                                            value={String(item.pricePerUnit)}
                                            onChangeText={(text) => {
                                                const price = parseFloat(text) || 0;
                                                updateManualItem(index, 'pricePerUnit', Math.max(0, price));
                                            }}
                                            keyboardType="decimal-pad"
                                            style={{
                                                backgroundColor: '#0f172a',
                                                borderRadius: 10,
                                                borderWidth: 1,
                                                borderColor: '#334155',
                                                color: '#f1f5f9',
                                                fontSize: 13,
                                                paddingHorizontal: 12,
                                                paddingVertical: 10,
                                                textAlign: 'center',
                                                height: 44,
                                            }}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '600', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                                            Subtotal
                                        </Text>
                                        <View style={{
                                            backgroundColor: '#0f172a',
                                            borderRadius: 10,
                                            borderWidth: 1,
                                            borderColor: '#334155',
                                            paddingHorizontal: 12,
                                            paddingVertical: 10,
                                            height: 44,
                                            justifyContent: 'center',
                                        }}>
                                            <Text style={{ color: '#f1f5f9', fontSize: 13, fontWeight: '700', textAlign: 'center' }}>
                                                {currency}{Number(item.subtotal || 0).toFixed(2)}
                                            </Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => removeManualItem(index)}
                                        style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: 10,
                                            backgroundColor: '#1e293b',
                                            borderWidth: 1,
                                            borderColor: '#ef4444',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <Text style={{ fontSize: 18 }}>🗑️</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            {/* Floating Cart Button */}
            {(cart.length > 0 || manualItems.length > 0) && (
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 24, paddingTop: 12 }}>
                    <TouchableOpacity onPress={() => setShowCart(true)} activeOpacity={0.9}>
                        <LinearGradient
                            colors={['#06b6d4', '#0284c7']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                                borderRadius: 16,
                                padding: 16,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{getCartCount()}</Text>
                                </View>
                                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>View Cart</Text>
                            </View>
                            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '800' }}>{currency}{Number(getCartTotal() || 0).toFixed(2)}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            )}

            {/* Cart Modal */}
            <Modal visible={showCart} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
                    <View
                        style={{
                            backgroundColor: '#0f172a',
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            padding: 20,
                            maxHeight: '85%',
                        }}
                    >
                        {/* Modal Header */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <Text style={{ color: '#f1f5f9', fontSize: 20, fontWeight: '800' }}>Your Cart</Text>
                            <TouchableOpacity onPress={() => setShowCart(false)}>
                                <Text style={{ color: '#64748b', fontSize: 24 }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Cart Items */}
                            {cart.map(item => (
                                <View
                                    key={item.serviceId}
                                    style={{
                                        backgroundColor: '#1e293b',
                                        borderRadius: 16,
                                        padding: 14,
                                        marginBottom: 8,
                                        borderWidth: 1,
                                        borderColor: '#334155',
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '600' }}>{item.service.name}</Text>
                                            <Text style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                                                {currency}{Number(item.service.pricePerUnit || 0).toFixed(2)} × {item.quantity} {item.service.unit}
                                            </Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={{ color: '#f1f5f9', fontSize: 15, fontWeight: '700' }}>
                                                {currency}{Number(item.service.pricePerUnit * item.quantity || 0).toFixed(2)}
                                            </Text>
                                            <TouchableOpacity onPress={() => removeFromCart(item.serviceId)} style={{ marginTop: 4 }}>
                                                <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '600' }}>Remove</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {/* Quantity controls */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
                                        <TouchableOpacity
                                            onPress={() => {
                                                if (item.quantity <= 1) removeFromCart(item.serviceId);
                                                else updateQuantity(item.serviceId, -1);
                                            }}
                                            style={{
                                                width: 30, height: 30, borderRadius: 8,
                                                backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center',
                                                borderWidth: 1, borderColor: '#334155',
                                            }}
                                        >
                                            <Text style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '700' }}>−</Text>
                                        </TouchableOpacity>
                                        <Text style={{ color: '#f1f5f9', fontSize: 15, fontWeight: '700', minWidth: 20, textAlign: 'center' }}>
                                            {item.quantity}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => updateQuantity(item.serviceId, 1)}
                                            style={{
                                                width: 30, height: 30, borderRadius: 8,
                                                backgroundColor: '#06b6d4', alignItems: 'center', justifyContent: 'center',
                                            }}
                                        >
                                            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700' }}>+</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}

                            {/* Manual Items Section */}
                            {manualItems.length > 0 && (
                                <View style={{ marginTop: 16, marginBottom: 8 }}>
                                    <Text style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '700', marginBottom: 4 }}>
                                        Items
                                    </Text>
                                    <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '600', marginBottom: 8, fontStyle: 'italic' }}>
                                        For tracking only - not billed
                                    </Text>
                                    {manualItems.map((item, index) => (
                                        <View
                                            key={index}
                                            style={{
                                                backgroundColor: '#1e293b',
                                                borderRadius: 14,
                                                padding: 12,
                                                marginBottom: 6,
                                                borderWidth: 1,
                                                borderColor: '#22c55e',
                                            }}
                                        >
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                                    <Text style={{ color: '#22c55e', fontSize: 10, fontWeight: '700' }}>
                                                        {item.itemType.replace('_', ' ')}
                                                    </Text>
                                                </View>
                                                <TouchableOpacity onPress={() => removeManualItem(index)} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
                                                    <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '600' }}>Remove</Text>
                                                </TouchableOpacity>
                                            </View>
                                            <Text style={{ color: '#f1f5f9', fontSize: 13, fontWeight: '600', marginBottom: 4 }}>
                                                {item.itemName || 'Unnamed Item'}
                                            </Text>
                                            <Text style={{ color: '#64748b', fontSize: 11 }}>
                                                {item.quantity} × {currency}{Number(item.pricePerUnit || 0).toFixed(2)} = {currency}{Number(item.subtotal || 0).toFixed(2)}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Special Instructions */}
                            <View style={{ marginTop: 12 }}>
                                <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 8, letterSpacing: 0.5 }}>
                                    SPECIAL INSTRUCTIONS (OPTIONAL)
                                </Text>
                                <TextInput
                                    style={{
                                        backgroundColor: '#1e293b',
                                        borderRadius: 14,
                                        padding: 14,
                                        color: '#f1f5f9',
                                        fontSize: 14,
                                        minHeight: 80,
                                        textAlignVertical: 'top',
                                        borderWidth: 1,
                                        borderColor: '#334155',
                                    }}
                                    placeholder="E.g., please handle with care, starch shirts etc."
                                    placeholderTextColor="#475569"
                                    value={specialInstructions}
                                    onChangeText={setSpecialInstructions}
                                    multiline
                                />
                            </View>

                            {/* Payment Method */}
                            <View style={{ marginTop: 24, marginBottom: 8 }}>
                                <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 12, letterSpacing: 0.5 }}>
                                    PAYMENT METHOD
                                </Text>
                                <View
                                    style={{
                                        backgroundColor: '#0f172a',
                                        borderRadius: 16,
                                        padding: 16,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 14,
                                        borderWidth: 1,
                                        borderColor: '#06b6d4',
                                    }}
                                >
                                    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(6, 182, 212, 0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                        <Text style={{ fontSize: 22 }}>💵</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: '#64748b', fontSize: 15, fontWeight: '700' }}>Pay Offline</Text>
                                        <Text style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>Pay via Cash at delivery</Text>
                                    </View>
                                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#06b6d4', alignItems: 'center', justifyContent: 'center' }}>
                                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>✓</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Total Summary */}
                            <View
                                style={{
                                    backgroundColor: '#1e293b',
                                    borderRadius: 16,
                                    padding: 16,
                                    marginTop: 16,
                                    borderWidth: 1,
                                    borderColor: '#334155',
                                }}
                            >
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <Text style={{ color: '#64748b', fontSize: 14 }}>Items</Text>
                                    <Text style={{ color: '#94a3b8', fontSize: 14 }}>{getCartCount()}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' }}>
                                    <Text style={{ color: '#f1f5f9', fontSize: 18, fontWeight: '800' }}>Total</Text>
                                    <Text style={{ color: '#06b6d4', fontSize: 18, fontWeight: '800' }}>{currency}{Number(getCartTotal() || 0).toFixed(2)}</Text>
                                </View>
                            </View>
                        </ScrollView>

                        {/* Place Order Button */}
                        <TouchableOpacity onPress={placeOrder} disabled={submitting} activeOpacity={0.8} style={{ marginTop: 24, marginBottom: 8 }}>
                            <LinearGradient
                                colors={submitting ? ['#475569', '#475569'] : ['#06b6d4', '#0284c7']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{
                                    paddingVertical: 16,
                                    borderRadius: 16,
                                    alignItems: 'center',
                                }}
                            >
                                <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 }}>
                                    {submitting ? 'Placing Order...' : 'Confirm Order — Pay Offline'}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Success Modal */}
            <Modal visible={showSuccess} animationType="fade" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 24 }}>
                    <View
                        style={{
                            backgroundColor: '#1e293b',
                            borderRadius: 32,
                            padding: 32,
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: '#334155',
                        }}
                    >
                        <LinearGradient
                            colors={['#22c55e', '#15803d']}
                            style={{
                                width: 80,
                                height: 80,
                                borderRadius: 40,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 24,
                                shadowColor: '#22c55e',
                                shadowOffset: { width: 0, height: 10 },
                                shadowOpacity: 0.3,
                                shadowRadius: 20,
                                elevation: 10,
                            }}
                        >
                            <Text style={{ fontSize: 40, color: '#fff' }}>✓</Text>
                        </LinearGradient>

                        <Text style={{ color: '#f8fafc', fontSize: 24, fontWeight: '800', textAlign: 'center' }}>
                            Order Placed!
                        </Text>
                        <Text style={{ color: '#94a3b8', fontSize: 16, marginTop: 8, textAlign: 'center' }}>
                            Order ID: <Text style={{ color: '#06b6d4', fontWeight: '700' }}>#{lastOrderId}</Text>
                        </Text>

                        <View style={{ width: '100%', backgroundColor: '#0f172a', borderRadius: 20, padding: 20, marginTop: 24, borderWidth: 1, borderColor: '#334155' }}>
                            <Text style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '700', marginBottom: 12 }}>WHAT HAPPENS NEXT?</Text>
                            
                            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                                <Text style={{ fontSize: 18 }}>🎒</Text>
                                <Text style={{ color: '#94a3b8', fontSize: 13, flex: 1 }}>Our partner will pick up your items within 24 hours.</Text>
                            </View>
                            
                            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                                <Text style={{ fontSize: 18 }}>🫧</Text>
                                <Text style={{ color: '#94a3b8', fontSize: 13, flex: 1 }}>Items will be washed, ironed and packed with care.</Text>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <Text style={{ fontSize: 18 }}>💵</Text>
                                <Text style={{ color: '#94a3b8', fontSize: 13, flex: 1 }}>Pay offline via Cash at the time of delivery.</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={() => {
                                setShowSuccess(false);
                                navigation.goBack();
                                // We don't need navigation.navigate('Orders') because we goBack to Home first usually, 
                                // but the user might expect to see orders. 
                                // Actually goBack is safer here.
                            }}
                            activeOpacity={0.8}
                            style={{ marginTop: 32, width: '100%' }}
                        >
                            <LinearGradient
                                colors={['#06b6d4', '#0284c7']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{
                                    paddingVertical: 16,
                                    borderRadius: 16,
                                    alignItems: 'center',
                                }}
                            >
                                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 }}>
                                    Back to Home
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => { setShowSuccess(false); navigation.goBack(); }} style={{ marginTop: 16 }}>
                            <Text style={{ color: '#64748b', fontSize: 14, fontWeight: '600' }}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
