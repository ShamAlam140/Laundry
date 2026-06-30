import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useSettings } from '../context/SettingsContext';
import type { IOrder } from '../types';
import Pagination from '../components/Pagination';
import {
    HiOutlineSearch,
    HiOutlineEye,
    HiOutlinePrinter,
    HiOutlineX,
} from 'react-icons/hi';
import { HiOutlineTruck } from 'react-icons/hi2';

const Shipped = () => {
    const [orders, setOrders] = useState<IOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { currency } = useSettings();

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const itemsPerPage = 20;

    // Search filter
    const [search, setSearch] = useState('');

    // Shipping Modal state
    const [shipModalOrder, setShipModalOrder] = useState<IOrder | null>(null);
    const [shippedQuantities, setShippedQuantities] = useState<Record<string, number>>({});
    const [shipping, setShipping] = useState(false);

    // Fetch only un-shipped packed orders
    const fetchPackedOrders = useCallback(async () => {
        try {
            setLoading(true);
            const params: Record<string, any> = { 
                page: currentPage, 
                limit: itemsPerPage,
                status: 'packed',
                isShipped: 'false' // ONLY FETCH PACKED AND NOT SHIPPED YET
            };
            if (search) params.search = search;

            const res = await api.get('/orders', { params });
            setOrders(res.data.data);
            setTotalPages(res.data.totalPages || 1);
            setTotalItems(res.data.total || 0);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to fetch packed orders');
        } finally {
            setLoading(false);
        }
    }, [search, currentPage]);

    // Debounced search refetch
    useEffect(() => {
        setCurrentPage(1);
        const t = setTimeout(() => fetchPackedOrders(), 400);
        return () => clearTimeout(t);
    }, [search]);

    // Fetch on page change
    useEffect(() => {
        fetchPackedOrders();
    }, [currentPage]);

    // Open ship modal
    const openShipModal = (order: IOrder) => {
        setShipModalOrder(order);
        const initialQties: Record<string, number> = {};
        order.items?.forEach((item) => {
            initialQties[item._id!] = item.shippedQuantity ?? item.quantity;
        });
        setShippedQuantities(initialQties);
    };

    // Close ship modal
    const closeShipModal = () => {
        setShipModalOrder(null);
        setShippedQuantities({});
    };

    // Handle shipped quantity inputs
    const handleQtyChange = (itemId: string, val: string) => {
        const parsed = Math.max(0, parseFloat(val) || 0);
        setShippedQuantities((prev) => ({
            ...prev,
            [itemId]: parsed,
        }));
    };

    // Compute active shipment totals dynamically
    const shipTotals = useMemo(() => {
        if (!shipModalOrder) return { subtotal: 0, taxAmount: 0, discountAmount: 0, totalAmount: 0 };
        const subtotal = shipModalOrder.items.reduce((sum, item) => {
            if (item.serviceType === 'manual') return sum;
            const qty = shippedQuantities[item._id!] ?? item.quantity;
            return sum + qty * item.pricePerUnit;
        }, 0);
        const taxAmount = (subtotal * (shipModalOrder.taxPercent || 0)) / 100;
        const discountAmount = (subtotal * (shipModalOrder.discountPercent || 0)) / 100;
        const totalAmount = subtotal + taxAmount - discountAmount + (shipModalOrder.serviceCharge || 0);
        return { subtotal, taxAmount, discountAmount, totalAmount };
    }, [shipModalOrder, shippedQuantities]);

    // Confirm shipment and call API
    const handleConfirmShipment = async () => {
        if (!shipModalOrder) return;
        try {
            setShipping(true);
            const payload = {
                items: shipModalOrder.items.map((item) => ({
                    itemId: item._id!,
                    shippedQuantity: shippedQuantities[item._id!] ?? item.quantity,
                })),
            };

            await api.post(`/orders/${shipModalOrder._id}/ship`, payload);
            toast.success(`Order ${shipModalOrder.orderId} shipped & Invoice generated successfully!`);
            closeShipModal();
            fetchPackedOrders();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to complete order shipment');
        } finally {
            setShipping(false);
        }
    };

    // Print Thermal Label
    const printThermalLabel = (order: IOrder) => {
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) return;

        const customer = order.customer || {};
        const items = order.items || [];
        
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
                                ${items.map((item: any, index: number) => {
                                    const qty = item.shippedQuantity !== null && item.shippedQuantity !== undefined ? item.shippedQuantity : item.quantity;
                                    return `
                                        <tr style="${index % 2 === 1 ? styles.rowEven : ''}">
                                            <td style="${styles.td}">${index + 1}</td>
                                            <td style="${styles.td}">${item.itemName || item.serviceName}</td>
                                            <td style="${styles.tdCenter}">${item.quantity}</td>
                                            <td style="${styles.tdCenter}">${qty}</td>
                                            <td style="${styles.tdCenter}">${Math.max(0, item.quantity - qty)}</td>
                                        </tr>
                                    `;
                                }).join('')}
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
                        JsBarcode("#barcode", "${order.orderId}", {
                            format: "CODE128",
                            width: 2,
                            height: 50,
                            displayValue: false,
                            background: "#ffffff",
                            lineColor: "#000000"
                        });
                        
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

    return (
        <div className="space-y-5 animate-fadeIn">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Shipped / Packed Orders</h1>
                <p className="text-sm text-slate-500 mt-1">{totalItems} packed orders ready to ship</p>
            </div>

            {/* Search filter */}
            <div className="relative max-w-md">
                <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search packed orders by ID or customer..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                />
                {search && (
                    <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <HiOutlineX className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-20 text-slate-500 text-sm">No packed orders found</div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                        <th className="px-5 py-3 text-left">Order ID</th>
                                        <th className="px-5 py-3 text-left">Customer</th>
                                        <th className="px-5 py-3 text-left">Items Details</th>
                                        <th className="px-5 py-3 text-right">Amount</th>
                                        <th className="px-5 py-3 text-left">Date Completed</th>
                                        <th className="px-5 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map((o) => (
                                        <tr key={o._id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <span className="text-sm font-semibold text-cyan-600 cursor-pointer hover:underline" onClick={() => navigate(`/orders/${o._id}`)}>
                                                    {o.orderId}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className="text-sm font-medium text-slate-900">{o.customer?.name}</span>
                                                <p className="text-xs text-slate-400">{o.customer?.customerId}</p>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="space-y-1 my-1">
                                                    {o.items?.filter((item: any) => item.serviceType === 'manual' || !item.service).map((item: any, idx: number) => {
                                                        const qty = item.shippedQuantity !== null && item.shippedQuantity !== undefined ? item.shippedQuantity : item.quantity;
                                                        const hasDiff = item.shippedQuantity !== null && item.shippedQuantity !== undefined && item.shippedQuantity !== item.quantity;
                                                        return (
                                                            <div key={idx} className="text-xs text-slate-600 flex items-center gap-1 flex-wrap">
                                                                <span className="font-semibold text-slate-800">{qty}</span> x {item.itemName || item.serviceName}
                                                                {hasDiff && (
                                                                    <span className="text-[10px] text-slate-400 font-normal">
                                                                        (ordered: {item.quantity})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <span className="text-sm font-semibold text-slate-900">{currency}{o.totalAmount?.toLocaleString()}</span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className="text-sm text-slate-500">
                                                    {o.serviceEndTime ? new Date(o.serviceEndTime).toLocaleDateString() : new Date(o.updatedAt).toLocaleDateString()}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        onClick={() => navigate(`/orders/${o._id}`)}
                                                        title="View Details"
                                                        className="p-2 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
                                                    >
                                                        <HiOutlineEye className="w-4.5 h-4.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => printThermalLabel(o)}
                                                        title="Print Label"
                                                        className="p-2 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
                                                    >
                                                        <HiOutlinePrinter className="w-4.5 h-4.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => openShipModal(o)}
                                                        title="Ship & Generate Invoice"
                                                        className="p-2 rounded-lg text-white bg-[#1c2a5e] hover:bg-opacity-90 shadow-sm transition-colors"
                                                    >
                                                        <HiOutlineTruck className="w-4.5 h-4.5" />
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

            {/* Premium Shipping Modal */}
            {shipModalOrder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
                    <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden transform transition-all border border-slate-100 flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="px-6 py-5 bg-[#1c2a5e] text-white flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold">Confirm Shipment & Bill</h3>
                                <p className="text-xs text-slate-200 mt-1">Order {shipModalOrder.orderId} • Customer: {shipModalOrder.customer?.name}</p>
                            </div>
                            <button
                                onClick={closeShipModal}
                                className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                            >
                                <HiOutlineX className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            <div className="rounded-2xl border border-slate-150 overflow-hidden bg-slate-25">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-100 text-slate-600 font-semibold text-xs border-b border-slate-200">
                                            <th className="px-4 py-3 text-left">Item Name</th>
                                            <th className="px-4 py-3 text-center">Ordered Qty</th>
                                            <th className="px-4 py-3 text-center">Shipped Qty</th>
                                            <th className="px-4 py-3 text-right">Price</th>
                                            <th className="px-4 py-3 text-right">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {shipModalOrder.items?.filter((item) => item.serviceType === 'manual' || !item.service).map((item) => {
                                            const currentQty = shippedQuantities[item._id!] ?? item.quantity;
                                            return (
                                                <tr key={item._id} className="hover:bg-slate-25 transition-colors">
                                                    <td className="px-4 py-3 text-slate-900 font-medium">{item.itemName || item.serviceName}</td>
                                                    <td className="px-4 py-3 text-center text-slate-500 font-semibold">{item.quantity}</td>
                                                    <td className="px-4 py-2 text-center">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={currentQty}
                                                            onChange={(e) => handleQtyChange(item._id!, e.target.value)}
                                                            className="w-20 px-2 py-1 text-center font-bold bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-slate-600">{currency}{item.pricePerUnit}</td>
                                                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                                        {currency}{(currentQty * item.pricePerUnit).toLocaleString()}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Billing details block */}
                            <div className="flex flex-col lg:flex-row gap-6">
                                <div className="flex-1 bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs text-slate-600 leading-relaxed">
                                    <h4 className="font-bold text-slate-800 mb-2 uppercase tracking-wide">Invoicing Note</h4>
                                    <p className="mb-2">
                                        Confirming the shipment will update the final quantities for each line item in this order.
                                    </p>
                                    <p className="font-semibold text-cyan-700">
                                        An invoice starting as "Pending Approval" will be automatically generated with the recalculated totals.
                                    </p>
                                </div>
                                <div className="w-full lg:w-80 bg-[#1c2a5e]/5 rounded-2xl p-5 border border-[#1c2a5e]/10 space-y-3">
                                    <div className="flex justify-between text-xs text-slate-600">
                                        <span>Subtotal:</span>
                                        <span className="font-semibold text-slate-900">{currency}{shipTotals.subtotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-600">
                                        <span>Tax ({shipModalOrder.taxPercent || 0}%):</span>
                                        <span className="font-semibold text-slate-900">{currency}{shipTotals.taxAmount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-600 text-red-600">
                                        <span>Discount ({shipModalOrder.discountPercent || 0}%):</span>
                                        <span className="font-semibold">-{currency}{shipTotals.discountAmount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-600">
                                        <span>Service Charge:</span>
                                        <span className="font-semibold text-slate-900">{currency}{(shipModalOrder.serviceCharge || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="border-t border-slate-200 my-2 pt-2 flex justify-between text-sm font-bold text-slate-900">
                                        <span>New Total:</span>
                                        <span className="text-cyan-700">{currency}{shipTotals.totalAmount.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex items-center justify-end gap-3">
                            <button
                                onClick={closeShipModal}
                                className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm bg-white hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmShipment}
                                disabled={shipping}
                                className="px-5 py-2.5 font-bold text-white bg-[#1c2a5e] hover:bg-opacity-95 disabled:bg-slate-400 rounded-xl text-sm shadow-md flex items-center gap-2 transition-colors"
                            >
                                {shipping ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <HiOutlineTruck className="w-4 h-4" />
                                )}
                                Confirm Shipment
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Shipped;
