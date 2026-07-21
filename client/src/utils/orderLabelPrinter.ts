export const generateOrderLabelHTML = (order: any, origin: string = window.location.origin) => {
    const customer = order.customer || {};
    const items = order.items || [];
    
    // Format dates
    const createdDateObj = order.createdAt ? new Date(order.createdAt) : new Date();
    
    // Format e.g. JUL 15, 2026
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const formattedCreatedDate = `${months[createdDateObj.getMonth()]} ${String(createdDateObj.getDate()).padStart(2, '0')}, ${createdDateObj.getFullYear()}`;
    
    let formattedDeliveryDate = 'N/A';
    if (order.deliveryDate) {
        const delivDateObj = new Date(order.deliveryDate);
        formattedDeliveryDate = `${months[delivDateObj.getMonth()]} ${String(delivDateObj.getDate()).padStart(2, '0')}, ${delivDateObj.getFullYear()}`;
    }
        
    // Format time 07:34 am
    let hours = createdDateObj.getHours();
    const minutes = String(createdDateObj.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const createdTimeStr = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;

    // Format top left print timestamp e.g. 7/17/26, 8:03 PM
    const printTopTimestamp = `${createdDateObj.getMonth() + 1}/${createdDateObj.getDate()}/${String(createdDateObj.getFullYear()).slice(-2)}, ${createdDateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;

    // Format address
    let addressHTML = '';
    if (typeof customer.address === 'string' && customer.address.trim()) {
        addressHTML = customer.address.replace(/\n/g, '<br/>');
    } else if (typeof customer.address === 'object' && customer.address) {
        const parts = [
            customer.address.street,
            customer.address.city,
            [customer.address.state, customer.address.zipCode].filter(Boolean).join(', '),
            customer.address.country
        ].filter(Boolean);
        addressHTML = parts.join('<br/>');
    }

    const createdByName = order.createdBy?.name || 'Admin';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Order Label - ${order.orderId}</title>
            <meta charset="utf-8" />
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    background: #ffffff;
                    color: #000000;
                    font-family: Arial, Helvetica, sans-serif;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                @page { size: A4 portrait; margin: 8mm; }
                @media print {
                    html, body { background: #ffffff !important; margin: 0 !important; padding: 0 !important; }
                    body * { visibility: hidden; }
                    .label-print-shell, .label-print-shell * { visibility: visible; }
                    .label-print-shell { position: absolute; left: 0; top: 0; width: 100%; }
                }
                .label-print-shell {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 15px 20px;
                    background: #ffffff;
                }
                .print-top-time {
                    font-size: 11px;
                    color: #111111;
                    margin-bottom: 15px;
                    font-weight: 500;
                }
                .header-table {
                    width: 100%;
                    margin-bottom: 15px;
                    border-collapse: collapse;
                }
                .company-title {
                    font-size: 13px;
                    font-weight: bold;
                    color: #000000;
                    margin-bottom: 3px;
                }
                .company-details {
                    font-size: 10px;
                    color: #222222;
                    line-height: 1.4;
                }
                .contact-details {
                    text-align: right;
                    font-size: 10px;
                    color: #222222;
                    line-height: 1.6;
                }
                .contact-icon {
                    display: inline-block;
                    width: 13px;
                    height: 13px;
                    background: #38a5da;
                    color: #ffffff;
                    border-radius: 50%;
                    text-align: center;
                    font-size: 8px;
                    line-height: 13px;
                    margin-right: 4px;
                }
                .customer-order-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    margin-bottom: 10px;
                }
                .customer-name {
                    font-size: 15px;
                    font-weight: bold;
                    color: #000000;
                    margin-bottom: 2px;
                }
                .customer-address-text {
                    font-size: 11px;
                    color: #222222;
                    line-height: 1.4;
                }
                .customer-email-text {
                    font-size: 11px;
                    color: #0088cc;
                    margin-top: 2px;
                }
                .order-badge-container {
                    display: inline-flex;
                    align-items: center;
                    border-radius: 3px;
                    overflow: hidden;
                    font-family: Arial, sans-serif;
                }
                .order-badge-plus {
                    background: #3a3f47;
                    color: #ffffff;
                    padding: 4px 8px;
                    font-size: 14px;
                    font-weight: bold;
                }
                .order-badge-text {
                    background: #38a5da;
                    color: #ffffff;
                    padding: 4px 14px;
                    font-size: 15px;
                    font-weight: bold;
                }
                .barcode-box {
                    text-align: right;
                }
                .barcode-text {
                    font-size: 11px;
                    font-weight: bold;
                    letter-spacing: 1px;
                    color: #000000;
                    margin-top: 2px;
                }
                .divider-line {
                    border-bottom: 1.5px solid #222222;
                    margin-bottom: 12px;
                }
                .dates-row {
                    display: flex;
                    gap: 50px;
                    margin-bottom: 15px;
                }
                .date-col {
                    display: flex;
                    flex-direction: column;
                }
                .date-title {
                    font-size: 9.5px;
                    font-weight: bold;
                    color: #000000;
                    text-transform: uppercase;
                    margin-bottom: 3px;
                    letter-spacing: 0.5px;
                }
                .date-val {
                    font-size: 12.5px;
                    font-weight: bold;
                    color: #000000;
                }
                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 25px;
                }
                .items-table th {
                    background: #38a5da !important;
                    color: #ffffff !important;
                    padding: 7px 10px;
                    font-size: 11px;
                    font-weight: bold;
                    border: none;
                }
                .items-table td {
                    padding: 6.5px 10px;
                    font-size: 11px;
                    color: #000000;
                    border-bottom: 1px solid #e5e7eb;
                }
                .items-table tr.even {
                    background: #f2f4f7 !important;
                }
                .text-left { text-align: left; }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .created-by-text {
                    font-size: 11px;
                    color: #000000;
                    font-weight: 400;
                    margin-bottom: 15px;
                }
                .created-by-name {
                    font-weight: bold;
                }
                .footer-banner {
                    background: #38a5da !important;
                    color: #ffffff !important;
                    text-align: center;
                    padding: 8px 12px;
                    font-size: 12px;
                    font-weight: bold;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
            </style>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        </head>
        <body>
            <div class="label-print-shell">
                <!-- Top print timestamp -->
                <div class="print-top-time">
                    ${printTopTimestamp}
                </div>

                <!-- Top Header -->
                <table class="header-table">
                    <tr>
                        <td style="width: 200px; vertical-align: top;">
                            <img src="${origin}/logo.jpeg" alt="Logo" style="max-width: 180px; height: auto;" />
                        </td>
                        <td style="text-align: center; vertical-align: top;">
                            <div class="company-title">LinenTech</div>
                            <div class="company-details">
                                JSP Corporation Pty Ltd T/A Peninsula Laundries<br/>
                                13 Redcliffe Gardens Drive<br/>
                                Clontarf, Queensland, 4019<br/>
                                <span style="color: #0088cc;">orders@peninsulalaundries.com.au</span>
                            </div>
                        </td>
                        <td style="width: 220px; vertical-align: top;">
                            <div class="contact-details">
                                <div><span class="contact-icon">📞</span> 61475902921</div>
                                <div><span class="contact-icon">🔒</span> &nbsp;</div>
                                <div><span class="contact-icon">🌐</span> <span style="color: #0088cc;">peninsulalaundries.com.au</span></div>
                            </div>
                        </td>
                    </tr>
                </table>

                <!-- Customer Details & Order / Barcode -->
                <div class="customer-order-row">
                    <div style="max-width: 50%;">
                        <div class="customer-name">${customer.name || 'N/A'}</div>
                        ${addressHTML ? `<div class="customer-address-text">${addressHTML}</div>` : ''}
                        ${customer.email ? `<div class="customer-email-text">${customer.email}</div>` : ''}
                    </div>

                    <div style="display: flex; align-items: flex-end; gap: 25px;">
                        <div>
                            <div class="order-badge-container">
                                <span class="order-badge-plus">+</span>
                                <span class="order-badge-text">Order</span>
                            </div>
                        </div>
                        <div class="barcode-box">
                            <svg id="barcode"></svg>
                            <div class="barcode-text">${order.orderId}</div>
                        </div>
                    </div>
                </div>

                <!-- Divider Line -->
                <div class="divider-line"></div>

                <!-- Dates -->
                <div class="dates-row">
                    <div class="date-col">
                        <span class="date-title">ORDER DATE</span>
                        <span class="date-val">${formattedCreatedDate}</span>
                    </div>
                    <div class="date-col">
                        <span class="date-title">DELIVERY DATE</span>
                        <span class="date-val">${formattedDeliveryDate}</span>
                    </div>
                </div>

                <!-- Table -->
                <table class="items-table">
                    <thead>
                        <tr>
                            <th class="text-left" style="width: 15%;">Item #</th>
                            <th class="text-left" style="width: 45%;">Item Name</th>
                            <th class="text-center" style="width: 13%;">Order Qty</th>
                            <th class="text-center" style="width: 13%;">Filled Qty</th>
                            <th class="text-center" style="width: 14%;">Back Order</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((item: any, index: number) => {
                            const filledQty = item.shippedQuantity !== null && item.shippedQuantity !== undefined ? item.shippedQuantity : item.quantity;
                            const backOrder = Math.max(0, item.quantity - filledQty);
                            const itemNum = item.itemCode || item.itemNumber || (index + 1);
                            return `
                                <tr class="${index % 2 === 1 ? 'even' : ''}">
                                    <td class="text-left">${itemNum}</td>
                                    <td class="text-left">${item.itemName || item.serviceName}</td>
                                    <td class="text-center">${item.quantity}</td>
                                    <td class="text-center">${filledQty}</td>
                                    <td class="text-center">${backOrder}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>

                <!-- Created By -->
                <div class="created-by-text">
                    Created by <span class="created-by-name">${createdByName}</span> on ${formattedCreatedDate} at ${createdTimeStr}
                </div>

                <!-- Footer Banner -->
                <div class="footer-banner">
                    THANK YOU FOR DOING BUSINESS WITH US!
                </div>
            </div>

            <script>
                window.onload = function() {
                    if (window.JsBarcode) {
                        JsBarcode("#barcode", "${order.orderId}", {
                            format: "CODE128",
                            width: 1.8,
                            height: 42,
                            displayValue: false,
                            background: "#ffffff",
                            lineColor: "#000000",
                            margin: 0
                        });
                    }
                    setTimeout(function() {
                        window.print();
                    }, 500);
                };
            </script>
        </body>
        </html>
    `;
};
