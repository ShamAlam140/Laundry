import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useSettings } from '../context/SettingsContext';
import type { OrderStatus } from '../types';
import {
    HiOutlineArrowLeft,
    HiOutlineCheckCircle,
    HiOutlineUser,
    HiOutlineCalendar,
    HiOutlinePrinter,
    HiOutlineX,
    HiOutlineDocumentText,
    HiOutlinePencil,
    HiOutlineTrash,
} from 'react-icons/hi';
import { HiOutlineCube, HiOutlineTruck } from 'react-icons/hi2';

interface InventoryItem {
    _id: string;
    itemName: string;
    category: string;
    quantity: number;
    unit: string;
    isLowStock: boolean;
}

interface InventoryUsageEntry {
    item: string;
    itemName: string;
    quantityUsed: number;
    unit: string;
}

const statusColors: Record<string, string> = {
    received: 'bg-blue-500 text-slate-900',
    washing: 'bg-cyan-500 text-slate-900',
    packed: 'bg-amber-500 text-slate-900',
    cancelled: 'bg-red-500 text-slate-900',
};

const statusSteps: OrderStatus[] = ['received', 'washing', 'packed'];

const OrderDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const { currency } = useSettings();

    // Inventory modal state
    const [showInventoryModal, setShowInventoryModal] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<string>('');
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [inventoryUsage, setInventoryUsage] = useState<InventoryUsageEntry[]>([]);
    const [loadingInventory, setLoadingInventory] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showShipModal, setShowShipModal] = useState(false);
    const [shippedQuantities, setShippedQuantities] = useState<Record<string, number>>({});
    const [shipping, setShipping] = useState(false);

    const fetchOrder = async () => {
        try {
            const res = await api.get(`/orders/${id}`);
            setOrder(res.data.data);
        } catch (err: any) {
            toast.error('Order not found');
            navigate('/orders');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchOrder(); }, [id]);

    const location = useLocation();
    useEffect(() => {
        if (order && location.state?.openShip && order.status === 'packed' && !order.isShipped) {
            // Clear location state to prevent repeating on refresh
            window.history.replaceState({}, document.title);
            openShipModal();
        }
    }, [order, location.state]);

    const fetchInventory = async () => {
        try {
            setLoadingInventory(true);
            const res = await api.get('/inventory', { params: { limit: 200 } });
            setInventoryItems(res.data.data);
        } catch {
            toast.error('Failed to load inventory');
        } finally {
            setLoadingInventory(false);
        }
    };

    const handleStatusClick = (status: string) => {
        if (status === 'washing') {
            // Only show inventory modal for washing
            setPendingStatus(status);
            setInventoryUsage([]);
            fetchInventory();
            setShowInventoryModal(true);
        } else {
            // For packed — update directly without inventory
            updateStatusDirect(status);
        }
    };

    const updateStatusDirect = async (status: string) => {
        try {
            await api.patch(`/orders/${id}/status`, { status });
            toast.success(`Status updated to ${status}`);
            fetchOrder();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update status');
        }
    };

    const addInventoryRow = () => {
        setInventoryUsage([...inventoryUsage, { item: '', itemName: '', quantityUsed: 0, unit: '' }]);
    };

    const removeInventoryRow = (index: number) => {
        setInventoryUsage(inventoryUsage.filter((_, i) => i !== index));
    };

    const updateInventoryRow = (index: number, field: string, value: any) => {
        const updated = [...inventoryUsage];
        if (field === 'item') {
            const selected = inventoryItems.find(i => i._id === value);
            updated[index] = {
                ...updated[index],
                item: value,
                itemName: selected?.itemName || '',
                unit: selected?.unit || '',
            };
        } else {
            (updated[index] as any)[field] = value;
        }
        setInventoryUsage(updated);
    };

    const submitStatusUpdate = async () => {
        try {
            setSubmitting(true);
            // Filter out rows with no item selected or zero quantity
            const validUsage = inventoryUsage.filter(u => u.item && u.quantityUsed > 0);
            await api.patch(`/orders/${id}/status`, {
                status: pendingStatus,
                inventoryUsage: validUsage,
            });
            toast.success(`Status updated to ${pendingStatus}`);
            setShowInventoryModal(false);
            setInventoryUsage([]);
            fetchOrder();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update status');
        } finally {
            setSubmitting(false);
        }
    };

        // Edit Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editQuantities, setEditQuantities] = useState<Record<string, number>>({});
    const [customItems, setCustomItems] = useState<any[]>([]);
    const [masterServices, setMasterServices] = useState<any[]>([]);
    const [savingEdits, setSavingEdits] = useState(false);
    const hasCheckedEdit = useRef(false);

    useEffect(() => {
        if (order && (location.state as any)?.openEdit && !order.isShipped && order.status !== 'cancelled' && !hasCheckedEdit.current) {
            hasCheckedEdit.current = true;
            window.history.replaceState({}, document.title);
            openEditModal();
        }
    }, [order, location.state]);

    const openEditModal = async () => {
        if (!order) return;
        let services: any[] = [];
        try {
            const res = await api.get('/services', { params: { active: true, customerId: order.customer?._id } });
            services = (res.data.data || res.data || []).map((s: any) => ({ ...s, name: s.name || s.serviceName, serviceName: s.serviceName || s.name }));
        } catch (err) {
            console.error('Failed to fetch services', err);
        }

        const existingServices = order.items?.filter((i: any) => i.serviceType !== 'manual' && i.service) || [];
        existingServices.forEach((es: any) => {
            if (!services.some(s => s._id === es.service)) {
                services.push({ _id: es.service, name: es.serviceName, serviceName: es.serviceName, serviceType: es.serviceType, pricePerUnit: es.pricePerUnit, unit: es.unit });
            }
        });
        setMasterServices(services);

        const initialQty: Record<string, number> = {};
        services.forEach(s => {
            const found = order.items?.find((i: any) => i.service === s._id);
            initialQty[s._id] = found ? found.quantity : 0;
        });
        setEditQuantities(initialQty);

        const manual = order.items?.filter((i: any) => i.serviceType === 'manual') || [];
        setCustomItems(manual.map((i: any) => ({ ...i })));
        setShowEditModal(true);
    };

    const closeEditModal = () => {
        setShowEditModal(false);
        setEditQuantities({});
        setCustomItems([]);
    };

    const handleEditQty = (srvId: string, val: string) => {
        if (val === '') { setEditQuantities(prev => ({ ...prev, [srvId]: 0 })); return; }
        const parsed = Math.max(0, parseFloat(val) || 0);
        setEditQuantities(prev => ({ ...prev, [srvId]: parsed }));
    };

    const toggleServiceQty = (srvId: string) => {
        setEditQuantities(prev => {
            const current = prev[srvId] ?? 0;
            const original = order?.items?.find((i: any) => i.service === srvId);
            const fallback = (original && original.quantity > 0) ? original.quantity : 1;
            return { ...prev, [srvId]: current > 0 ? 0 : fallback };
        });
    };

    const handleCustomChange = (idx: number, field: string, val: any) => {
        setCustomItems(prev => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], [field]: val };
            return copy;
        });
    };
    const addCustomItem = () => {
        setCustomItems(prev => [...prev, { _id: `temp-custom-${Date.now()}`, serviceType: 'manual', itemName: '', quantity: 1, pricePerUnit: 0, unit: 'piece' }]);
    };
    const removeCustomItem = (idx: number) => {
        setCustomItems(prev => prev.filter((_, i) => i !== idx));
    };

    const fillAllEditServices = () => {
        if (!order) return;
        setEditQuantities(prev => {
            const next = { ...prev };
            masterServices.forEach(s => {
                const found = order.items?.find((i: any) => i.service === s._id);
                next[s._id] = found ? found.quantity : 1;
            });
            return next;
        });
    };

    const fillAllEditCustom = () => {
        setCustomItems(prev => prev.map(c => ({ ...c, quantity: c.quantity > 0 ? c.quantity : 1 })));
    };

    const editTotals = useMemo(() => {
        if (!order) return { subtotal: 0, taxAmount: 0, discountAmount: 0, totalAmount: 0 };
        let sub = 0;
        masterServices.forEach(s => {
            const q = editQuantities[s._id] || 0;
            sub += q * s.pricePerUnit;
        });
        const tax = sub * (order.taxPercent || 0) / 100;
        const discount = sub * (order.discountPercent || 0) / 100;
        const total = sub + tax - discount + (order.serviceCharge || 0);
        return { subtotal: sub, taxAmount: tax, discountAmount: discount, totalAmount: total };
    }, [order, masterServices, editQuantities]);

    const saveEditChanges = async () => {
        if (!order) return;
        const finalItems: any[] = [];
        masterServices.forEach(s => {
            const q = editQuantities[s._id];
            if (q > 0) {
                finalItems.push({
                    service: s._id,
                    serviceName: s.serviceName || s.name,
                    serviceType: s.serviceType,
                    itemName: "",
                    quantity: q,
                    pricePerUnit: s.pricePerUnit,
                    unit: s.unit,
                    subtotal: q * s.pricePerUnit
                });
            }
        });
        customItems.forEach(c => {
            if (c.itemName.trim() && c.quantity > 0) {
                finalItems.push({
                    service: null,
                    serviceName: c.itemName,
                    serviceType: 'manual',
                    itemName: c.itemName,
                    quantity: c.quantity,
                    pricePerUnit: c.pricePerUnit || 0,
                    unit: c.unit || 'piece',
                    subtotal: c.quantity * (c.pricePerUnit || 0)
                });
            }
        });

        try {
            setSavingEdits(true);
            await api.put(`/orders/${order._id}`, { items: finalItems });
            toast.success('Order items updated successfully!');
            closeEditModal();
            fetchOrder();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update order items');
        } finally {
            setSavingEdits(false);
        }
    };


    // Ship order modal functions
    const openShipModal = () => {
        if (!order) return;
        const initialQtys: Record<string, number> = {};
        order.items?.forEach((item: any) => {
            initialQtys[item._id] = item.quantity;
        });
        setShippedQuantities(initialQtys);
        setShowShipModal(true);
    };

    const closeShipModal = () => {
        setShowShipModal(false);
        setShippedQuantities({});
    };

    const handleShipQtyChange = (itemId: string, val: number, max: number) => {
        const cleanVal = Math.max(0, Math.min(max, val));
        setShippedQuantities((prev) => ({
            ...prev,
            [itemId]: cleanVal,
        }));
    };

    const shipTotals = useMemo(() => {
        if (!order) return { subtotal: 0, taxAmount: 0, discountAmount: 0, totalAmount: 0 };
        const billable = order.items.filter((item: any) => item.serviceType !== 'manual');
        const subtotal = billable.reduce((sum: number, item: any) => {
            const shippedQty = shippedQuantities[item._id] ?? item.quantity;
            return sum + shippedQty * item.pricePerUnit;
        }, 0);
        const taxAmount = (subtotal * (order.taxPercent || 0)) / 100;
        const discountAmount = (subtotal * (order.discountPercent || 0)) / 100;
        const totalAmount = subtotal + taxAmount - discountAmount + (order.serviceCharge || 0);
        return { subtotal, taxAmount, discountAmount, totalAmount };
    }, [order, shippedQuantities]);

    const handleConfirmShipment = async () => {
        if (!order) return;
        try {
            setShipping(true);
            const items = Object.entries(shippedQuantities).map(([itemId, shippedQuantity]) => ({
                itemId,
                shippedQuantity,
            }));

            await api.post(`/orders/${order._id}/ship`, { items });
            toast.success('Order shipped & Invoice generated!');
            closeShipModal();
            fetchOrder();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to ship order');
        } finally {
            setShipping(false);
        }
    };

    const printThermalLabel = () => {
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) return;

        const customer = order.customer || {};
        const items = order.items || [];
        
        // Inline styles object (like invoice approach)
        const styles = {
            page: 'max-width: 800px; margin: 0 auto; padding: 20px; background: #fff; color: #000; font-family: Arial, sans-serif;',
            container: 'border: 3px solid #1c2a5e; padding: 20px; border-radius: 8px;',
            header: 'display: grid; grid-template-columns: 180px 1fr auto; gap: 15px; align-items: start; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e5e7eb;',
            logo: 'max-width: 180px; height: auto;',
            companyInfo: 'text-align: center;',
            companyName: 'font-size: 14px; font-weight: bold; margin-bottom: 4px; color: #1c2a5e;',
            companyAddress: 'font-size: 10px; color: #475569; line-height: 1.5;',
            contactInfo: 'text-align: right; font-size: 9px; line-height: 1.7; color: #475569;',
            contactIcon: 'font-size: 10px; margin-right: 4px;',
            customerSection: 'margin-bottom: 20px; padding: 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px;',
            customerName: 'font-size: 15px; font-weight: bold; margin-bottom: 4px; color: #1c2a5e;',
            customerDetails: 'font-size: 11px; color: #64748b;',
            orderHeader: 'display: flex; justify-content: space-between; align-items: center; padding: 12px 0; margin-bottom: 15px; border-bottom: 2px solid #e5e7eb;',
            orderButton: 'background: #1c2a5e; color: white; padding: 8px 16px; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-flex; align-items: center; gap: 8px;',
            barcodeSection: 'text-align: right;',
            barcodeText: 'font-size: 12px; margin-top: 4px; font-weight: bold; letter-spacing: 1px; color: #1c2a5e;',
            datesSection: 'display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; padding: 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px;',
            dateItem: 'text-align: center;',
            dateLabel: 'font-size: 9px; color: #64748b; text-transform: uppercase; margin-bottom: 5px; font-weight: 600; letter-spacing: 1px;',
            dateValue: 'font-size: 13px; font-weight: bold; color: #1c2a5e;',
            table: 'width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;',
            th: 'background: #1c2a5e; color: white; padding: 10px 12px; text-align: left; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;',
            thCenter: 'background: #1c2a5e; color: white; padding: 10px 12px; text-align: center; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;',
            td: 'padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #1e293b;',
            tdCenter: 'padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #1e293b; text-align: center; font-weight: 500;',
            rowEven: 'background: #f8fafc;',
            footer: 'text-align: center; background: #1c2a5e; color: white; padding: 12px; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; border-radius: 6px;',
            createdBy: 'text-align: center; font-size: 9px; color: #94a3b8; margin-top: 12px; font-style: italic;',
        };
        
        printWindow.document.write(`
            <html>
            <head>
                <title>Order Label - ${order.orderId}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    @page { size: A4 portrait; margin: 10mm; }
                    @media print {
                        html, body { background: #ffffff !important; margin: 0 !important; padding: 0 !important; }
                        body * { visibility: hidden; }
                        .label-print-shell, .label-print-shell * { visibility: visible; }
                        .label-print-shell { position: absolute; left: 0; top: 0; width: 100%; }
                    }
                </style>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
            </head>
            <body>
                <div class="label-print-shell" style="${styles.page}">
                    <div style="${styles.container}">
                        <!-- Header -->
                        <div style="${styles.header}">
                            <div>
                                <img src="${window.location.origin}/logo.jpeg" alt="Logo" style="${styles.logo}" />
                            </div>
                            <div style="${styles.companyInfo}">
                                <div style="${styles.companyName}">JSP Corporation Pty Ltd T/A Peninsula Laundries</div>
                                <div style="${styles.companyAddress}">
                                    13 Redcliffe Gardens Drive<br/>
                                    Clontarf, Queensland, 4019
                                </div>
                            </div>
                            <div style="${styles.contactInfo}">
                                <div><span style="${styles.contactIcon}">📞</span> 61475902921</div>
                                <div><span style="${styles.contactIcon}">🌐</span> peninsulalaundries.com.au</div>
                                <div><span style="${styles.contactIcon}">📧</span> orders@peninsulalaundries.com.au</div>
                                <div style="margin-top: 4px; font-weight: bold;">ABN: 31647801045</div>
                            </div>
                        </div>

                        <!-- Customer Section -->
                        <div style="${styles.customerSection}">
                            <div style="${styles.customerName}">${customer.name || 'N/A'}</div>
                            <div style="${styles.customerDetails}">
                                ${customer.phone || ''} ${customer.email ? '• ' + customer.email : ''}
                            </div>
                        </div>

                        <!-- Order Header with Barcode -->
                        <div style="${styles.orderHeader}">
                            <div style="${styles.orderButton}">
                                <span style="font-size: 20px;">+</span> Order
                            </div>
                            <div style="${styles.barcodeSection}">
                                <svg id="barcode"></svg>
                                <div style="${styles.barcodeText}">${order.orderId}</div>
                            </div>
                        </div>

                        <!-- Dates -->
                        <div style="${styles.datesSection}">
                            <div style="${styles.dateItem}">
                                <div style="${styles.dateLabel}">Order Date</div>
                                <div style="${styles.dateValue}">${new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()}</div>
                            </div>
                            <div style="${styles.dateItem}">
                                <div style="${styles.dateLabel}">Delivery Date</div>
                                <div style="${styles.dateValue}">${order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase() : 'N/A'}</div>
                            </div>
                        </div>

                        <!-- Items Table -->
                        <table style="${styles.table}">
                            <thead>
                                <tr>
                                    <th style="${styles.th}">Item #</th>
                                    <th style="${styles.th}">Item Name</th>
                                    <th style="${styles.thCenter}">Order Qty</th>
                                    <th style="${styles.thCenter}">Filled Qty</th>
                                    <th style="${styles.thCenter}">Back Order</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.map((item: any, index: number) => `
                                    <tr style="${index % 2 === 1 ? styles.rowEven : ''}">
                                        <td style="${styles.td}">${index + 1}</td>
                                        <td style="${styles.td}">${item.itemName || item.serviceName}</td>
                                        <td style="${styles.tdCenter}">${item.quantity}</td>
                                        <td style="${styles.tdCenter}">${item.quantity}</td>
                                        <td style="${styles.tdCenter}">0</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>

                        <!-- Created By -->
                        <div style="${styles.createdBy}">
                            Created by ${order.createdBy?.name || 'Admin'} on ${new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })} at ${new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </div>

                        <!-- Footer -->
                        <div style="${styles.footer}">
                            THANK YOU FOR DOING BUSINESS WITH US!
                        </div>
                    </div>
                </div>
                <script>
                    window.onload = function() {
                        // Generate barcode
                        JsBarcode("#barcode", "${order.orderId}", {
                            format: "CODE128",
                            width: 2,
                            height: 50,
                            displayValue: false,
                            background: "#ffffff",
                            lineColor: "#000000"
                        });
                        
                        // Print after barcode is generated
                        setTimeout(function() {
                            window.print();
                        }, 800);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!order) return null;

    const currentStepIndex = statusSteps.indexOf(order.status);

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/orders')} className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white transition-colors">
                    <HiOutlineArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-900">{order.orderId}</h1>
                    <p className="text-sm text-slate-500">Created {new Date(order.createdAt).toLocaleString()}</p>
                </div>
                                {!order.isShipped && order.status !== 'cancelled' && (
                    <button
                        onClick={openEditModal}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:text-cyan-600 hover:border-cyan-200 hover:bg-cyan-50 transition-all cursor-pointer"
                        title="Edit Order Items"
                    >
                        <HiOutlinePencil className="w-4 h-4" />
                        <span className="text-sm font-medium">Edit Items</span>
                    </button>
                )}
                <button 
                    onClick={printThermalLabel}
 
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:text-cyan-600 hover:border-cyan-200 hover:bg-cyan-50 transition-all" 
                    title="Print Order Label"
                >
                    <HiOutlinePrinter className="w-4 h-4" />
                    <span className="text-sm font-medium">Print Label</span>
                </button>
                <span className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize ${statusColors[order.status] || 'bg-slate-600 text-slate-900'}`}>
                    {order.status}
                </span>
            </div>

            {/* Status Timeline */}
            {order.status !== 'cancelled' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h2 className="text-base font-semibold text-slate-900 mb-4">Order Progress</h2>
                    <div className="flex items-center justify-between overflow-x-auto pb-2">
                        {statusSteps.map((step, i) => (
                            <div key={step} className="flex items-center">
                                <div className="flex flex-col items-center">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${i <= currentStepIndex ? 'bg-cyan-500 text-slate-900' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                        {i <= currentStepIndex ? <HiOutlineCheckCircle className="w-5 h-5" /> : i + 1}
                                    </div>
                                    <span className={`text-[10px] mt-1 capitalize whitespace-nowrap ${i <= currentStepIndex ? 'text-cyan-600' : 'text-slate-500'
                                        }`}>{step}</span>
                                </div>
                                {i < statusSteps.length - 1 && (
                                    <div className={`w-8 sm:w-16 h-0.5 mx-1 ${i < currentStepIndex ? 'bg-cyan-500' : 'bg-slate-100'
                                        }`}></div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Quick status buttons */}
                    {order.status !== 'packed' && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {statusSteps.filter((_, i) => i > currentStepIndex).slice(0, 2).map((s) => (
                                <button key={s} onClick={() => handleStatusClick(s)}
                                    className="px-4 py-2 text-sm rounded-xl border border-cyan-200 text-cyan-600 hover:bg-cyan-50 transition-colors capitalize">
                                    Mark as {s}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Ship & Create Invoice button — only for packed, un-shipped orders */}
                    {order.status === 'packed' && !order.isShipped && (
                        <div className="mt-4">
                            <button
                                onClick={openShipModal}
                                disabled={shipping}
                                className="flex items-center gap-2 px-5 py-2.5 bg-[#1c2a5e] text-white text-sm font-bold rounded-xl hover:bg-opacity-90 transition-all shadow-lg disabled:bg-slate-400 disabled:cursor-not-allowed"
                            >
                                {shipping ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <HiOutlineTruck className="w-5 h-5" />
                                )}
                                Ship & Create Invoice
                            </button>
                            <p className="text-xs text-slate-500 mt-2">Invoice will be generated pending approval.</p>
                        </div>
                    )}

                    {/* Already shipped badge */}
                    {order.isShipped && (
                        <div className="mt-4">
                            <button
                                onClick={() => navigate('/invoices?tab=pending', { state: { searchOrderId: order.orderId, tab: 'pending' } })}
                                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-sm font-semibold rounded-xl transition-all shadow-sm"
                            >
                                <HiOutlineDocumentText className="w-5 h-5 text-emerald-600" />
                                Shipped & Invoiced
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Service Time Tracking */}
            {order.serviceStartTime && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h2 className="text-base font-semibold text-slate-900 mb-4">Service Time</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <span className="text-xs text-slate-500">Started</span>
                            <p className="text-sm text-slate-900 font-medium mt-1">
                                {new Date(order.serviceStartTime).toLocaleString()}
                            </p>
                        </div>
                        {order.serviceEndTime && (
                            <>
                                <div>
                                    <span className="text-xs text-slate-500">Completed</span>
                                    <p className="text-sm text-slate-900 font-medium mt-1">
                                        {new Date(order.serviceEndTime).toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-xs text-slate-500">Duration</span>
                                    <p className="text-sm text-slate-900 font-medium mt-1">
                                        {order.serviceDuration < 1 
                                            ? `${Math.round(order.serviceDuration * 60)} minutes`
                                            : `${order.serviceDuration.toFixed(2)} hours`
                                        }
                                    </p>
                                </div>
                            </>
                        )}
                        {!order.serviceEndTime && (
                            <div>
                                <span className="text-xs text-slate-500">Status</span>
                                <p className="text-sm text-cyan-600 font-medium mt-1">In Progress</p>
                            </div>
                        )}
                    </div>
                    {order.isDelayed && (
                        <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                            <span className="text-red-600 text-sm font-medium">⚠️ Delayed Order</span>
                        </div>
                    )}
                </div>
            )}

            {/* Refund Information */}
            {order.hasRefund && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-semibold text-slate-900">Refund Information</h2>
                        <span className="px-3 py-1 bg-amber-200 text-amber-800 text-xs font-semibold rounded-lg">
                            REFUNDED
                        </span>
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-600">Total Refunded:</span>
                            <span className="text-slate-900 font-semibold">{currency}{order.totalRefundAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate(`/orders/${id}/refund`)}
                        className="mt-3 w-full px-4 py-2 text-sm rounded-xl border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors"
                    >
                        View Refund Details
                    </button>
                </div>
            )}

            {/* Damage Information */}
            {order.items?.some((item: any) => item.damageDetails) && (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-semibold text-slate-900">Damage Information</h2>
                        <span className="px-3 py-1 bg-orange-200 text-orange-800 text-xs font-semibold rounded-lg">
                            DAMAGE RECORDED
                        </span>
                    </div>
                    <div className="space-y-3">
                        {order.items?.filter((item: any) => item.damageDetails).map((item: any, i: number) => (
                            <div key={i} className="p-3 bg-white rounded-lg border border-orange-200">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="font-medium text-slate-900">{item.itemName || item.serviceName}</p>
                                        <p className="text-sm text-slate-600">
                                            Damaged: {item.damagedQuantity} of {item.quantity} {item.unit}
                                        </p>
                                    </div>
                                    <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">
                                        {item.damageReason?.replace('_', ' ')}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-700 bg-slate-50 p-2 rounded">
                                    <strong>Details:</strong> {item.damageDetails}
                                </p>
                                {item.potentialRefundAmount && (
                                    <p className="text-xs text-slate-500 mt-1">
                                        Potential refund: {currency}{item.potentialRefundAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                    {!order.hasRefund && (
                        <button
                            onClick={() => navigate(`/orders/${id}/refund`)}
                            className="mt-3 w-full px-4 py-2 text-sm rounded-xl border border-orange-300 text-orange-700 hover:bg-orange-100 transition-colors"
                        >
                            Process Refund for Damaged Items
                        </button>
                    )}
                </div>
            )}

            {/* Process Refund Button (for admin/manager) */}
            {!order.hasRefund && order.status !== 'cancelled' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <button
                        onClick={() => navigate(`/orders/${id}/refund`)}
                        className="w-full px-4 py-2.5 text-sm font-semibold rounded-xl border-2 border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                    >
                        Process Refund
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Customer & Order Info */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Items */}
                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-200">
                            <h2 className="text-base font-semibold text-slate-900">Order Items</h2>
                        </div>
                        <table className="w-full">
                            <thead>
                                <tr className="text-xs text-slate-500 uppercase border-b border-slate-200">
                                    <th className="px-5 py-3 text-left">Service / Item</th>
                                    <th className="px-5 py-3 text-center">Qty</th>
                                    <th className="px-5 py-3 text-right">Rate</th>
                                    <th className="px-5 py-3 text-right">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.items?.map((item: any, i: number) => (
                                    <tr key={i} className="border-b border-slate-200">
                                        <td className="px-5 py-3">
                                            <div className="flex items-start gap-2">
                                                <div className="flex-1">
                                                    <span className="text-sm text-slate-900 font-medium">
                                                        {item.itemName || item.serviceName}
                                                    </span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <p className="text-xs text-slate-500 capitalize">{item.serviceType?.replace('-', ' ')}</p>
                                                        {item.itemType && (
                                                            <>
                                                                <span className="text-slate-300">•</span>
                                                                <span className="text-xs px-2 py-0.5 bg-cyan-50 text-cyan-600 rounded">
                                                                    {item.itemType.replace('_', ' ')}
                                                                </span>
                                                            </>
                                                        )}
                                                        {item.isRefunded && (
                                                            <>
                                                                <span className="text-slate-300">•</span>
                                                                <span className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded font-medium">
                                                                    Refunded {currency}{item.refundAmount}
                                                                </span>
                                                            </>
                                                        )}
                                                        {item.damageDetails && (
                                                            <>
                                                                <span className="text-slate-300">•</span>
                                                                <span className="text-xs px-2 py-0.5 bg-orange-50 text-orange-600 rounded font-medium">
                                                                    Damaged ({item.damagedQuantity} {item.unit})
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 text-center">
                                            {item.shippedQuantity !== null && item.shippedQuantity !== undefined ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[12px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                                                        {item.shippedQuantity} {item.unit}
                                                    </span>
                                                    {item.shippedQuantity !== item.quantity && (
                                                        <span className="text-[10px] text-slate-500 font-medium bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                                                            Ordered: {item.quantity}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-sm text-slate-700 font-medium">
                                                    {item.quantity} {item.unit}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-right text-sm text-slate-600">{currency}{item.pricePerUnit}</td>
                                        <td className="px-5 py-3 text-right text-sm text-slate-900 font-medium">{currency}{item.subtotal}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Status History */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <h2 className="text-base font-semibold text-slate-900 mb-4">Status History</h2>
                        <div className="space-y-4">
                            {order.statusHistory?.map((h: any, i: number) => (
                                <div key={i} className="flex items-start gap-3 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-cyan-500 mt-1.5 flex-shrink-0"></div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-slate-900 capitalize font-medium">{h.status}</span>
                                            <span className="text-slate-500">•</span>
                                            <span className="text-slate-500">{new Date(h.timestamp).toLocaleString()}</span>
                                            {h.updatedBy?.name && <span className="text-slate-500">by {h.updatedBy.name}</span>}
                                        </div>
                                        {/* Show inventory usage for this status change */}
                                        {h.inventoryUsage && h.inventoryUsage.length > 0 && (
                                            <div className="mt-2 ml-1 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                                                <p className="text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1">
                                                    <HiOutlineCube className="w-3.5 h-3.5" /> Inventory Used:
                                                </p>
                                                <div className="space-y-1">
                                                    {h.inventoryUsage.map((u: any, j: number) => (
                                                        <div key={j} className="flex justify-between text-xs">
                                                            <span className="text-slate-600">{u.itemName}</span>
                                                            <span className="text-slate-900 font-medium">{u.quantityUsed} {u.unit}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right sidebar */}
                <div className="space-y-4">
                    {/* Customer */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><HiOutlineUser className="w-4 h-4" /> Customer</h3>
                        <p className="text-slate-900 font-medium">{order.customer?.name}</p>
                        <p className="text-sm text-slate-500">{order.customer?.phone}</p>
                        <p className="text-xs text-slate-500 mt-1">{order.customer?.customerId} • {order.customer?.customerType}</p>
                    </div>

                    {/* Pricing */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <h3 className="text-sm font-semibold text-slate-900 mb-3">Pricing</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="text-slate-900">{currency}{Number(order.subtotal || 0).toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Tax ({order.taxPercent}%)</span><span className="text-slate-900">+{currency}{Number(order.taxAmount || 0).toFixed(2)}</span></div>
                            {order.discountAmount > 0 && (
                                <div className="flex justify-between"><span className="text-slate-500">Discount ({order.discountPercent}%)</span><span className="text-emerald-400">-{currency}{Number(order.discountAmount || 0).toFixed(2)}</span></div>
                            )}
                            <div className="flex justify-between pt-2 border-t border-slate-200 font-bold text-base">
                                <span className="text-slate-900">Total</span>
                                <span className="text-cyan-600">{currency}{Number(order.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>

                    {/* Invoice / Payment */}
                    {order.invoice && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-5">
                            <h3 className="text-sm font-semibold text-slate-900 mb-3">Invoice</h3>
                            <p className="text-cyan-600 font-medium">{order.invoice.invoiceId}</p>
                            <div className="mt-2 space-y-1 text-sm">
                                <div className="flex justify-between"><span className="text-slate-500">Paid</span><span className="text-emerald-400">{currency}{Number(order.invoice.paidAmount || 0).toFixed(2)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Due</span><span className="text-red-400">{currency}{Number(order.invoice.balanceDue || 0).toFixed(2)}</span></div>
                            </div>
                            <span className={`inline-block mt-2 px-2.5 py-1 rounded-lg text-xs font-medium capitalize ${order.invoice.paymentStatus === 'paid'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                : order.invoice.paymentStatus === 'partial'
                                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                    : 'bg-red-500/15 text-red-400 border border-red-500/20'
                                }`}>{order.invoice.paymentStatus}</span>
                        </div>
                    )}

                    {/* Delivery */}
                    {order.deliveryDate && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-5">
                            <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2"><HiOutlineCalendar className="w-4 h-4" /> Delivery Date</h3>
                            <p className="text-slate-900">{new Date(order.deliveryDate).toLocaleDateString()}</p>
                        </div>
                    )}

                    {order.specialInstructions && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-5">
                            <h3 className="text-sm font-semibold text-slate-900 mb-2">Special Instructions</h3>
                            <p className="text-sm text-slate-500">{order.specialInstructions}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Inventory Usage Modal */}
            {showInventoryModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 capitalize">
                                    Mark as {pendingStatus}
                                </h3>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    Select inventory items used (optional)
                                </p>
                            </div>
                            <button onClick={() => setShowInventoryModal(false)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                                <HiOutlineX className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                            {loadingInventory ? (
                                <div className="flex items-center justify-center py-10">
                                    <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <>
                                    {/* Inventory usage rows */}
                                    {inventoryUsage.map((row, index) => (
                                        <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="flex-1 space-y-2">
                                                <select
                                                    value={row.item}
                                                    onChange={(e) => updateInventoryRow(index, 'item', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-cyan-500"
                                                >
                                                    <option value="">Select Item</option>
                                                    {inventoryItems.map((item) => (
                                                        <option key={item._id} value={item._id}>
                                                            {item.itemName} — {item.quantity} {item.unit} available
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        placeholder="Qty used"
                                                        min="0"
                                                        step="any"
                                                        value={row.quantityUsed || ''}
                                                        onChange={(e) => updateInventoryRow(index, 'quantityUsed', parseFloat(e.target.value) || 0)}
                                                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-cyan-500"
                                                    />
                                                    {row.unit && (
                                                        <span className="text-xs text-slate-500 px-2 py-1 bg-slate-100 rounded-lg">{row.unit}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <button onClick={() => removeInventoryRow(index)} className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors mt-1">
                                                <HiOutlineX className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}

                                    {/* Add item button */}
                                    <button
                                        onClick={addInventoryRow}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:text-cyan-600 hover:border-cyan-300 transition-colors"
                                    >
                                        <HiOutlineCube className="w-4 h-4" />
                                        Add Inventory Item
                                    </button>

                                    {inventoryUsage.length === 0 && (
                                        <p className="text-xs text-slate-400 text-center">
                                            No inventory items selected. You can update the status without adding items.
                                        </p>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setShowInventoryModal(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitStatusUpdate}
                                disabled={submitting}
                                className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/30 disabled:opacity-50"
                            >
                                {submitting ? 'Updating...' : `Update to ${pendingStatus}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── SHIP & INVOICE MODAL ── */}
            {showShipModal && order && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
                    <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden transform transition-all flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Ship Order & Generate Invoice: {order.orderId}</h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    Customer: <span className="font-bold text-slate-700">{order.customer?.name}</span> <span className="text-slate-400">({order.customer?.customerId || 'CUST-0047'})</span>
                                </p>
                            </div>
                            <button onClick={closeShipModal} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                                <HiOutlineX className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-8 overflow-y-auto space-y-10 flex-1">
                            <p className="text-sm text-slate-500">
                                Enter the quantity of items being shipped. Any difference from the ordered quantity will be tracked.
                            </p>

                            {/* Service Items Table */}
                            {order.items?.filter((item: any) => item.serviceType !== 'manual' && item.service).length > 0 && (
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-[#1c2a5e] uppercase tracking-widest">Services & Billing Items</h4>
                                    <div className="w-full">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="text-[#1c2a5e] text-[11px] font-bold uppercase border-b border-slate-200">
                                                    <th className="py-3 text-left w-1/3">Item</th>
                                                    <th className="py-3 text-center">
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <span>Fill Items</span>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => {
                                                                    setShippedQuantities(prev => {
                                                                        const next = { ...prev };
                                                                        order.items?.filter((i: any) => i.serviceType !== 'manual' && i.service).forEach((i: any) => next[i._id] = i.quantity);
                                                                        return next;
                                                                    });
                                                                }} 
                                                                className="text-[9px] text-cyan-600 hover:text-cyan-800 hover:underline transition-all"
                                                            >
                                                                [Fill All]
                                                            </button>
                                                        </div>
                                                    </th>
                                                    <th className="py-3 text-center">Qty Ordered</th>
                                                    <th className="py-3 text-center">Filled Qty</th>
                                                    <th className="py-3 text-center">Back Order</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {order.items?.filter((item: any) => item.serviceType !== 'manual' && item.service).map((item: any) => {
                                                    const qty = shippedQuantities[item._id] ?? item.quantity;
                                                    const backOrder = Math.max(0, item.quantity - qty);
                                                    
                                                    return (
                                                        <tr key={item._id}>
                                                            <td className="py-4 font-medium text-slate-800 text-sm">
                                                                {item.itemName || item.serviceName}
                                                            </td>
                                                            <td className="py-4 text-center">
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => handleShipQtyChange(item._id, item.quantity, item.quantity)}
                                                                    className="px-4 py-1.5 rounded-full border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                                                >
                                                                    {item.quantity}
                                                                </button>
                                                            </td>
                                                            <td className="py-4 text-center">
                                                                <div className="text-sm font-semibold text-slate-400">
                                                                    {item.quantity}
                                                                </div>
                                                            </td>
                                                            <td className="py-4 text-center">
                                                                <input 
                                                                    type="number" 
                                                                    min={0} 
                                                                    max={item.quantity}
                                                                    value={qty || ''} 
                                                                    onChange={(e) => handleShipQtyChange(item._id, parseInt(e.target.value) || 0, item.quantity)} 
                                                                    className={`w-24 mx-auto text-center py-2 text-base font-bold rounded-full focus:outline-none transition-all hide-spinners ${qty > 0 ? 'border-2 border-cyan-200 text-slate-800' : 'border border-slate-200 text-slate-400'}`} 
                                                                />
                                                            </td>
                                                            <td className="py-4 text-center">
                                                                <div className="w-16 mx-auto py-1.5 text-center text-sm font-bold text-slate-300 border border-slate-200 rounded-full">
                                                                    {backOrder}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Custom Items */}
                            {order.items?.filter((item: any) => item.serviceType === 'manual' || !item.service).length > 0 && (
                                <div className="space-y-4 pt-4 border-t border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <h4 className="text-xs font-bold text-[#1c2a5e] uppercase tracking-widest">Linen / Custom Items Tracking</h4>
                                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase bg-slate-100 text-slate-500">Not Billed</span>
                                    </div>
                                    
                                    <div className="w-full">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="text-[#1c2a5e] text-[11px] font-bold uppercase border-b border-slate-200">
                                                    <th className="py-3 text-left w-1/3">Linen / Bag Item</th>
                                                    <th className="py-3 text-center">
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <span>Fill Items</span>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => {
                                                                    setShippedQuantities(prev => {
                                                                        const next = { ...prev };
                                                                        order.items?.filter((i: any) => i.serviceType === 'manual' || !i.service).forEach((i: any) => next[i._id] = i.quantity);
                                                                        return next;
                                                                    });
                                                                }} 
                                                                className="text-[9px] text-cyan-600 hover:text-cyan-800 hover:underline transition-all"
                                                            >
                                                                [Fill All]
                                                            </button>
                                                        </div>
                                                    </th>
                                                    <th className="py-3 text-center">Qty Ordered</th>
                                                    <th className="py-3 text-center">Filled Qty</th>
                                                    <th className="py-3 text-center">Back Order</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {order.items?.filter((item: any) => item.serviceType === 'manual' || !item.service).map((item: any) => {
                                                    const qty = shippedQuantities[item._id] ?? item.quantity;
                                                    const backOrder = Math.max(0, item.quantity - qty);
                                                    
                                                    return (
                                                        <tr key={item._id}>
                                                            <td className="py-4 font-medium text-slate-800 text-sm">
                                                                {item.itemName || item.serviceName}
                                                            </td>
                                                            <td className="py-4 text-center">
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => handleShipQtyChange(item._id, item.quantity, item.quantity)}
                                                                    className="px-4 py-1.5 rounded-full border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                                                >
                                                                    {item.quantity}
                                                                </button>
                                                            </td>
                                                            <td className="py-4 text-center">
                                                                <div className="text-sm font-semibold text-slate-400">
                                                                    {item.quantity}
                                                                </div>
                                                            </td>
                                                            <td className="py-4 text-center">
                                                                <input 
                                                                    type="number" 
                                                                    min={0} 
                                                                    max={item.quantity}
                                                                    value={qty || ''} 
                                                                    onChange={(e) => handleShipQtyChange(item._id, parseInt(e.target.value) || 0, item.quantity)} 
                                                                    className={`w-24 mx-auto text-center py-2 text-base font-bold rounded-full focus:outline-none transition-all hide-spinners ${qty > 0 ? 'border-2 border-cyan-200 text-slate-800' : 'border border-slate-200 text-slate-400'}`} 
                                                                />
                                                            </td>
                                                            <td className="py-4 text-center">
                                                                <div className="w-16 mx-auto py-1.5 text-center text-sm font-bold text-slate-300 border border-slate-200 rounded-full">
                                                                    {backOrder}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Totals Section */}
                            <div className="flex justify-end pt-6">
                                <div className="w-full lg:w-[320px] bg-slate-50/80 rounded-2xl p-6 border border-slate-100 space-y-4">
                                    <div className="flex justify-between text-sm text-slate-500">
                                        <span>Subtotal:</span>
                                        <span className="font-bold text-slate-800">{currency}{Number(shipTotals.subtotal || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-slate-500">
                                        <span>Tax ({order.taxPercent || 0}%):</span>
                                        <span className="font-bold text-slate-800">{currency}{Number(shipTotals.taxAmount || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-slate-500">
                                        <span>Discount ({order.discountPercent || 0}%):</span>
                                        <span className="font-bold text-slate-800">-{currency}{Number(shipTotals.discountAmount || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-slate-500">
                                        <span>Service Charge:</span>
                                        <span className="font-bold text-slate-800">{currency}{Number(order.serviceCharge || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
                                        <span className="font-bold text-slate-900">Invoice Total:</span>
                                        <span className="text-lg font-bold text-cyan-600">{currency}{Number(shipTotals.totalAmount || 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-5 border-t border-slate-100 flex items-center justify-end gap-4">
                            <button onClick={closeShipModal} className="px-4 py-2 text-slate-500 font-semibold text-sm hover:text-slate-800 transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleConfirmShipment} disabled={shipping} className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#1c2a5e] text-white text-sm font-bold rounded-xl hover:bg-[#152046] transition-all shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed min-w-[140px]">
                                {shipping ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><HiOutlineTruck className="w-5 h-5" /> Confirm & Ship</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Edit Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
                    <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden transform transition-all flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Edit Order Items: #{order.orderId}</h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    Customer: <span className="font-bold text-slate-700">{order.customer?.name}</span> <span className="text-slate-400">({order.customer?.customerId || 'CUST-0047'})</span>
                                </p>
                            </div>
                            <button onClick={closeEditModal} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                                <HiOutlineX className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-8 overflow-y-auto space-y-10 flex-1">
                            <p className="text-sm text-slate-500">
                                Adjust the quantities of the services below. Enter a quantity greater than 0 to add a service to the order, or set it to 0 to remove it.
                            </p>

                            {/* Service Items Table */}
                            {masterServices.length > 0 && (
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-[#1c2a5e] uppercase tracking-widest">Services & Billing Items</h4>
                                    <div className="w-full">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="text-[#1c2a5e] text-[11px] font-bold uppercase border-b border-slate-200">
                                                    <th className="py-3 text-left w-1/3">Item</th>
                                                    <th className="py-3 text-center">
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <span>Fill Items</span>
                                                            <button type="button" onClick={fillAllEditServices} className="text-[9px] text-cyan-600 hover:text-cyan-800 hover:underline transition-all">[Fill All]</button>
                                                        </div>
                                                    </th>
                                                    <th className="py-3 text-center">Qty Ordered</th>
                                                    <th className="py-3 text-center">Edit Qty</th>
                                                    <th className="py-3 text-center">Unit</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {masterServices.map((item: any) => {
                                                    const editQty = editQuantities[item._id] || 0;
                                                    const orderedQty = order.items?.find((i: any) => i.service === item._id)?.quantity || 0;
                                                    
                                                    return (
                                                        <tr key={item._id}>
                                                            <td className="py-4">
                                                                <div className="flex flex-col">
                                                                    <span className="font-semibold text-slate-800 text-base">{item.name || item.serviceName}</span>
                                                                    <span className="text-xs text-slate-400 mt-1">Price: {currency}{Number(item.pricePerUnit).toFixed(2).replace(/\.00$/, '')} / {item.unit}</span>
                                                                </div>
                                                            </td>
                                                            <td className="py-4 text-center">
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => handleEditQty(item._id, orderedQty.toString())}
                                                                    className="px-4 py-1.5 rounded-full border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                                                >
                                                                    {editQty === orderedQty && orderedQty > 0 ? `Selected (${orderedQty})` : orderedQty}
                                                                </button>
                                                            </td>
                                                            <td className="py-4 text-center">
                                                                <div className="text-sm font-semibold text-slate-400">
                                                                    {orderedQty}
                                                                </div>
                                                            </td>
                                                            <td className="py-4 text-center">
                                                                <input 
                                                                    type="number" 
                                                                    min={0} 
                                                                    value={editQty || ''} 
                                                                    onChange={(e) => handleEditQty(item._id, e.target.value)} 
                                                                    className={`w-24 mx-auto text-center py-2 text-base font-bold rounded-full focus:outline-none transition-all hide-spinners ${editQty > 0 ? 'border-2 border-cyan-200 text-slate-800' : 'border border-slate-200 text-slate-400'}`} 
                                                                />
                                                            </td>
                                                            <td className="py-4 text-center">
                                                                <span className="px-4 py-1.5 rounded-full border-2 border-cyan-100 text-cyan-600 font-bold text-sm bg-white">
                                                                    {item.unit}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Custom Items */}
                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <h4 className="text-xs font-bold text-[#1c2a5e] uppercase tracking-widest">Linen / Custom Items Tracking</h4>
                                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase bg-slate-100 text-slate-500">Not Billed</span>
                                    </div>
                                    <button type="button" onClick={addCustomItem} className="text-sm font-bold text-cyan-600 hover:text-cyan-700 transition-colors">
                                        + Add Custom Item
                                    </button>
                                </div>
                                
                                {customItems.length > 0 && (
                                    <div className="w-full">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="text-[#1c2a5e] text-[11px] font-bold uppercase border-b border-slate-200">
                                                    <th className="py-3 text-left w-1/3">Linen / Bag Item</th>
                                                    <th className="py-3 text-center">
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <span>Fill Items</span>
                                                            <button type="button" onClick={fillAllEditCustom} className="text-[9px] text-cyan-600 hover:text-cyan-800 hover:underline transition-all">[Fill All]</button>
                                                        </div>
                                                    </th>
                                                    <th className="py-3 text-center">Qty Ordered</th>
                                                    <th className="py-3 text-center">Edit Qty</th>
                                                    <th className="py-3 text-center">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {customItems.map((c, idx) => {
                                                    const orderedQty = order.items?.find((i: any) => i._id === c._id)?.quantity || 0;
                                                    return (
                                                        <tr key={c._id || idx}>
                                                            <td className="py-4">
                                                                <div className="flex flex-col gap-2">
                                                                    <input 
                                                                        type="text" 
                                                                        placeholder="e.g. towel" 
                                                                        value={c.itemName} 
                                                                        onChange={(e) => handleCustomChange(idx, 'itemName', e.target.value)} 
                                                                        className="w-full max-w-[200px] px-4 py-2 border border-slate-200 rounded-full text-sm font-medium text-slate-800 focus:outline-none focus:border-cyan-400" 
                                                                    />
                                                                    <div className="flex items-center gap-2 pl-2">
                                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Unit:</span>
                                                                        <select 
                                                                            value={c.unit || 'piece'} 
                                                                            onChange={(e) => handleCustomChange(idx, 'unit', e.target.value)}
                                                                            className="text-xs text-slate-600 bg-transparent focus:outline-none font-medium cursor-pointer"
                                                                        >
                                                                            <option value="piece">piece</option>
                                                                            <option value="kg">kg</option>
                                                                            <option value="bag">bag</option>
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="py-4 text-center">
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => handleCustomChange(idx, 'quantity', orderedQty)}
                                                                    className="px-4 py-1.5 rounded-full border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                                                >
                                                                    {c.quantity === orderedQty && orderedQty > 0 ? `Selected (${orderedQty})` : orderedQty}
                                                                </button>
                                                            </td>
                                                            <td className="py-4 text-center">
                                                                <div className="w-16 mx-auto py-1.5 text-center text-sm font-semibold text-slate-300 border border-slate-100 rounded-full bg-slate-50/50">
                                                                    {orderedQty}
                                                                </div>
                                                            </td>
                                                            <td className="py-4 text-center">
                                                                <input 
                                                                    type="number" 
                                                                    min={0} 
                                                                    value={c.quantity || ''} 
                                                                    onChange={(e) => handleCustomChange(idx, 'quantity', Math.max(0, parseInt(e.target.value) || 0))} 
                                                                    className="w-24 mx-auto text-center py-2 text-base font-bold rounded-full border border-slate-200 focus:outline-none focus:border-cyan-400 text-slate-800 hide-spinners" 
                                                                />
                                                            </td>
                                                            <td className="py-4 text-center">
                                                                <button type="button" onClick={() => removeCustomItem(idx)} className="p-2 text-red-500 hover:text-red-700 transition-colors">
                                                                    <HiOutlineTrash className="w-5 h-5" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Totals Section */}
                            <div className="flex justify-end pt-6">
                                <div className="w-full lg:w-[320px] bg-slate-50/80 rounded-2xl p-6 border border-slate-100 space-y-4">
                                    <div className="flex justify-between text-sm text-slate-500">
                                        <span>Subtotal:</span>
                                        <span className="font-bold text-slate-800">{currency}{Number(editTotals.subtotal || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-slate-500">
                                        <span>Tax ({order.taxPercent || 0}%):</span>
                                        <span className="font-bold text-slate-800">{currency}{Number(editTotals.taxAmount || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-slate-500">
                                        <span>Discount ({order.discountPercent || 0}%):</span>
                                        <span className="font-bold text-slate-800">-{currency}{Number(editTotals.discountAmount || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-slate-500">
                                        <span>Service Charge:</span>
                                        <span className="font-bold text-slate-800">{currency}{Number(order.serviceCharge || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
                                        <span className="font-bold text-slate-900">Estimated Total:</span>
                                        <span className="text-lg font-bold text-cyan-600">{currency}{Number(editTotals.totalAmount || 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-5 border-t border-slate-100 flex items-center justify-end gap-4">
                            <button onClick={closeEditModal} className="px-4 py-2 text-slate-500 font-semibold text-sm hover:text-slate-800 transition-colors">
                                Cancel
                            </button>
                            <button onClick={saveEditChanges} disabled={savingEdits} className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#1c2a5e] text-white text-sm font-bold rounded-xl hover:bg-[#152046] transition-all shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed min-w-[140px]">
                                {savingEdits ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default OrderDetail;
