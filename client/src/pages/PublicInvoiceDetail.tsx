import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';

const PublicInvoiceDetail = () => {
    const { invoiceId } = useParams();
    const [invoice, setInvoice] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const currency = invoice?.business?.currency || '$';

    useEffect(() => {
        fetchInvoice();
    }, [invoiceId]);

    const fetchInvoice = async () => {
        try {
            const res = await api.get(`/invoices/public/${invoiceId}`);
            setInvoice(res.data.data);
        } catch (err) {
            toast.error('Failed to load invoice. Link might be invalid.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
            </div>
        );
    }

    if (!invoice) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center space-y-4">
                    <span className="text-4xl">⚠️</span>
                    <h1 className="text-xl font-bold text-slate-900">Invoice Not Found</h1>
                    <p className="text-sm text-slate-500">
                        The link you followed may have expired or is incorrect. Please contact support.
                    </p>
                </div>
            </div>
        );
    }

    const allItems = [...(invoice.order?.items || [])];
    const services = allItems.filter(item => !item.isRefunded && item.serviceType !== 'manual' && item.service);
    const refundedItems = allItems.filter(item => item.isRefunded);

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const deliveryDate = invoice.order?.deliveryDate;
    const formattedDate = formatDate(deliveryDate);

    const generateInvoiceHTML = (inv: any) => {
        const biz = inv.business || {};
        const customer = inv.customer || inv.order?.customer || {};
        const order = inv.order || {};
        const items = order.items || [];

        const invoiceDate = new Date(inv.createdAt);
        const creditDays = inv.customer?.creditDays || 0;
        const fallbackDueDateStr = creditDays > 0 
            ? new Date(new Date(inv.createdAt).setDate(new Date(inv.createdAt).getDate() + creditDays)).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
            : 'DUE ON RECEIPT';
        const dueDateStr = inv.dueDate
            ? new Date(inv.dueDate).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
            : fallbackDueDateStr;
        const invoiceDateStr = invoiceDate.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();

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

    const printInvoice = () => {
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) return;
        printWindow.document.write(generateInvoiceHTML(invoice));
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); }, 500);
    };

    return (
        <div className="min-h-screen bg-slate-100 py-6 px-4 sm:px-6 lg:px-8 print:bg-white print:py-0 print:px-0">
            <div className="max-w-4xl mx-auto space-y-6 bg-white p-6 sm:p-8 rounded-2xl shadow-xl print:shadow-none print:rounded-none">

                {/* Header Controls */}
                <div className="flex items-center justify-between pb-6 border-b border-slate-200 print:hidden">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Peninsula Laundries</h1>
                        <p className="text-xs text-slate-500 mt-1">Tax Invoice for {invoice.customer?.name}</p>
                    </div>
                    <button
                        onClick={printInvoice}
                        className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:from-cyan-400 hover:to-blue-500 text-sm font-semibold transition-all shadow-md shadow-cyan-500/20 flex items-center gap-2 cursor-pointer"
                    >
                        <span>🖨️</span> Print / Save PDF
                    </button>
                </div>

                {/* ── BUSINESS HEADER: Logo | Contact | ABN ── */}
                <div className="flex flex-col sm:flex-row items-start justify-between gap-6 pb-6 border-b border-slate-200">
                    {/* LEFT: Logo + Website + Email */}
                    <div className="flex flex-col items-start gap-1">
                        <img src="/logo.jpeg" alt="Peninsula Laundries" className="max-h-14 max-w-[110px] object-contain mb-1" />
                        <span className="text-[7px] tracking-[2px] text-slate-400 uppercase font-semibold mb-2">L A U N D R I E S</span>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <svg className="w-3 h-3 text-[#1c2a5e] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>
                            {invoice.business?.website || 'peninsulalaundries.com.au'}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <svg className="w-3 h-3 text-[#1c2a5e] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                            {invoice.business?.email || 'orders@peninsulalaundries.com.au'}
                        </div>
                    </div>

                    {/* CENTER: Business Name + Address */}
                    <div className="flex-1 text-xs text-slate-700">
                        <div className="font-bold text-sm text-[#1a1a2e] mb-1">
                            {invoice.business?.companyName || 'JSP Corporation Pty Ltd'}
                        </div>
                        <div className="text-xs text-slate-500 mb-2">T/A Peninsula Laundries</div>
                        <div className="flex items-start gap-1.5 text-slate-600">
                            <svg className="w-3.5 h-3.5 mt-0.5 text-[#1c2a5e] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
                            <span className="leading-relaxed">
                                {invoice.business?.address || '13 Redcliffe Gardens Drive'}<br />
                                {invoice.business?.suburb || 'Clontarf'}, {invoice.business?.state || 'Queensland'} {invoice.business?.postcode || '4019'}, Australia
                            </span>
                        </div>
                    </div>

                    {/* RIGHT: ABN + Phone */}
                    <div className="text-left sm:text-right">
                        <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-1">A.B.N.</div>
                        <div className="text-lg font-black text-[#1a1a2e] tracking-wider mb-3">
                            {invoice.business?.taxNumber || invoice.business?.abn || '31647801045'}
                        </div>
                        <div className="flex items-center sm:justify-end gap-1.5 text-xs text-slate-600">
                            <svg className="w-3 h-3 text-[#1c2a5e] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 015.33 12a19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
                            {invoice.business?.phone || '61475902921'}
                        </div>
                    </div>
                </div>

                {/* ── BILL TO + TAX INVOICE STRIP ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
                    {/* Bill To — Customer */}
                    <div>
                        <div className="text-[9px] uppercase tracking-widest text-slate-400 font-semibold mb-1.5">Bill To</div>
                        <div className="font-bold text-[#1a1a2e] text-sm mb-1">{invoice.customer?.name || '—'}</div>
                        {(invoice.customer?.address || invoice.customer?.suburb) && (
                            <div className="flex items-start gap-1.5 text-slate-500 text-xs mb-0.5">
                                <svg className="w-3.5 h-3.5 mt-0.5 text-[#1c2a5e] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                <span className="leading-relaxed">
                                    {invoice.customer?.address && <>{invoice.customer.address}<br /></>}
                                    {[invoice.customer?.suburb || invoice.customer?.city, invoice.customer?.state, invoice.customer?.postcode, 'Australia'].filter(Boolean).join(', ')}
                                </span>
                            </div>
                        )}
                        {invoice.customer?.phone && (
                            <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-0.5">
                                <svg className="w-3.5 h-3.5 text-[#1c2a5e] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 015.33 12a19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
                                {invoice.customer.phone}
                            </div>
                        )}
                        {invoice.customer?.email && (
                            <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                                <svg className="w-3.5 h-3.5 text-[#1c2a5e] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                                {invoice.customer.email}
                            </div>
                        )}
                    </div>

                    {/* Tax Invoice badge + Invoice # */}
                    <div className="flex flex-col items-start sm:items-end gap-2">
                        <div className="flex items-center gap-2 bg-[#1c2a5e] text-white text-sm font-bold px-5 py-2 rounded-lg tracking-wide">
                            <span className="text-xl font-light leading-none">+</span> Tax Invoice
                        </div>
                        <div className="text-xs text-slate-500 text-left sm:text-right">
                            <span className="font-semibold text-slate-700">Invoice #: </span>
                            {invoice.invoiceNumber || invoice.invoiceId}
                        </div>
                    </div>
                </div>

                {/* Meta Numbers Bar */}
                <div className="grid grid-cols-2 md:grid-cols-5 border border-slate-200 rounded-xl overflow-hidden text-xs">
                    {[
                        { label: 'INVOICE #', value: invoice.invoiceNumber || invoice.invoiceId, cls: '' },
                        { label: 'DATE', value: new Date(invoice.createdAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(), cls: '' },
                        { label: 'DUE DATE', value: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : (invoice.customer?.creditDays ? new Date(new Date(invoice.createdAt).setDate(new Date(invoice.createdAt).getDate() + invoice.customer.creditDays)).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : 'DUE ON RECEIPT'), cls: 'text-red-600' },
                        { label: 'TOTAL', value: `${currency}${Number(invoice.totalAmount || 0).toFixed(2)}`, cls: 'text-[#1c2a5e]' },
                        { label: 'TERMS', value: invoice.terms || (invoice.customer?.creditDays ? `NET ${invoice.customer.creditDays}` : 'Due on Receipt'), cls: '' },
                    ].map((cell, i, arr) => (
                        <div key={i} className={`px-3 py-2.5 border-b border-slate-200 md:border-b-0 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'} ${i < arr.length - 1 ? 'md:border-r border-slate-200' : ''}`}>
                            <div className="text-[9px] uppercase tracking-wider text-slate-400 mb-1 font-semibold">{cell.label}</div>
                            <div className={`font-bold text-[#1a1a2e] truncate ${cell.cls}`}>{cell.value}</div>
                        </div>
                    ))}
                </div>

                {/* Invoice Table Container */}
                <div className="rounded-lg overflow-hidden border border-slate-200">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            {/* Table Header */}
                            <thead>
                                <tr className="bg-[#1c2a5e] text-white">
                                    <th className="text-left py-2 px-3 font-semibold">Delivery Date</th>
                                    <th className="text-left py-2 px-3 font-semibold">Item Name</th>
                                    <th className="text-center py-2 px-3 font-semibold">Quantity</th>
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

                                {/* SECTION 2: REFUNDED ITEMS */}
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
                    </div>
                </div>

                {invoice.creditedItems?.length > 0 && (
                    <div className="rounded-xl overflow-hidden border border-red-100">
                        <div className="bg-red-50 border-b border-red-100 px-3 py-2 text-xs font-bold text-red-700 uppercase tracking-wide">
                            Credited Items
                        </div>
                        <table className="w-full text-xs">
                            <tbody>
                                {invoice.creditedItems.map((item: any, i: number) => (
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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 pt-1">
                    <p className="text-[10px] text-blue-500 italic">* Items marked with * are rental carts.</p>
                    <div className="text-right min-w-[200px] w-full sm:w-auto">
                        <div className="bg-[#1c2a5e] text-white text-sm font-bold px-6 py-2 rounded-lg inline-block mb-3 tracking-widest">
                            AMOUNT DUE
                        </div>
                        <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between gap-12 text-slate-600">
                                <span>Sub Total</span>
                                <span className="font-medium text-slate-800">
                                    {currency}{Number(invoice.subtotal || 0).toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between gap-12 text-slate-600">
                                <span>Sales Tax</span>
                                <span className="font-medium text-slate-800">
                                    {currency}{Number(invoice.taxAmount || 0).toFixed(2)}
                                </span>
                            </div>
                            {(invoice.discountAmount || 0) > 0 && (
                                <div className="flex justify-between gap-12 text-emerald-600">
                                    <span>Discount</span>
                                    <span className="font-medium">
                                        -{currency}{Number(invoice.discountAmount).toFixed(2)}
                                    </span>
                                </div>
                            )}
                            {(invoice.serviceCharge || 0) > 0 && (
                                <div className="flex justify-between gap-12 text-slate-600">
                                    <span>Service Charge</span>
                                    <span className="font-medium text-slate-800">
                                        {currency}{Number(invoice.serviceCharge).toFixed(2)}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between gap-12 bg-[#1c2a5e] text-white font-black text-sm px-4 py-2 rounded-lg mt-2">
                                <span>TOTAL</span>
                                <span>
                                    {currency}{Number(invoice.totalAmount || 0).toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between gap-12 text-slate-500 text-[11px] px-1">
                                <span>Paid</span>
                                <span className="text-emerald-600 font-semibold">{currency}{Number(invoice.paidAmount || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between gap-12 text-slate-500 text-[11px] px-1">
                                <span>{(invoice.balanceDue || 0) < 0 ? 'Refund Due to Customer' : 'Balance Due'}</span>
                                <span className={`font-bold ${(invoice.balanceDue || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {(invoice.balanceDue || 0) < 0 ? '-' : ''}{currency}{Math.abs(Number(invoice.balanceDue || 0)).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Payment + Disclaimer */}
                <div className="flex flex-col md:flex-row gap-5 pt-4 border-t border-slate-200">
                    <div className="bg-slate-50 rounded-xl p-4 min-w-[220px]">
                        <div className="flex items-center gap-1.5 font-bold text-[#1a1a2e] text-sm mb-2">
                            <span>🏦</span> PAYMENT
                        </div>
                        <div className="text-xs text-slate-700 font-semibold mb-1">Direct Deposit:</div>
                        <div className="text-xs text-slate-600 space-y-0.5 leading-relaxed">
                            <div><span className="text-slate-500">Account Name:</span> {invoice.business?.bankAccountName || 'JSP CORPORATION PTY LTD'}</div>
                            <div><span className="text-slate-500">Bank:</span> {invoice.business?.bankName || 'ANZ'} &nbsp; <span className="text-slate-500">BSB:</span> {invoice.business?.bankBSB || '012787'}</div>
                            <div><span className="text-slate-500">Account NO:</span> {invoice.business?.bankAccountNo || '—'}</div>
                        </div>
                    </div>
                    <div className="text-[10px] text-slate-500 leading-relaxed flex-1 pt-1">
                        <div className="font-bold text-blue-600 text-xs mb-1.5">Disclaimer:</div>
                        {invoice.business?.name || 'JSP Corporation Pty Ltd T/as Peninsula Laundries'} reserves the right to claim ownership of any linen that has not been returned. We also reserve the right to seek legal advice and pursue recovery of replacement costs for any unreturned or missing items.
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PublicInvoiceDetail;
