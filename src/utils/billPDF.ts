// Professional Bill Generator - 4 Themes
// Pure HTML → print → Save as PDF approach (no external lib needed)

import type { Sale, Customer, BusinessProfile } from '@/types';
import { buildCustomerLedger, computeBillSnapshot, type BillSnapshot } from '@/utils/ledger';

export type BillTheme = 'classic' | 'modern' | 'minimal' | 'colorful';

interface BillData {
  sale: Sale;
  customer?: Customer | null;
  business: BusinessProfile;
  theme: BillTheme;
  /** Historical snapshot (us bill ke waqt ka balance) — na do to fallback logic chalega */
  snapshot?: BillSnapshot;
}

function formatDate(dateStr: string, timeStr: string) {
  return `${dateStr} | ${timeStr}`;
}

// ── Theme Definitions ──
export const themes: Record<BillTheme, {
  headerBg: string;
  headerText: string;
  accentColor: string;
  accentLight: string;
  fontFamily: string;
  borderStyle: string;
  label: string;
  tableHead: string;
  tableHeadText: string;
  footerBg: string;
}> = {
  classic: {
    headerBg: '#1a1a2e',
    headerText: '#ffffff',
    accentColor: '#e94560',
    accentLight: '#ffeef2',
    fontFamily: 'Georgia, "Times New Roman", serif',
    borderStyle: '2px solid #1a1a2e',
    label: '🏛️ Classic',
    tableHead: '#1a1a2e',
    tableHeadText: '#ffffff',
    footerBg: '#f8f4f0',
  },
  modern: {
    headerBg: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)',
    headerText: '#ffffff',
    accentColor: '#f97316',
    accentLight: '#fff7ed',
    fontFamily: '"Segoe UI", Arial, sans-serif',
    borderStyle: '1.5px solid #f97316',
    label: '🎨 Modern',
    tableHead: '#f97316',
    tableHeadText: '#ffffff',
    footerBg: '#fff7ed',
  },
  minimal: {
    headerBg: '#ffffff',
    headerText: '#1f2937',
    accentColor: '#374151',
    accentLight: '#f9fafb',
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    borderStyle: '1px solid #e5e7eb',
    label: '⬜ Minimal',
    tableHead: '#f3f4f6',
    tableHeadText: '#374151',
    footerBg: '#f9fafb',
  },
  colorful: {
    headerBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    headerText: '#ffffff',
    accentColor: '#7c3aed',
    accentLight: '#f5f3ff',
    fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
    borderStyle: '2px solid #7c3aed',
    label: '🌈 Colorful',
    tableHead: '#7c3aed',
    tableHeadText: '#ffffff',
    footerBg: '#faf5ff',
  },
};

