import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useSettings } from '../context/SettingsContext';
import type { ICustomer, IService, IOrderItem } from '../types';
import {
    HiOutlineSearch,
    HiOutlinePlusCircle,
    HiOutlineTrash,
    HiOutlineUpload,
} from 'react-icons/hi';
import { HiMinus, HiPlus } from 'react-icons/hi2';
import BulkOrderImport from '../components/order/BulkOrderImport';

const serviceTypeLabels: Record<string, string> = {
    'wash-fold': '🧺 Wash & Fold',
    'dry-cleaning': '👔 Dry Cleaning',
    'ironing': '🔥 Ironing',
    'express': '⚡ Express',
    'bulk-commercial': '🏭 Bulk/Commercial',
};

type CustomServiceForm = {
    name: string;
    serviceType: string;
    description: string;
    pricePerUnit: number;
    unit: string;
    isExpress: boolean;
    expressSurchargePercent: number;
    isActive: boolean;
};

type QuickCustomerForm = {
    name: string;
    phone: string;
    email: string;
    customerType: string;
    isPremium: boolean;
    customServices: CustomServiceForm[];
};

const serviceTypes = ['wash-fold', 'dry-cleaning', 'ironing', 'express', 'bulk-commercial'];
const units = ['piece', 'kg', 'bundle'];

const createEmptyCustomService = (): CustomServiceForm => ({
    name: '',
    serviceType: 'wash-fold',
    description: '',
    pricePerUnit: 0,
    unit: 'piece',
    isExpress: false,
    expressSurchargePercent: 50,
    isActive: true,
});

const createEmptyQuickCustomer = (): QuickCustomerForm => ({
    name: '',
    phone: '',
    email: '',
    customerType: 'walk-in',
    isPremium: false,
    customServices: [],
});

