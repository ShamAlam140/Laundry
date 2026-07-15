import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { useSettings } from '../context/SettingsContext';
import {
    HiOutlineCog,
    HiOutlineCurrencyRupee,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlinePlusCircle,
} from 'react-icons/hi';

type Tab = 'business' | 'billing' | 'services' | 'email';

interface ServiceRow {
    number: string;
    linenGroup: string;
    category: string;
    name: string;
    serviceType: string;
    colors: string;
    sizes: string;
    weight: string;
    pricePerUnit: number;
    unit: string;
    isExpress: boolean;
    expressSurchargePercent: number;
    isActive: boolean;
    description: string;
}

const createEmptyServiceRow = (): ServiceRow => ({
    number: '',
    linenGroup: '',
    category: '',
    name: '',
    serviceType: 'wash-fold',
    colors: '',
    sizes: '',
    weight: '',
    pricePerUnit: 0,
    unit: 'piece',
    isExpress: false,
    expressSurchargePercent: 50,
    isActive: true,
    description: '',
});

const serviceTypes = ['wash-fold', 'dry-cleaning', 'ironing', 'express', 'bulk-commercial'];
const units = ['kg', 'piece', 'bundle'];

const Settings = () => {
    const [activeTab, setActiveTab] = useState<Tab>('business');
    const [settings, setSettings] = useState<any>({});
    const [services, setServices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { currency, refreshSettings: refreshGlobalSettings } = useSettings();

    // Service modal
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [editService, setEditService] = useState<any>(null);
    const [serviceRows, setServiceRows] = useState<ServiceRow[]>([createEmptyServiceRow()]);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const res = await api.get('/settings');
            setSettings(res.data.data);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    };

    const fetchServices = async () => {
        try {
            const res = await api.get('/settings/services');
            setServices(res.data.data);
        } catch { /* ignore */ }
    };

    useEffect(() => {
        fetchSettings();
        fetchServices();
    }, []);

    const saveSettings = async () => {
        try {
            setSaving(true);
            await api.put('/settings', settings);
            toast.success('Settings saved!');
            refreshGlobalSettings();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const openServiceCreate = () => {
        setEditService(null);
        setServiceRows([createEmptyServiceRow()]);
        setShowServiceModal(true);
    };

    const openServiceEdit = (s: any) => {
        setEditService(s);
        setServiceRows([{
            number: s.number || '',
            linenGroup: s.linenGroup || '',
            category: s.category || '',
            name: s.name,
            serviceType: s.serviceType,
            colors: s.colors || '',
            sizes: s.sizes || '',
            weight: s.weight || '',
            pricePerUnit: s.pricePerUnit,
            unit: s.unit || 'piece',
            isExpress: s.isExpress || false,
            expressSurchargePercent: s.expressSurchargePercent || 50,
            isActive: s.isActive !== false,
            description: s.description || '',
        }]);
        setShowServiceModal(true);
    };

    const addServiceRow = () => {
        setServiceRows([...serviceRows, createEmptyServiceRow()]);
    };

    const removeServiceRow = (index: number) => {
        setServiceRows(serviceRows.filter((_, i) => i !== index));
    };

    const updateServiceRow = (index: number, field: keyof ServiceRow, value: any) => {
        setServiceRows(serviceRows.map((row, i) => i === index ? { ...row, [field]: value } : row));
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const fileName = file.name.toLowerCase();
        const reader = new FileReader();

        reader.onload = (evt) => {
            try {
                let rows: any[] = [];
                
                if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                    const data = evt.target?.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                    
                    // Normalize keys to lowercase & trimmed
                    rows = rawRows.map((r: any) => {
                        const normalized: any = {};
                        Object.keys(r).forEach(k => {
                            normalized[k.trim().toLowerCase()] = r[k];
                        });
                        return normalized;
                    });
                } else {
                    // Treat as text file (CSV, TSV, TXT)
                    const rawText = evt.target?.result as string;
                    const cleanText = rawText.replace(/^\uFEFF/, ''); // Strip BOM
                    
                    // Detect delimiter
                    const detectDelimiter = (text: string): string => {
                        const lines = text.slice(0, 1000).split('\n');
                        let commas = 0, tabs = 0, semis = 0;
                        lines.forEach(line => {
                            commas += (line.match(/,/g) || []).length;
                            tabs += (line.match(/\t/g) || []).length;
                            semis += (line.match(/;/g) || []).length;
                        });
                        if (tabs > commas && tabs > semis) return '\t';
                        if (semis > commas && semis > tabs) return ';';
                        return ',';
                    };

                    const delimiter = detectDelimiter(cleanText);
                    const lines = cleanText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
                    
                    if (lines.length >= 2) {
                        const parseLine = (line: string): string[] => {
                            const result: string[] = [];
                            let current = '';
                            let inQuotes = false;
                            for (let i = 0; i < line.length; i++) {
                                const char = line[i];
                                if (char === '"') {
                                    inQuotes = !inQuotes;
                                } else if (char === delimiter && !inQuotes) {
                                    result.push(current.trim());
                                    current = '';
                                } else {
                                    current += char;
                                }
                            }
                            result.push(current.trim());
                            return result;
                        };

                        const headers = parseLine(lines[0]).map(h => h.toLowerCase().trim());
                        for (let i = 1; i < lines.length; i++) {
                            const cells = parseLine(lines[i]);
                            const rowObj: any = {};
                            headers.forEach((header, index) => {
                                if (header) {
                                    rowObj[header] = cells[index] || '';
                                }
                            });
                            rows.push(rowObj);
                        }
                    }
                }

                // Map row data to ServiceRows
                const parsedRows = rows.map((r: any) => {
                    const numberVal = String(r['client number'] || r['number'] || r['ye number'] || r['yenumber'] || r['clientnumber'] || r['code'] || '').trim();
                    const linenGroupVal = String(r['linen group'] || r['group'] || r['linengroup'] || '').trim();
                    const categoryVal = String(r['category'] || '').trim();
                    const nameVal = String(r['name'] || r['service name'] || '').trim();
                    const colorsVal = String(r['colors'] || r['color'] || '0').trim();
                    const sizesVal = String(r['sizes'] || r['size'] || '0').trim();
                    const weightVal = String(r['weight'] || '0').trim();
                    const priceVal = Number(r['price'] || r['price per unit'] || r['priceperunit'] || 0);

                    return {
                        number: numberVal,
                        linenGroup: linenGroupVal,
                        category: categoryVal,
                        name: nameVal,
                        serviceType: 'wash-fold',
                        colors: colorsVal,
                        sizes: sizesVal,
                        weight: weightVal,
                        pricePerUnit: priceVal,
                        unit: 'piece',
                        isExpress: false,
                        expressSurchargePercent: 50,
                        isActive: true,
                        description: '',
                    };
                }).filter((r: any) => r.name);

                if (parsedRows.length === 0) {
                    toast.error('No services found in file or missing "Name" column');
                    return;
                }

                setServiceRows(parsedRows);
                toast.success(`Imported ${parsedRows.length} services from file! Review them in the table before saving.`);
            } catch (err) {
                toast.error('Failed to parse file. Make sure it is a valid Excel or CSV.');
                console.error(err);
            }
        };

        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            reader.readAsBinaryString(file);
        } else {
            reader.readAsText(file);
        }
    };

    const handleServiceSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const sanitizedRows = serviceRows.map(row => ({
                ...row,
                pricePerUnit: typeof row.pricePerUnit === 'number' && !isNaN(row.pricePerUnit) ? row.pricePerUnit : 0
            }));

            if (editService) {
                await api.put(`/settings/services/${editService._id}`, sanitizedRows[0]);
                toast.success('Service updated');
            } else {
                await api.post('/settings/services', sanitizedRows);
                toast.success('Services created');
            }
            setShowServiceModal(false);
            fetchServices();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed');
        }
    };

    const deleteService = async (id: string) => {
        if (!confirm('Delete this service?')) return;
        try {
            await api.delete(`/settings/services/${id}`);
            toast.success('Service deleted');
            fetchServices();
        } catch { toast.error('Failed'); }
    };

    const inputClass = 'w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-cyan-500';

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <HiOutlineCog className="w-6 h-6 text-cyan-600" /> Settings
            </h1>

            {/* Tabs */}
            <div className="flex gap-2">
                {([
                    { key: 'business' as Tab, label: '🏢 Business Profile' },
                    { key: 'billing' as Tab, label: '💰 Tax & Billing' },
                    { key: 'services' as Tab, label: '🧺 Services & Pricing' },
                    { key: 'email' as Tab, label: '📧 Email Templates' },
                ]).map(({ key, label }) => (
                    <button key={key} onClick={() => setActiveTab(key)}
                        className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === key
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
                            : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                            }`}>{label}</button>
                ))}
            </div>

            {/* Business Profile Tab */}
            {activeTab === 'business' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
                    <h2 className="text-base font-semibold text-slate-900">Business Information</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Business Name</label>
                            <input type="text" value={settings.businessName || ''} onChange={(e) => setSettings({ ...settings, businessName: e.target.value })} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Phone</label>
                            <input type="tel" value={settings.businessPhone || ''} onChange={(e) => setSettings({ ...settings, businessPhone: e.target.value })} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Email</label>
                            <input type="email" value={settings.businessEmail || ''} onChange={(e) => setSettings({ ...settings, businessEmail: e.target.value })} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Currency</label>
                            <select value={settings.currency || 'AUD$'} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} className={inputClass}>
                                <option value="₹">₹ — Indian Rupee (INR)</option>
                                <option value="AUD$">AUD$ — Australian Dollar (AUD)</option>
                                <option value="$">$ — US Dollar (USD)</option>
                                <option value="€">€ — Euro (EUR)</option>
                                <option value="£">£ — British Pound (GBP)</option>
                                <option value="¥">¥ — Japanese Yen (JPY)</option>
                                <option value="¥">¥ — Chinese Yuan (CNY)</option>
                                <option value="₩">₩ — South Korean Won (KRW)</option>
                                <option value="د.إ">د.إ — UAE Dirham (AED)</option>
                                <option value="﷼">﷼ — Saudi Riyal (SAR)</option>
                                <option value="د.ك">د.ك — Kuwaiti Dinar (KWD)</option>
                                <option value="د.ب">د.ب — Bahraini Dinar (BHD)</option>
                                <option value="ر.ع">ر.ع — Omani Rial (OMR)</option>
                                <option value="ر.ق">ر.ق — Qatari Riyal (QAR)</option>
                                <option value="C$">C$ — Canadian Dollar (CAD)</option>
                                <option value="AUD$">AUD$ — Australian Dollar (AUD)</option>
                                <option value="NZ$">NZ$ — New Zealand Dollar (NZD)</option>
                                <option value="S$">S$ — Singapore Dollar (SGD)</option>
                                <option value="HK$">HK$ — Hong Kong Dollar (HKD)</option>
                                <option value="CHF">CHF — Swiss Franc (CHF)</option>
                                <option value="R">R — South African Rand (ZAR)</option>
                                <option value="R$">R$ — Brazilian Real (BRL)</option>
                                <option value="₱">₱ — Philippine Peso (PHP)</option>
                                <option value="฿">฿ — Thai Baht (THB)</option>
                                <option value="₫">₫ — Vietnamese Dong (VND)</option>
                                <option value="Rp">Rp — Indonesian Rupiah (IDR)</option>
                                <option value="RM">RM — Malaysian Ringgit (MYR)</option>
                                <option value="₦">₦ — Nigerian Naira (NGN)</option>
                                <option value="KSh">KSh — Kenyan Shilling (KES)</option>
                                <option value="E£">E£ — Egyptian Pound (EGP)</option>
                                <option value="₺">₺ — Turkish Lira (TRY)</option>
                                <option value="zł">zł — Polish Zloty (PLN)</option>
                                <option value="Kč">Kč — Czech Koruna (CZK)</option>
                                <option value="kr">kr — Swedish Krona (SEK)</option>
                                <option value="₽">₽ — Russian Ruble (RUB)</option>
                                <option value="₸">₸ — Kazakhstani Tenge (KZT)</option>
                                <option value="৳">৳ — Bangladeshi Taka (BDT)</option>
                                <option value="රු">රු — Sri Lankan Rupee (LKR)</option>
                                <option value="Rs">Rs — Pakistani Rupee (PKR)</option>
                                <option value="Rs">Rs — Nepalese Rupee (NPR)</option>
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-xs text-slate-500 mb-1">Address</label>
                            <textarea rows={2} value={settings.businessAddress || ''} onChange={(e) => setSettings({ ...settings, businessAddress: e.target.value })}
                                className={`${inputClass} resize-none`} />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Tax Number Type</label>
                            <select value={settings.taxNumberLabel || 'GST Number'} onChange={(e) => setSettings({ ...settings, taxNumberLabel: e.target.value })} className={inputClass}>
                                <option value="GST Number">GST Number (India)</option>
                                <option value="ABN">ABN (Australia)</option>
                                <option value="EIN">EIN (USA)</option>
                                <option value="VAT Number">VAT Number (EU/UK)</option>
                                <option value="TIN">TIN (Tax ID Number)</option>
                                <option value="TRN">TRN (UAE)</option>
                                <option value="CR Number">CR Number (Saudi)</option>
                                <option value="Tax Number">Tax Number (Other)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">{settings.taxNumberLabel || 'GST Number'}</label>
                            <input type="text" value={settings.taxNumber || ''} onChange={(e) => setSettings({ ...settings, taxNumber: e.target.value })}
                                placeholder={`Enter your ${settings.taxNumberLabel || 'GST Number'}`} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Working Hours</label>
                            <input type="text" value={settings.workingHours || ''} onChange={(e) => setSettings({ ...settings, workingHours: e.target.value })} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Working Days</label>
                            <input type="text" value={settings.workingDays || ''} onChange={(e) => setSettings({ ...settings, workingDays: e.target.value })} className={inputClass} />
                        </div>
                    </div>
                    <button onClick={saveSettings} disabled={saving}
                        className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 transition-all shadow-lg shadow-md shadow-cyan-500/30">
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            )}

            {/* Tax & Billing Tab */}
            {activeTab === 'billing' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
                    <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                        <HiOutlineCurrencyRupee className="w-5 h-5 text-emerald-400" /> Tax & Billing Configuration
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Default Tax %</label>
                            <input type="number" min={0} max={100} step="any" value={settings.taxPercent ?? 5}
                                onChange={(e) => setSettings({ ...settings, taxPercent: Number(e.target.value) })} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Default Discount %</label>
                            <input type="number" min={0} max={100} step="any" value={settings.defaultDiscountPercent ?? 0}
                                onChange={(e) => setSettings({ ...settings, defaultDiscountPercent: Number(e.target.value) })} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Service Charge ({currency})</label>
                            <input type="number" min={0} step="any" value={settings.defaultServiceCharge ?? 0}
                                onChange={(e) => setSettings({ ...settings, defaultServiceCharge: Number(e.target.value) })} className={inputClass} />
                        </div>
                    </div>

                    <h3 className="text-sm font-semibold text-slate-900 pt-4">Invoice Settings</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Invoice Prefix</label>
                            <input type="text" value={settings.invoicePrefix || ''} onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Order Prefix</label>
                            <input type="text" value={settings.orderPrefix || ''} onChange={(e) => setSettings({ ...settings, orderPrefix: e.target.value })} className={inputClass} />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-xs text-slate-500 mb-1">Invoice Footer Text</label>
                            <textarea rows={2} value={settings.invoiceFooter || ''}
                                onChange={(e) => setSettings({ ...settings, invoiceFooter: e.target.value })}
                                className={`${inputClass} resize-none`} />
                        </div>
                    </div>
                    <button onClick={saveSettings} disabled={saving}
                        className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 transition-all shadow-lg shadow-md shadow-cyan-500/30">
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            )}

            {/* Email Templates Tab */}
            {activeTab === 'email' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
                    <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                        📧 Email Message Templates
                    </h2>
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Order Confirmation Email Intro</label>
                            <textarea rows={4} value={settings.orderEmailMessage || ''}
                                onChange={(e) => setSettings({ ...settings, orderEmailMessage: e.target.value })}
                                className={`${inputClass} resize-none`} />
                            <p className="text-[10px] text-slate-400 mt-1">Introductory text shown in the order confirmation email before the order summary table.</p>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Invoice Approved Email Intro</label>
                            <textarea rows={4} value={settings.invoiceEmailMessage || ''}
                                onChange={(e) => setSettings({ ...settings, invoiceEmailMessage: e.target.value })}
                                className={`${inputClass} resize-none`} />
                            <p className="text-[10px] text-slate-400 mt-1">Introductory text shown in the invoice approved email. Use <code>{`{invoiceId}`}</code> as a placeholder for the invoice ID.</p>
                        </div>
                    </div>
                    <button onClick={saveSettings} disabled={saving}
                        className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 transition-all shadow-lg shadow-md shadow-cyan-500/30">
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            )}

            {/* Services & Pricing Tab */}
            {activeTab === 'services' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-semibold text-slate-900">Service Types & Pricing</h2>
                        <button onClick={openServiceCreate}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-md shadow-cyan-500/30">
                            <HiOutlinePlusCircle className="w-4 h-4" /> Add Service
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {services.map((s: any) => (
                            <div key={s._id} className={`rounded-2xl border p-4 transition-colors ${s.isActive ? 'border-slate-200 bg-white' : 'border-red-500/20 bg-red-500/5 opacity-60'
                                }`}>
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-sm font-semibold text-slate-900 truncate">{s.name}</h3>
                                            {s.isCustomerSpecific && (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                                    Custom
                                                </span>
                                            )}
                                        </div>
                                        {s.isCustomerSpecific && (
                                            <p className="text-xs text-slate-500 mt-1">
                                                {s.customerPhone || 'No phone'}{s.customerId ? ` • ${s.customerId}` : ''}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => openServiceEdit(s)} className="p-1.5 text-slate-500 hover:text-cyan-600">
                                            <HiOutlinePencil className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => deleteService(s._id)} className="p-1.5 text-slate-500 hover:text-red-400">
                                            <HiOutlineTrash className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 capitalize mb-2">{s.serviceType.replace('-', ' ')}</p>
                                
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                    {s.number && (
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200/50 rounded-md text-[10px] font-semibold">
                                            #{s.number}
                                        </span>
                                    )}
                                    {s.linenGroup && (
                                        <span className="px-2 py-0.5 bg-cyan-50/50 text-cyan-700 border border-cyan-100 rounded-md text-[10px] font-medium">
                                            {s.linenGroup}
                                        </span>
                                    )}
                                    {s.category && (
                                        <span className="px-2 py-0.5 bg-purple-50/50 text-purple-700 border border-purple-100 rounded-md text-[10px] font-medium">
                                            {s.category}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-baseline gap-1 mb-3">
                                    <span className="text-lg font-bold text-cyan-600">{currency}{s.pricePerUnit}</span>
                                    <span className="text-xs text-slate-500">/{s.unit}</span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-2.5 text-[10px] text-slate-500">
                                    <div>Colors: <span className="font-semibold text-slate-700">{s.colors || '0'}</span></div>
                                    <div>Sizes: <span className="font-semibold text-slate-700">{s.sizes || '0'}</span></div>
                                    <div>Weight: <span className="font-semibold text-slate-700">{s.weight || '0'}</span></div>
                                </div>

                                {s.isExpress && (
                                    <span className="inline-block mt-2 px-2 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded-lg text-[10px] font-medium mr-2">
                                        ⚡ Express +{s.expressSurchargePercent}%
                                    </span>
                                )}
                                {!s.isActive && (
                                    <span className="inline-block mt-2 px-2 py-0.5 bg-red-500/15 text-red-400 border border-red-500/20 rounded-lg text-[10px] font-medium">
                                        Inactive
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Service Modal */}
            {showServiceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-[95vw] max-h-[90vh] overflow-y-auto mx-4 bg-white border border-slate-200 rounded-2xl p-6 animate-fadeIn flex flex-col">
                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                            <h3 className="text-lg font-semibold text-slate-900">{editService ? 'Edit Service' : 'Add Services'}</h3>
                            {!editService && (
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                                        <span>Import Excel/CSV</span>
                                        <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                                    </label>
                                    <button type="button" onClick={addServiceRow}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-semibold rounded-lg hover:from-cyan-400 hover:to-blue-500 transition-all shadow-md">
                                        <HiOutlinePlusCircle className="w-4 h-4" /> Add Row
                                    </button>
                                </div>
                            )}
                        </div>
                        <form onSubmit={handleServiceSubmit} className="space-y-4 flex-1 flex flex-col min-h-0">
                            <div className="overflow-x-auto border border-slate-200 rounded-xl flex-1 min-h-0">
                                <table className="w-full text-left border-collapse min-w-[1300px]">
                                    <thead>
                                        <tr className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                                            <th className="p-3 w-[100px]">Number</th>
                                            <th className="p-3 w-[120px]">Linen Group</th>
                                            <th className="p-3 w-[130px]">Category</th>
                                            <th className="p-3 w-[200px]">Name *</th>
                                            <th className="p-3 w-[150px]">Type</th>
                                            <th className="p-3 w-[80px]">Colors</th>
                                            <th className="p-3 w-[80px]">Sizes</th>
                                            <th className="p-3 w-[80px]">Weight</th>
                                            <th className="p-3 w-[120px]">Price *</th>
                                            <th className="p-3 w-[100px]">Unit</th>
                                            <th className="p-3 w-[80px] text-center">Express</th>
                                            <th className="p-3 w-[100px]">Surcharge %</th>
                                            <th className="p-3 w-[80px] text-center">Active</th>
                                            <th className="p-3">Description</th>
                                            {!editService && <th className="p-3 w-[60px] text-center">Action</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {serviceRows.map((row, index) => (
                                            <tr key={index} className="hover:bg-slate-50/50">
                                                <td className="p-2">
                                                    <input type="text" placeholder="3549" value={row.number}
                                                        onChange={(e) => updateServiceRow(index, 'number', e.target.value)}
                                                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-cyan-500" />
                                                </td>
                                                <td className="p-2">
                                                    <input type="text" placeholder="Linen" value={row.linenGroup}
                                                        onChange={(e) => updateServiceRow(index, 'linenGroup', e.target.value)}
                                                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-cyan-500" />
                                                </td>
                                                <td className="p-2">
                                                    <input type="text" placeholder="Bed Linen" value={row.category}
                                                        onChange={(e) => updateServiceRow(index, 'category', e.target.value)}
                                                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-cyan-500" />
                                                </td>
                                                <td className="p-2">
                                                    <input type="text" required placeholder="COG Blanket" value={row.name}
                                                        onChange={(e) => updateServiceRow(index, 'name', e.target.value)}
                                                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-cyan-500" />
                                                </td>
                                                <td className="p-2">
                                                    <select value={row.serviceType} onChange={(e) => updateServiceRow(index, 'serviceType', e.target.value)}
                                                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer">
                                                        {serviceTypes.map((t) => <option key={t} value={t}>{t.replace('-', ' ')}</option>)}
                                                    </select>
                                                </td>
                                                <td className="p-2">
                                                    <input type="text" placeholder="0" value={row.colors}
                                                        onChange={(e) => updateServiceRow(index, 'colors', e.target.value)}
                                                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-cyan-500" />
                                                </td>
                                                <td className="p-2">
                                                    <input type="text" placeholder="0" value={row.sizes}
                                                        onChange={(e) => updateServiceRow(index, 'sizes', e.target.value)}
                                                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-cyan-500" />
                                                </td>
                                                <td className="p-2">
                                                    <input type="text" placeholder="0" value={row.weight}
                                                        onChange={(e) => updateServiceRow(index, 'weight', e.target.value)}
                                                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-cyan-500" />
                                                </td>
                                                <td className="p-2">
                                                    <input type="number" min={0} step="any" placeholder="0.00" value={row.pricePerUnit || ''}
                                                        onChange={(e) => updateServiceRow(index, 'pricePerUnit', e.target.value === '' ? 0 : Number(e.target.value))}
                                                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-cyan-500" />
                                                </td>
                                                <td className="p-2">
                                                    <select value={row.unit} onChange={(e) => updateServiceRow(index, 'unit', e.target.value)}
                                                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer">
                                                        {units.map((u) => <option key={u} value={u}>{u}</option>)}
                                                    </select>
                                                </td>
                                                <td className="p-2 text-center">
                                                    <input type="checkbox" checked={row.isExpress}
                                                        onChange={(e) => updateServiceRow(index, 'isExpress', e.target.checked)}
                                                        className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer" />
                                                </td>
                                                <td className="p-2">
                                                    <input type="number" min={0} step="any" placeholder="50" disabled={!row.isExpress} value={row.expressSurchargePercent}
                                                        onChange={(e) => updateServiceRow(index, 'expressSurchargePercent', Number(e.target.value))}
                                                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-cyan-500 disabled:bg-slate-100 disabled:text-slate-400" />
                                                </td>
                                                <td className="p-2 text-center">
                                                    <input type="checkbox" checked={row.isActive}
                                                        onChange={(e) => updateServiceRow(index, 'isActive', e.target.checked)}
                                                        className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer" />
                                                </td>
                                                <td className="p-2">
                                                    <input type="text" placeholder="Description (optional)" value={row.description}
                                                        onChange={(e) => updateServiceRow(index, 'description', e.target.value)}
                                                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-cyan-500" />
                                                </td>
                                                {!editService && (
                                                    <td className="p-2 text-center">
                                                        <button type="button" onClick={() => removeServiceRow(index)} disabled={serviceRows.length === 1}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg disabled:opacity-30 transition-colors">
                                                            <HiOutlineTrash className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setShowServiceModal(false)}
                                    className="px-6 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                                <button type="submit"
                                    className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all shadow-md">
                                    {editService ? 'Update Service' : `Create ${serviceRows.length} Service(s)`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