// ── Generate single bill HTML ──
function generateBillHTML(data: BillData): string {
  const { sale, customer, business, theme } = data;
  const t = themes[theme];
  const isGrad = t.headerBg.startsWith('linear');
  const headerStyle = isGrad ? `background:${t.headerBg}` : `background-color:${t.headerBg}`;

  const subtotal = sale.items.reduce((s, i) => s + i.total, 0);

  // ── Advance & Snapshot Due logic — HISTORICAL snapshot (us bill ke waqt ka balance) ──
  // snapshot diya gaya to wahi use karo (exact per-date balance), warna fallback:
  // sale.advanceBeforeBill → customer.current totalDue (last resort).
  const snap = data.snapshot;
  const advanceBefore: number = snap
    ? snap.balanceBefore
    : (sale.advanceBeforeBill !== undefined
      ? sale.advanceBeforeBill
      : (customer?.totalDue ?? 0));

  // How much advance was available BEFORE this bill? (historical — aaj ka nahi)
  const advanceAvailable = snap ? snap.advanceAvailable : (advanceBefore < 0 ? Math.abs(advanceBefore) : 0);
  const advanceUsed = snap ? snap.advanceUsed : Math.min(advanceAvailable, sale.total);
  const netPayable = snap ? snap.netPayable : Math.max(0, sale.total - advanceUsed);
  const advanceAfter = advanceAvailable - advanceUsed;

  // For udhaar/split partial payment: remaining due
  const partialPaid = (sale.amountPaid || 0);
  const udhaarRemaining = snap
    ? snap.udhaarRemaining
    : (sale.type === 'udhaar' || sale.type === 'split'
      ? Math.max(0, netPayable - partialPaid)
      : 0);

  // Snapshot total due AFTER this bill (purana baki + is bill ka baki) — bill-date accurate
  const priorDue = snap ? snap.puranaBaki : (advanceBefore > 0 ? advanceBefore : 0);
  const totalDueAtBillTime = snap
    ? snap.totalDueAtBillTime
    : ((sale.type === 'udhaar' || sale.type === 'split')
      ? priorDue + udhaarRemaining
      : priorDue);

  const itemsHTML = sale.items.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? t.accentLight : '#ffffff'}">
      <td style="padding:9px 12px; font-size:13px; color:#1f2937;">${item.name}</td>
      <td style="padding:9px 12px; text-align:center; font-size:13px; color:#374151;">${item.quantity}</td>
      <td style="padding:9px 12px; text-align:right; font-size:13px; color:#374151;">₹${item.price.toFixed(2)}</td>
      <td style="padding:9px 12px; text-align:right; font-size:13px; font-weight:700; color:#111827;">₹${item.total.toFixed(2)}</td>
    </tr>
  `).join('');

  const nowStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bill - ${sale.billNumber || sale.id}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:${t.fontFamily}; background:#f1f5f9; }
    .page { max-width:480px; margin:20px auto; background:#fff; border:${t.borderStyle}; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.12); }

    /* HEADER */
    .header { ${headerStyle}; color:${t.headerText}; padding:24px 20px 20px; text-align:center; position:relative; }
    .shop-icon { font-size:32px; margin-bottom:6px; }
    .shop-name { font-size:22px; font-weight:800; letter-spacing:0.5px; }
    .shop-tagline { font-size:11px; opacity:0.75; margin-top:2px; letter-spacing:0.3px; }
    .shop-meta { margin-top:10px; font-size:11.5px; opacity:0.9; line-height:1.7; }
    .gstin-badge { display:inline-block; background:rgba(255,255,255,0.2); border-radius:4px; padding:2px 8px; font-size:10px; margin-top:6px; letter-spacing:0.5px; }

    /* BILL INFO BAR */
    .bill-bar { display:flex; justify-content:space-between; align-items:flex-start; padding:12px 16px; background:${t.accentLight}; border-bottom:1px solid ${isGrad ? '#e5e7eb' : t.accentColor}30; }
    .bill-num { font-size:16px; font-weight:800; color:${isGrad ? t.accentColor : t.headerBg}; }
    .bill-date { font-size:11px; color:#6b7280; margin-top:2px; }
    .bill-type-badge { padding:4px 12px; border-radius:20px; font-size:11px; font-weight:700; letter-spacing:0.3px;
      background:${sale.type === 'cash' ? '#dcfce7' : '#fee2e2'};
      color:${sale.type === 'cash' ? '#166534' : '#991b1b'}; }

    /* CUSTOMER BAR */
    .customer-bar { padding:10px 16px; border-bottom:1px solid #f3f4f6; background:#fff; }
    .customer-label { font-size:10px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; }
    .customer-name { font-size:14px; font-weight:700; color:#1f2937; margin-top:2px; }
    .customer-meta { font-size:11px; color:#6b7280; margin-top:2px; }

    /* ITEMS TABLE */
    .items-section { }
    .items-table { width:100%; border-collapse:collapse; }
    .items-table thead tr { background:${t.tableHead}; }
    .items-table th { padding:9px 12px; font-size:11.5px; font-weight:700; letter-spacing:0.3px; color:${t.tableHeadText}; text-align:left; }
    .items-table th:nth-child(2) { text-align:center; }
    .items-table th:nth-child(3), .items-table th:nth-child(4) { text-align:right; }

    /* TOTALS */
    .totals-section { padding:14px 16px; border-top:2px ${isGrad ? 'solid #e5e7eb' : 'solid ' + t.accentColor}; background:${t.accentLight}; }
    .total-row { display:flex; justify-content:space-between; font-size:13px; color:#374151; margin-bottom:6px; }
    .total-row.grand { font-size:20px; font-weight:900; color:${isGrad ? t.accentColor : t.headerBg}; margin-top:8px; padding-top:8px; border-top:1px dashed #d1d5db; }
    .total-row.paid { font-size:13px; color:#16a34a; font-weight:600; }
    .total-row.change { font-size:14px; color:#ea580c; font-weight:700; }
    .total-row.advance { font-size:13px; color:#16a34a; }

    /* BALANCE BOX */
    .balance-box { margin:0 16px 12px; border-radius:8px; padding:10px 14px; font-size:12.5px; font-weight:600; }
    .balance-due { background:#fef2f2; color:#991b1b; border:1px solid #fecaca; }
    .balance-adv { background:#f0fdf4; color:#166534; border:1px solid #bbf7d0; }

    /* FOOTER */
    .footer { padding:14px 16px; background:${t.footerBg}; border-top:1px dashed #e5e7eb; text-align:center; }
    .footer-thanks { font-size:15px; font-weight:700; color:#374151; margin-bottom:4px; }
    .footer-meta { font-size:10.5px; color:#9ca3af; }
    .footer-print-date { font-size:10px; color:#d1d5db; margin-top:4px; }

    /* DIVIDER */
    .section-divider { border:none; border-top:1px solid #f3f4f6; margin:0; }

    @media print {
      body { background:#fff; }
      .page { box-shadow:none; border:none; border-radius:0; max-width:100%; margin:0; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- HEADER -->
    <div class="header" style="${headerStyle}">
      <div class="shop-icon">🏪</div>
      <div class="shop-name">${business.shopName || 'Kirana Store'}</div>
      ${business.ownerName ? `<div class="shop-tagline">${business.ownerName}</div>` : ''}
      <div class="shop-meta">
        ${business.phone ? `📞 ${business.phone}` : ''}
        ${business.phone && business.address ? '&nbsp;&nbsp;|&nbsp;&nbsp;' : ''}
        ${business.address ? `📍 ${business.address}` : ''}
      </div>
      ${business.gstin ? `<div class="gstin-badge">GSTIN: ${business.gstin}</div>` : ''}
    </div>

    <!-- BILL INFO BAR -->
    <div class="bill-bar">
      <div>
        <div class="bill-num">${sale.billNumber || '#' + sale.id.slice(-8).toUpperCase()}</div>
        <div class="bill-date">📅 ${formatDate(sale.date, sale.time)}</div>
      </div>
      <div style="text-align:right">
        <span class="bill-type-badge">${sale.type === 'cash' ? '💵 CASH' : sale.type === 'split' ? '🔀 SPLIT' : '📋 UDHAAR'}</span>
      </div>
    </div>

    ${customer || sale.customerName ? `
    <!-- CUSTOMER INFO -->
    <div class="customer-bar">
      <div class="customer-label">Customer</div>
      <div class="customer-name">👤 ${customer?.name || sale.customerName}</div>
      <div class="customer-meta">
        ${(customer?.phone || sale.customerPhone) ? `📞 ${customer?.phone || sale.customerPhone}` : ''}
        ${customer?.address ? `&nbsp;&nbsp;📍 ${customer.address}` : ''}
      </div>
    </div>` : ''}

    <!-- ITEMS TABLE -->
    <div class="items-section">
      <table class="items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th style="text-align:center">Qty</th>
            <th style="text-align:right">Rate</th>
            <th style="text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>${itemsHTML}</tbody>
      </table>
    </div>

    <!-- TOTALS -->
    <div class="totals-section">
      <div class="total-row">
        <span>${sale.items.length} item${sale.items.length > 1 ? 's' : ''}</span>
        <span>₹${subtotal.toFixed(2)}</span>
      </div>
      ${(sale.discount || 0) > 0 ? `
      <div class="total-row" style="color:#059669;">
        <span>🎁 Discount</span>
        <span>- ₹${(sale.discount || 0).toFixed(2)}</span>
      </div>` : ''}
      ${advanceUsed > 0 ? `
      <div class="total-row advance">
        <span>✓ Advance Adjust</span>
        <span>- ₹${advanceUsed.toFixed(2)}</span>
      </div>` : ''}
      <div class="total-row grand">
        <span>TOTAL</span>
        <span>₹${netPayable.toFixed(2)}</span>
      </div>
      ${partialPaid > 0 ? `
      <div class="total-row paid">
        <span>✅ ${sale.type === 'udhaar' ? 'Abhi Mila' : '💵 Amount Received'}</span>
        <span>₹${partialPaid.toFixed(2)}</span>
      </div>` : ''}
      ${udhaarRemaining > 0 ? `
      <div class="total-row" style="font-size:15px;font-weight:800;color:#dc2626;margin-top:6px;padding-top:6px;border-top:1px dashed #fca5a5;">
        <span>${sale.type === 'split' ? '🔀 Split Baaki' : '📋 Udhaar Baaki'}</span>
        <span>₹${udhaarRemaining.toFixed(2)}</span>
      </div>` : ''}
      ${(sale.changeReturned || 0) > 0 ? `
      <div class="total-row change">
        <span>↩ Wapas Diye (Change)</span>
        <span>₹${(sale.changeReturned || 0).toFixed(2)}</span>
      </div>` : ''}
    </div>

    ${advanceAvailable > 0 || advanceAfter > 0 ? `
    <!-- ADVANCE HISTORY BOX: before → used → after -->
    <div class="balance-box balance-adv" style="margin:0 16px 12px;">
      <div style="font-size:11px;color:#166534;font-weight:700;letter-spacing:0.3px;margin-bottom:6px;">💰 ADVANCE HISAAB</div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
        <span style="color:#374151;">Is bill se pehle:</span>
        <span style="font-weight:700;color:#166534;">₹${advanceAvailable.toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
        <span style="color:#374151;">Is bill mein kata:</span>
        <span style="font-weight:700;color:#dc2626;">- ₹${advanceUsed.toFixed(2)}</span>
      </div>
      <div style="border-top:1px dashed #86efac;margin:5px 0;"></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;">
        <span style="font-weight:700;color:#166534;">Bacha hua advance:</span>
        <span style="font-weight:800;font-size:14px;color:#166534;">₹${advanceAfter.toFixed(2)}</span>
      </div>
      ${advanceAfter > 0 ? `<div style="font-size:10px;color:#4ade80;margin-top:3px;">Agle bill mein kaat liya jayega ✓</div>` : ''}
    </div>` : ''}
    ${totalDueAtBillTime > 0 && (sale.type === 'udhaar' || sale.type === 'split') ? `
    <!-- BALANCE DUE BOX: Snapshot balance at bill creation date -->
    <div class="balance-box balance-due" style="margin:0 16px 12px;">
      ⚠️ <strong>Is Bill Tak Kul Baki: ₹${totalDueAtBillTime.toFixed(2)}</strong>
      ${priorDue > 0 ? `<div style="font-size:10.5px;color:#b91c1c;margin-top:2px;">(Purana Baki: ₹${priorDue.toFixed(2)} + Is Bill Ka Baki: ₹${udhaarRemaining.toFixed(2)})</div>` : ''}
    </div>` : ''}

    <!-- UPI QR CODE -->
    ${business.upiId ? `
    <div style="padding:12px 16px;border-top:1px solid #f3f4f6;text-align:center;background:#fff;">
      <p style="font-size:11px;color:#6b7280;margin-bottom:8px;font-weight:600;">📱 UPI Se Payment Karein</p>
      <img
        src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`upi://pay?pa=${business.upiId}&pn=${encodeURIComponent(business.shopName || 'Shop')}&am=${netPayable.toFixed(2)}&cu=INR&tn=${encodeURIComponent((sale.billNumber || 'Bill'))}`)}"
        alt="UPI QR"
        style="width:110px;height:110px;border:2px solid #f3f4f6;border-radius:8px;"
        onerror="this.style.display='none'"
      />
      <p style="font-size:11px;color:#374151;font-weight:700;margin-top:6px;">${business.upiId}</p>
      <p style="font-size:10px;color:#9ca3af;">Amount: ₹${netPayable.toFixed(2)}</p>
    </div>` : ''}

    <!-- FESTIVAL MESSAGE -->
    ${business.festivalMsg ? `
    <div style="padding:8px 16px;background:linear-gradient(135deg,#fef3c7,#fde68a);text-align:center;">
      <p style="font-size:12px;color:#92400e;font-weight:600;">🎊 ${business.festivalMsg}</p>
    </div>` : ''}

    <!-- FOOTER -->
    <div class="footer">
      <div class="footer-thanks">🙏 Shukriya! Phir zaroor aana!</div>
      ${business.phone ? `<div class="footer-meta">📞 ${business.phone}</div>` : ''}
      <div class="footer-meta" style="margin-top:4px;">Powered by Dukaan POS</div>
      <div class="footer-print-date">Printed: ${nowStr}</div>
    </div>
  </div>
</body>
</html>`;
}

