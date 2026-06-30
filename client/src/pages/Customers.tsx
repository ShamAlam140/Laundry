import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useSettings } from '../context/SettingsContext';
import type { ICustomer } from '../types';
import Pagination from '../components/Pagination';
import {
    HiOutlineSearch,
    HiOutlinePlusCircle,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlinePhone,
    HiOutlineMail,
    HiOutlineX,
} from 'react-icons/hi';

type CustomServiceForm = {
    _id?: string;
    number: string;
    linenGroup: string;
    category: string;
    name: string;
    serviceType: string;
    description: string;
    colors: string;
    sizes: string;
    weight: string;
    pricePerUnit: number;
    unit: string;
    isExpress: boolean;
    expressSurchargePercent: number;
    isActive: boolean;
};

type CustomerFormState = {
    name: string;
    phone: string;
    email: string;
    address: string;
    customerType: string;
    isPremium: boolean;
    customServices: CustomServiceForm[];
    notificationFrequency: string;
    creditDays: number;
};

const serviceTypes = ['wash-fold', 'dry-cleaning', 'ironing', 'express', 'bulk-commercial'];
const units = ['piece', 'kg', 'bundle'];

const createEmptyCustomService = (): CustomServiceForm => ({
    number: '',
    linenGroup: '',
    category: '',
    name: '',
    serviceType: 'wash-fold',
    description: '',
    colors: '',
    sizes: '',
    weight: '',
    pricePerUnit: 0,
    unit: 'piece',
    isExpress: false,
    expressSurchargePercent: 50,
    isActive: true,
});

const createEmptyForm = (): CustomerFormState => ({
    name: '',
    phone: '',
    email: '',
    address: '',
    customerType: 'walk-in',
    isPremium: false,
    customServices: [],
    notificationFrequency: 'none',
    creditDays: 0,
});

const mapCustomService = (service: any): CustomServiceForm => ({
    _id: service._id,
    number: service.number || '',
    linenGroup: service.linenGroup || '',
    category: service.category || '',
    name: service.name || '',
    serviceType: service.serviceType || 'wash-fold',
    description: service.description || '',
    colors: service.colors || '',
    sizes: service.sizes || '',
    weight: service.weight || '',
    pricePerUnit: Number(service.pricePerUnit) || 0,
    unit: service.unit || 'piece',
    isExpress: Boolean(service.isExpress),
    expressSurchargePercent: Number(service.expressSurchargePercent) || 50,
    isActive: service.isActive !== false,
});

