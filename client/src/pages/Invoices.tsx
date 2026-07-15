import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import * as XLSX from 'xlsx';
import {
    HiOutlineFilter,
    HiOutlineDownload,
    HiOutlinePrinter,
    HiOutlineEye,
    HiOutlineX,
    HiOutlineDocumentText,
    HiOutlineSearch,
    HiOutlineCalendar,
    HiOutlineChevronDown,
    HiOutlineUpload,
    HiOutlineTrash,
    HiOutlinePencil,
    HiOutlinePlus,
    HiCheck,
    HiOutlineCash,
} from 'react-icons/hi';

type DatePreset = 'today' | 'yesterday' | 'tomorrow' | 'last7' | 'last15' | 'last30' | '';
type BatchAction = '' | 'view' | 'pdf' | 'print';

const toDateInputValue = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const Invoices = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const activeTab = searchParams.get('tab') || 'standard';
    const { user } = useAuth();

    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { currency } = useSettings();
    const [viewInvoice, setViewInvoice] = useState<any>(null);
    const [batchAction, setBatchAction] = useState<BatchAction>('');

    // ── Edit Mode States ──
    const [isEditMode, setIsEditMode] = useState(false);
    const [editItems, setEditItems] = useState<any[]>([]);
    const [editDiscountPercent, setEditDiscountPercent] = useState(0);
    const [editTaxPercent, setEditTaxPercent] = useState(0);
    const [editServiceCharge, setEditServiceCharge] = useState(0);
    const [editSaving, setEditSaving] = useState(false);

    // ── Edit Mode Calculated Totals ──
    const editCalc = useMemo(() => {
        if (!isEditMode) return { subtotal: 0, taxAmount: 0, discountAmount: 0, totalAmount: 0, balanceDue: 0 };
        const billable = editItems.filter(item => item.serviceType !== 'manual');
        const subtotal = billable.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.pricePerUnit) || 0), 0);
        const taxAmount = (subtotal * (Number(editTaxPercent) || 0)) / 100;
        const discountAmount = (subtotal * (Number(editDiscountPercent) || 0)) / 100;
        const totalAmount = subtotal + taxAmount - discountAmount + (Number(editServiceCharge) || 0);
        const paidAmount = viewInvoice?.paidAmount || 0;
        const balanceDue = totalAmount - paidAmount;
        return { subtotal, taxAmount, discountAmount, totalAmount, balanceDue };
    }, [isEditMode, editItems, editDiscountPercent, editTaxPercent, editServiceCharge, viewInvoice?.paidAmount]);

    const enterEditMode = () => {
        if (!viewInvoice) return;
        const orderItems = viewInvoice.order?.items || [];
        setEditItems(orderItems.map((item: any) => ({
            ...item,
            quantity: item.shippedQuantity ?? item.quantity
        })));
        setEditDiscountPercent(viewInvoice.order?.discountPercent || 0);
        setEditTaxPercent(viewInvoice.order?.taxPercent || 0);
        setEditServiceCharge(viewInvoice.order?.serviceCharge || 0);
        setIsEditMode(true);
    };

    const exitEditMode = () => {
        setIsEditMode(false);
        setEditItems([]);
        setEditSaving(false);
    };

    const handleEditItemChange = (index: number, field: string, value: any) => {
        setEditItems(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            if (field === 'quantity' || field === 'pricePerUnit') {
                const qty = Number(field === 'quantity' ? value : updated[index].quantity) || 0;
                const rate = Number(field === 'pricePerUnit' ? value : updated[index].pricePerUnit) || 0;
                updated[index].subtotal = qty * rate;
            }
            return updated;
        });
    };

    const handleRemoveEditItem = (index: number) => {
        setEditItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddEditItem = () => {
        setEditItems(prev => [...prev, {
            serviceName: '',
            serviceType: 'service',
            itemName: '',
            itemType: 'Clothing',
            quantity: 1,
            unit: 'piece',
            pricePerUnit: 0,
            subtotal: 0,
            service: 'custom', // set a dummy or non-null value so it matches billable filters
        }]);
    };

    const handleSaveInvoice = async () => {
        if (!viewInvoice || editItems.length === 0) {
            toast.error('At least one item is required');
            return;
        }
        // Validate
        for (const item of editItems) {
            if (!Number(item.quantity) || Number(item.quantity) <= 0) {
                toast.error(`Item "${item.itemName || item.serviceName || 'Unnamed'}" must have quantity > 0`);
                return;
            }
            if (Number(item.pricePerUnit) < 0) {
                toast.error(`Item "${item.itemName || item.serviceName || 'Unnamed'}" has invalid price`);
                return;
            }
        }
        try {
            setEditSaving(true);
            const res = await api.put(`/invoices/${viewInvoice._id}`, {
                items: editItems,
                discountPercent: Number(editDiscountPercent) || 0,
                taxPercent: Number(editTaxPercent) || 0,
                serviceCharge: Number(editServiceCharge) || 0,
            });
            toast.success('Invoice updated successfully');
            setViewInvoice(res.data.data);
            exitEditMode();
            fetchInvoices();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update invoice');
        } finally {
            setEditSaving(false);
        }
    };
    const handleApproveInvoice = async (invoiceId: string) => {
        try {
            await api.put(`/invoices/${invoiceId}/approve`);
            toast.success('Invoice approved successfully!');
            fetchInvoices();
            // Refresh detailed invoice view if open
            if (viewInvoice && viewInvoice._id === invoiceId) {
                const res = await api.get(`/invoices/${invoiceId}`);
                setViewInvoice(res.data.data);
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to approve invoice');
        }
    };

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const itemsPerPage = 20;

    // ── Filters ──
    const [filterStatus, setFilterStatus] = useState('');
    const [filterCustomer, setFilterCustomer] = useState('');
    const [filterOrderId, setFilterOrderId] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [filterDatePreset, setFilterDatePreset] = useState<DatePreset>('');
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        if (location.state && location.state.searchOrderId) {
            setFilterOrderId(location.state.searchOrderId);
            if (location.state.tab) {
                setSearchParams({ tab: location.state.tab });
            }
        }
    }, [location.state, setSearchParams]);

    // ── Migrated Invoices States ──
    const [migratedInvoices, setMigratedInvoices] = useState<any[]>([]);
    const [migratedLoading, setMigratedLoading] = useState(false);
    const [migratedSearch, setMigratedSearch] = useState('');
    const [migratedPage, setMigratedPage] = useState(1);
    const [migratedTotalPages, setMigratedTotalPages] = useState(1);
    const [migratedTotalItems, setMigratedTotalItems] = useState(0);
    const [migratedTotalAmount, setMigratedTotalAmount] = useState(0);
    const [viewMigratedInvoice, setViewMigratedInvoice] = useState<any>(null);

    const fetchMigratedInvoices = async () => {
        try {
            setMigratedLoading(true);
            const params = {
                page: migratedPage,
                limit: itemsPerPage,
                search: migratedSearch || undefined,
            };
            const res = await api.get('/invoices/migrated', { params });
            setMigratedInvoices(res.data.data);
            setMigratedTotalPages(res.data.totalPages || 1);
            setMigratedTotalItems(res.data.total || 0);
            setMigratedTotalAmount(res.data.totalAmountSum || 0);
        } catch (err) {
            toast.error('Failed to fetch migrated invoices');
        } finally {
            setMigratedLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'migrated') {
            fetchMigratedInvoices();
        }
    }, [activeTab, migratedPage, migratedSearch]);

    // CSV header mapping helper
    const normalizeKey = (key: string) => key.replace(/^\*/, '').replace(/\s+/g, '').toLowerCase();

    const mapRow = (row: any) => {
        const mapped: any = {};
        for (const key of Object.keys(row)) {
            const norm = normalizeKey(key);
            mapped[norm] = row[key];
        }
        return {
            contactName: mapped['customer'] || mapped['contactname'],
            emailAddress: mapped['emailaddress'],
            poAddressLine1: mapped['poaddressline1'],
            poAddressLine2: mapped['poaddressline2'],
            poAddressLine3: mapped['poaddressline3'],
            poAddressLine4: mapped['poaddressline4'],
            poCity: mapped['pocity'],
            poRegion: mapped['poregion'],
            poPostalCode: mapped['popostalcode'],
            poCountry: mapped['pocountry'],
            invoiceNumber: (mapped['invoice#'] || mapped['invoice'] || mapped['invoicenumber'])?.toString()?.trim(),
            reference: mapped['reference'] || mapped['department'],
            invoiceDate: mapped['date'] || mapped['invoicedate'],
            dueDate: mapped['duedate'] || mapped['due-date'],
            inventoryItemCode: mapped['inventoryitemcode'] || '',
            description: mapped['description'] || mapped['status'] || 'Imported Invoice',
            quantity: parseFloat(mapped['quantity']) || 1,
            unitAmount: parseFloat(mapped['unitamount']) || parseFloat(mapped['amount(aud)']) || parseFloat(mapped['amount']) || 0,
            discount: parseFloat(mapped['discount']) || 0,
            accountCode: mapped['accountcode'] || '400',
            taxType: mapped['taxtype'] || 'GST',
            trackingName1: mapped['trackingname1'],
            trackingOption1: mapped['trackingoption1'],
            trackingName2: mapped['trackingname2'],
            trackingOption2: mapped['trackingoption2'],
            currency: mapped['currency'] || 'AUD',
            brandingTheme: mapped['brandingtheme']
        };
    };

    const parseImportDate = (val: any): Date | null => {
        if (!val) return null;
        if (val instanceof Date) return val;
        if (typeof val === 'number') {
            return new Date((val - 25569) * 86400 * 1000);
        }
        const date = new Date(val);
        if (!isNaN(date.getTime())) return date;
        
        if (typeof val === 'string') {
            const parts = val.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                const customDate = new Date(year, month, day);
                if (!isNaN(customDate.getTime())) return customDate;
            }
        }
        return null;
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];

                // Read sheet as array of arrays to dynamically find where headers start
                const rowsData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
                if (rowsData.length === 0) {
                    toast.error("The file is empty.");
                    return;
                }

                // Find header row index
                let headerRowIndex = 0;
                for (let i = 0; i < Math.min(rowsData.length, 15); i++) {
                    const row = rowsData[i];
                    if (Array.isArray(row)) {
                        const normalizedCells = row.map(cell => cell ? String(cell).trim().toLowerCase() : '');
                        const hasInvoice = normalizedCells.some(c => c.includes('invoice'));
                        const hasDate = normalizedCells.some(c => c.includes('date'));
                        const hasCustomer = normalizedCells.some(c => c.includes('customer') || c.includes('contact'));
                        if ((hasInvoice && hasDate) || (hasInvoice && hasCustomer)) {
                            headerRowIndex = i;
                            break;
                        }
                    }
                }

                const headerRow = rowsData[headerRowIndex];
                if (!headerRow || headerRow.length === 0) {
                    toast.error("Could not find table headers in the sheet.");
                    return;
                }

                const rawData: any[] = [];

                // Convert data rows below header row to objects
                for (let i = headerRowIndex + 1; i < rowsData.length; i++) {
                    const row = rowsData[i];
                    if (Array.isArray(row) && row.length > 0) {
                        const obj: any = {};
                        let hasData = false;
                        headerRow.forEach((header, index) => {
                            if (header !== undefined && header !== null && String(header).trim() !== '') {
                                obj[String(header).trim()] = row[index];
                                if (row[index] !== undefined && row[index] !== null && row[index] !== '') {
                                    hasData = true;
                                }
                            }
                        });
                        if (hasData) {
                            rawData.push(obj);
                        }
                    }
                }

                if (rawData.length === 0) {
                    toast.error("No valid data rows found in the sheet.");
                    return;
                }

                const invoicesMap: { [key: string]: any } = {};
                let invalidRows = 0;

                for (const row of rawData as any[]) {
                    const mapped = mapRow(row);

                    const invNum = String(mapped.invoiceNumber || '').trim();
                    const contactName = String(mapped.contactName || '').trim();

                    // Skip header/footer summary rows
                    if (
                        !invNum || 
                        !contactName || 
                        invNum.toLowerCase().includes('total') || 
                        contactName.toLowerCase().includes('total') ||
                        invNum.toLowerCase().includes('report')
                    ) {
                        continue;
                    }

                    if (!mapped.invoiceDate || !mapped.dueDate) {
                        invalidRows++;
                        continue;
                    }

                    const invoiceDate = parseImportDate(mapped.invoiceDate);
                    const dueDate = parseImportDate(mapped.dueDate);

                    if (!invoiceDate || !dueDate) {
                        invalidRows++;
                        continue;
                    }

                    const quantity = parseFloat(String(mapped.quantity)) || 1;
                    const unitAmount = parseFloat(String(mapped.unitAmount)) || 0;
                    const discount = parseFloat(String(mapped.discount)) || 0;

                    const lineItem = {
                        inventoryItemCode: mapped.inventoryItemCode || '',
                        description: mapped.description || 'No description',
                        quantity,
                        unitAmount,
                        discount,
                        accountCode: mapped.accountCode || '',
                        taxType: mapped.taxType || '',
                        trackingName1: mapped.trackingName1 || '',
                        trackingOption1: mapped.trackingOption1 || '',
                        trackingName2: mapped.trackingName2 || '',
                        trackingOption2: mapped.trackingOption2 || '',
                    };

                    const lineAmount = (quantity * unitAmount) - discount;

                    if (!invoicesMap[invNum]) {
                        invoicesMap[invNum] = {
                            invoiceNumber: invNum,
                            contactName: mapped.contactName,
                            emailAddress: mapped.emailAddress || '',
                            poAddressLine1: mapped.poAddressLine1 || '',
                            poAddressLine2: mapped.poAddressLine2 || '',
                            poAddressLine3: mapped.poAddressLine3 || '',
                            poAddressLine4: mapped.poAddressLine4 || '',
                            poCity: mapped.poCity || '',
                            poRegion: mapped.poRegion || '',
                            poPostalCode: mapped.poPostalCode || '',
                            poCountry: mapped.poCountry || '',
                            reference: mapped.reference || '',
                            invoiceDate,
                            dueDate,
                            currency: mapped.currency || 'AUD',
                            brandingTheme: mapped.brandingTheme || '',
                            lineItems: [lineItem],
                            totalAmount: lineAmount,
                        };
                    } else {
                        invoicesMap[invNum].lineItems.push(lineItem);
                        invoicesMap[invNum].totalAmount += lineAmount;
                    }
                }

                const invoicesToImport = Object.values(invoicesMap);
                if (invoicesToImport.length === 0) {
                    toast.error("No valid invoices found to import.");
                    return;
                }

                // Batch size of 500 invoices per request to avoid payload limits
                const BATCH_SIZE = 500;
                let importedTotal = 0;
                let skippedTotal = 0;

                const uploadBatches = async () => {
                    for (let i = 0; i < invoicesToImport.length; i += BATCH_SIZE) {
                        const batch = invoicesToImport.slice(i, i + BATCH_SIZE);
                        const res = await api.post('/invoices/migrated/import', { invoices: batch });
                        importedTotal += res.data.importedCount || 0;
                        skippedTotal += res.data.skippedCount || 0;
                    }
                    return `Successfully imported ${importedTotal} invoices. Skipped ${skippedTotal} duplicates.`;
                };

                await toast.promise(uploadBatches(), {
                    loading: `Importing ${invoicesToImport.length} invoices in batches...`,
                    success: (msg: string) => {
                        setMigratedPage(1);
                        fetchMigratedInvoices();
                        return msg;
                    },
                    error: 'Failed to import invoices.'
                });

                if (invalidRows > 0) {
                    toast(`${invalidRows} rows had missing or invalid required columns and were skipped.`, { icon: '⚠️' });
                }

            } catch (err: any) {
                toast.error(`Error reading file: ${err.message || err}`);
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const handleClearMigrated = async () => {
        if (user?.role !== 'admin') {
            toast.error('Only Admins can clear migrated invoices');
            return;
        }
        if (!window.confirm("Are you sure you want to delete all migrated invoices? This action cannot be undone.")) {
            return;
        }

        try {
            await api.delete('/invoices/migrated');
            toast.success("All migrated invoices cleared successfully.");
            fetchMigratedInvoices();
        } catch (err) {
            toast.error("Failed to clear migrated invoices.");
        }
    };

    const handleExportMigrated = async (format: 'xlsx' | 'csv') => {
        try {
            toast.loading(`Preparing export data...`, { id: 'export-toast' });
            // Fetch all migrated invoices
            const res = await api.get('/invoices/migrated', { params: { limit: 100000, search: migratedSearch || undefined } });
            const allInvoices = res.data.data;

            if (!allInvoices || allInvoices.length === 0) {
                toast.error('No migrated invoices to export.', { id: 'export-toast' });
                return;
            }

            // Map data to columns matching the spreadsheet
            const exportData = allInvoices.map((inv: any) => ({
                'Invoice#': inv.invoiceNumber,
                'Date': inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
                'Customer': inv.contactName,
                'Reference': inv.reference || '',
                'Amount (AUD)': inv.totalAmount,
                'Status': inv.lineItems?.[0]?.description || 'Imported Invoice',
                'Due Date': inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
            }));

            // Create worksheet
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Migrated Invoices');

            if (format === 'xlsx') {
                XLSX.writeFile(workbook, `migrated_invoices_${Date.now()}.xlsx`);
            } else {
                XLSX.writeFile(workbook, `migrated_invoices_${Date.now()}.csv`, { bookType: 'csv' });
            }

            toast.success(`Exported ${allInvoices.length} invoices successfully!`, { id: 'export-toast' });
        } catch (err: any) {
            toast.error(`Export failed: ${err.message || err}`, { id: 'export-toast' });
        }
    };

    const downloadTemplate = () => {
        const headers = "*ContactName,EmailAddress,POAddressLine1,POAddressLine2,POAddressLine3,POAddressLine4,POCity,PORegion,POPostalCode,POCountry,*InvoiceNumber,Reference,*InvoiceDate,*DueDate,InventoryItemCode,*Description,*Quantity,*UnitAmount,Discount,*AccountCode,*TaxType,TrackingName1,TrackingOption1,TrackingName2,TrackingOption2,Currency,BrandingTheme";
        const sampleRow = "John Doe,john@example.com,123 Main St,,,,Sydney,NSW,2000,Australia,INV-OLD-001,REF-100,2026-05-14,2026-06-14,ITEM-01,Dry Cleaning Service,2,30,0,400,GST,Region,East,,,AUD,Standard Theme";
        const csvContent = "data:text/csv;charset=utf-8," + [headers, sampleRow].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "SalesInvoiceTemplate.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const fetchInvoices = async () => {
        try {
            setLoading(true);
            const params: any = { page: currentPage, limit: itemsPerPage };
            if (filterStatus) params.paymentStatus = filterStatus;
            if (activeTab === 'pending') {
                params.isApproved = 'false';
            }
            
            const res = await api.get('/invoices', { params });
            setInvoices(res.data.data);
            setTotalPages(res.data.totalPages || 1);
            setTotalItems(res.data.total || 0);
        } catch (err: any) {
            toast.error('Failed to fetch invoices');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab !== 'migrated') {
            fetchInvoices();
        }
    }, [currentPage, filterStatus, activeTab]);

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab]);

    // ── Client-side filtering ──
    const filteredInvoices = useMemo(() => {
        return invoices.filter((inv) => {
            if (filterStatus && inv.paymentStatus !== filterStatus) return false;
            if (filterCustomer) {
                const q = filterCustomer.toLowerCase();
                const name = (inv.customer?.name || '').toLowerCase();
                const phone = (inv.customer?.phone || '').toLowerCase();
                const customerId = (inv.customer?.customerId || '').toLowerCase();
                if (!name.includes(q) && !phone.includes(q) && !customerId.includes(q)) return false;
            }
            if (filterOrderId) {
                const q = filterOrderId.toLowerCase();
                if (!(inv.order?.orderId || '').toLowerCase().includes(q) &&
                    !(inv.invoiceId || '').toLowerCase().includes(q)) return false;
            }
            if (filterDateFrom) {
                const invDate = new Date(inv.createdAt);
                const from = new Date(filterDateFrom);
                from.setHours(0, 0, 0, 0);
                if (invDate < from) return false;
            }
            if (filterDateTo) {
                const invDate = new Date(inv.createdAt);
                const to = new Date(filterDateTo);
                to.setHours(23, 59, 59, 999);
                if (invDate > to) return false;
            }
            return true;
        });
    }, [invoices, filterStatus, filterCustomer, filterOrderId, filterDateFrom, filterDateTo]);

    const hasDateFilter = Boolean(filterDateFrom || filterDateTo);
    const activeFilterCount = [filterStatus, filterCustomer, filterOrderId, hasDateFilter ? 'date' : ''].filter(Boolean).length;
    const hasActiveFilters = activeFilterCount > 0;

    const clearFilters = () => {
        setFilterStatus('');
        setFilterCustomer('');
        setFilterOrderId('');
        setFilterDateFrom('');
        setFilterDateTo('');
        setFilterDatePreset('');
    };

    const applyDatePreset = (preset: DatePreset) => {
        setFilterDatePreset(preset);
        if (!preset) {
            setFilterDateFrom('');
            setFilterDateTo('');
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (preset === 'today') {
            setFilterDateFrom(toDateInputValue(today));
            setFilterDateTo(toDateInputValue(today));
        } else if (preset === 'yesterday') {
            const y = new Date(today);
            y.setDate(y.getDate() - 1);
            setFilterDateFrom(toDateInputValue(y));
            setFilterDateTo(toDateInputValue(y));
        } else if (preset === 'tomorrow') {
            const t = new Date(today);
            t.setDate(t.getDate() + 1);
            setFilterDateFrom(toDateInputValue(t));
            setFilterDateTo(toDateInputValue(t));
        } else if (preset === 'last7') {
            const w = new Date(today);
            w.setDate(w.getDate() - 6);
            setFilterDateFrom(toDateInputValue(w));
            setFilterDateTo(toDateInputValue(today));
        } else if (preset === 'last15') {
            const w = new Date(today);
            w.setDate(w.getDate() - 14);
            setFilterDateFrom(toDateInputValue(w));
            setFilterDateTo(toDateInputValue(today));
        } else if (preset === 'last30') {
            const m = new Date(today);
            m.setDate(m.getDate() - 29);
            setFilterDateFrom(toDateInputValue(m));
            setFilterDateTo(toDateInputValue(today));
        }
    };

    const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
        paid: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
        partial: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
        unpaid: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
    };

    const viewInvoiceDetail = async (id: string) => {
        try {
            const res = await api.get(`/invoices/${id}`);
            setViewInvoice(res.data.data);
        } catch {
            toast.error('Failed to load invoice');
        }
    };

    /* ─────────────────────────────────────────────
       Generate printable HTML - MATCHES MODAL EXACTLY
    ───────────────────────────────────────────── */
    const generateInvoiceHTML = (inv: any, format: 'a4' | 'thermal' = 'a4') => {
        const biz = inv.business || {};
        const customer = inv.customer || inv.order?.customer || {};
        const order = inv.order || {};
        const items = order.items || [];
        const payments = inv.payments || [];

        /* ── THERMAL ── */
        if (format === 'thermal') {
            // Separate items into sections (same as A4)
            const allItems = items || [];
            const services = allItems.filter((item: any) => !item.isRefunded && item.serviceType !== 'manual' && item.service);
            const refundedItems = allItems.filter((item: any) => item.isRefunded);
            
            return `
                <html><head><title>Receipt - ${inv.invoiceId}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Courier New', monospace; width: 80mm; padding: 8mm; font-size: 11px; color: #000; }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .line { border-top: 1px dashed #000; margin: 6px 0; }
                    .row { display: flex; justify-content: space-between; margin: 2px 0; }
                    .item-row { margin: 4px 0; }
                    .section-header { font-weight: bold; font-size: 10px; margin: 6px 0 3px; text-transform: uppercase; }
                    .strike { text-decoration: line-through; color: #666; }
                    .refund { color: #000; }
                    h1 { font-size: 15px; margin-bottom: 2px; }
                    h2 { font-size: 12px; margin: 4px 0; }
                    .small { font-size: 9px; color: #555; }
                    .info { font-size: 9px; color: #666; font-style: italic; margin: 3px 0; }
                    @media print { body { width: 80mm; } @page { size: 80mm auto; margin: 0; } }
                </style></head><body>
                    <div class="center">
                        <img src="${window.location.origin}/logo.jpeg" style="max-height: 35px; margin-bottom: 4px;" alt="Logo" />
                        <h1>${biz.name || 'Peninsula Laundries'}</h1>
                        <p class="small">${biz.address || ''}</p>
                        <p class="small">${biz.phone || ''} ${biz.email ? '| ' + biz.email : ''}</p>
                        ${biz.taxNumber ? `<p class="small" style="margin-top: 2px;">ABN: ${biz.taxNumber}</p>` : ''}
                    </div>
                    <div class="line"></div>
                    <div class="center"><h2>TAX INVOICE</h2></div>
                    <div class="row"><span>Invoice:</span><span class="bold">${inv.invoiceId}</span></div>
                    <div class="row"><span>Order:</span><span>${order.orderId || '-'}</span></div>
                    <div class="row"><span>Date:</span><span>${new Date(inv.createdAt).toLocaleDateString('en-AU')}</span></div>
                    <div class="row"><span>Customer:</span><span>${customer.name || '-'}</span></div>
                    <div class="row"><span>Phone:</span><span>${customer.phone || '-'}</span></div>
                    <div class="line"></div>
                    
                    ${services.length > 0 ? `
                        <div class="section-header">SERVICES - BILLABLE</div>
                        ${services.map((item: any) => {
                            const qty = item.shippedQuantity ?? item.quantity;
                            const hasDiff = item.shippedQuantity !== null && item.shippedQuantity !== undefined && item.shippedQuantity !== item.quantity;
                            return `
                                <div class="item-row">
                                    <div class="bold">${item.serviceName || item.itemName}</div>
                                    <div class="row small">
                                        <span>${qty}${hasDiff ? ` (ordered: ${item.quantity})` : ''} × ${currency}${Number(item.pricePerUnit || 0).toFixed(2)}</span>
                                        <span class="bold">${currency}${Number(item.subtotal || 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    ` : ''}

                    
                    ${refundedItems.length > 0 ? `
                        <div class="section-header">REFUNDED ITEMS</div>
                        ${refundedItems.map((item: any) => `
                            <div class="item-row refund">
                                <div class="bold">${item.serviceName || item.itemName}</div>
                                ${item.refundReason ? `<div class="small">Reason: ${item.refundReason}</div>` : ''}
                                <div class="row small">
                                    <span>${item.damagedQuantity || item.quantity} × ${currency}${Number(item.pricePerUnit || 0).toFixed(2)}</span>
                                    <span class="bold">-${currency}${Number(item.refundAmount || item.subtotal || 0).toFixed(2)}</span>
                                </div>
                            </div>
                        `).join('')}
                    ` : ''}
                    
                    <div class="line"></div>
                    <div class="row"><span>Subtotal</span><span>${currency}${Number(inv.subtotal || 0).toFixed(2)}</span></div>
                    <div class="row"><span>Tax (${inv.taxPercent || 0}%)</span><span>${currency}${Number(inv.taxAmount || 0).toFixed(2)}</span></div>
                    ${(inv.discountAmount || 0) > 0 ? `<div class="row"><span>Discount</span><span>-${currency}${Number(inv.discountAmount).toFixed(2)}</span></div>` : ''}
                    <div class="line"></div>
                    <div class="row bold" style="font-size: 13px;"><span>TOTAL</span><span>${currency}${Number(inv.totalAmount || 0).toFixed(2)}</span></div>
                    <div class="row"><span>Paid</span><span>${currency}${Number(inv.paidAmount || 0).toFixed(2)}</span></div>
                    <div class="row bold">
                        <span>${(inv.balanceDue || 0) < 0 ? 'Refund Due' : 'Balance Due'}</span>
                        <span>${(inv.balanceDue || 0) < 0 ? '-' : ''}${currency}${Math.abs(Number(inv.balanceDue || 0)).toFixed(2)}</span>
                    </div>
                    <div class="line"></div>
                    ${payments.length > 0 ? `
                        <div class="center bold small" style="margin-bottom: 4px;">PAYMENTS</div>
                        ${payments.map((p: any) => `
                            <div class="row small"><span>${p.paymentMethod} - ${new Date(p.createdAt).toLocaleDateString('en-AU')}</span><span>${currency}${p.amount}</span></div>
                        `).join('')}
                        <div class="line"></div>
                    ` : ''}
                    <div class="center small" style="margin-top: 6px;">
                        <p>Thank you for choosing us!</p>
                        <p style="margin-top: 3px;">*** ${biz.name || 'Peninsula Laundries'} ***</p>
                    </div>
                </body></html>
            `;
        }

        /* ── A4 Professional Invoice - MATCHES MODAL EXACTLY ── */
        const invoiceDate = new Date(inv.createdAt);
        const creditDays = inv.customer?.creditDays || 0;
        const fallbackDueDateStr = creditDays > 0 
            ? new Date(new Date(inv.createdAt).setDate(new Date(inv.createdAt).getDate() + creditDays)).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
            : 'DUE ON RECEIPT';
        const dueDateStr = inv.dueDate
            ? new Date(inv.dueDate).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
            : fallbackDueDateStr;
        const invoiceDateStr = invoiceDate.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();

        // Separate items into sections (SAME AS MODAL)
        const allItems = items || [];
        const services = allItems.filter((item: any) => !item.isRefunded && item.serviceType !== 'manual' && item.service);
        const refundedItems = allItems.filter((item: any) => item.isRefunded);
        
        const deliveryDate = order.deliveryDate;
        const formattedDate = deliveryDate 
            ? new Date(deliveryDate).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—';

        const subtotal = inv.subtotal || 0;
        const taxAmount = inv.taxAmount || 0;
        const totalAmount = inv.totalAmount || 0;
        const paidAmount = inv.paidAmount || 0;
        const balanceDue = inv.balanceDue || 0;
        const discountAmount = inv.discountAmount || 0;
        const invoiceNumber = inv.invoiceNumber || inv.invoiceId || '';
        const paymentAccountName = biz.bankAccountName || 'JSP CORPORATION PTY LTD';
        const paymentBank = biz.bankName || 'ANZ';
        const paymentBSB = biz.bankBSB || '012787';
        const paymentAccountNo = biz.bankAccountNo || '';
        const abn = biz.taxNumber || biz.abn || '31647801045';
        const terms = inv.terms || (creditDays > 0 ? `NET ${creditDays}` : 'Due on Receipt');

        // Inline styles object (like mrLuxury approach)
        const styles = {
            page: 'max-width: 900px; margin: 0 auto; padding: 24px; font-family: Arial, sans-serif; font-size: 12px; color: #1a1a2e; background: #fff;',
            header: 'display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; margin-bottom: 16px;',
            logoBlock: 'display: flex; flex-direction: column; gap: 4px;',
            logo: 'max-height: 56px; max-width: 110px; object-fit: contain; margin-bottom: 4px;',
            tagline: 'font-size: 7px; letter-spacing: 2px; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;',
            contactLine: 'display: flex; align-items: center; gap: 6px; font-size: 11px; color: #475569;',
            centerBlock: 'flex: 1;',
            companyName: 'font-size: 14px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px;',
            ta: 'font-size: 11px; color: #64748b; margin-bottom: 8px;',
            address: 'display: flex; align-items: flex-start; gap: 6px; font-size: 11px; color: #475569;',
            rightBlock: 'text-align: right;',
            abnLabel: 'font-size: 9px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px;',
            abnValue: 'font-size: 18px; font-weight: 900; color: #1a1a2e; letter-spacing: 1px; margin-bottom: 12px;',
            taxStrip: 'display: flex; justify-content: space-between; align-items: center; margin: 16px 0;',
            taxBtn: 'background: #1c2a5e; color: #fff; font-size: 13px; font-weight: 700; padding: 8px 20px; border-radius: 8px; letter-spacing: 1px;',
            billSection: 'display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: flex-start; margin-bottom: 12px;',
            billLabel: 'font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; font-weight: 600; margin-bottom: 6px;',
            custName: 'font-weight: 700; color: #1a1a2e; font-size: 14px; margin-bottom: 4px;',
            metaBar: 'display: grid; grid-template-columns: repeat(5, 1fr); border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; font-size: 12px; margin-bottom: 14px;',
            metaCell: 'padding: 10px 12px; border-right: 1px solid #cbd5e1;',
            metaCellAlt: 'padding: 10px 12px; border-right: 1px solid #cbd5e1; background: #f8fafc;',
            metaCellLast: 'padding: 10px 12px;',
            metaCellLastAlt: 'padding: 10px 12px; background: #f8fafc;',
            metaLabel: 'font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; margin-bottom: 4px; font-weight: 600;',
            metaValue: 'font-weight: 700; color: #1a1a2e; font-size: 12px;',
            metaValueRed: 'font-weight: 700; color: #dc2626; font-size: 12px;',
            metaValueBlue: 'font-weight: 700; color: #1c2a5e; font-size: 12px;',
            table: 'width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-bottom: 12px;',
            thead: 'background: #1c2a5e; color: #fff;',
            th: 'padding: 8px 12px; font-size: 11px; font-weight: 700; text-align: left;',
            thRight: 'padding: 8px 12px; font-size: 11px; font-weight: 700; text-align: right;',
            thCenter: 'padding: 8px 12px; font-size: 11px; font-weight: 700; text-align: center;',
            sectionHeader: 'background: #f1f5f9; padding: 8px 12px; font-weight: 700; font-size: 10px; text-transform: uppercase; color: #475569;',
            td: 'padding: 8px 12px; font-size: 11px; color: #1a1a2e; border-bottom: 1px solid #e2e8f0;',
            tdRight: 'padding: 8px 12px; font-size: 11px; color: #1a1a2e; border-bottom: 1px solid #e2e8f0; text-align: right;',
            tdCenter: 'padding: 8px 12px; font-size: 11px; color: #1a1a2e; border-bottom: 1px solid #e2e8f0; text-align: center;',
            tdStrike: 'padding: 8px 12px; font-size: 11px; color: #94a3b8; border-bottom: 1px solid #e2e8f0; text-align: right; text-decoration: line-through;',
            tdNotBilled: 'padding: 8px 12px; font-size: 11px; color: #64748b; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;',
            tdRed: 'padding: 8px 12px; font-size: 11px; color: #b91c1c; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;',
            infoRow: 'background: #f8fafc; border-bottom: 1px solid #e2e8f0;',
            infoText: 'padding: 8px 12px; text-align: center; font-size: 10px; color: #64748b;',
            bottomSection: 'display: flex; justify-content: space-between; align-items: flex-end; padding-top: 8px;',
            note: 'font-size: 10px; color: #3b82f6; font-style: italic;',
            summaryBlock: 'text-align: right; min-width: 200px;',
            amountDueBtn: 'background: #1c2a5e; color: #fff; font-size: 14px; font-weight: 700; padding: 8px 24px; border-radius: 8px; display: inline-block; margin-bottom: 12px; letter-spacing: 1px;',
            summaryRow: 'display: flex; justify-content: space-between; gap: 48px; font-size: 12px; color: #64748b; margin-bottom: 6px;',
            summaryTotal: 'display: flex; justify-content: space-between; gap: 48px; background: #1c2a5e; color: #fff; font-weight: 900; font-size: 14px; padding: 8px 16px; border-radius: 8px; margin-top: 8px; margin-bottom: 8px;',
            summaryPaid: 'display: flex; justify-content: space-between; gap: 48px; font-size: 11px; color: #64748b; padding: 0 4px; margin-bottom: 4px;',
            paymentSection: 'display: flex; gap: 20px; padding-top: 16px; border-top: 1px solid #cbd5e1; margin-top: 16px;',
            paymentBox: 'background: #f8fafc; border-radius: 12px; padding: 16px; min-width: 220px;',
            paymentTitle: 'display: flex; align-items: center; gap: 6px; font-weight: 700; color: #1a1a2e; font-size: 12px; margin-bottom: 8px;',
            paymentText: 'font-size: 11px; color: #475569; line-height: 1.7;',
            disclaimer: 'font-size: 10px; color: #64748b; line-height: 1.6; flex: 1; padding-top: 4px;',
            disclaimerTitle: 'font-weight: 700; color: #3b82f6; font-size: 11px; margin-bottom: 6px;',
        };

        return `
            <html><head><title>Tax Invoice - ${invoiceNumber}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                @page { size: A4 portrait; margin: 12mm; }
                @media print {
                    html, body { background: #ffffff !important; margin: 0 !important; padding: 0 !important; }
                    body * { visibility: hidden; }
                    .invoice-print-shell, .invoice-print-shell * { visibility: visible; }
                    .invoice-print-shell { position: absolute; left: 0; top: 0; width: 100%; }
                }
            </style></head><body>
            <div class="invoice-print-shell" style="${styles.page}">
                <!-- HEADER SECTION - MATCHING MODAL EXACTLY -->
                <div style="${styles.header}">
                    <!-- LEFT: Logo + Website + Email -->
                    <div style="${styles.logoBlock}">
                        <img src="${window.location.origin}/logo.jpeg" alt="Peninsula Laundries" style="${styles.logo}" />
                        <div style="${styles.tagline}">L A U N D R I E S</div>
                        <div style="${styles.contactLine}">
                            <span>🌐</span>
                            ${biz.website || 'peninsulalaundries.com.au'}
                        </div>
                        <div style="${styles.contactLine}">
                            <span>📧</span>
                            ${biz.email || 'orders@peninsulalaundries.com.au'}
                        </div>
                    </div>
                    
                    <!-- CENTER: Company Name + Address -->
                    <div style="${styles.centerBlock}">
                        <div style="${styles.companyName}">
                            ${biz.companyName || 'JSP Corporation Pty Ltd'}
                        </div>
                        <div style="${styles.ta}">T/A Peninsula Laundries</div>
                        <div style="${styles.address}">
                            <span>📍</span>
                            <span>
                                ${biz.address || '13 Redcliffe Gardens Drive'}<br/>
                                ${biz.suburb || 'Clontarf'}, ${biz.state || 'Queensland'} ${biz.postcode || '4019'}, Australia
                            </span>
                        </div>
                    </div>
                    
                    <!-- RIGHT: ABN + Phone -->
                    <div style="${styles.rightBlock}">
                        <div style="${styles.abnLabel}">A.B.N.</div>
                        <div style="${styles.abnValue}">${abn}</div>
                        <div style="${styles.contactLine}">
                            <span>📞</span>
                            ${biz.phone || '61475902921'}
                        </div>
                    </div>
                </div>

                <!-- TAX INVOICE STRIP + BILL TO -->
                <div style="${styles.billSection}">
                    <!-- Bill To -->
                    <div>
                        <div style="${styles.billLabel}">Bill To</div>
                        <div style="${styles.custName}">${customer.name || '—'}</div>
                        ${(customer.address || customer.suburb) ? `
                            <div style="${styles.address}">
                                <span>📍</span>
                                <span>
                                    ${customer.address ? customer.address + '<br/>' : ''}
                                    ${[customer.suburb || customer.city, customer.state, customer.postcode, 'Australia'].filter(Boolean).join(', ')}
                                </span>
                            </div>
                        ` : ''}
                        ${customer.phone ? `<div style="${styles.contactLine}"><span>📞</span>${customer.phone}</div>` : ''}
                        ${customer.email ? `<div style="${styles.contactLine}"><span>📧</span>${customer.email}</div>` : ''}
                    </div>
                    
                    <!-- Tax Invoice Badge -->
                    <div style="text-align: right;">
                        <div style="${styles.taxBtn}">
                            <span style="font-size: 20px; font-weight: 300;">+</span> Tax Invoice
                        </div>
                        <div style="font-size: 11px; color: #64748b; margin-top: 8px;">
                            <span style="font-weight: 600; color: #475569;">Invoice #: </span>${invoiceNumber}
                        </div>
                    </div>
                </div>

                <!-- META NUMBERS BAR -->
                <div style="${styles.metaBar}">
                    <div style="${styles.metaCell}"><div style="${styles.metaLabel}">INVOICE #</div><div style="${styles.metaValue}">${invoiceNumber}</div></div>
                    <div style="${styles.metaCellAlt}"><div style="${styles.metaLabel}">DATE</div><div style="${styles.metaValue}">${invoiceDateStr}</div></div>
                    <div style="${styles.metaCell}"><div style="${styles.metaLabel}">DUE DATE</div><div style="${styles.metaValueRed}">${dueDateStr}</div></div>
                    <div style="${styles.metaCellAlt}"><div style="${styles.metaLabel}">TOTAL</div><div style="${styles.metaValueBlue}">${currency}${Number(totalAmount).toFixed(2)}</div></div>
                    <div style="${styles.metaCellLast}"><div style="${styles.metaLabel}">TERMS</div><div style="${styles.metaValue}">${terms}</div></div>
                </div>

                <!-- ITEMS TABLE WITH 3 SECTIONS - MATCHING MODAL -->
                <table style="${styles.table}">
                    <thead style="${styles.thead}">
                        <tr>
                            <th style="${styles.th}">Delivery Date</th>
                            <th style="${styles.th}">Item Name</th>
                            <th style="${styles.thCenter}">Qty</th>
                            <th style="${styles.thRight}">Rate</th>
                            <th style="${styles.thRight}">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${services.length > 0 ? `
                            <tr style="${styles.sectionHeader}">
                                <td colspan="5">🔧 Services - Billable</td>
                            </tr>
                            ${services.map((item: any, idx: number) => {
                                const qty = item.shippedQuantity ?? item.quantity;
                                const hasDiff = item.shippedQuantity !== null && item.shippedQuantity !== undefined && item.shippedQuantity !== item.quantity;
                                return `
                                    <tr>
                                        <td style="${styles.td}">${idx === 0 ? formattedDate : '—'}</td>
                                        <td style="${styles.td}">${item.serviceName || item.itemName}</td>
                                        <td style="${styles.tdCenter}">${qty}${hasDiff ? ` <span style="font-size: 8px; color: #64748b;">(ord: ${item.quantity})</span>` : ''}</td>
                                        <td style="${styles.tdRight}">${currency}${Number(item.pricePerUnit || 0).toFixed(2)}</td>
                                        <td style="${styles.tdRight}">${currency}${Number(item.subtotal || 0).toFixed(2)}</td>
                                    </tr>
                                `;
                            }).join('')}
                        ` : ''}

                        
                        ${refundedItems.length > 0 ? `
                            <tr style="${styles.sectionHeader}">
                                <td colspan="5">🔄 Refunded Items</td>
                            </tr>
                            ${refundedItems.map((item: any, idx: number) => `
                                <tr>
                                    <td style="${styles.td}">${idx === 0 ? formattedDate : '—'}</td>
                                    <td style="${styles.td}">
                                        ${item.serviceName || item.itemName}
                                        ${item.refundReason ? `<br/><span style="font-size: 10px; color: #dc2626;">Reason: ${item.refundReason}</span>` : ''}
                                    </td>
                                    <td style="${styles.tdCenter}">${item.damagedQuantity || item.quantity}</td>
                                    <td style="${styles.tdRight}">${currency}${Number(item.pricePerUnit || 0).toFixed(2)}</td>
                                    <td style="${styles.tdRed}">-${currency}${Number(item.refundAmount || item.subtotal || 0).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        ` : ''}
                    </tbody>
                </table>

                <!-- BOTTOM SECTION - MATCHING MODAL -->
                <div style="${styles.bottomSection}">
                    <div style="${styles.note}">* Items marked with * are rental carts.</div>
                    <div style="${styles.summaryBlock}">
                        <div style="${styles.amountDueBtn}">AMOUNT DUE</div>
                        <div style="${styles.summaryRow}">
                            <span>Sub Total</span>
                            <span style="font-weight: 600; color: #475569;">${currency}${Number(subtotal).toFixed(2)}</span>
                        </div>
                        <div style="${styles.summaryRow}">
                            <span>Sales Tax</span>
                            <span style="font-weight: 600; color: #475569;">${currency}${Number(taxAmount).toFixed(2)}</span>
                        </div>
                        ${discountAmount > 0 ? `
                            <div style="${styles.summaryRow}">
                                <span>Discount</span>
                                <span style="font-weight: 600; color: #10b981;">-${currency}${Number(discountAmount).toFixed(2)}</span>
                            </div>
                        ` : ''}
                        <div style="${styles.summaryTotal}">
                            <span>TOTAL</span>
                            <span>${currency}${Number(totalAmount).toFixed(2)}</span>
                        </div>
                        <div style="${styles.summaryPaid}">
                            <span>Paid</span>
                            <span style="color: #10b981; font-weight: 600;">${currency}${Number(paidAmount).toFixed(2)}</span>
                        </div>
                        <div style="${styles.summaryPaid}">
                            <span>${balanceDue < 0 ? 'Refund Due to Customer' : 'Balance Due'}</span>
                            <span style="font-weight: 700; color: ${balanceDue > 0 ? '#dc2626' : '#10b981'};">${balanceDue < 0 ? '-' : ''}${currency}${Math.abs(Number(balanceDue)).toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <!-- PAYMENT + DISCLAIMER - MATCHING MODAL -->
                <div style="${styles.paymentSection}">
                    <div style="${styles.paymentBox}">
                        <div style="${styles.paymentTitle}">🏦 PAYMENT</div>
                        <div style="${styles.paymentText}">
                            <div><strong>Direct Deposit:</strong></div>
                            <div>Account Name: ${paymentAccountName}</div>
                            <div>Bank: ${paymentBank} &nbsp; BSB: ${paymentBSB}</div>
                            <div>Account NO: ${paymentAccountNo}</div>
                        </div>
                    </div>
                    <div style="${styles.disclaimer}">
                        <div style="${styles.disclaimerTitle}">Disclaimer:</div>
                        ${biz.name || 'JSP Corporation Pty Ltd T/as Peninsula Laundries'} reserves the right to claim ownership of any linen that has not been returned. We also reserve the right to seek legal advice and pursue recovery of replacement costs for any unreturned or missing items.
                    </div>
                </div>
            </div>
            </body></html>
        `;
    };

    const printInvoice = (inv: any, format: 'a4' | 'thermal' = 'a4') => {
        const printWindow = window.open('', '_blank', format === 'thermal' ? 'width=350,height=600' : 'width=900,height=700');
        if (!printWindow) return;
        printWindow.document.write(generateInvoiceHTML(inv, format));
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); }, 500);
    };

    const downloadPDF = (inv: any) => {
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) return;
        printWindow.document.write(generateInvoiceHTML(inv, 'a4'));
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); }, 500);
    };

    const generateBatchInvoiceHTML = (batchInvoices: any[]) => {
        const formatMoney = (amount: number) => `${currency}${Number(amount || 0).toFixed(2)}`;
        const formatShortDate = (date?: string) => (
            date ? new Date(date).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
        );
        const formatMetaDate = (date?: string) => (
            date ? new Date(date).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : '-'
        );
        const escapeHtml = (value: any) => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

        const titleParts = [
            filterCustomer ? `Customer: ${filterCustomer}` : '',
            filterDateFrom || filterDateTo ? `${filterDateFrom || 'Start'} to ${filterDateTo || 'Today'}` : '',
            filterOrderId ? `ID: ${filterOrderId}` : '',
            filterStatus ? `Status: ${filterStatus}` : '',
        ].filter(Boolean);
        const title = titleParts.length > 0 ? titleParts.join(' | ') : 'All filtered invoices';
        const biz = batchInvoices[0]?.business || {};
        const firstCustomer = batchInvoices[0]?.customer || batchInvoices[0]?.order?.customer || {};
        const allSameCustomer = batchInvoices.every((inv) => {
            const customer = inv.customer || inv.order?.customer || {};
            return String(customer._id || customer.customerId || customer.phone || '') === String(firstCustomer._id || firstCustomer.customerId || firstCustomer.phone || '');
        });
        const billTo = allSameCustomer ? firstCustomer : { name: 'Multiple Customers' };
        const totals = batchInvoices.reduce((acc, inv) => ({
            subtotal: acc.subtotal + Number(inv.subtotal || 0),
            tax: acc.tax + Number(inv.taxAmount || 0),
            discount: acc.discount + Number(inv.discountAmount || 0),
            total: acc.total + Number(inv.totalAmount || 0),
            paid: acc.paid + Number(inv.paidAmount || 0),
            due: acc.due + Number(inv.balanceDue || 0),
        }), { subtotal: 0, tax: 0, discount: 0, total: 0, paid: 0, due: 0 });
        const generatedAt = new Date().toLocaleString('en-AU', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
        const periodText = filterDateFrom || filterDateTo
            ? `${filterDateFrom ? formatMetaDate(filterDateFrom) : 'START'} - ${filterDateTo ? formatMetaDate(filterDateTo) : 'TODAY'}`
            : 'FILTERED';
        const reportNumber = batchInvoices.length === 1
            ? (batchInvoices[0].invoiceNumber || batchInvoices[0].invoiceId)
            : `${batchInvoices[batchInvoices.length - 1]?.invoiceId || 'INV'} - ${batchInvoices[0]?.invoiceId || 'INV'}`;
        const paymentAccountName = biz.bankAccountName || 'JSP CORPORATION PTY LTD';
        const paymentBank = biz.bankName || 'ANZ';
        const paymentBSB = biz.bankBSB || '012787';
        const paymentAccountNo = biz.bankAccountNo || '';
        const abn = biz.taxNumber || biz.abn || '31647801045';

        const invoiceRows = batchInvoices.map((inv) => {
            const order = inv.order || {};
            const items = order.items || [];
            const services = items.filter((item: any) => !item.isRefunded && item.serviceType !== 'manual' && item.service);
            const manualItems = items.filter((item: any) => !item.isRefunded && (item.serviceType === 'manual' || !item.service));
            const refundedItems = items.filter((item: any) => item.isRefunded);
            const deliveryDate = order.deliveryDate ? formatShortDate(order.deliveryDate) : formatShortDate(inv.createdAt);
            const due = Number(inv.balanceDue || 0);
            const invoiceLabel = inv.invoiceNumber || inv.invoiceId || '-';
            const invoiceDate = formatMetaDate(inv.createdAt);
            const serviceRows = services.length > 0 ? `
                <tr class="section-row"><td colspan="5">Services - Billable</td></tr>
                ${services.map((item: any, idx: number) => {
                    const qty = item.shippedQuantity ?? item.quantity;
                    const hasDiff = item.shippedQuantity !== null && item.shippedQuantity !== undefined && item.shippedQuantity !== item.quantity;
                    return `
                        <tr>
                            <td>${idx === 0 ? deliveryDate : '-'}</td>
                            <td>
                                <strong>${escapeHtml(item.serviceName || item.itemName || 'Service')}</strong>
                                <div class="muted">${escapeHtml(invoiceLabel)}${order.orderId ? ` | ${escapeHtml(order.orderId)}` : ''}</div>
                            </td>
                            <td class="center">
                                ${qty}
                                ${hasDiff ? `<div style="font-size: 8px; color: #64748b;">(ord: ${item.quantity})</div>` : ''}
                            </td>
                            <td class="right">${formatMoney(item.pricePerUnit)}</td>
                            <td class="right strong">${formatMoney(item.subtotal)}</td>
                        </tr>
                    `;
                }).join('')}
            ` : '';
            const manualRows = '';
            const refundedRows = refundedItems.length > 0 ? `
                <tr class="section-row"><td colspan="5">Refunded Items</td></tr>
                ${refundedItems.map((item: any, idx: number) => `
                    <tr>
                        <td>${idx === 0 && services.length === 0 && manualItems.length === 0 ? deliveryDate : '-'}</td>
                        <td>
                            <strong>${escapeHtml(item.serviceName || item.itemName || 'Refunded item')}</strong>
                            ${item.refundReason ? `<div class="refund-note">Reason: ${escapeHtml(item.refundReason)}</div>` : ''}
                        </td>
                        <td class="center">${Number(item.damagedQuantity || item.quantity || 0)}</td>
                        <td class="right">${formatMoney(item.pricePerUnit)}</td>
                        <td class="right refund">-${formatMoney(item.refundAmount || item.subtotal || 0)}</td>
                    </tr>
                `).join('')}
            ` : '';

            return `
                <tr class="invoice-row">
                    <td colspan="5">
                        <div class="invoice-row-inner">
                            <span>${escapeHtml(invoiceLabel)}${order.orderId ? ` | ${escapeHtml(order.orderId)}` : ''} | ${invoiceDate}</span>
                            <span>Total ${formatMoney(inv.totalAmount)} | Paid ${formatMoney(inv.paidAmount)} | Due ${due < 0 ? '-' : ''}${formatMoney(Math.abs(due))}</span>
                        </div>
                    </td>
                </tr>
                ${serviceRows || manualRows || refundedRows ? `${serviceRows}${manualRows}${refundedRows}` : `
                    <tr><td colspan="5" class="empty-row">No order items found for this invoice</td></tr>
                `}
            `;
        }).join('');

        return `
            <html>
                <head>
                    <title>Invoice Report - ${escapeHtml(title)}</title>
                    <style>
                        * { box-sizing: border-box; }
                        body {
                            margin: 0;
                            background: #f8fafc;
                            color: #1a1a2e;
                            font-family: Arial, sans-serif;
                            font-size: 12px;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        .batch-toolbar {
                            position: sticky;
                            top: 0;
                            z-index: 10;
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            gap: 16px;
                            padding: 12px 20px;
                            background: #ffffff;
                            border-bottom: 1px solid #e2e8f0;
                            font-family: Arial, sans-serif;
                            color: #334155;
                        }
                        .batch-toolbar h1 {
                            margin: 0;
                            font-size: 14px;
                            color: #0f172a;
                        }
                        .batch-toolbar p {
                            margin: 2px 0 0;
                            font-size: 12px;
                            color: #64748b;
                        }
                        .batch-toolbar button {
                            border: 0;
                            border-radius: 8px;
                            padding: 8px 12px;
                            background: #0891b2;
                            color: white;
                            font-size: 12px;
                            font-weight: 700;
                            cursor: pointer;
                        }
                        .report-page {
                            background: #ffffff;
                            max-width: 900px;
                            margin: 24px auto;
                            padding: 24px;
                            box-shadow: 0 18px 45px rgba(15, 23, 42, 0.12);
                        }
                        .report-header {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            gap: 24px;
                            padding-bottom: 16px;
                            border-bottom: 1px solid #e2e8f0;
                            margin-bottom: 16px;
                        }
                        .logo-block {
                            display: flex;
                            flex-direction: column;
                            gap: 4px;
                        }
                        .logo {
                            max-height: 48px;
                            max-width: 110px;
                            object-fit: contain;
                            margin-bottom: 4px;
                        }
                        .tagline {
                            font-size: 7px;
                            letter-spacing: 2px;
                            color: #94a3b8;
                            text-transform: uppercase;
                            margin-bottom: 8px;
                        }
                        .company {
                            font-size: 14px;
                            font-weight: 700;
                            color: #1a1a2e;
                            margin-bottom: 4px;
                        }
                        .ta {
                            font-size: 11px;
                            color: #64748b;
                            margin-bottom: 8px;
                        }
                        .center-block {
                            flex: 1;
                        }
                        .right-block {
                            text-align: right;
                        }
                        .abn-label {
                            font-size: 9px;
                            font-weight: 600;
                            color: #94a3b8;
                            text-transform: uppercase;
                            letter-spacing: 2px;
                            margin-bottom: 4px;
                        }
                        .abn-value {
                            font-size: 18px;
                            font-weight: 900;
                            color: #1a1a2e;
                            letter-spacing: 1px;
                            margin-bottom: 12px;
                        }
                        .meta {
                            font-size: 11px;
                            color: #64748b;
                            line-height: 1.6;
                        }
                        .contact-line {
                            display: flex;
                            align-items: center;
                            gap: 6px;
                            font-size: 11px;
                            color: #475569;
                            margin-bottom: 4px;
                        }
                        .right-block .contact-line {
                            justify-content: flex-end;
                        }
                        .bill-section {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 24px;
                            align-items: flex-start;
                            margin: 16px 0 12px;
                        }
                        .bill-label {
                            font-size: 9px;
                            text-transform: uppercase;
                            letter-spacing: 2px;
                            color: #94a3b8;
                            font-weight: 600;
                            margin-bottom: 6px;
                        }
                        .customer-name {
                            font-weight: 700;
                            color: #1a1a2e;
                            font-size: 14px;
                            margin-bottom: 4px;
                        }
                        .tax-block {
                            text-align: right;
                        }
                        .tax-btn {
                            background: #1c2a5e;
                            color: #fff;
                            font-size: 13px;
                            font-weight: 700;
                            padding: 8px 20px;
                            border-radius: 8px;
                            letter-spacing: 1px;
                            display: inline-block;
                        }
                        .meta-bar {
                            display: grid;
                            grid-template-columns: repeat(5, 1fr);
                            border: 1px solid #cbd5e1;
                            border-radius: 12px;
                            overflow: hidden;
                            font-size: 12px;
                            margin-bottom: 14px;
                        }
                        .meta-cell {
                            padding: 10px 12px;
                            border-right: 1px solid #cbd5e1;
                        }
                        .meta-cell:nth-child(even) {
                            background: #f8fafc;
                        }
                        .meta-cell:last-child {
                            border-right: 0;
                        }
                        .meta-label {
                            font-size: 9px;
                            text-transform: uppercase;
                            letter-spacing: 1.5px;
                            color: #94a3b8;
                            margin-bottom: 4px;
                            font-weight: 600;
                        }
                        .meta-value {
                            font-weight: 700;
                            color: #1a1a2e;
                            font-size: 12px;
                            overflow-wrap: anywhere;
                        }
                        .meta-value-blue {
                            color: #1c2a5e;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            border: 1px solid #cbd5e1;
                            border-radius: 8px;
                            overflow: hidden;
                            font-size: 11px;
                            margin-bottom: 12px;
                        }
                        th {
                            background: #1c2a5e;
                            color: #ffffff;
                            padding: 8px 12px;
                            text-align: left;
                            font-size: 11px;
                            font-weight: 700;
                        }
                        td {
                            padding: 8px 12px;
                            border-bottom: 1px solid #e2e8f0;
                            vertical-align: top;
                            color: #1a1a2e;
                        }
                        .right { text-align: right; }
                        .center { text-align: center; }
                        .strong { font-weight: 700; }
                        .invoice-row td {
                            background: #e8eefc;
                            color: #1c2a5e;
                            font-weight: 800;
                            text-transform: uppercase;
                            font-size: 10px;
                        }
                        .invoice-row-inner {
                            display: flex;
                            justify-content: space-between;
                            gap: 12px;
                        }
                        .section-row td {
                            background: #f1f5f9;
                            padding: 8px 12px;
                            font-weight: 700;
                            font-size: 10px;
                            text-transform: capitalize;
                            color: #475569;
                        }
                        .muted {
                            color: #64748b;
                            font-size: 10px;
                            margin-top: 3px;
                        }
                        .muted-strong {
                            color: #64748b;
                            font-weight: 600;
                        }
                        .strike {
                            color: #94a3b8;
                            text-decoration: line-through;
                        }
                        .info-row td {
                            background: #f8fafc;
                            text-align: center;
                            font-size: 10px;
                            color: #64748b;
                        }
                        .refund, .refund-note {
                            color: #b91c1c;
                        }
                        .empty-row {
                            text-align: center;
                            color: #64748b;
                            background: #f8fafc;
                        }
                        .bottom-section {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-end;
                            padding-top: 8px;
                        }
                        .note {
                            font-size: 10px;
                            color: #3b82f6;
                            font-style: italic;
                        }
                        .summary-block {
                            text-align: right;
                            min-width: 230px;
                        }
                        .amount-due-btn {
                            background: #1c2a5e;
                            color: #fff;
                            font-size: 14px;
                            font-weight: 700;
                            padding: 8px 24px;
                            border-radius: 8px;
                            display: inline-block;
                            margin-bottom: 12px;
                            letter-spacing: 1px;
                        }
                        .summary-row {
                            display: flex;
                            justify-content: space-between;
                            gap: 48px;
                            font-size: 12px;
                            color: #64748b;
                            margin-bottom: 6px;
                        }
                        .summary-total {
                            display: flex;
                            justify-content: space-between;
                            gap: 48px;
                            background: #1c2a5e;
                            color: #fff;
                            font-weight: 900;
                            font-size: 14px;
                            padding: 8px 16px;
                            border-radius: 8px;
                            margin-top: 8px;
                            margin-bottom: 8px;
                        }
                        .summary-paid {
                            display: flex;
                            justify-content: space-between;
                            gap: 48px;
                            font-size: 11px;
                            color: #64748b;
                            padding: 0 4px;
                            margin-bottom: 4px;
                        }
                        .green { color: #10b981; font-weight: 700; }
                        .red { color: #dc2626; font-weight: 700; }
                        .payment-section {
                            display: flex;
                            gap: 20px;
                            padding-top: 16px;
                            border-top: 1px solid #cbd5e1;
                            margin-top: 16px;
                        }
                        .payment-box {
                            background: #f8fafc;
                            border-radius: 12px;
                            padding: 16px;
                            min-width: 220px;
                        }
                        .payment-title {
                            display: flex;
                            align-items: center;
                            gap: 6px;
                            font-weight: 700;
                            color: #1a1a2e;
                            font-size: 12px;
                            margin-bottom: 8px;
                        }
                        .payment-text {
                            font-size: 11px;
                            color: #475569;
                            line-height: 1.7;
                        }
                        .disclaimer {
                            font-size: 10px;
                            color: #64748b;
                            line-height: 1.6;
                            flex: 1;
                            padding-top: 4px;
                        }
                        .disclaimer-title {
                            font-weight: 700;
                            color: #3b82f6;
                            font-size: 11px;
                            margin-bottom: 6px;
                        }
                        @page { size: A4 portrait; margin: 12mm; }
                        @media print {
                            html, body { background: #ffffff !important; margin: 0 !important; padding: 0 !important; }
                            .batch-toolbar { display: none; }
                            .report-page {
                                margin: 0;
                                padding: 0;
                                box-shadow: none;
                                max-width: none;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="batch-toolbar">
                        <div>
                            <h1>Tax Invoice Batch</h1>
                            <p>${batchInvoices.length} invoice${batchInvoices.length === 1 ? '' : 's'} in this batch</p>
                        </div>
                        <button onclick="window.print()">Print / Save PDF</button>
                    </div>
                    <main class="report-page">
                        <div class="report-header">
                            <div class="logo-block">
                                <img src="${window.location.origin}/logo.jpeg" alt="Peninsula Laundries" class="logo" />
                                <div class="tagline">L A U N D R I E S</div>
                                <div class="contact-line"><span>🌐</span>${escapeHtml(biz.website || 'peninsulalaundries.com.au')}</div>
                                <div class="contact-line"><span>📧</span>${escapeHtml(biz.email || 'orders@peninsulalaundries.com.au')}</div>
                            </div>
                            <div class="center-block">
                                <div class="company">${escapeHtml(biz.companyName || 'JSP Corporation Pty Ltd')}</div>
                                <div class="ta">T/A Peninsula Laundries</div>
                                <div class="contact-line">
                                    <span>📍</span>
                                    <span>
                                        ${escapeHtml(biz.address || '13 Redcliffe Gardens Drive')}<br/>
                                        ${escapeHtml([biz.suburb || 'Clontarf', biz.state || 'Queensland', biz.postcode || '4019', 'Australia'].filter(Boolean).join(', '))}
                                    </span>
                                </div>
                            </div>
                            <div class="right-block">
                                <div class="abn-label">A.B.N.</div>
                                <div class="abn-value">${escapeHtml(abn)}</div>
                                <div class="contact-line"><span>📞</span>${escapeHtml(biz.phone || '61475902921')}</div>
                            </div>
                        </div>

                        <div class="bill-section">
                            <div>
                                <div class="bill-label">Bill To</div>
                                <div class="customer-name">${escapeHtml(billTo.name || '-')}</div>
                                ${billTo.address ? `<div class="contact-line"><span>📍</span>${escapeHtml(billTo.address)}</div>` : ''}
                                ${allSameCustomer && billTo.phone ? `<div class="contact-line"><span>📞</span>${escapeHtml(billTo.phone)}</div>` : ''}
                                ${allSameCustomer && billTo.email ? `<div class="contact-line"><span>📧</span>${escapeHtml(billTo.email)}</div>` : ''}
                            </div>
                            <div class="tax-block">
                                <div class="tax-btn"><span style="font-size: 20px; font-weight: 300;">+</span> Tax Invoice</div>
                                <div class="meta">
                                    <span style="font-weight: 600; color: #475569;">Invoices: </span>${batchInvoices.length}<br/>
                                    ${escapeHtml(title)}
                                </div>
                            </div>
                        </div>

                        <div class="meta-bar">
                            <div class="meta-cell">
                                <div class="meta-label">REPORT #</div>
                                <div class="meta-value">${escapeHtml(reportNumber || '-')}</div>
                            </div>
                            <div class="meta-cell">
                                <div class="meta-label">DATE</div>
                                <div class="meta-value">${escapeHtml(generatedAt.toUpperCase())}</div>
                            </div>
                            <div class="meta-cell">
                                <div class="meta-label">PERIOD</div>
                                <div class="meta-value red">${escapeHtml(periodText)}</div>
                            </div>
                            <div class="meta-cell">
                                <div class="meta-label">TOTAL</div>
                                <div class="meta-value meta-value-blue">${formatMoney(totals.total)}</div>
                            </div>
                            <div class="meta-cell">
                                <div class="meta-label">INVOICES</div>
                                <div class="meta-value">${batchInvoices.length}</div>
                            </div>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th>Delivery Date</th>
                                    <th>Item Name</th>
                                    <th style="text-align:center;">Qty</th>
                                    <th style="text-align:right;">Rate</th>
                                    <th style="text-align:right;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${invoiceRows}
                            </tbody>
                        </table>

                        <div class="bottom-section">
                            <div class="note">* Items marked with * are rental carts.</div>
                            <div class="summary-block">
                                <div class="amount-due-btn">AMOUNT DUE</div>
                                <div class="summary-row">
                                    <span>Sub Total</span>
                                    <span style="font-weight: 600; color: #475569;">${formatMoney(totals.subtotal)}</span>
                                </div>
                                <div class="summary-row">
                                    <span>Sales Tax</span>
                                    <span style="font-weight: 600; color: #475569;">${formatMoney(totals.tax)}</span>
                                </div>
                                ${totals.discount > 0 ? `
                                    <div class="summary-row">
                                        <span>Discount</span>
                                        <span class="green">-${formatMoney(totals.discount)}</span>
                                    </div>
                                ` : ''}
                                <div class="summary-total">
                                    <span>TOTAL</span>
                                    <span>${formatMoney(totals.total)}</span>
                                </div>
                                <div class="summary-paid">
                                    <span>Paid</span>
                                    <span class="green">${formatMoney(totals.paid)}</span>
                                </div>
                                <div class="summary-paid">
                                    <span>${totals.due < 0 ? 'Refund Due to Customer' : 'Balance Due'}</span>
                                    <span class="${totals.due > 0 ? 'red' : 'green'}">${totals.due < 0 ? '-' : ''}${formatMoney(Math.abs(totals.due))}</span>
                                </div>
                            </div>
                        </div>

                        <div class="payment-section">
                            <div class="payment-box">
                                <div class="payment-title">🏦 PAYMENT</div>
                                <div class="payment-text">
                                    <div><strong>Direct Deposit:</strong></div>
                                    <div>Account Name: ${escapeHtml(paymentAccountName)}</div>
                                    <div>Bank: ${escapeHtml(paymentBank)} &nbsp; BSB: ${escapeHtml(paymentBSB)}</div>
                                    <div>Account NO: ${escapeHtml(paymentAccountNo)}</div>
                                </div>
                            </div>
                            <div class="disclaimer">
                                <div class="disclaimer-title">Disclaimer:</div>
                                ${escapeHtml(biz.name || 'JSP Corporation Pty Ltd T/as Peninsula Laundries')} reserves the right to claim ownership of any linen that has not been returned. We also reserve the right to seek legal advice and pursue recovery of replacement costs for any unreturned or missing items.
                            </div>
                        </div>
                    </main>
                </body>
            </html>
        `;
    };

    const openBatchInvoices = async (action: Exclude<BatchAction, ''>) => {
        if (filteredInvoices.length === 0) {
            toast.error('No invoices found for selected filters');
            return;
        }

        const batchWindow = window.open('', '_blank', 'width=1000,height=800');
        if (!batchWindow) {
            toast.error('Please allow popups to open batch invoices');
            return;
        }

        setBatchAction(action);
        batchWindow.document.write(`
            <html><body style="font-family: Arial, sans-serif; padding: 32px; color: #334155;">
                <h3 style="margin: 0 0 8px;">Preparing invoices...</h3>
                <p style="margin: 0;">Loading ${filteredInvoices.length} filtered invoice${filteredInvoices.length === 1 ? '' : 's'}.</p>
            </body></html>
        `);
        batchWindow.document.close();

        try {
            const detailedInvoices = [];
            for (const inv of filteredInvoices) {
                const res = await api.get(`/invoices/${inv._id}`);
                detailedInvoices.push(res.data.data);
            }

            batchWindow.document.open();
            batchWindow.document.write(generateBatchInvoiceHTML(detailedInvoices));
            batchWindow.document.close();
            batchWindow.focus();

            if (action !== 'view') {
                setTimeout(() => { batchWindow.print(); }, 700);
            }
        } catch {
            batchWindow.close();
            toast.error('Failed to prepare batch invoices');
        } finally {
            setBatchAction('');
        }
    };

    /* ─────────────────────────────────────────────
       STATUS BADGE
    ───────────────────────────────────────────── */
    const StatusBadge = ({ status }: { status: string }) => {
        const c = statusColors[status] || { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                {status?.charAt(0).toUpperCase() + status?.slice(1)}
            </span>
        );
    };

    /* ─────────────────────────────────────────────
       RENDER
    ───────────────────────────────────────────── */
    return (
        <div className="space-y-6 animate-fadeIn">

            {/* ── PAGE HEADER ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                        <HiOutlineDocumentText className="w-5 h-5 text-cyan-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">
                            {activeTab === 'migrated' ? 'Migrate Invoices' : 'Invoices'}
                        </h1>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {activeTab === 'migrated' ? (
                                `Showing ${migratedTotalItems} old ERP invoices`
                            ) : (
                                `${filteredInvoices.length} of ${invoices.length} invoices`
                            )}
                            {activeTab !== 'migrated' && activeFilterCount > 0 && (
                                <span className="ml-1 text-cyan-500">(filtered)</span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Filter toggle button (only for standard invoices) */}
                {activeTab !== 'migrated' && (
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium shadow-sm transition-all ${
                            showFilters || activeFilterCount > 0
                                ? 'bg-cyan-500 text-white border-cyan-500 shadow-cyan-100'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-cyan-300'
                        }`}
                    >
                        <HiOutlineFilter className="w-4 h-4" />
                        Filters
                        {activeFilterCount > 0 && (
                            <span className="ml-0.5 w-5 h-5 rounded-full bg-white text-cyan-600 text-xs font-bold flex items-center justify-center">
                                {activeFilterCount}
                            </span>
                        )}
                        <HiOutlineChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>
                )}
            </div>

            {/* ── TABS ── */}
            <div className="flex border-b border-slate-200 gap-6">
                <button
                    onClick={() => setSearchParams({})}
                    className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                        activeTab !== 'migrated' && activeTab !== 'pending'
                            ? 'border-cyan-500 text-cyan-600'
                            : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                >
                    Standard Invoices
                </button>
                <button
                    onClick={() => setSearchParams({ tab: 'pending' })}
                    className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                        activeTab === 'pending'
                            ? 'border-cyan-500 text-cyan-600'
                            : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                >
                    Pending Approval
                </button>
                <button
                    onClick={() => setSearchParams({ tab: 'migrated' })}
                    className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                        activeTab === 'migrated'
                            ? 'border-cyan-500 text-cyan-600'
                            : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                >
                    Migrated Invoices
                </button>
            </div>

            {activeTab !== 'migrated' ? (
                <>
                    {/* ── ADVANCED FILTER PANEL ── */}
                    {showFilters && (
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">

                                {/* Customer Search */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Customer</label>
                                    <div className="relative">
                                        <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                        <input
                                            type="text"
                                            placeholder="Name, phone, or ID…"
                                            value={filterCustomer}
                                            onChange={(e) => setFilterCustomer(e.target.value)}
                                            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent placeholder:text-slate-300"
                                        />
                                    </div>
                                </div>

                                {/* Order / Invoice ID */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Order / Invoice ID</label>
                                    <div className="relative">
                                        <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                        <input
                                            type="text"
                                            placeholder="ORD-001 or INV-001…"
                                            value={filterOrderId}
                                            onChange={(e) => setFilterOrderId(e.target.value)}
                                            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent placeholder:text-slate-300"
                                        />
                                    </div>
                                </div>

                                {/* Quick Date Range */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Quick Range</label>
                                    <div className="relative">
                                        <HiOutlineCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                        <select
                                            value={filterDatePreset}
                                            onChange={(e) => applyDatePreset(e.target.value as DatePreset)}
                                            className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent appearance-none cursor-pointer"
                                        >
                                            <option value="">Custom dates</option>
                                            <option value="today">Today</option>
                                            <option value="yesterday">Yesterday</option>
                                            <option value="tomorrow">Tomorrow</option>
                                            <option value="last7">Last 7 days</option>
                                            <option value="last15">Last 15 days</option>
                                            <option value="last30">Last 1 month</option>
                                        </select>
                                        <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                                    </div>
                                </div>

                                {/* Date From */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Date From</label>
                                    <div className="relative">
                                        <HiOutlineCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                        <input
                                            type="date"
                                            value={filterDateFrom}
                                            onChange={(e) => {
                                                setFilterDatePreset('');
                                                setFilterDateFrom(e.target.value);
                                            }}
                                            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                {/* Date To */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Date To</label>
                                    <div className="relative">
                                        <HiOutlineCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                        <input
                                            type="date"
                                            value={filterDateTo}
                                            onChange={(e) => {
                                                setFilterDatePreset('');
                                                setFilterDateTo(e.target.value);
                                            }}
                                            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                {/* Status */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Status</label>
                                    <div className="relative">
                                        <HiOutlineFilter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                        <select
                                            value={filterStatus}
                                            onChange={(e) => setFilterStatus(e.target.value)}
                                            className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent appearance-none cursor-pointer"
                                        >
                                            <option value="">All Status</option>
                                            <option value="unpaid">Unpaid</option>
                                            <option value="partial">Partial</option>
                                            <option value="paid">Paid</option>
                                        </select>
                                        <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                                    </div>
                                </div>
                            </div>

                            {/* Batch actions */}
                            {hasActiveFilters && (
                                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                    <p className="text-xs text-slate-400">
                                        Showing <span className="font-semibold text-slate-700">{filteredInvoices.length}</span> of {invoices.length} invoices
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            onClick={() => openBatchInvoices('view')}
                                            disabled={filteredInvoices.length === 0 || Boolean(batchAction)}
                                            title="View all filtered invoices"
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:text-cyan-700 hover:border-cyan-200 hover:bg-cyan-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <HiOutlineEye className="w-3.5 h-3.5" />
                                            {batchAction === 'view' ? 'Loading...' : 'View All'}
                                        </button>
                                        <button
                                            onClick={() => openBatchInvoices('pdf')}
                                            disabled={filteredInvoices.length === 0 || Boolean(batchAction)}
                                            title="Print or save all filtered invoices as PDF"
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <HiOutlineDownload className="w-3.5 h-3.5" />
                                            {batchAction === 'pdf' ? 'Loading...' : 'PDF All'}
                                        </button>
                                        <button
                                            onClick={() => openBatchInvoices('print')}
                                            disabled={filteredInvoices.length === 0 || Boolean(batchAction)}
                                            title="Print all filtered invoices"
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-200 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <HiOutlinePrinter className="w-3.5 h-3.5" />
                                            {batchAction === 'print' ? 'Loading...' : 'Print All'}
                                        </button>
                                        <button
                                            onClick={clearFilters}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-red-500 hover:text-red-700 hover:bg-red-50 font-medium transition-colors"
                                        >
                                            <HiOutlineX className="w-3.5 h-3.5" />
                                            Clear filters
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Quick date chips ── */}
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        {(['today', 'yesterday', 'tomorrow', 'last7', 'last15', 'last30'] as DatePreset[]).map((preset) => {
                            const labels: Record<string, string> = { 
                                today: 'Today', 
                                yesterday: 'Yesterday', 
                                tomorrow: 'Tomorrow', 
                                last7: 'Last 7 Days',
                                last15: 'Last 15 Days',
                                last30: 'Last 30 Days'
                            };
                            const active = filterDatePreset === preset;
                            return (
                                <button
                                    key={preset}
                                    onClick={() => applyDatePreset(preset)}
                                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${active
                                        ? 'bg-cyan-500 text-white border-cyan-500 shadow-md shadow-cyan-200'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-cyan-400 hover:text-cyan-600'
                                        }`}
                                >
                                    {labels[preset!]}
                                </button>
                            );
                        })}
                    </div>

                    {/* ── INVOICES GRID ── */}
                    <div>
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-24 gap-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                                <div className="w-10 h-10 border-[3px] border-cyan-500 border-t-transparent rounded-full animate-spin" />
                                <p className="text-sm text-slate-400">Loading invoices…</p>
                            </div>
                        ) : filteredInvoices.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-sm">
                                <HiOutlineDocumentText className="w-12 h-12 opacity-30" />
                                <p className="text-sm font-medium">No invoices match your filters</p>
                                <button onClick={clearFilters} className="text-xs text-cyan-500 hover:text-cyan-700 font-medium underline underline-offset-2">
                                    Clear filters
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                    {filteredInvoices.map((inv) => (
                                        <div key={inv._id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-all duration-205 flex flex-col md:flex-row gap-5 relative overflow-hidden text-left">
                                            {/* Left Column: ID, Order ID, Date, Customer */}
                                            <div className="flex-1 space-y-3 flex flex-col justify-between">
                                                <div>
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">Invoice ID</span>
                                                            <div className="text-base font-bold text-cyan-600 cursor-pointer hover:text-cyan-800 transition-colors" onClick={() => viewInvoiceDetail(inv._id)}>
                                                                {inv.invoiceId}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">Order ID</span>
                                                            <div className="text-xs font-mono font-bold text-slate-600 mt-0.5">
                                                                {inv.order?.orderId || '—'}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="border-t border-slate-100 pt-2.5 mt-2.5">
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Customer</span>
                                                        <div className="font-bold text-slate-800 text-sm mt-0.5">{inv.customer?.name || '—'}</div>
                                                        <div className="text-xs text-slate-400 font-medium">
                                                            {[inv.customer?.phone, inv.customer?.customerId].filter(Boolean).join(' • ')}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="border-t border-slate-100 pt-2.5 mt-auto flex justify-between items-center">
                                                    <div>
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Date</span>
                                                        <div className="text-xs font-semibold text-slate-600 mt-0.5">
                                                            {inv.createdAt
                                                                ? new Date(inv.createdAt).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                                                : '—'}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status</span>
                                                        <div className="mt-1">
                                                            <StatusBadge status={inv.paymentStatus} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Vertical divider on medium screens */}
                                            <div className="hidden md:block w-px bg-slate-100 shrink-0" />

                                            {/* Right Column: Pricing & Actions */}
                                            <div className="flex-1 flex flex-col justify-between gap-4">
                                                <div className="space-y-2.5 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                    <div className="flex justify-between text-xs text-slate-600">
                                                        <span>Total Amount:</span>
                                                        <span className="font-bold text-slate-900">{currency}{inv.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-slate-600">
                                                        <span>Paid Amount:</span>
                                                        <span className="font-semibold text-emerald-600">{currency}{inv.paidAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-slate-655 border-t border-dashed border-slate-200 pt-2">
                                                        <span className="font-semibold">Balance Due:</span>
                                                        {inv.balanceDue < 0 ? (
                                                            <span className="font-bold text-emerald-600">
                                                                Refund {currency}{Math.abs(inv.balanceDue)?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        ) : (
                                                            <span className={`font-bold ${inv.balanceDue > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                                                {currency}{inv.balanceDue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5 border-t border-slate-100 pt-3">
                                                        {!inv.isApproved && (
                                                            <button
                                                                onClick={() => handleApproveInvoice(inv._id)}
                                                                title="Approve Invoice"
                                                                className="flex-1 flex items-center justify-center gap-1 px-2.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                                                            >
                                                                <HiCheck className="w-4 h-4" /> Approve
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => viewInvoiceDetail(inv._id)}
                                                            title="View Invoice"
                                                            className="flex-1 flex items-center justify-center gap-1 px-2.5 py-2 bg-slate-50 hover:bg-cyan-50 hover:text-cyan-600 text-slate-500 rounded-xl text-xs font-semibold border border-slate-105 transition-all cursor-pointer"
                                                        >
                                                            <HiOutlineEye className="w-4 h-4" /> View
                                                        </button>
                                                        <button
                                                            title="Download PDF"
                                                            className="p-2 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-xl border border-slate-105 text-slate-400 transition-all cursor-pointer"
                                                            onClick={async () => {
                                                                try {
                                                                    const res = await api.get(`/invoices/${inv._id}`);
                                                                    downloadPDF(res.data.data);
                                                                } catch { toast.error('Failed to download'); }
                                                            }}
                                                        >
                                                            <HiOutlineDownload className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            title="Print Thermal Receipt"
                                                            className="p-2 bg-slate-50 hover:bg-amber-50 hover:text-amber-600 rounded-xl border border-slate-105 text-slate-400 transition-all cursor-pointer"
                                                            onClick={async () => {
                                                                try {
                                                                    const res = await api.get(`/invoices/${inv._id}`);
                                                                    printInvoice(res.data.data, 'thermal');
                                                                } catch { toast.error('Failed to print'); }
                                                            }}
                                                        >
                                                            <HiOutlinePrinter className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Pagination */}
                                {!loading && filteredInvoices.length > 0 && (
                                    <div className="mt-6">
                                        <Pagination
                                            currentPage={currentPage}
                                            totalPages={totalPages}
                                            totalItems={totalItems}
                                            itemsPerPage={itemsPerPage}
                                            onPageChange={setCurrentPage}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </>
            ) : (
                <div className="space-y-6">
                    {/* ── MIGRATION AREA: Import & Description ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* File Drop/Upload Zone */}
                        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col justify-between">
                            <div>
                                <h2 className="text-base font-bold text-slate-800 mb-2">Import Old ERP Invoices</h2>
                                <p className="text-xs text-slate-400 leading-relaxed mb-6">
                                    Upload a CSV or Excel spreadsheet containing your old invoices. The system will parse the records, group them by Invoice Number, and save them as migrated history.
                                </p>
                            </div>
                            
                            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-cyan-400 rounded-xl p-8 bg-slate-50 hover:bg-cyan-50/20 transition-all group relative cursor-pointer">
                                <input
                                    type="file"
                                    accept=".csv,.xlsx,.xls"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <HiOutlineUpload className="w-10 h-10 text-slate-400 group-hover:text-cyan-500 mb-3 transition-colors" />
                                <p className="text-sm font-semibold text-slate-700 group-hover:text-cyan-600 transition-colors">
                                    Click or drag your CSV/Excel file here to upload
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    Supports .csv, .xlsx, .xls formats up to 10MB
                                </p>
                            </div>
                        </div>

                        {/* Stats & Help */}
                        <div className="bg-[#1c2a5e] text-white rounded-2xl shadow-lg p-6 flex flex-col justify-between">
                            <div>
                                <span className="text-[10px] text-blue-300 font-bold uppercase tracking-wider">Migration Helper</span>
                                <h3 className="text-lg font-black mt-1 mb-3">Required Columns</h3>
                                <p className="text-xs text-blue-200 leading-relaxed mb-4">
                                    Make sure your spreadsheet contains the following mandatory fields:
                                </p>
                                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                                    {["ContactName", "InvoiceNumber", "InvoiceDate", "DueDate", "Description", "Quantity", "UnitAmount", "AccountCode", "TaxType"].map((col) => (
                                        <span key={col} className="px-2 py-1 bg-white/10 rounded text-[10px] font-semibold text-white/95">
                                            *{col}
                                        </span>
                                    ))}
                                    {["EmailAddress", "POAddressLine1", "POCity", "PORegion", "POPostalCode", "POCountry", "Reference", "Currency", "BrandingTheme"].map((col) => (
                                        <span key={col} className="px-2 py-1 bg-white/5 rounded text-[10px] font-medium text-white/60">
                                            {col}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={downloadTemplate}
                                className="mt-6 w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-600 active:scale-95 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-md transition-all cursor-pointer"
                            >
                                <HiOutlineDownload className="w-4 h-4" /> Download Sample CSV
                            </button>
                        </div>
                    </div>

                    {/* ── MIGRATED INVOICES KPI CARDS ── */}
                    {migratedTotalItems > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Total Migrated Invoices</span>
                                    <span className="text-2xl font-bold text-slate-800">{migratedTotalItems.toLocaleString()}</span>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-600">
                                    <HiOutlineDocumentText className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Total Net Amount</span>
                                    <span className={`text-2xl font-bold ${migratedTotalAmount < 0 ? 'text-red-500' : 'text-slate-850'}`}>
                                        AUD ${migratedTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                                    <HiOutlineCash className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── SEARCH & CLEAR BAR ── */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                        <div className="relative w-full sm:max-w-xs">
                            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search old invoices..."
                                value={migratedSearch}
                                onChange={(e) => {
                                    setMigratedSearch(e.target.value);
                                    setMigratedPage(1);
                                }}
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent placeholder:text-slate-300"
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            {migratedTotalItems > 0 && (
                                <>
                                    <button
                                        onClick={() => handleExportMigrated('xlsx')}
                                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                                        title="Export all migrated invoices to Excel"
                                    >
                                        <HiOutlineDownload className="w-3.5 h-3.5" /> Export Excel
                                    </button>
                                    <button
                                        onClick={() => handleExportMigrated('csv')}
                                        className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-600 hover:text-cyan-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                                        title="Export all migrated invoices to CSV"
                                    >
                                        <HiOutlineDownload className="w-3.5 h-3.5" /> Export CSV
                                    </button>
                                    <button
                                        onClick={handleClearMigrated}
                                        disabled={user?.role !== 'admin'}
                                        className="flex items-center gap-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-50 disabled:hover:text-red-600"
                                        title={user?.role !== 'admin' ? "Only Admin can clear migrated history" : "Clear All History"}
                                    >
                                        <HiOutlineTrash className="w-3.5 h-3.5" /> Clear All History
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── TABLE CARD ── */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        {migratedLoading ? (
                            <div className="flex flex-col items-center justify-center py-24 gap-4">
                                <div className="w-10 h-10 border-[3px] border-cyan-500 border-t-transparent rounded-full animate-spin" />
                                <p className="text-sm text-slate-400">Loading old invoices…</p>
                            </div>
                        ) : migratedInvoices.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
                                <HiOutlineDocumentText className="w-12 h-12 opacity-30" />
                                <p className="text-sm font-medium">No migrated invoices found</p>
                                <p className="text-xs text-slate-350">Upload a spreadsheet to import records</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Invoice Number</th>
                                            <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact Name</th>
                                            <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Invoice Date</th>
                                            <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Due Date</th>
                                            <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Reference</th>
                                            <th className="px-5 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Currency</th>
                                            <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Amount</th>
                                            <th className="px-5 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {migratedInvoices.map((inv) => (
                                            <tr key={inv._id} className="hover:bg-slate-50/80 transition-colors group">
                                                <td className="px-5 py-4 font-semibold text-cyan-600 group-hover:text-cyan-700 transition-colors">
                                                    {inv.invoiceNumber}
                                                </td>
                                                <td className="px-5 py-4 font-medium text-slate-800">
                                                    {inv.contactName}
                                                </td>
                                                <td className="px-5 py-4 text-slate-500 text-xs">
                                                    {new Date(inv.invoiceDate).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </td>
                                                <td className="px-5 py-4 text-slate-500 text-xs">
                                                    {new Date(inv.dueDate).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </td>
                                                <td className="px-5 py-4 text-slate-500 text-xs font-mono">
                                                    {inv.reference || '—'}
                                                </td>
                                                <td className="px-5 py-4 text-center text-slate-600 font-bold text-xs uppercase">
                                                    {inv.currency || 'AUD'}
                                                </td>
                                                <td className="px-5 py-4 text-right font-bold text-slate-850">
                                                    {inv.currency || 'AUD'} ${inv.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    <button
                                                        onClick={() => setViewMigratedInvoice(inv)}
                                                        title="View Details"
                                                        className="p-2 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-all cursor-pointer inline-flex"
                                                    >
                                                        <HiOutlineEye className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination */}
                        {!migratedLoading && migratedInvoices.length > 0 && (
                            <Pagination
                                currentPage={migratedPage}
                                totalPages={migratedTotalPages}
                                totalItems={migratedTotalItems}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setMigratedPage}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* ── INVOICE DETAIL MODAL ── */}
            {viewInvoice && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) setViewInvoice(null); }}
                >
                    <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[95vh] animate-fadeIn">

                        {/* ── TOOLBAR ── */}
                        <div className="flex-shrink-0 bg-[#1c2a5e] px-5 py-3 rounded-t-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <img src="/logo.jpeg" alt="Logo" className="h-8 w-auto object-contain rounded opacity-90" />
                                <div>
                                    <p className="text-white font-bold text-sm leading-tight">Peninsula Laundries</p>
                                    <p className="text-blue-300 text-xs font-mono">
                                        {viewInvoice.invoiceId}
                                        {isEditMode && <span className="ml-2 text-amber-300 font-semibold">• Editing</span>}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {isEditMode ? (
                                    <>
                                        <button
                                            onClick={handleSaveInvoice}
                                            disabled={editSaving || editItems.length === 0}
                                            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded-lg transition-all font-bold shadow-lg"
                                        >
                                            {editSaving ? (
                                                <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
                                            ) : (
                                                <>💾 Save Changes</>
                                            )}
                                        </button>
                                        <button
                                            onClick={exitEditMode}
                                            disabled={editSaving}
                                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white/10 hover:bg-red-500/60 text-white text-xs rounded-lg transition-all font-medium"
                                        >
                                            <HiOutlineX className="w-3.5 h-3.5" /> Cancel
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        {!viewInvoice.isApproved && (
                                            <button
                                                onClick={() => handleApproveInvoice(viewInvoice._id)}
                                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg transition-all font-bold shadow"
                                            >
                                                <HiCheck className="w-3.5 h-3.5" /> Approve
                                            </button>
                                        )}
                                        <button
                                            onClick={enterEditMode}
                                            disabled={viewInvoice.isFinalized && user?.role !== 'admin'}
                                            title={viewInvoice.isFinalized && user?.role !== 'admin' ? "This invoice is finalized. Only Admin can edit." : "Edit Invoice"}
                                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500/90 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded-lg transition-all font-bold shadow"
                                        >
                                            <HiOutlinePencil className="w-3.5 h-3.5" /> Edit
                                        </button>
                                        <button
                                            onClick={() => downloadPDF(viewInvoice)}
                                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-all font-medium"
                                        >
                                            <HiOutlineDownload className="w-3.5 h-3.5" /> PDF
                                        </button>
                                        <button
                                            onClick={() => printInvoice(viewInvoice, 'thermal')}
                                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-all font-medium"
                                        >
                                            <HiOutlinePrinter className="w-3.5 h-3.5" /> Thermal
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => { exitEditMode(); setViewInvoice(null); }}
                                    className="p-1.5 rounded-lg bg-white/10 hover:bg-red-500/60 text-white transition-all"
                                    title="Close"
                                >
                                    <HiOutlineX className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* ── SCROLLABLE BODY ── */}
                        <div className="overflow-y-auto flex-1 p-6 space-y-4">

                            {/* ── BUSINESS HEADER: Logo | Contact | ABN ── */}
                            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">

                                {/* LEFT: Logo + Website + Email */}
                                <div className="flex flex-col items-start gap-1">
                                    <img src="/logo.jpeg" alt="Peninsula Laundries" className="max-h-14 max-w-[110px] object-contain mb-1" />
                                    <span className="text-[7px] tracking-[2px] text-slate-400 uppercase font-semibold mb-2">L A U N D R I E S</span>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                        <svg className="w-3 h-3 text-[#1c2a5e] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                                        {viewInvoice.business?.website || 'peninsulalaundries.com.au'}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                        <svg className="w-3 h-3 text-[#1c2a5e] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                        {viewInvoice.business?.email || 'orders@peninsulalaundries.com.au'}
                                    </div>
                                </div>

                                {/* CENTER: Business Name + Address */}
                                <div className="flex-1 text-xs text-slate-700">
                                    <div className="font-bold text-sm text-[#1a1a2e] mb-1">
                                        {viewInvoice.business?.companyName || 'JSP Corporation Pty Ltd'}
                                    </div>
                                    <div className="text-xs text-slate-500 mb-2">T/A Peninsula Laundries</div>
                                    <div className="flex items-start gap-1.5 text-slate-600">
                                        <svg className="w-3.5 h-3.5 mt-0.5 text-[#1c2a5e] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                        <span className="leading-relaxed">
                                            {viewInvoice.business?.address || '13 Redcliffe Gardens Drive'}<br />
                                            {viewInvoice.business?.suburb || 'Clontarf'}, {viewInvoice.business?.state || 'Queensland'} {viewInvoice.business?.postcode || '4019'}, Australia
                                        </span>
                                    </div>
                                </div>

                                {/* RIGHT: ABN + Phone */}
                                <div className="text-right">
                                    <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-1">A.B.N.</div>
                                    <div className="text-lg font-black text-[#1a1a2e] tracking-wider mb-3">
                                        {viewInvoice.business?.taxNumber || viewInvoice.business?.abn || '31647801045'}
                                    </div>
                                    <div className="flex items-center justify-end gap-1.5 text-xs text-slate-600">
                                        <svg className="w-3 h-3 text-[#1c2a5e] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 015.33 12a19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                                        {viewInvoice.business?.phone || '61475902921'}
                                    </div>
                                </div>
                            </div>

                            {/* ── TAX INVOICE STRIP + BILL TO (side by side) ── */}
                            <div className="grid grid-cols-2 gap-6 items-start">

                                {/* Bill To — Customer */}
                                <div>
                                    <div className="text-[9px] uppercase tracking-widest text-slate-400 font-semibold mb-1.5">Bill To</div>
                                    <div className="font-bold text-[#1a1a2e] text-sm mb-1">{viewInvoice.customer?.name || '—'}</div>
                                    {(viewInvoice.customer?.address || viewInvoice.customer?.suburb) && (
                                        <div className="flex items-start gap-1.5 text-slate-500 text-xs mb-0.5">
                                            <svg className="w-3.5 h-3.5 mt-0.5 text-[#1c2a5e] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                            <span className="leading-relaxed">
                                                {viewInvoice.customer?.address && <>{viewInvoice.customer.address}<br /></>}
                                                {[viewInvoice.customer?.suburb || viewInvoice.customer?.city, viewInvoice.customer?.state, viewInvoice.customer?.postcode, 'Australia'].filter(Boolean).join(', ')}
                                            </span>
                                        </div>
                                    )}
                                    {viewInvoice.customer?.phone && (
                                        <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-0.5">
                                            <svg className="w-3.5 h-3.5 text-[#1c2a5e] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 015.33 12a19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                                            {viewInvoice.customer.phone}
                                        </div>
                                    )}
                                    {viewInvoice.customer?.email && (
                                        <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                                            <svg className="w-3.5 h-3.5 text-[#1c2a5e] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                            {viewInvoice.customer.email}
                                        </div>
                                    )}
                                </div>

                                {/* Tax Invoice badge + Invoice # */}
                                <div className="flex flex-col items-end gap-2">
                                    <div className="flex items-center gap-2 bg-[#1c2a5e] text-white text-sm font-bold px-5 py-2 rounded-lg tracking-wide">
                                        <span className="text-xl font-light leading-none">+</span> Tax Invoice
                                    </div>
                                    <div className="text-xs text-slate-500 text-right">
                                        <span className="font-semibold text-slate-700">Invoice #: </span>
                                        {viewInvoice.invoiceNumber || viewInvoice.invoiceId}
                                    </div>
                                </div>
                            </div>

                            {/* Meta Numbers Bar */}
                            <div className="grid grid-cols-5 border border-slate-200 rounded-xl overflow-hidden text-xs">
                                {[
                                    { label: 'INVOICE #', value: viewInvoice.invoiceNumber || viewInvoice.invoiceId, cls: '' },
                                    { label: 'DATE', value: new Date(viewInvoice.createdAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(), cls: '' },
                                    { label: 'DUE DATE', value: viewInvoice.dueDate ? new Date(viewInvoice.dueDate).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : (viewInvoice.customer?.creditDays ? new Date(new Date(viewInvoice.createdAt).setDate(new Date(viewInvoice.createdAt).getDate() + viewInvoice.customer.creditDays)).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : 'DUE ON RECEIPT'), cls: 'text-red-600' },
                                    { label: 'TOTAL', value: `${currency}${Number(viewInvoice.totalAmount || 0).toFixed(2)}`, cls: 'text-[#1c2a5e]' },
                                    { label: 'TERMS', value: viewInvoice.terms || (viewInvoice.customer?.creditDays ? `NET ${viewInvoice.customer.creditDays}` : 'Due on Receipt'), cls: '' },
                                ].map((cell, i, arr) => (
                                    <div key={i} className={`px-3 py-2.5 ${i < arr.length - 1 ? 'border-r border-slate-200' : ''} ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                        <div className="text-[9px] uppercase tracking-wider text-slate-400 mb-1 font-semibold">{cell.label}</div>
                                        <div className={`font-bold text-[#1a1a2e] truncate ${cell.cls}`}>{cell.value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Unified Invoice Table with 3 Sections */}
                            <div className="rounded-lg overflow-hidden border border-slate-200">
                                {isEditMode ? (
                                    /* ── EDIT MODE TABLE ── */
                                    <>
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-[#1c2a5e] text-white">
                                                    <th className="text-left py-2 px-3 font-semibold w-8">#</th>
                                                    <th className="text-left py-2 px-3 font-semibold">Item Name</th>
                                                    <th className="text-center py-2 px-3 font-semibold w-20">Qty</th>
                                                    <th className="text-right py-2 px-3 font-semibold w-32">Rate</th>
                                                    <th className="text-right py-2 px-3 font-semibold w-28">Total</th>
                                                    <th className="text-center py-2 px-3 font-semibold w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(() => {
                                                    let visibleIndex = 0;
                                                    return editItems.map((item, index) => {
                                                        if (item.serviceType === 'manual') return null;
                                                        visibleIndex++;
                                                        const rowSubtotal = (Number(item.quantity) || 0) * (Number(item.pricePerUnit) || 0);
                                                        return (
                                                            <tr key={index} className={`border-b border-slate-200 ${item.isRefunded ? 'bg-red-50/50' : 'hover:bg-amber-50/30'} transition-colors`}>
                                                                <td className="py-2 px-3 text-slate-400 font-mono text-center">{visibleIndex}</td>
                                                                <td className="py-1.5 px-2">
                                                                    <input
                                                                        type="text"
                                                                        value={item.itemName || item.serviceName || ''}
                                                                        onChange={(e) => {
                                                                            handleEditItemChange(index, 'itemName', e.target.value);
                                                                            handleEditItemChange(index, 'serviceName', e.target.value);
                                                                        }}
                                                                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none text-slate-800 font-medium"
                                                                        placeholder="Item name…"
                                                                    />
                                                                </td>
                                                                <td className="py-1.5 px-2">
                                                                    <input
                                                                        type="number"
                                                                        min="1"
                                                                        value={item.quantity}
                                                                        onChange={(e) => handleEditItemChange(index, 'quantity', e.target.value)}
                                                                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none text-center font-semibold text-slate-800"
                                                                    />
                                                                </td>
                                                                <td className="py-1.5 px-2">
                                                                    <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-amber-400 focus-within:border-transparent transition-all">
                                                                        <span className="bg-slate-50 border-r border-slate-200 px-2 py-1.5 text-[10px] font-bold text-slate-400 select-none">
                                                                            {currency}
                                                                        </span>
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            step="0.01"
                                                                            value={item.pricePerUnit}
                                                                            onChange={(e) => handleEditItemChange(index, 'pricePerUnit', e.target.value)}
                                                                            className="w-full px-2 py-1.5 outline-none text-right font-semibold text-slate-800 text-xs border-none"
                                                                        />
                                                                    </div>
                                                                </td>
                                                                <td className="text-right py-2 px-3 font-bold text-slate-800">
                                                                    {currency}{rowSubtotal.toFixed(2)}
                                                                </td>
                                                                <td className="py-2 px-2 text-center">
                                                                    <button
                                                                        onClick={() => handleRemoveEditItem(index)}
                                                                        className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                                                        title="Remove item"
                                                                    >
                                                                        <HiOutlineTrash className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    });
                                                })()}
                                            </tbody>
                                        </table>
                                        {/* Add Item Button */}
                                        <div className="px-3 py-2.5 bg-slate-50 border-t border-slate-200">
                                            <button
                                                onClick={handleAddEditItem}
                                                className="flex items-center gap-1.5 text-xs font-semibold text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 px-3 py-1.5 rounded-lg transition-all"
                                            >
                                                <HiOutlinePlus className="w-3.5 h-3.5" /> Add New Item
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    /* ── READ-ONLY TABLE (original) ── */
                                    (() => {
                                        const allItems = [...(viewInvoice.order?.items || [])];
                                        const services = allItems.filter(item => !item.isRefunded && item.serviceType !== 'manual' && item.service);
                                        const refundedItems = allItems.filter(item => item.isRefunded);
                                        
                                        const formatDate = (dateStr: string) => {
                                            if (!dateStr) return '—';
                                            return new Date(dateStr).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
                                        };
                                        
                                        const deliveryDate = viewInvoice.order?.deliveryDate;
                                        const formattedDate = formatDate(deliveryDate);
                                        
                                        return (
                                            <table className="w-full text-xs">
                                                {/* Table Header */}
                                                <thead>
                                                    <tr className="bg-[#1c2a5e] text-white">
                                                        <th className="text-left py-2 px-3 font-semibold">Delivery Date</th>
                                                        <th className="text-left py-2 px-3 font-semibold">Item Name</th>
                                                        <th className="text-center py-2 px-3 font-semibold">Qty</th>
                                                        <th className="text-right py-2 px-3 font-semibold">Rate</th>
                                                        <th className="text-right py-2 px-3 font-semibold">Total</th>
                                                    </tr>
                                                </thead>
                                                
                                                <tbody>
                                                    {/* SECTION 1: SERVICES - BILLABLE */}
                                                    {services.length > 0 && (
                                                        <>
                                                            <tr className="bg-slate-100">
                                                                <td colSpan={5} className="py-2 px-3 font-bold text-xs uppercase tracking-wide text-slate-700">
                                                                    🔧 Services - Billable
                                                                </td>
                                                            </tr>
                                                            {services.map((item, i) => (
                                                                <tr key={`service-${i}`} className="border-b border-slate-200 hover:bg-slate-50">
                                                                    <td className="py-2 px-3 text-slate-700">
                                                                        {i === 0 ? formattedDate : '—'}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-slate-900 font-medium">{item.serviceName || item.itemName}</td>
                                                                    <td className="text-center py-2 px-3">
                                                                        <div className="flex flex-col items-center gap-1">
                                                                            <span className="text-[12px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                                                                {item.shippedQuantity ?? item.quantity} {item.unit}
                                                                            </span>
                                                                            {item.shippedQuantity !== null && item.shippedQuantity !== undefined && item.shippedQuantity !== item.quantity && (
                                                                                <span className="text-[10px] text-slate-500 font-medium bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                                                                                    Ordered: {item.quantity}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="text-right py-2 px-3 text-slate-900">{currency}{Number(item.pricePerUnit || 0).toFixed(2)}</td>
                                                                    <td className="text-right py-2 px-3 text-slate-900 font-semibold">{currency}{Number(item.subtotal || 0).toFixed(2)}</td>
                                                                </tr>
                                                            ))}
                                                        </>
                                                    )}

                                                    
                                                    {/* SECTION 3: REFUNDED ITEMS */}
                                                    {refundedItems.length > 0 && (
                                                        <>
                                                            <tr className="bg-slate-100">
                                                                <td colSpan={5} className="py-2 px-3 font-bold text-xs uppercase tracking-wide text-slate-700">
                                                                    🔄 Refunded Items
                                                                </td>
                                                            </tr>
                                                            {refundedItems.map((item, i) => (
                                                                <tr key={`refund-${i}`} className="border-b border-slate-200 hover:bg-slate-50">
                                                                    <td className="py-2 px-3 text-slate-700">
                                                                        {i === 0 ? formattedDate : '—'}
                                                                    </td>
                                                                    <td className="py-2 px-3">
                                                                        <div className="text-slate-900 font-medium">{item.serviceName || item.itemName}</div>
                                                                        {item.refundReason && (
                                                                            <div className="text-red-600 text-xs mt-0.5">Reason: {item.refundReason}</div>
                                                                        )}
                                                                    </td>
                                                                    <td className="text-center py-2 px-3 text-slate-900">{item.damagedQuantity || item.quantity}</td>
                                                                    <td className="text-right py-2 px-3 text-slate-900">{currency}{Number(item.pricePerUnit || 0).toFixed(2)}</td>
                                                                    <td className="text-right py-2 px-3 text-red-700 font-semibold">-{currency}{Number(item.refundAmount || item.subtotal || 0).toFixed(2)}</td>
                                                                </tr>
                                                            ))}
                                                        </>
                                                    )}
                                                </tbody>
                                            </table>
                                        );
                                    })()
                                )}
                            </div>

                            {/* ── EDIT MODE: Discount / Tax / Service Charge Controls ── */}
                            {isEditMode && (
                                <div className="grid grid-cols-3 gap-3 p-4 bg-amber-50/50 border border-amber-200 rounded-xl">
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1 block">Discount %</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.1"
                                            value={editDiscountPercent}
                                            onChange={(e) => setEditDiscountPercent(Number(e.target.value) || 0)}
                                            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none text-slate-800 font-semibold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1 block">Tax %</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.1"
                                            value={editTaxPercent}
                                            onChange={(e) => setEditTaxPercent(Number(e.target.value) || 0)}
                                            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none text-slate-800 font-semibold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1 block">Service Charge ({currency})</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={editServiceCharge}
                                            onChange={(e) => setEditServiceCharge(Number(e.target.value) || 0)}
                                            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none text-slate-800 font-semibold"
                                        />
                                    </div>
                                </div>
                            )}
                            {viewInvoice.creditedItems?.length > 0 && (
                                <div className="rounded-xl overflow-hidden border border-red-100">
                                    <div className="bg-red-50 border-b border-red-100 px-3 py-2 text-xs font-bold text-red-700 uppercase tracking-wide">
                                        Credited Items
                                    </div>
                                    <table className="w-full text-xs">
                                        <tbody>
                                            {viewInvoice.creditedItems.map((item: any, i: number) => (
                                                <tr key={i} className="border-t border-red-50">
                                                    <td className="px-3 py-2 text-red-600">{item.serviceName || item.name}:</td>
                                                    <td className="px-3 py-2 text-right text-red-600">{item.quantity}</td>
                                                    <td className="px-3 py-2 text-right text-red-600">{currency}{Number(item.pricePerUnit || item.rate || 0).toFixed(2)}</td>
                                                    <td className="px-3 py-2 text-right text-red-600 font-semibold">({currency}{Math.abs(Number(item.subtotal || item.total || 0)).toFixed(2)})</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Amount Due + Summary */}
                            <div className="flex justify-between items-end pt-1">
                                <p className="text-[10px] text-blue-500 italic">* Items marked with * are rental carts.</p>
                                <div className="text-right min-w-[200px]">
                                    <div className="bg-[#1c2a5e] text-white text-sm font-bold px-6 py-2 rounded-lg inline-block mb-3 tracking-widest">
                                        AMOUNT DUE
                                    </div>
                                    <div className="space-y-1.5 text-xs">
                                        <div className="flex justify-between gap-12 text-slate-600">
                                            <span>Sub Total</span>
                                            <span className="font-medium text-slate-800">
                                                {currency}{Number(isEditMode ? editCalc.subtotal : viewInvoice.subtotal || 0).toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between gap-12 text-slate-600">
                                            <span>Sales Tax</span>
                                            <span className="font-medium text-slate-800">
                                                {currency}{Number(isEditMode ? editCalc.taxAmount : viewInvoice.taxAmount || 0).toFixed(2)}
                                            </span>
                                        </div>
                                        {((isEditMode ? editCalc.discountAmount : viewInvoice.discountAmount) || 0) > 0 && (
                                            <div className="flex justify-between gap-12 text-emerald-600">
                                                <span>Discount</span>
                                                <span className="font-medium">
                                                    -{currency}{Number(isEditMode ? editCalc.discountAmount : viewInvoice.discountAmount).toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                        {((isEditMode ? editServiceCharge : viewInvoice.serviceCharge) || 0) > 0 && (
                                            <div className="flex justify-between gap-12 text-slate-600">
                                                <span>Service Charge</span>
                                                <span className="font-medium text-slate-800">
                                                    {currency}{Number(isEditMode ? editServiceCharge : viewInvoice.serviceCharge).toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex justify-between gap-12 bg-[#1c2a5e] text-white font-black text-sm px-4 py-2 rounded-lg mt-2">
                                            <span>TOTAL</span>
                                            <span>
                                                {currency}{Number(isEditMode ? editCalc.totalAmount : viewInvoice.totalAmount || 0).toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between gap-12 text-slate-500 text-[11px] px-1">
                                            <span>Paid</span>
                                            <span className="text-emerald-600 font-semibold">{currency}{Number(viewInvoice.paidAmount || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between gap-12 text-slate-500 text-[11px] px-1">
                                            <span>{(isEditMode ? editCalc.balanceDue : viewInvoice.balanceDue || 0) < 0 ? 'Refund Due to Customer' : 'Balance Due'}</span>
                                            <span className={`font-bold ${(isEditMode ? editCalc.balanceDue : viewInvoice.balanceDue || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                {(isEditMode ? editCalc.balanceDue : viewInvoice.balanceDue || 0) < 0 ? '-' : ''}{currency}{Math.abs(Number(isEditMode ? editCalc.balanceDue : viewInvoice.balanceDue || 0)).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Payment + Disclaimer */}
                            <div className="flex gap-5 pt-4 border-t border-slate-200">
                                <div className="bg-slate-50 rounded-xl p-4 min-w-[220px]">
                                    <div className="flex items-center gap-1.5 font-bold text-[#1a1a2e] text-sm mb-2">
                                        <span>🏦</span> PAYMENT
                                    </div>
                                    <div className="text-xs text-slate-700 font-semibold mb-1">Direct Deposit:</div>
                                    <div className="text-xs text-slate-600 space-y-0.5 leading-relaxed">
                                        <div><span className="text-slate-500">Account Name:</span> {viewInvoice.business?.bankAccountName || 'JSP CORPORATION PTY LTD'}</div>
                                        <div><span className="text-slate-500">Bank:</span> {viewInvoice.business?.bankName || 'ANZ'} &nbsp; <span className="text-slate-500">BSB:</span> {viewInvoice.business?.bankBSB || '012787'}</div>
                                        <div><span className="text-slate-500">Account NO:</span> {viewInvoice.business?.bankAccountNo || '—'}</div>
                                    </div>
                                </div>
                                <div className="text-[10px] text-slate-500 leading-relaxed flex-1 pt-1">
                                    <div className="font-bold text-blue-600 text-xs mb-1.5">Disclaimer:</div>
                                    {viewInvoice.business?.name || 'JSP Corporation Pty Ltd T/as Peninsula Laundries'} reserves the right to claim ownership of any linen that has not been returned. We also reserve the right to seek legal advice and pursue recovery of replacement costs for any unreturned or missing items.
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* ── MIGRATED INVOICE DETAIL MODAL ── */}
            {viewMigratedInvoice && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
                    onClick={(e) => { if (e.target === e.currentTarget) setViewMigratedInvoice(null); }}
                >
                    <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[95vh]">
                        {/* Header */}
                        <div className="flex-shrink-0 bg-[#1c2a5e] px-5 py-3.5 rounded-t-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <img src="/logo.jpeg" alt="Logo" className="h-8 w-auto object-contain rounded opacity-90" />
                                <div>
                                    <p className="text-white font-bold text-sm leading-tight">Peninsula Laundries</p>
                                    <p className="text-blue-300 text-xs font-mono">Migrated • {viewMigratedInvoice.invoiceNumber}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setViewMigratedInvoice(null)}
                                className="p-1.5 rounded-lg bg-white/10 hover:bg-red-500/60 text-white transition-all cursor-pointer"
                                title="Close"
                            >
                                <HiOutlineX className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="overflow-y-auto flex-1 p-6 space-y-6">
                            {/* Meta & Customer */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-200">
                                <div>
                                    <span className="text-[9px] uppercase tracking-widest text-slate-400 font-semibold mb-1 block">Bill To</span>
                                    <div className="font-bold text-slate-800 text-base mb-1">{viewMigratedInvoice.contactName}</div>
                                    {viewMigratedInvoice.emailAddress && (
                                        <p className="text-xs text-slate-500 mb-2">Email: {viewMigratedInvoice.emailAddress}</p>
                                    )}
                                    <div className="text-xs text-slate-500 leading-relaxed space-y-0.5">
                                        {[
                                            viewMigratedInvoice.poAddressLine1,
                                            viewMigratedInvoice.poAddressLine2,
                                            viewMigratedInvoice.poAddressLine3,
                                            viewMigratedInvoice.poAddressLine4
                                        ].filter(Boolean).map((line, idx) => (
                                            <p key={idx}>{line}</p>
                                        ))}
                                        { (viewMigratedInvoice.poCity || viewMigratedInvoice.poRegion || viewMigratedInvoice.poPostalCode) && (
                                            <p>
                                                {[viewMigratedInvoice.poCity, viewMigratedInvoice.poRegion, viewMigratedInvoice.poPostalCode].filter(Boolean).join(', ')}
                                            </p>
                                        )}
                                        {viewMigratedInvoice.poCountry && (
                                            <p className="font-medium text-slate-650">{viewMigratedInvoice.poCountry}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-4 text-xs">
                                    <div>
                                        <p className="text-slate-400 uppercase tracking-wider font-semibold text-[9px] mb-0.5">Invoice Date</p>
                                        <p className="font-bold text-slate-700">
                                            {new Date(viewMigratedInvoice.invoiceDate).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 uppercase tracking-wider font-semibold text-[9px] mb-0.5">Due Date</p>
                                        <p className="font-bold text-slate-700">
                                            {new Date(viewMigratedInvoice.dueDate).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 uppercase tracking-wider font-semibold text-[9px] mb-0.5">Reference</p>
                                        <p className="font-medium text-slate-700 font-mono">
                                            {viewMigratedInvoice.reference || '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 uppercase tracking-wider font-semibold text-[9px] mb-0.5">Branding Theme</p>
                                        <p className="font-medium text-slate-700">
                                            {viewMigratedInvoice.brandingTheme || '—'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Line Items Table */}
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-450 mb-3">Line Items</h4>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wider">Item Code</th>
                                                <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                                                <th className="px-4 py-2.5 text-center font-semibold text-slate-500 uppercase tracking-wider">Qty</th>
                                                <th className="px-4 py-2.5 text-right font-semibold text-slate-500 uppercase tracking-wider">Unit Amount</th>
                                                <th className="px-4 py-2.5 text-right font-semibold text-slate-500 uppercase tracking-wider">Discount</th>
                                                <th className="px-4 py-2.5 text-center font-semibold text-slate-500 uppercase tracking-wider">Account / Tax</th>
                                                <th className="px-4 py-2.5 text-right font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {viewMigratedInvoice.lineItems?.map((item: any, idx: number) => {
                                                const itemTotal = (item.quantity * item.unitAmount) - (item.discount || 0);
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50/50">
                                                        <td className="px-4 py-3 font-mono text-slate-600">{item.inventoryItemCode || '—'}</td>
                                                        <td className="px-4 py-3 font-medium text-slate-800">{item.description}</td>
                                                        <td className="px-4 py-3 text-center text-slate-600">{item.quantity}</td>
                                                        <td className="px-4 py-3 text-right text-slate-650">${item.unitAmount?.toFixed(2)}</td>
                                                        <td className="px-4 py-3 text-right text-emerald-600">{item.discount > 0 ? `-$${item.discount.toFixed(2)}` : '—'}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="text-[10px] text-slate-500 font-semibold">{item.accountCode}</div>
                                                            <div className="text-[9px] text-slate-400">{item.taxType}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-bold text-slate-800">${itemTotal?.toFixed(2)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Total Summary */}
                            <div className="flex justify-end pt-4 border-t border-slate-100">
                                <div className="text-right space-y-1 md:w-80">
                                    <div className="flex justify-between items-center bg-[#1c2a5e] text-white font-black text-sm px-4 py-2 rounded-xl">
                                        <span>TOTAL ({viewMigratedInvoice.currency || 'AUD'})</span>
                                        <span>
                                            ${viewMigratedInvoice.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Invoices;
