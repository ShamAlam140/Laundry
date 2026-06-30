/**
 * generateInvoiceHTML
 * Ported from the web client's Invoices.tsx generateInvoiceHTML function.
 * Adapted for React Native (no window.location, no DOM APIs).
 */
export const generateInvoiceHTML = (inv: any, currency: string = '$'): string => {
    const biz = inv.business || {};
    const customer = inv.customer || inv.order?.customer || {};
    const order = inv.order || {};
    const items = order.items || [];
    const payments = inv.payments || [];

    const invoiceDate = new Date(inv.createdAt);
    const creditDays = inv.customer?.creditDays || 0;
    const fallbackDueDateStr = creditDays > 0 
        ? new Date(new Date(inv.createdAt).setDate(new Date(inv.createdAt).getDate() + creditDays))
              .toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
              .toUpperCase()
        : 'DUE ON RECEIPT';
    const dueDateStr = inv.dueDate
        ? new Date(inv.dueDate)
              .toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
              .toUpperCase()
        : fallbackDueDateStr;
    const invoiceDateStr = invoiceDate
        .toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
        .toUpperCase();

    const allItems = items || [];
    const services = allItems.filter(
        (item: any) => !item.isRefunded && item.serviceType !== 'manual' && item.service,
    );
    const manualItems = allItems.filter(
        (item: any) => !item.isRefunded && (item.serviceType === 'manual' || !item.service),
    );
    const refundedItems = allItems.filter((item: any) => item.isRefunded);

    const deliveryDate = order.deliveryDate;
    const formattedDate = deliveryDate
        ? new Date(deliveryDate).toLocaleDateString('en-AU', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
          })
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

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Tax Invoice - ${invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      font-size: 12px;
      color: #1a1a2e;
      background: #fff;
      padding: 20px;
    }
    .page { max-width: 860px; margin: 0 auto; }

    /* ── HEADER ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      padding-bottom: 16px;
      border-bottom: 2px solid #1c2a5e;
      margin-bottom: 16px;
    }
    .logo-block { display: flex; flex-direction: column; gap: 4px; }
    .tagline { font-size: 7px; letter-spacing: 2px; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; }
    .contact-line { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #475569; margin-bottom: 2px; }
    .center-block { flex: 1; padding-left: 16px; }
    .company-name { font-size: 15px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
    .ta { font-size: 11px; color: #64748b; margin-bottom: 6px; }
    .right-block { text-align: right; min-width: 160px; }
    .abn-label { font-size: 9px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
    .abn-value { font-size: 18px; font-weight: 900; color: #1a1a2e; letter-spacing: 1px; margin-bottom: 10px; }

    /* ── BILL / BADGE ── */
    .bill-section { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; gap: 24px; }
    .bill-label { font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; font-weight: 600; margin-bottom: 6px; }
    .cust-name { font-weight: 700; color: #1a1a2e; font-size: 14px; margin-bottom: 4px; }
    .tax-badge { background: #1c2a5e; color: #fff; font-size: 13px; font-weight: 700; padding: 8px 18px; border-radius: 8px; letter-spacing: 1px; display: inline-block; }
    .inv-num-label { font-size: 11px; color: #64748b; margin-top: 8px; }

    /* ── META BAR ── */
    .meta-bar { display: flex; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; margin-bottom: 14px; }
    .meta-cell { flex: 1; padding: 10px 12px; border-right: 1px solid #cbd5e1; }
    .meta-cell:nth-child(even) { background: #f8fafc; }
    .meta-cell:last-child { border-right: none; }
    .meta-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; margin-bottom: 4px; font-weight: 600; }
    .meta-value { font-weight: 700; color: #1a1a2e; font-size: 12px; }
    .meta-value-red { font-weight: 700; color: #dc2626; font-size: 12px; }
    .meta-value-blue { font-weight: 700; color: #1c2a5e; font-size: 12px; }

    /* ── TABLE ── */
    table { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-bottom: 14px; }
    thead { background: #1c2a5e; color: #fff; }
    th { padding: 9px 12px; font-size: 11px; font-weight: 700; text-align: left; }
    th.right { text-align: right; }
    th.center { text-align: center; }
    td { padding: 8px 12px; font-size: 11px; color: #1a1a2e; border-bottom: 1px solid #e2e8f0; }
    td.right { text-align: right; }
    td.center { text-align: center; }
    td.strike { text-align: right; color: #94a3b8; text-decoration: line-through; }
    td.not-billed { text-align: right; color: #64748b; font-weight: 600; }
    td.red { text-align: right; color: #b91c1c; font-weight: 700; }
    tr.section-hdr td { background: #f1f5f9; font-weight: 700; font-size: 10px; text-transform: uppercase; color: #475569; padding: 8px 12px; }
    tr.info-row td { background: #f8fafc; text-align: center; font-size: 10px; color: #64748b; }

    /* ── BOTTOM ── */
    .bottom-section { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 10px; gap: 20px; }
    .note { font-size: 10px; color: #3b82f6; font-style: italic; }
    .summary-block { text-align: right; min-width: 220px; }
    .amount-due-btn { background: #1c2a5e; color: #fff; font-size: 13px; font-weight: 700; padding: 8px 22px; border-radius: 8px; display: inline-block; margin-bottom: 12px; letter-spacing: 1px; }
    .summary-row { display: flex; justify-content: space-between; gap: 40px; font-size: 12px; color: #64748b; margin-bottom: 6px; }
    .summary-total { display: flex; justify-content: space-between; gap: 40px; background: #1c2a5e; color: #fff; font-weight: 900; font-size: 14px; padding: 8px 14px; border-radius: 8px; margin-top: 8px; margin-bottom: 8px; }
    .summary-paid { display: flex; justify-content: space-between; gap: 40px; font-size: 11px; color: #64748b; padding: 0 4px; margin-bottom: 4px; }

    /* ── PAYMENT SECTION ── */
    .payment-section { display: flex; gap: 20px; padding-top: 16px; border-top: 2px solid #1c2a5e; margin-top: 16px; }
    .payment-box { background: #f8fafc; border-radius: 10px; padding: 14px; min-width: 200px; }
    .payment-title { font-weight: 700; color: #1a1a2e; font-size: 12px; margin-bottom: 8px; }
    .payment-text { font-size: 11px; color: #475569; line-height: 1.7; }
    .disclaimer { font-size: 10px; color: #64748b; line-height: 1.6; flex: 1; padding-top: 4px; }
    .disclaimer-title { font-weight: 700; color: #3b82f6; font-size: 11px; margin-bottom: 6px; }

    /* ── PAYMENT HISTORY ── */
    .payment-history { margin-top: 14px; }
    .payment-history-title { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; text-align: center; }
    .ph-row { display: flex; justify-content: space-between; font-size: 11px; color: #475569; padding: 3px 0; }
  </style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div class="logo-block">
      <div class="tagline">L A U N D R I E S</div>
      <div class="contact-line">🌐 ${biz.website || 'peninsulalaundries.com.au'}</div>
      <div class="contact-line">📧 ${biz.email || 'orders@peninsulalaundries.com.au'}</div>
    </div>
    <div class="center-block">
      <div class="company-name">${biz.companyName || 'JSP Corporation Pty Ltd'}</div>
      <div class="ta">T/A Peninsula Laundries</div>
      <div class="contact-line">📍 ${biz.address || '13 Redcliffe Gardens Drive'}, ${biz.suburb || 'Clontarf'}, ${biz.state || 'QLD'} ${biz.postcode || '4019'}, Australia</div>
    </div>
    <div class="right-block">
      <div class="abn-label">A.B.N.</div>
      <div class="abn-value">${abn}</div>
      <div class="contact-line" style="justify-content:flex-end;">📞 ${biz.phone || '61475902921'}</div>
    </div>
  </div>

  <!-- BILL TO + TAX BADGE -->
  <div class="bill-section">
    <div>
      <div class="bill-label">Bill To</div>
      <div class="cust-name">${customer.name || '—'}</div>
      ${customer.address || customer.suburb ? `<div class="contact-line">📍 ${[customer.address, customer.suburb || customer.city, customer.state, customer.postcode, 'Australia'].filter(Boolean).join(', ')}</div>` : ''}
      ${customer.phone ? `<div class="contact-line">📞 ${customer.phone}</div>` : ''}
      ${customer.email ? `<div class="contact-line">📧 ${customer.email}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div class="tax-badge">+ Tax Invoice</div>
      <div class="inv-num-label"><strong>Invoice #:</strong> ${invoiceNumber}</div>
    </div>
  </div>

  <!-- META BAR -->
  <div class="meta-bar">
    <div class="meta-cell"><div class="meta-label">INVOICE #</div><div class="meta-value">${invoiceNumber}</div></div>
    <div class="meta-cell"><div class="meta-label">DATE</div><div class="meta-value">${invoiceDateStr}</div></div>
    <div class="meta-cell"><div class="meta-label">DUE DATE</div><div class="meta-value-red">${dueDateStr}</div></div>
    <div class="meta-cell"><div class="meta-label">TOTAL</div><div class="meta-value-blue">${currency}${Number(totalAmount).toFixed(2)}</div></div>
    <div class="meta-cell"><div class="meta-label">TERMS</div><div class="meta-value">${terms}</div></div>
  </div>

  <!-- ITEMS TABLE -->
  <table>
    <thead>
      <tr>
        <th>Delivery Date</th>
        <th>Item Name</th>
        <th class="center">Qty</th>
        <th class="right">Rate</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${services.length > 0 ? `
        <tr class="section-hdr"><td colspan="5">🔧 Services - Billable</td></tr>
        ${services.map((item: any, idx: number) => `
          <tr>
            <td>${idx === 0 ? formattedDate : '—'}</td>
            <td>${item.serviceName || item.itemName}</td>
            <td class="center">${item.quantity}</td>
            <td class="right">${currency}${Number(item.pricePerUnit || 0).toFixed(2)}</td>
            <td class="right">${currency}${Number(item.subtotal || 0).toFixed(2)}</td>
          </tr>`).join('')}` : ''}

      ${manualItems.length > 0 ? `
        <tr class="section-hdr"><td colspan="5">📦 Items - Tracking Only (Not Billed)</td></tr>
        ${manualItems.map((item: any, idx: number) => `
          <tr>
            <td>${idx === 0 ? formattedDate : '—'}</td>
            <td>${item.itemName || item.serviceName}</td>
            <td class="center">${item.quantity}</td>
            <td class="strike">${currency}${Number(item.pricePerUnit || 0).toFixed(2)}</td>
            <td class="not-billed">Not Billed</td>
          </tr>`).join('')}
        <tr class="info-row"><td colspan="5">ℹ️ These items are tracked for damage reference only and NOT included in billing</td></tr>` : ''}

      ${refundedItems.length > 0 ? `
        <tr class="section-hdr"><td colspan="5">🔄 Refunded Items</td></tr>
        ${refundedItems.map((item: any, idx: number) => `
          <tr>
            <td>${idx === 0 ? formattedDate : '—'}</td>
            <td>${item.serviceName || item.itemName}${item.refundReason ? `<br/><span style="font-size:10px;color:#dc2626;">Reason: ${item.refundReason}</span>` : ''}</td>
            <td class="center">${item.damagedQuantity || item.quantity}</td>
            <td class="right">${currency}${Number(item.pricePerUnit || 0).toFixed(2)}</td>
            <td class="red">-${currency}${Number(item.refundAmount || item.subtotal || 0).toFixed(2)}</td>
          </tr>`).join('')}` : ''}
    </tbody>
  </table>

  <!-- BOTTOM SECTION -->
  <div class="bottom-section">
    <div class="note">* Items marked with * are rental carts.</div>
    <div class="summary-block">
      <div class="amount-due-btn">AMOUNT DUE</div>
      <div class="summary-row"><span>Sub Total</span><span style="font-weight:600;color:#475569;">${currency}${Number(subtotal).toFixed(2)}</span></div>
      <div class="summary-row"><span>Sales Tax</span><span style="font-weight:600;color:#475569;">${currency}${Number(taxAmount).toFixed(2)}</span></div>
      ${discountAmount > 0 ? `<div class="summary-row"><span>Discount</span><span style="font-weight:600;color:#10b981;">-${currency}${Number(discountAmount).toFixed(2)}</span></div>` : ''}
      <div class="summary-total"><span>TOTAL</span><span>${currency}${Number(totalAmount).toFixed(2)}</span></div>
      <div class="summary-paid"><span>Paid</span><span style="color:#10b981;font-weight:600;">${currency}${Number(paidAmount).toFixed(2)}</span></div>
      <div class="summary-paid">
        <span>${balanceDue < 0 ? 'Refund Due to Customer' : 'Balance Due'}</span>
        <span style="font-weight:700;color:${balanceDue > 0 ? '#dc2626' : '#10b981'};">${balanceDue < 0 ? '-' : ''}${currency}${Math.abs(Number(balanceDue)).toFixed(2)}</span>
      </div>
    </div>
  </div>

  <!-- PAYMENT DETAILS + DISCLAIMER -->
  <div class="payment-section">
    <div class="payment-box">
      <div class="payment-title">🏦 PAYMENT</div>
      <div class="payment-text">
        <div><strong>Direct Deposit:</strong></div>
        <div>Account Name: ${paymentAccountName}</div>
        <div>Bank: ${paymentBank} &nbsp; BSB: ${paymentBSB}</div>
        <div>Account NO: ${paymentAccountNo}</div>
      </div>
    </div>
    <div class="disclaimer">
      <div class="disclaimer-title">Disclaimer:</div>
      ${biz.name || 'JSP Corporation Pty Ltd T/as Peninsula Laundries'} reserves the right to claim ownership of any linen that has not been returned. We also reserve the right to seek legal advice and pursue recovery of replacement costs for any unreturned or missing items.
    </div>
  </div>

  ${payments.length > 0 ? `
  <!-- PAYMENT HISTORY -->
  <div class="payment-history">
    <div class="payment-history-title">— PAYMENTS —</div>
    ${payments.map((p: any) => `
      <div class="ph-row">
        <span>${p.paymentMethod} — ${new Date(p.createdAt).toLocaleDateString('en-AU')}</span>
        <span style="font-weight:600;">${currency}${p.amount}</span>
      </div>`).join('')}
  </div>` : ''}

</div>
</body>
</html>`;
};

/**
 * generateBatchInvoiceHTML
 * Ported from the web client's generateBatchInvoiceHTML function.
 * Combines multiple invoices into one printable report.
 */
export const generateBatchInvoiceHTML = (
    batchInvoices: any[],
    currency: string = '$',
    cycleLabel: string = 'Cycle',
    periodStart?: string | null,
    periodEnd?: string | null,
): string => {
    if (batchInvoices.length === 0) return '<html><body><p>No invoices</p></body></html>';

    const formatMoney = (amount: number) => `${currency}${Number(amount || 0).toFixed(2)}`;
    const formatShortDate = (date?: string) =>
        date ? new Date(date).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
    const formatMetaDate = (date?: string) =>
        date ? new Date(date).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : '-';
    const esc = (value: any) => String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

    const biz = batchInvoices[0]?.business || {};
    const firstCustomer = batchInvoices[0]?.customer || batchInvoices[0]?.order?.customer || {};
    const allSameCustomer = batchInvoices.every((inv) => {
        const c = inv.customer || inv.order?.customer || {};
        return String(c._id || c.customerId || c.phone || '') === String(firstCustomer._id || firstCustomer.customerId || firstCustomer.phone || '');
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
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const periodText = periodStart
        ? `${formatMetaDate(periodStart)} - ${formatMetaDate(periodEnd || undefined)}`
        : cycleLabel.toUpperCase();
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
            ${services.map((item: any, idx: number) => `
                <tr>
                    <td>${idx === 0 ? deliveryDate : '-'}</td>
                    <td><strong>${esc(item.serviceName || item.itemName || 'Service')}</strong>
                        <div class="muted">${esc(invoiceLabel)}${order.orderId ? ` | ${esc(order.orderId)}` : ''}</div></td>
                    <td class="center">${Number(item.quantity || 0)}</td>
                    <td class="right">${formatMoney(item.pricePerUnit)}</td>
                    <td class="right strong">${formatMoney(item.subtotal)}</td>
                </tr>`).join('')}` : '';

        const manualRows = manualItems.length > 0 ? `
            <tr class="section-row"><td colspan="5">Items - Tracking Only (Not Billed)</td></tr>
            ${manualItems.map((item: any, idx: number) => `
                <tr>
                    <td>${idx === 0 && services.length === 0 ? deliveryDate : '-'}</td>
                    <td><strong>${esc(item.itemName || item.serviceName || 'Item')}</strong>
                        <div class="muted">${esc(invoiceLabel)}${order.orderId ? ` | ${esc(order.orderId)}` : ''}</div></td>
                    <td class="center">${Number(item.quantity || 0)}</td>
                    <td class="right strike">${formatMoney(item.pricePerUnit)}</td>
                    <td class="right muted-strong">Not Billed</td>
                </tr>`).join('')}
            <tr class="info-row"><td colspan="5">These items are tracked for damage reference only and NOT included in billing</td></tr>` : '';

        const refundedRows = refundedItems.length > 0 ? `
            <tr class="section-row"><td colspan="5">Refunded Items</td></tr>
            ${refundedItems.map((item: any, idx: number) => `
                <tr>
                    <td>${idx === 0 && services.length === 0 && manualItems.length === 0 ? deliveryDate : '-'}</td>
                    <td><strong>${esc(item.serviceName || item.itemName || 'Refunded item')}</strong>
                        ${item.refundReason ? `<div class="refund-note">Reason: ${esc(item.refundReason)}</div>` : ''}</td>
                    <td class="center">${Number(item.damagedQuantity || item.quantity || 0)}</td>
                    <td class="right">${formatMoney(item.pricePerUnit)}</td>
                    <td class="right refund">-${formatMoney(item.refundAmount || item.subtotal || 0)}</td>
                </tr>`).join('')}` : '';

        return `
            <tr class="invoice-row"><td colspan="5">
                <div class="invoice-row-inner">
                    <span>${esc(invoiceLabel)}${order.orderId ? ` | ${esc(order.orderId)}` : ''} | ${invoiceDate}</span>
                    <span>Total ${formatMoney(inv.totalAmount)} | Paid ${formatMoney(inv.paidAmount)} | Due ${due < 0 ? '-' : ''}${formatMoney(Math.abs(due))}</span>
                </div>
            </td></tr>
            ${serviceRows || manualRows || refundedRows ? `${serviceRows}${manualRows}${refundedRows}` : `
                <tr><td colspan="5" class="empty-row">No order items found for this invoice</td></tr>`}`;
    }).join('');

    return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Invoice Report - ${esc(cycleLabel)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: #1a1a2e; font-family: Arial, sans-serif; font-size: 12px; padding: 20px; }
  .page { max-width: 860px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding-bottom: 16px; border-bottom: 2px solid #1c2a5e; margin-bottom: 16px; }
  .logo-block { display: flex; flex-direction: column; gap: 4px; }
  .tagline { font-size: 7px; letter-spacing: 2px; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; }
  .contact-line { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #475569; margin-bottom: 4px; }
  .center-block { flex: 1; }
  .company { font-size: 14px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
  .ta { font-size: 11px; color: #64748b; margin-bottom: 8px; }
  .right-block { text-align: right; }
  .right-block .contact-line { justify-content: flex-end; }
  .abn-label { font-size: 9px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
  .abn-value { font-size: 18px; font-weight: 900; color: #1a1a2e; letter-spacing: 1px; margin-bottom: 12px; }
  .bill-section { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; margin: 16px 0 12px; }
  .bill-label { font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; font-weight: 600; margin-bottom: 6px; }
  .customer-name { font-weight: 700; color: #1a1a2e; font-size: 14px; margin-bottom: 4px; }
  .tax-btn { background: #1c2a5e; color: #fff; font-size: 13px; font-weight: 700; padding: 8px 20px; border-radius: 8px; letter-spacing: 1px; display: inline-block; }
  .meta { font-size: 11px; color: #64748b; line-height: 1.6; }
  .meta-bar { display: flex; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; font-size: 12px; margin-bottom: 14px; }
  .meta-cell { flex: 1; padding: 10px 12px; border-right: 1px solid #cbd5e1; }
  .meta-cell:nth-child(even) { background: #f8fafc; }
  .meta-cell:last-child { border-right: 0; }
  .meta-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; margin-bottom: 4px; font-weight: 600; }
  .meta-value { font-weight: 700; color: #1a1a2e; font-size: 12px; overflow-wrap: anywhere; }
  .meta-value-blue { color: #1c2a5e; }
  table { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; font-size: 11px; margin-bottom: 12px; }
  th { background: #1c2a5e; color: #ffffff; padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 700; }
  td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; color: #1a1a2e; }
  .right { text-align: right; }
  .center { text-align: center; }
  .strong { font-weight: 700; }
  .invoice-row td { background: #e8eefc; color: #1c2a5e; font-weight: 800; text-transform: uppercase; font-size: 10px; }
  .invoice-row-inner { display: flex; justify-content: space-between; gap: 12px; }
  .section-row td { background: #f1f5f9; padding: 8px 12px; font-weight: 700; font-size: 10px; text-transform: capitalize; color: #475569; }
  .muted { color: #64748b; font-size: 10px; margin-top: 3px; }
  .muted-strong { color: #64748b; font-weight: 600; }
  .strike { color: #94a3b8; text-decoration: line-through; }
  .info-row td { background: #f8fafc; text-align: center; font-size: 10px; color: #64748b; }
  .refund, .refund-note { color: #b91c1c; }
  .empty-row { text-align: center; color: #64748b; background: #f8fafc; }
  .bottom-section { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 8px; }
  .note { font-size: 10px; color: #3b82f6; font-style: italic; }
  .summary-block { text-align: right; min-width: 230px; }
  .amount-due-btn { background: #1c2a5e; color: #fff; font-size: 14px; font-weight: 700; padding: 8px 24px; border-radius: 8px; display: inline-block; margin-bottom: 12px; letter-spacing: 1px; }
  .summary-row { display: flex; justify-content: space-between; gap: 48px; font-size: 12px; color: #64748b; margin-bottom: 6px; }
  .summary-total { display: flex; justify-content: space-between; gap: 48px; background: #1c2a5e; color: #fff; font-weight: 900; font-size: 14px; padding: 8px 16px; border-radius: 8px; margin-top: 8px; margin-bottom: 8px; }
  .summary-paid { display: flex; justify-content: space-between; gap: 48px; font-size: 11px; color: #64748b; padding: 0 4px; margin-bottom: 4px; }
  .green { color: #10b981; font-weight: 700; }
  .red { color: #dc2626; font-weight: 700; }
  .payment-section { display: flex; gap: 20px; padding-top: 16px; border-top: 2px solid #1c2a5e; margin-top: 16px; }
  .payment-box { background: #f8fafc; border-radius: 12px; padding: 16px; min-width: 200px; }
  .payment-title { font-weight: 700; color: #1a1a2e; font-size: 12px; margin-bottom: 8px; }
  .payment-text { font-size: 11px; color: #475569; line-height: 1.7; }
  .disclaimer { font-size: 10px; color: #64748b; line-height: 1.6; flex: 1; padding-top: 4px; }
  .disclaimer-title { font-weight: 700; color: #3b82f6; font-size: 11px; margin-bottom: 6px; }
</style>
</head>
<body>
<div class="page">
  <!-- HEADER -->
  <div class="header">
    <div class="logo-block">
      <div class="tagline">L A U N D R I E S</div>
      <div class="contact-line">🌐 ${esc(biz.website || 'peninsulalaundries.com.au')}</div>
      <div class="contact-line">📧 ${esc(biz.email || 'orders@peninsulalaundries.com.au')}</div>
    </div>
    <div class="center-block">
      <div class="company">${esc(biz.companyName || 'JSP Corporation Pty Ltd')}</div>
      <div class="ta">T/A Peninsula Laundries</div>
      <div class="contact-line">📍 ${esc(biz.address || '13 Redcliffe Gardens Drive')}, ${esc(biz.suburb || 'Clontarf')}, ${esc(biz.state || 'QLD')} ${esc(biz.postcode || '4019')}, Australia</div>
    </div>
    <div class="right-block">
      <div class="abn-label">A.B.N.</div>
      <div class="abn-value">${esc(abn)}</div>
      <div class="contact-line">📞 ${esc(biz.phone || '61475902921')}</div>
    </div>
  </div>

  <!-- BILL TO -->
  <div class="bill-section">
    <div>
      <div class="bill-label">Bill To</div>
      <div class="customer-name">${esc(billTo.name || '-')}</div>
      ${billTo.address ? `<div class="contact-line">📍 ${esc(billTo.address)}</div>` : ''}
      ${allSameCustomer && billTo.phone ? `<div class="contact-line">📞 ${esc(billTo.phone)}</div>` : ''}
      ${allSameCustomer && billTo.email ? `<div class="contact-line">📧 ${esc(billTo.email)}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div class="tax-btn"><span style="font-size:20px;font-weight:300;">+</span> Tax Invoice</div>
      <div class="meta" style="margin-top:8px;">
        <span style="font-weight:600;color:#475569;">Invoices: </span>${batchInvoices.length}<br/>
        ${esc(cycleLabel)} Report
      </div>
    </div>
  </div>

  <!-- META BAR -->
  <div class="meta-bar">
    <div class="meta-cell"><div class="meta-label">REPORT #</div><div class="meta-value">${esc(reportNumber || '-')}</div></div>
    <div class="meta-cell"><div class="meta-label">DATE</div><div class="meta-value">${esc(generatedAt.toUpperCase())}</div></div>
    <div class="meta-cell"><div class="meta-label">PERIOD</div><div class="meta-value red">${esc(periodText)}</div></div>
    <div class="meta-cell"><div class="meta-label">TOTAL</div><div class="meta-value meta-value-blue">${formatMoney(totals.total)}</div></div>
    <div class="meta-cell"><div class="meta-label">INVOICES</div><div class="meta-value">${batchInvoices.length}</div></div>
  </div>

  <!-- TABLE -->
  <table>
    <thead><tr>
      <th>Delivery Date</th><th>Item Name</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Rate</th><th style="text-align:right;">Total</th>
    </tr></thead>
    <tbody>${invoiceRows}</tbody>
  </table>

  <!-- BOTTOM -->
  <div class="bottom-section">
    <div class="note">* Items marked with * are rental carts.</div>
    <div class="summary-block">
      <div class="amount-due-btn">AMOUNT DUE</div>
      <div class="summary-row"><span>Sub Total</span><span style="font-weight:600;color:#475569;">${formatMoney(totals.subtotal)}</span></div>
      <div class="summary-row"><span>Sales Tax</span><span style="font-weight:600;color:#475569;">${formatMoney(totals.tax)}</span></div>
      ${totals.discount > 0 ? `<div class="summary-row"><span>Discount</span><span class="green">-${formatMoney(totals.discount)}</span></div>` : ''}
      <div class="summary-total"><span>TOTAL</span><span>${formatMoney(totals.total)}</span></div>
      <div class="summary-paid"><span>Paid</span><span class="green">${formatMoney(totals.paid)}</span></div>
      <div class="summary-paid">
        <span>${totals.due < 0 ? 'Refund Due to Customer' : 'Balance Due'}</span>
        <span class="${totals.due > 0 ? 'red' : 'green'}">${totals.due < 0 ? '-' : ''}${formatMoney(Math.abs(totals.due))}</span>
      </div>
    </div>
  </div>

  <!-- PAYMENT -->
  <div class="payment-section">
    <div class="payment-box">
      <div class="payment-title">🏦 PAYMENT</div>
      <div class="payment-text">
        <div><strong>Direct Deposit:</strong></div>
        <div>Account Name: ${esc(paymentAccountName)}</div>
        <div>Bank: ${esc(paymentBank)} &nbsp; BSB: ${esc(paymentBSB)}</div>
        <div>Account NO: ${esc(paymentAccountNo)}</div>
      </div>
    </div>
    <div class="disclaimer">
      <div class="disclaimer-title">Disclaimer:</div>
      ${esc(biz.name || 'JSP Corporation Pty Ltd T/as Peninsula Laundries')} reserves the right to claim ownership of any linen that has not been returned. We also reserve the right to seek legal advice and pursue recovery of replacement costs for any unreturned or missing items.
    </div>
  </div>
</div>
</body></html>`;
};