const Customers = () => {
    const [customers, setCustomers] = useState<ICustomer[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<ICustomer | null>(null);
    const { currency } = useSettings();
    const [form, setForm] = useState<CustomerFormState>(createEmptyForm());
    const [masterServices, setMasterServices] = useState<any[]>([]);
    const [serviceSearchQuery, setServiceSearchQuery] = useState('');
    const [showServiceDropdown, setShowServiceDropdown] = useState(false);
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const itemsPerPage = 20;

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            const params: any = { page: currentPage, limit: itemsPerPage };
            if (search) params.search = search;
            if (filterType) params.customerType = filterType;
            const res = await api.get('/customers', { params });
            setCustomers(res.data.data);
            setTotalPages(res.data.totalPages || 1);
            setTotalItems(res.data.total || 0);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to fetch customers');
        } finally {
            setLoading(false);
        }
    };

    const fetchMasterServices = async () => {
        try {
            const res = await api.get('/services');
            setMasterServices(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch master services', err);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, [filterType, currentPage]);

    useEffect(() => {
        fetchMasterServices();
    }, []);

    useEffect(() => {
        setCurrentPage(1); // Reset to page 1 when search changes
        const t = setTimeout(() => fetchCustomers(), 400);
        return () => clearTimeout(t);
    }, [search]);

    const openCreate = () => {
        setEditingCustomer(null);
        setForm(createEmptyForm());
        setShowModal(true);
    };

    const openEdit = async (c: ICustomer) => {
        setEditingCustomer(c);
        setForm({
            name: c.name,
            phone: c.phone,
            email: c.email || '',
            address: c.address || '',
            customerType: c.customerType,
            isPremium: Boolean(c.isPremium),
            customServices: [],
            notificationFrequency: c.notificationFrequency || 'none',
            creditDays: c.creditDays || 0,
        });
        setShowModal(true);

        try {
            const res = await api.get(`/customers/${c._id}`);
            const detail = res.data.data;
            setForm({
                name: detail.name,
                phone: detail.phone,
                email: detail.email || '',
                address: detail.address || '',
                customerType: detail.customerType,
                isPremium: Boolean(detail.isPremium),
                customServices: (detail.customServices || []).map(mapCustomService),
                notificationFrequency: detail.notificationFrequency || 'none',
                creditDays: detail.creditDays || 0,
            });
        } catch {
            // keep the list-row data if the detail request fails
        }
    };

    const togglePremium = (checked: boolean) => {
        setForm((prev) => ({
            ...prev,
            isPremium: checked,
            customServices: checked && prev.customServices.length === 0
                ? [createEmptyCustomService()]
                : prev.customServices,
        }));
    };

    const addCustomService = () => {
        setForm((prev) => ({
            ...prev,
            customServices: [...prev.customServices, createEmptyCustomService()],
        }));
    };

    const assignMasterService = (serviceId: string) => {
        if (!serviceId) return;
        const service = masterServices.find((s) => s._id === serviceId);
        if (!service) return;

        const exists = form.customServices.some(
            (s) => s.name.trim().toLowerCase() === service.name.trim().toLowerCase()
        );
        if (exists) {
            toast.error(`"${service.name}" is already assigned to this customer.`);
            return;
        }

        const newCustomService: CustomServiceForm = {
            number: service.number || '',
            linenGroup: service.linenGroup || '',
            category: service.category || '',
            name: service.name,
            serviceType: service.serviceType,
            description: service.description || '',
            colors: service.colors || '',
            sizes: service.sizes || '',
            weight: service.weight || '',
            pricePerUnit: service.pricePerUnit,
            unit: service.unit,
            isExpress: Boolean(service.isExpress),
            expressSurchargePercent: service.expressSurchargePercent || 50,
            isActive: true,
        };

        setForm((prev) => ({
            ...prev,
            customServices: [...prev.customServices, newCustomService],
        }));
        toast.success(`"${service.name}" assigned successfully!`);
    };

    const assignAllMasterServices = () => {
        const toAdd: CustomServiceForm[] = [];
        let skippedCount = 0;

        for (const service of masterServices) {
            const exists = form.customServices.some(
                (s) => s.name.trim().toLowerCase() === service.name.trim().toLowerCase()
            );
            if (exists) {
                skippedCount++;
                continue;
            }

            toAdd.push({
                number: service.number || '',
                linenGroup: service.linenGroup || '',
                category: service.category || '',
                name: service.name,
                serviceType: service.serviceType,
                description: service.description || '',
                colors: service.colors || '',
                sizes: service.sizes || '',
                weight: service.weight || '',
                pricePerUnit: service.pricePerUnit,
                unit: service.unit,
                isExpress: Boolean(service.isExpress),
                expressSurchargePercent: service.expressSurchargePercent || 50,
                isActive: true,
            });
        }

        if (toAdd.length === 0) {
            toast.error('All master services are already assigned.');
            return;
        }

        setForm((prev) => ({
            ...prev,
            customServices: [...prev.customServices, ...toAdd],
        }));
        toast.success(`Assigned ${toAdd.length} master services!${skippedCount > 0 ? ` (Skipped ${skippedCount} duplicates)` : ''}`);
    };

    const updateCustomService = (index: number, field: keyof CustomServiceForm, value: string | number | boolean) => {
        setForm((prev) => ({
            ...prev,
            customServices: prev.customServices.map((service, i) => (
                i === index ? { ...service, [field]: value } : service
            )),
        }));
    };

    const removeCustomService = (index: number) => {
        setForm((prev) => ({
            ...prev,
            customServices: prev.customServices.filter((_, i) => i !== index),
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...form,
                customServices: form.isPremium ? form.customServices : [],
            };

            if (editingCustomer) {
                await api.put(`/customers/${editingCustomer._id}`, payload);
                toast.success('Customer updated');
            } else {
                await api.post('/customers', payload);
                toast.success('Customer created');
            }
            setShowModal(false);
            fetchCustomers();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this customer?')) return;
        try {
            await api.delete(`/customers/${id}`);
            toast.success('Customer deleted');
            fetchCustomers();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed');
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
                    <p className="text-sm text-slate-500 mt-1">{customers.length} total customers</p>
                </div>
                <button onClick={openCreate} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-md shadow-cyan-500/30">
                    <HiOutlinePlusCircle className="w-5 h-5" /> Add Customer
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search by name, phone, email, ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                </div>
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer"
                >
                    <option value="">All Types</option>
                    <option value="walk-in">Walk-in</option>
                    <option value="corporate">Corporate</option>
                </select>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-slate-200 bg-white backdrop-blur-sm overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : customers.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">No customers found</div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-xs text-slate-500 uppercase border-b border-slate-200">
                                        <th className="px-5 py-3 text-left">ID</th>
                                        <th className="px-5 py-3 text-left">Name</th>
                                        <th className="px-5 py-3 text-left">Contact</th>
                                        <th className="px-5 py-3 text-left">Type</th>
                                        <th className="px-5 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {customers.map((c) => (
                                        <tr key={c._id} className="border-b border-slate-200 hover:bg-white transition-colors">
                                            <td className="px-5 py-3.5">
                                                <span className="text-sm font-medium text-cyan-600">{c.customerId}</span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-slate-900 font-medium">{c.name}</span>
                                                    {c.isPremium && (
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                                            Premium
                                                        </span>
                                                    )}
                                                </div>
                                                {c.address && <p className="text-xs text-slate-500 mt-0.5">{c.address}</p>}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-1 text-sm text-slate-600">
                                                    <HiOutlinePhone className="w-3.5 h-3.5" /> {c.phone}
                                                </div>
                                                {c.email && (
                                                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                                                        <HiOutlineMail className="w-3 h-3" /> {c.email}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-medium border capitalize ${c.customerType === 'corporate'
                                                    ? 'bg-purple-50 text-purple-600 border-purple-200'
                                                    : 'bg-white0/15 text-slate-500 border-slate-500/20'
                                                    }`}>
                                                    {c.customerType}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={() => openEdit(c)} className="p-2 rounded-lg text-slate-500 hover:text-cyan-600 hover:bg-white transition-colors">
                                                        <HiOutlinePencil className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(c._id)} className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-white transition-colors">
                                                        <HiOutlineTrash className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalItems}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                        />
                    </>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto mx-4 bg-white border border-slate-200 rounded-2xl p-6 animate-fadeIn">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-semibold text-slate-900">{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h3>
                            <button onClick={() => setShowModal(false)} className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100">
                                <HiOutlineX className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">Name *</label>
                                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500" />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">Phone *</label>
                                <input type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500" />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">Email</label>
                                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500" />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">Address</label>
                                <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500" />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">Type</label>
                                <select value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer">
                                    <option value="walk-in">Walk-in</option>
                                    <option value="corporate">Corporate</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">Invoice Notification Reminder Frequency</label>
                                <select value={form.notificationFrequency} onChange={(e) => setForm({ ...form, notificationFrequency: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer">
                                    <option value="none">No reminders</option>
                                    <option value="1_day">Every 1 day</option>
                                    <option value="3_days">Every 3 days</option>
                                    <option value="5_days">Every 5 days</option>
                                    <option value="1_week">Every 1 week</option>
                                    <option value="15_days">Every 15 days</option>
                                    <option value="1_month">Every 1 month</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">Credit Line (Days)</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={form.creditDays}
                                    onChange={(e) => setForm({ ...form, creditDays: parseInt(e.target.value) || 0 })}
                                    placeholder="e.g. 7, 15, 30 days"
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500"
                                />
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.isPremium}
                                        onChange={(e) => togglePremium(e.target.checked)}
                                        className="w-4 h-4 text-cyan-500 rounded focus:ring-cyan-500"
                                    />
                                    <span className="text-sm font-medium text-slate-800">Premium customer</span>
                                </label>

                                {form.isPremium && (
                                    <div className="space-y-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
                                            <p className="text-xs text-slate-500 max-w-sm">
                                                Custom services will be linked with this customer. Assign master services or add blank ones.
                                            </p>
                                            <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
                                                <div className="relative flex-1 min-w-[200px] max-w-[280px]">
                                                    <div className="relative">
                                                        <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                        <input
                                                            type="text"
                                                            placeholder="Search & Assign Master Service..."
                                                            value={serviceSearchQuery}
                                                            onChange={(e) => {
                                                                setServiceSearchQuery(e.target.value);
                                                                setShowServiceDropdown(true);
                                                            }}
                                                            onFocus={() => setShowServiceDropdown(true)}
                                                            onBlur={() => setTimeout(() => setShowServiceDropdown(false), 200)}
                                                            className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                                                        />
                                                        {serviceSearchQuery && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setServiceSearchQuery('')}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                            >
                                                                <HiOutlineX className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>

                                                    {showServiceDropdown && (
                                                        <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                            {masterServices.filter(ms => ms.isActive && ms.name.toLowerCase().includes(serviceSearchQuery.toLowerCase())).length === 0 ? (
                                                                <div className="p-3 text-xs text-slate-500 text-center">No services found</div>
                                                            ) : (
                                                                masterServices
                                                                    .filter(ms => ms.isActive && ms.name.toLowerCase().includes(serviceSearchQuery.toLowerCase()))
                                                                    .map((ms) => (
                                                                        <button
                                                                            key={ms._id}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                assignMasterService(ms._id);
                                                                                setServiceSearchQuery('');
                                                                                setShowServiceDropdown(false);
                                                                            }}
                                                                            className="w-full px-3 py-2 text-left hover:bg-slate-50 flex justify-between items-center text-xs text-slate-700 transition-colors"
                                                                        >
                                                                            <span className="font-medium truncate mr-2">{ms.name}</span>
                                                                            <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 shrink-0">
                                                                                {currency}{ms.pricePerUnit}/{ms.unit}
                                                                            </span>
                                                                        </button>
                                                                    ))
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={assignAllMasterServices}
                                                    className="px-3 py-2 rounded-lg border border-cyan-500 text-cyan-600 bg-cyan-50 hover:bg-cyan-100 text-xs font-semibold"
                                                >
                                                    Assign All
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={addCustomService}
                                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500 text-white text-xs font-semibold hover:bg-cyan-600"
                                                >
                                                    <HiOutlinePlusCircle className="w-4 h-4" />
                                                    Add Blank
                                                </button>
                                            </div>
                                        </div>

                                        {form.customServices.map((service, index) => (
                                            <div key={service._id || index} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    <div>
                                                        <label className="block text-xs text-slate-500 mb-1">Number</label>
                                                        <input
                                                            type="text"
                                                            value={service.number}
                                                            onChange={(e) => updateCustomService(index, 'number', e.target.value)}
                                                            placeholder="e.g. 3549"
                                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-cyan-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-slate-500 mb-1">Linen Group</label>
                                                        <input
                                                            type="text"
                                                            value={service.linenGroup}
                                                            onChange={(e) => updateCustomService(index, 'linenGroup', e.target.value)}
                                                            placeholder="e.g. Linen"
                                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-cyan-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-slate-500 mb-1">Category</label>
                                                        <input
                                                            type="text"
                                                            value={service.category}
                                                            onChange={(e) => updateCustomService(index, 'category', e.target.value)}
                                                            placeholder="e.g. Bed Linen"
                                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-cyan-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-slate-500 mb-1">Service Name *</label>
                                                        <input
                                                            type="text"
                                                            required={form.isPremium}
                                                            value={service.name}
                                                            onChange={(e) => updateCustomService(index, 'name', e.target.value)}
                                                            placeholder="Hotel, Air Bnb, etc."
                                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-cyan-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-slate-500 mb-1">Service Type</label>
                                                        <select
                                                            value={service.serviceType}
                                                            onChange={(e) => updateCustomService(index, 'serviceType', e.target.value)}
                                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-cyan-500"
                                                        >
                                                            {serviceTypes.map((type) => (
                                                                <option key={type} value={type}>{type}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-slate-500 mb-1">Price ({currency})</label>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            step="any"
                                                            value={service.pricePerUnit}
                                                            onChange={(e) => updateCustomService(index, 'pricePerUnit', Number(e.target.value))}
                                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-cyan-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-slate-500 mb-1">Unit</label>
                                                        <select
                                                            value={service.unit}
                                                            onChange={(e) => updateCustomService(index, 'unit', e.target.value)}
                                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-cyan-500"
                                                        >
                                                            {units.map((unit) => (
                                                                <option key={unit} value={unit}>{unit}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-slate-500 mb-1">Colors</label>
                                                        <input
                                                            type="text"
                                                            value={service.colors}
                                                            onChange={(e) => updateCustomService(index, 'colors', e.target.value)}
                                                            placeholder="e.g. White"
                                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-cyan-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-slate-500 mb-1">Sizes</label>
                                                        <input
                                                            type="text"
                                                            value={service.sizes}
                                                            onChange={(e) => updateCustomService(index, 'sizes', e.target.value)}
                                                            placeholder="e.g. Queen"
                                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-cyan-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-slate-500 mb-1">Weight</label>
                                                        <input
                                                            type="text"
                                                            value={service.weight}
                                                            onChange={(e) => updateCustomService(index, 'weight', e.target.value)}
                                                            placeholder="0"
                                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-cyan-500"
                                                        />
                                                    </div>
                                                </div>
                                                <textarea
                                                    rows={2}
                                                    value={service.description}
                                                    onChange={(e) => updateCustomService(index, 'description', e.target.value)}
                                                    placeholder="Description"
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 resize-none"
                                                />
                                                <div className="flex items-center justify-between gap-3">
                                                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={service.isActive}
                                                            onChange={(e) => updateCustomService(index, 'isActive', e.target.checked)}
                                                            className="w-4 h-4 text-cyan-500 rounded focus:ring-cyan-500"
                                                        />
                                                        Active
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeCustomService(index)}
                                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-red-600 hover:bg-red-50"
                                                    >
                                                        <HiOutlineTrash className="w-4 h-4" />
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)}
                                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-white transition-colors">Cancel</button>
                                <button type="submit"
                                    className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all">
                                    {editingCustomer ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Customers;