// ── Print single bill ──
export function printBill(data: BillData) {
  const html = generateBillHTML(data);
  const win = window.open('', '_blank', 'width=520,height=750');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

// ── Download all bills as printable HTML ──
export function downloadAllBillsHTML(
  sales: Sale[],
  customers: Customer[],
  business: BusinessProfile,
  theme: BillTheme
) {
  const customerMap = new Map(customers.map(c => [c.id, c]));
  const sorted = [...sales].sort((a, b) => b.createdAt - a.createdAt);

  const coverHTML = `
  <div style="max-width:480px;margin:20px auto 40px;text-align:center;font-family:Arial,sans-serif;">
    <div style="background:linear-gradient(135deg,#f97316,#dc2626);border-radius:16px;padding:30px;color:#fff;box-shadow:0 4px 20px rgba(0,0,0,0.15);">
      <div style="font-size:40px;margin-bottom:8px;">🏪</div>
      <div style="font-size:24px;font-weight:800;">${business.shopName}</div>
      ${business.ownerName ? `<div style="font-size:14px;opacity:0.85;margin-top:4px;">${business.ownerName}</div>` : ''}
      ${business.phone ? `<div style="font-size:13px;margin-top:6px;">📞 ${business.phone}</div>` : ''}
    </div>
    <div style="margin-top:20px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;">
      <div style="font-size:18px;font-weight:700;color:#1f2937;margin-bottom:12px;">📋 All Bills Report</div>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 20px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#166534;">${sales.length}</div>
          <div style="font-size:11px;color:#4ade80;">Total Bills</div>
        </div>
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 20px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#c2410c;">₹${sales.reduce((s, sl) => s + sl.total, 0).toFixed(0)}</div>
          <div style="font-size:11px;color:#f97316;">Total Revenue</div>
        </div>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 20px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#1d4ed8;">${sales.filter(s => s.type === 'cash').length}</div>
          <div style="font-size:11px;color:#60a5fa;">Cash Bills</div>
        </div>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 20px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#991b1b;">${sales.filter(s => s.type === 'udhaar').length}</div>
          <div style="font-size:11px;color:#f87171;">Udhaar Bills</div>
        </div>
      </div>
      <div style="margin-top:12px;font-size:11px;color:#9ca3af;">Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
    </div>
  </div>`;

  const billsHTML = sorted
    .map(sale => {
      const cust = sale.customerId ? customerMap.get(sale.customerId) ?? null : null;
      return generateBillHTML({ sale, customer: cust, business, theme });
    })
    .join('<div style="page-break-after:always;margin:20px 0;"></div>');

  const fullHTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>All Bills - ${business.shopName}</title>
<style>
  body { background:#f1f5f9; padding:20px; font-family:Arial,sans-serif; }
  @media print { body { background:#fff; padding:0; } }
</style>
</head>
<body>${coverHTML}${billsHTML}</body>
</html>`;

  const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(business.shopName || 'Dukaan').replace(/\s+/g, '_')}_Bills_${new Date().toISOString().split('T')[0]}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Customer Khata PDF ──
export function downloadCustomerBillsHTML(
  customer: Customer,
  sales: Sale[],
  transactions: Array<{ id: string; customerId: string; type: string | 'payment'; amount: number; description: string; saleId?: string; createdAt: number; date: string; time: string; }>,
  business: BusinessProfile,
  theme: BillTheme
) {
  const t = themes[theme];
  const isGrad = t.headerBg.startsWith('linear');
  const headerStyle = isGrad ? `background:${t.headerBg}` : `background-color:${t.headerBg}`;

  // 📒 Ledger-based summary — net = paid − udhaar (advance correctly handle hota hai)
  const ledger = buildCustomerLedger(
    sales,
    transactions.filter(tx => tx.type === 'payment')
  );
  const totalBilled = ledger.totalUdhaar;
  const totalPaid = ledger.totalPaid;
  const net = ledger.net; // >0 = advance, <0 = baaki

  const summaryHTML = `
  <div style="max-width:480px;margin:20px auto 30px;border:${t.borderStyle};border-radius:12px;overflow:hidden;font-family:${t.fontFamily};box-shadow:0 4px 20px rgba(0,0,0,0.12);">
    <!-- Header -->
    <div style="${headerStyle};color:${t.headerText};padding:22px 20px;text-align:center;">
      <div style="font-size:28px;margin-bottom:4px;">📒</div>
      <div style="font-size:19px;font-weight:800;">Khata / Ledger</div>
      <div style="font-size:13px;opacity:0.85;margin-top:3px;">${business.shopName}</div>
      ${business.phone ? `<div style="font-size:11px;opacity:0.75;margin-top:2px;">📞 ${business.phone}</div>` : ''}
    </div>

    <!-- Customer Info -->
    <div style="padding:16px;background:#fff;border-bottom:1px solid #f3f4f6;">
      <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Customer</div>
      <div style="font-size:18px;font-weight:800;color:#1f2937;margin-top:4px;">👤 ${customer.name}</div>
      ${customer.phone ? `<div style="font-size:12px;color:#6b7280;margin-top:3px;">📞 ${customer.phone}</div>` : ''}
      ${customer.address ? `<div style="font-size:12px;color:#6b7280;">📍 ${customer.address}</div>` : ''}
    </div>

    <!-- Summary Cards -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border-bottom:1px solid #f3f4f6;">
      <div style="padding:14px;text-align:center;border-right:1px solid #f3f4f6;">
        <div style="font-size:18px;font-weight:800;color:#dc2626;">₹${totalBilled.toFixed(0)}</div>
        <div style="font-size:10px;color:#9ca3af;margin-top:2px;">Total Udhaar</div>
      </div>
      <div style="padding:14px;text-align:center;border-right:1px solid #f3f4f6;">
        <div style="font-size:18px;font-weight:800;color:#16a34a;">₹${totalPaid.toFixed(0)}</div>
        <div style="font-size:10px;color:#9ca3af;margin-top:2px;">Total Paid</div>
      </div>
      <div style="padding:14px;text-align:center;background:${net < 0 ? '#fef2f2' : '#f0fdf4'};">
        <div style="font-size:18px;font-weight:800;color:${net < 0 ? '#dc2626' : '#16a34a'};">₹${Math.abs(net).toFixed(0)}</div>
        <div style="font-size:10px;color:#9ca3af;margin-top:2px;">${net < 0 ? '⚠ Balance' : '✅ Advance'}</div>
      </div>
    </div>

    <!-- Transactions -->
    <div style="padding:14px 16px;">
      <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">Transaction History</div>
      ${transactions.length === 0
        ? '<p style="text-align:center;color:#9ca3af;font-size:12px;padding:10px;">No transactions</p>'
        : transactions.slice(-30).reverse().map((tx: { type: string; date: string; time: string; amount: number }) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f9fafb;">
          <div>
            <span style="font-size:11.5px;font-weight:600;color:${tx.type === 'sale' ? '#dc2626' : '#16a34a'};">
              ${tx.type === 'sale' ? '📈 Udhaar' : '💵 Payment'}
            </span>
            <div style="font-size:10px;color:#9ca3af;">${tx.date} ${tx.time}</div>
          </div>
          <span style="font-weight:800;font-size:13px;color:${tx.type === 'sale' ? '#dc2626' : '#16a34a'};">
            ${tx.type === 'sale' ? '+' : '-'}₹${tx.amount.toFixed(2)}
          </span>
        </div>`).join('')}
    </div>

    <!-- Footer -->
    <div style="padding:12px 16px;text-align:center;background:${t.footerBg};border-top:1px dashed #e5e7eb;">
      <div style="font-size:11px;color:#6b7280;">Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })} | Dukaan POS</div>
    </div>
  </div>`;

  // Har bill ko uske APNE historical snapshot ke saath render karo (time-travel fix)
  const billsHTML = sales.map(sale =>
    generateBillHTML({ sale, customer, business, theme, snapshot: computeBillSnapshot(sale, ledger) })
  ).join('<div style="page-break-after:always;margin:20px 0;"></div>');

  const fullHTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Khata - ${customer.name} - ${business.shopName}</title>
<style>
  body { background:#f1f5f9; padding:20px; font-family:Arial,sans-serif; }
  @media print { body { background:#fff; padding:0; } }
</style>
</head>
<body>${summaryHTML}${billsHTML}</body>
</html>`;

  const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Khata_${customer.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Professional WhatsApp Bill ──
export function generateWhatsAppBill(sale: Sale, business: BusinessProfile, customer?: Customer | null): string {
  const lines: string[] = [];

  // Shop Header
  lines.push(`🏪 *${business.shopName}*`);
  if (business.ownerName) lines.push(`👤 ${business.ownerName}`);
  if (business.address) lines.push(`📍 ${business.address}`);
  if (business.phone) lines.push(`📞 ${business.phone}`);
  if (business.gstin) lines.push(`🔖 GSTIN: ${business.gstin}`);
  lines.push('');

  // Bill details
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`🧾 *${sale.billNumber || 'Bill'}*`);
  lines.push(`📅 Date: ${sale.date}  ⏰ ${sale.time}`);
  if (customer) lines.push(`👤 Customer: *${customer.name}*`);
  if (customer?.phone) lines.push(`📞 ${customer.phone}`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push('');

  // Items
  lines.push(`*📦 Items:*`);
  sale.items.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.name}`);
    lines.push(`   ${item.quantity} × ₹${item.price.toFixed(2)} = *₹${item.total.toFixed(2)}*`);
  });
  lines.push('');

  // Totals
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  if ((sale.discount || 0) > 0) {
    lines.push(`🎁 Discount: -₹${(sale.discount || 0).toFixed(2)}`);
  }
  lines.push(`💰 *TOTAL: ₹${sale.total.toFixed(2)}*`);

  if (sale.amountPaid !== undefined && sale.amountPaid > 0) {
    lines.push(`💵 Received: ₹${sale.amountPaid.toFixed(2)}`);
    if ((sale.changeReturned || 0) > 0) {
      lines.push(`↩ Change: ₹${(sale.changeReturned || 0).toFixed(2)}`);
    }
  }

  lines.push(`📌 Payment: ${sale.type === 'cash' ? '✅ *Cash*' : sale.type === 'split' ? `🔀 *Split (Cash ₹${(sale.amountPaid || 0).toFixed(0)} + Udhaar ₹${Math.max(0, sale.total - (sale.amountPaid || 0)).toFixed(0)})*` : '📋 *Udhaar / Credit*'}`);

  // Customer balance
  if (customer && customer.totalDue !== 0) {
    lines.push('');
    if (customer.totalDue > 0) {
      lines.push(`⚠️ *Aapka Baki: ₹${customer.totalDue.toFixed(2)}*`);
      lines.push(`_Jald payment karein — Shukriya!_`);
    } else {
      lines.push(`✅ *Advance Balance: ₹${Math.abs(customer.totalDue).toFixed(2)}*`);
      lines.push(`_Yeh agle bill mein adjust hoga._`);
    }
  }

  lines.push('');
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`🙏 *Shukriya! Phir zaroor aana!*`);
  if (business.upiId) {
    lines.push('');
    lines.push(`💳 *UPI Payment:* \`${business.upiId}\``);
    lines.push(`_Amount: ₹${sale.total.toFixed(2)}_`);
  }
  if (business.festivalMsg) {
    lines.push('');
    lines.push(`🎊 ${business.festivalMsg}`);
  }
  lines.push(`_${business.shopName} — Powered by Dukaan POS_`);

  return lines.join('\n');
}