const CreateOrder = () => {
    const navigate = useNavigate();
    const { currency, settings } = useSettings();
    const [customers, setCustomers] = useState<ICustomer[]>([]);
    const [services, setServices] = useState<IService[]>([]);
    const [loading, setLoading] = useState(false);

    // Form state
    const [selectedCustomer, setSelectedCustomer] = useState<ICustomer | null>(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [items, setItems] = useState<IOrderItem[]>([]);
    const [manualItems, setManualItems] = useState<Array<{
        itemType: string;
        itemName: string;
        quantity: number;
        pricePerUnit: number;
        subtotal: number;
    }>>([]);
    const [specialInstructions, setSpecialInstructions] = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');
    const taxPercent = settings?.taxPercent ?? 5;
    const [discountPercent, setDiscountPercent] = useState(0);
    const [applyCreditBalance, setApplyCreditBalance] = useState(false);
    const [hasLoadedDefaults, setHasLoadedDefaults] = useState(false);

    useEffect(() => {
        if (settings && Object.keys(settings).length > 0 && !hasLoadedDefaults) {
            if (settings.defaultDiscountPercent !== undefined) {
                setDiscountPercent(settings.defaultDiscountPercent);
            }
            setHasLoadedDefaults(true);
        }
    }, [settings, hasLoadedDefaults]);

    // Quick-add customer modal
    const [showAddCustomer, setShowAddCustomer] = useState(false);
    const [newCustomer, setNewCustomer] = useState<QuickCustomerForm>(createEmptyQuickCustomer());
    const [showBulkImport, setShowBulkImport] = useState(false);

    const fetchServices = async (customerId?: string) => {
        try {
            const res = await api.get('/services', {
                params: customerId ? { customer: customerId, isActive: true } : { isActive: true },
            });
            setServices(res.data.data);
        } catch {
            toast.error('Failed to load services');
        }
    };

    useEffect(() => {
        fetchServices();
    }, []);

    const searchCustomers = async (q: string) => {
        setCustomerSearch(q);
        if (q.length >= 2) {
            try {
                const res = await api.get('/customers', { params: { search: q } });
                setCustomers(res.data.data);
                setShowCustomerDropdown(true);
            } catch { /* ignore */ }
        } else {
            setCustomers([]);
            setShowCustomerDropdown(false);
        }
    };

    const selectCustomer = (c: ICustomer) => {
        if (selectedCustomer && selectedCustomer._id !== c._id && items.length > 0) {
            setItems([]);
        }
        setSelectedCustomer(c);
        setCustomerSearch(c.name);
        setShowCustomerDropdown(false);
        fetchServices(c._id);
    };

    const addService = (service: IService) => {
        const exists = items.find((i) => i.service === service._id);
        if (exists) {
            setItems(items.map((i) =>
                i.service === service._id
                    ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.pricePerUnit }
                    : i
            ));
        } else {
            setItems([...items, {
                service: service._id,
                serviceName: service.name,
                serviceType: service.serviceType,
                itemType: 'Clothing', // Default item type
                itemName: service.name, // Default item name
                quantity: 1,
                unit: service.unit,
                pricePerUnit: service.pricePerUnit,
                subtotal: service.pricePerUnit,
            }]);
        }
    };

    const updateQty = (index: number, delta: number) => {
        setItems(items.map((item, i) => {
            if (i !== index) return item;
            const newQty = Math.max(1, item.quantity + delta);
            return { ...item, quantity: newQty, subtotal: newQty * item.pricePerUnit };
        }));
    };

    const updateItemType = (index: number, itemType: string) => {
        setItems(items.map((item, i) => i === index ? { ...item, itemType: itemType as any } : item));
    };

    const updateItemName = (index: number, itemName: string) => {
        setItems(items.map((item, i) => i === index ? { ...item, itemName } : item));
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const addManualItem = () => {
        setManualItems([...manualItems, {
            itemType: 'Clothing',
            itemName: '',
            quantity: 1,
            pricePerUnit: 0,
            subtotal: 0,
        }]);
    };

    const updateManualItem = (index: number, field: string, value: any) => {
        setManualItems(manualItems.map((item, i) => {
            if (i !== index) return item;
            const updated = { ...item, [field]: value };
            if (field === 'quantity' || field === 'pricePerUnit') {
                updated.subtotal = updated.quantity * updated.pricePerUnit;
            }
            return updated;
        }));
    };

    const removeManualItem = (index: number) => {
        setManualItems(manualItems.filter((_, i) => i !== index));
    };

    const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
    const taxAmount = (subtotal * taxPercent) / 100;
    const discountAmount = (subtotal * discountPercent) / 100;
    const total = subtotal + taxAmount - discountAmount;

    const handleQuickAddCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...newCustomer,
                customServices: newCustomer.isPremium ? newCustomer.customServices : [],
            };
            const res = await api.post('/customers', payload);
            const createdCustomer = res.data.data;
            setSelectedCustomer(createdCustomer);
            setCustomerSearch(createdCustomer.name);
            setShowAddCustomer(false);
            setNewCustomer(createEmptyQuickCustomer());
            fetchServices(createdCustomer._id);
            toast.success('Customer created');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed');
        }
    };

    const toggleQuickPremium = (checked: boolean) => {
        setNewCustomer((prev) => ({
            ...prev,
            isPremium: checked,
            customServices: checked && prev.customServices.length === 0
                ? [createEmptyCustomService()]
                : prev.customServices,
        }));
    };

    const addQuickCustomService = () => {
        setNewCustomer((prev) => ({
            ...prev,
            customServices: [...prev.customServices, createEmptyCustomService()],
        }));
    };

    const updateQuickCustomService = (index: number, field: keyof CustomServiceForm, value: string | number | boolean) => {
        setNewCustomer((prev) => ({
            ...prev,
            customServices: prev.customServices.map((service, i) => (
                i === index ? { ...service, [field]: value } : service
            )),
        }));
    };

    const removeQuickCustomService = (index: number) => {
        setNewCustomer((prev) => ({
            ...prev,
            customServices: prev.customServices.filter((_, i) => i !== index),
        }));
    };

    const handleSubmit = async () => {
        if (!selectedCustomer) { toast.error('Please select a customer'); return; }
        if (items.length === 0 && manualItems.length === 0) { 
            toast.error('Please add at least one service or item'); 
            return; 
        }

        setLoading(true);
        try {
            // Combine service items and manual items
            const allItems = [
                ...items,
                ...manualItems.map(mi => ({
                    service: null, // Manual items don't have service reference
                    serviceName: mi.itemName,
                    serviceType: 'manual',
                    itemType: mi.itemType as any,
                    itemName: mi.itemName,
                    quantity: mi.quantity,
                    unit: 'piece',
                    pricePerUnit: mi.pricePerUnit,
                    subtotal: mi.subtotal,
                }))
            ];

            await api.post('/orders', {
                customer: selectedCustomer._id,
                items: allItems,
                specialInstructions,
                deliveryDate: deliveryDate || undefined,
                taxPercent,
                discountPercent,
                applyCreditBalance,
            });
            toast.success('Order created successfully!');
            navigate('/orders');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to create order');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900">Create New Order</h1>
                <button
                    onClick={() => setShowBulkImport(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors text-sm font-medium"
                >
                    <HiOutlineUpload className="w-4 h-4" />
                    Bulk Import CSV
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left — Form */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Customer Selection */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <h2 className="text-base font-semibold text-slate-900 mb-4">Customer</h2>
                        <div className="relative">
                            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search customer by name or phone..."
                                value={customerSearch}
                                onChange={(e) => searchCustomers(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500"
                            />
                            {showCustomerDropdown && customers.length > 0 && (
                                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                                    {customers.map((c) => (
                                        <button key={c._id} onClick={() => selectCustomer(c)}
                                            className="w-full px-4 py-2.5 text-left hover:bg-white flex justify-between items-center">
                                            <div>
                                                <span className="text-sm text-slate-900">{c.name}</span>
                                                <span className="text-xs text-slate-500 ml-2">{c.phone}</span>
                                            </div>
                                            <span className="text-xs text-cyan-600">{c.customerId}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {selectedCustomer && (
                            <div className="mt-3 flex items-center gap-3 px-3 py-2 bg-cyan-50 border border-cyan-200 rounded-xl">
                                <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-600 text-xs font-bold">
                                    {selectedCustomer.name.charAt(0)}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm text-slate-900 font-medium">{selectedCustomer.name}</p>
                                    <p className="text-xs text-slate-500">{selectedCustomer.phone} • {selectedCustomer.customerId}</p>
                                </div>
                            </div>
                        )}
                        <button onClick={() => setShowAddCustomer(true)}
                            className="mt-3 text-sm text-cyan-600 hover:text-cyan-700 flex items-center gap-1">
                            <HiOutlinePlusCircle className="w-4 h-4" /> Quick Add New Customer
                        </button>
                    </div>

                    {/* Services */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <h2 className="text-base font-semibold text-slate-900 mb-4">Select Services</h2>
                        {selectedCustomer?.isPremium && (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                                Premium customer selected. Only this customer's linked custom services are shown below.
                            </p>
                        )}
                        {services.length === 0 ? (
                            <div className="text-sm text-slate-500 text-center py-6">No active services available</div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {services.map((s) => (
                                    <button key={s._id} onClick={() => addService(s)}
                                        className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all text-left group">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium text-slate-900 group-hover:text-cyan-700 transition-colors truncate">
                                                    {serviceTypeLabels[s.serviceType]?.split(' ')[0]} {s.name}
                                                </p>
                                                {s.isCustomerSpecific && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                                        Custom
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-0.5">{currency}{s.pricePerUnit}/{s.unit}</p>
                                        </div>
                                        <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center text-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <HiOutlinePlusCircle className="w-5 h-5" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Manual Items Section */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-semibold text-slate-900">Add Items (Bedsheet, Towel, etc.)</h2>
                            <button
                                onClick={addManualItem}
                                className="flex items-center gap-2 px-3 py-2 text-sm bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
                            >
                                <HiOutlinePlusCircle className="w-4 h-4" />
                                Add Item
                            </button>
                        </div>

                        {manualItems.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-4">No items added. Click "Add Item" to add bedsheet, towel, etc.</p>
                        ) : (
                            <div className="space-y-3">
                                {manualItems.map((item, i) => (
                                    <div key={i} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                            <div>
                                                <label className="block text-xs text-slate-600 mb-1">Item Type</label>
                                                <select
                                                    value={item.itemType}
                                                    onChange={(e) => updateManualItem(i, 'itemType', e.target.value)}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-cyan-500"
                                                >
                                                    <option value="Clothing">👕 Clothing</option>
                                                    <option value="Linen">🛏️ Linen</option>
                                                    <option value="Accessories">👜 Accessories</option>
                                                    <option value="Special_Items">⭐ Special Items</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-600 mb-1">Item Name</label>
                                                <input
                                                    type="text"
                                                    value={item.itemName}
                                                    onChange={(e) => updateManualItem(i, 'itemName', e.target.value)}
                                                    placeholder="e.g., Bedsheet, Towel, Shirt"
                                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-xs text-slate-600 mb-1">Quantity</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    step="any"
                                                    value={item.quantity}
                                                    onChange={(e) => updateManualItem(i, 'quantity', Number(e.target.value))}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-cyan-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-600 mb-1">Price per Item</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={item.pricePerUnit}
                                                    onChange={(e) => updateManualItem(i, 'pricePerUnit', Number(e.target.value))}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-cyan-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-600 mb-1">Subtotal</label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={`${currency}${item.subtotal}`}
                                                        readOnly
                                                        className="flex-1 px-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-900 font-medium"
                                                    />
                                                    <button
                                                        onClick={() => removeManualItem(i)}
                                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <HiOutlineTrash className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Special Instructions */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <h2 className="text-base font-semibold text-slate-900 mb-3">Details</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">Delivery Date</label>
                                <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500" />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">Discount %</label>
                                <input type="number" min={0} max={100} step="any" value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="block text-sm text-slate-600 mb-1">Special Instructions</label>
                            <textarea rows={3} value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)}
                                placeholder="Any special handling, stains, etc."
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 resize-none" />
                        </div>
                    </div>
                </div>

                {/* Right — Cart summary */}
                <div className="lg:col-span-1">
                    <div className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-5">
                        <h2 className="text-base font-semibold text-slate-900 mb-4">Order Summary</h2>

                        {items.length === 0 && manualItems.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-8">No items added yet</p>
                        ) : (
                            <div className="space-y-4 mb-5">
                                {/* Service Items */}
                                {items.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                            <span className="w-2 h-2 bg-cyan-500 rounded-full"></span>
                                            Services
                                        </h3>
                                        <div className="space-y-2">
                                            {items.map((item, i) => (
                                                <div key={i} className="p-3 rounded-xl border border-slate-200 bg-white space-y-2">
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm text-slate-900 font-medium truncate">{item.serviceName}</p>
                                                            <p className="text-xs text-slate-500">{currency}{item.pricePerUnit}/{item.unit}</p>
                                                        </div>
                                                        <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-300 mt-1">
                                                            <HiOutlineTrash className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    
                                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                                        <div className="flex items-center gap-1.5">
                                                            <button onClick={() => updateQty(i, -1)}
                                                                className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300">
                                                                <HiMinus className="w-3 h-3" />
                                                            </button>
                                                            <span className="text-sm text-slate-900 w-8 text-center font-medium">{item.quantity}</span>
                                                            <button onClick={() => updateQty(i, 1)}
                                                                className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300">
                                                                <HiPlus className="w-3 h-3" />
                                                            </button>
                                                            <span className="text-xs text-slate-500 ml-1">× {currency}{item.pricePerUnit}</span>
                                                        </div>
                                                        <span className="text-base text-slate-900 font-bold">{currency}{item.subtotal}</span>
                                                    </div>
                                                    
                                                    {/* Item Type and Name */}
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="block text-xs text-slate-500 mb-1">Item Type</label>
                                                            <select
                                                                value={item.itemType || 'Clothing'}
                                                                onChange={(e) => updateItemType(i, e.target.value)}
                                                                className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-cyan-500"
                                                            >
                                                                <option value="Clothing">👕 Clothing</option>
                                                                <option value="Linen">🛏️ Linen</option>
                                                                <option value="Accessories">👜 Accessories</option>
                                                                <option value="Special_Items">⭐ Special Items</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs text-slate-500 mb-1">Item Name</label>
                                                            <input
                                                                type="text"
                                                                value={item.itemName || ''}
                                                                onChange={(e) => updateItemName(i, e.target.value)}
                                                                placeholder="e.g., Shirt, Towel"
                                                                className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Manual Items */}
                                {manualItems.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                                            Items
                                        </h3>
                                        <div className="space-y-2">
                                            {manualItems.map((item, i) => (
                                                <div key={i} className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-medium">
                                                                    {item.itemType.replace('_', ' ')}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-slate-900 font-medium">
                                                                {item.itemName || 'Unnamed Item'}
                                                            </p>
                                                            <p className="text-xs text-slate-600">
                                                                {item.quantity} × {currency}{item.pricePerUnit} = {currency}{item.subtotal}
                                                            </p>
                                                        </div>
                                                        <button 
                                                            onClick={() => removeManualItem(i)} 
                                                            className="text-red-400 hover:text-red-600 p-1"
                                                        >
                                                            <HiOutlineTrash className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Totals */}
                        <div className="border-t border-slate-200 pt-4 space-y-2">
                            {/* Credit Balance Option */}
                            {selectedCustomer && selectedCustomer.creditBalance && selectedCustomer.creditBalance > 0 && (
                                <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={applyCreditBalance}
                                            onChange={(e) => setApplyCreditBalance(e.target.checked)}
                                            className="w-4 h-4 text-cyan-500 rounded focus:ring-cyan-500"
                                        />
                                        <span className="text-sm text-slate-700">
                                            Apply credit balance: <span className="font-semibold text-emerald-600">{currency}{selectedCustomer.creditBalance.toLocaleString()}</span>
                                        </span>
                                    </label>
                                </div>
                            )}
                            
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Subtotal</span>
                                <span className="text-slate-900">{currency}{subtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Tax ({taxPercent}%)</span>
                                <span className="text-slate-900">+{currency}{taxAmount.toLocaleString()}</span>
                            </div>
                            {discountPercent > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Discount ({discountPercent}%)</span>
                                    <span className="text-emerald-400">-{currency}{discountAmount.toLocaleString()}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-200">
                                <span className="text-slate-900">Total</span>
                                <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">{currency}{total.toLocaleString()}</span>
                            </div>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={loading || !selectedCustomer || (items.length === 0 && manualItems.length === 0)}
                            className="w-full mt-5 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-md shadow-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Creating...' : 'Create Order'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Add Customer Modal */}
            {showAddCustomer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4 bg-white border border-slate-200 rounded-2xl p-6 animate-fadeIn">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Add Customer</h3>
                        <form onSubmit={handleQuickAddCustomer} className="space-y-4">
                            <input type="text" required placeholder="Customer Name" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500" />
                            <input type="tel" required placeholder="Phone Number" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500" />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <input type="email" placeholder="Email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500" />
                                <select value={newCustomer.customerType} onChange={(e) => setNewCustomer({ ...newCustomer, customerType: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500">
                                    <option value="walk-in">Walk-in</option>
                                    <option value="corporate">Corporate</option>
                                </select>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={newCustomer.isPremium}
                                        onChange={(e) => toggleQuickPremium(e.target.checked)}
                                        className="w-4 h-4 text-cyan-500 rounded focus:ring-cyan-500"
                                    />
                                    <span className="text-sm font-medium text-slate-800">Premium customer</span>
                                </label>

                                {newCustomer.isPremium && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-xs text-slate-500">Add services only this customer can use.</p>
                                            <button
                                                type="button"
                                                onClick={addQuickCustomService}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500 text-white text-xs font-semibold hover:bg-cyan-600"
                                            >
                                                <HiOutlinePlusCircle className="w-4 h-4" />
                                                Add Service
                                            </button>
                                        </div>

                                        {newCustomer.customServices.map((service, index) => (
                                            <div key={index} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <input
                                                        type="text"
                                                        required={newCustomer.isPremium}
                                                        placeholder="Service name"
                                                        value={service.name}
                                                        onChange={(e) => updateQuickCustomService(index, 'name', e.target.value)}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                                                    />
                                                    <select
                                                        value={service.serviceType}
                                                        onChange={(e) => updateQuickCustomService(index, 'serviceType', e.target.value)}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-cyan-500"
                                                    >
                                                        {serviceTypes.map((type) => (
                                                            <option key={type} value={type}>{type}</option>
                                                        ))}
                                                    </select>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step="any"
                                                        value={service.pricePerUnit}
                                                        onChange={(e) => updateQuickCustomService(index, 'pricePerUnit', Number(e.target.value))}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-cyan-500"
                                                        placeholder={`Price (${currency})`}
                                                    />
                                                    <select
                                                        value={service.unit}
                                                        onChange={(e) => updateQuickCustomService(index, 'unit', e.target.value)}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-cyan-500"
                                                    >
                                                        {units.map((unit) => (
                                                            <option key={unit} value={unit}>{unit}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <textarea
                                                    rows={2}
                                                    value={service.description}
                                                    onChange={(e) => updateQuickCustomService(index, 'description', e.target.value)}
                                                    placeholder="Description"
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 resize-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeQuickCustomService(index)}
                                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-red-600 hover:bg-red-50"
                                                >
                                                    <HiOutlineTrash className="w-4 h-4" />
                                                    Remove Service
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setShowAddCustomer(false)}
                                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-white">Cancel</button>
                                <button type="submit"
                                    className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-500">Create & Select</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bulk Import Modal */}
            {showBulkImport && (
                <BulkOrderImport
                    onClose={() => setShowBulkImport(false)}
                    onSuccess={() => {
                        // Optionally navigate to orders page or refresh
                        navigate('/orders');
                    }}
                />
            )}
        </div>
    );
};

export default CreateOrder;
