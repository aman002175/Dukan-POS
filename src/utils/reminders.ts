/**
 * reminders.ts — WhatsApp message builders (pure, testable).
 * Takaza (udhaar reminder) + supplier order list.
 */
import type { Product } from '@/types';

/** Udhaar takaza message — WhatsApp formatting (*bold*) */
export function buildDueReminderMessage(customerName: string, due: number, shopName: string): string {
  return `Namaste *${customerName}* ji! 🙏\n\n*${shopName}* se yaad dila rahe hain.\n\nAapka *₹${due.toFixed(2)}* baki hai. Jald se jald jama kar dein.\n\nShukriya! 🏪`;
}

/** Sab dues ka ek combined text (copy-paste ke liye) */
export function buildAllDuesMessage(dues: Array<{ name: string; due: number }>, shopName: string): string {
  const lines = dues.map((d, i) => `${i + 1}. ${d.name} — ₹${d.due.toFixed(2)}`);
  const total = dues.reduce((s, d) => s + d.due, 0);
  return `*${shopName}* — Udhaar Takaza 📋\n\n${lines.join('\n')}\n\nKul Baki: *₹${total.toFixed(2)}*`;
}

/** Supplier order list message (low-stock se auto) */
export function buildSupplierOrderMessage(
  items: Array<{ name: string; stock: number; unit: string; suggestQty: number }>,
  shopName: string
): string {
  const lines = items.map((it, i) => `${i + 1}. ${it.name} — ${it.suggestQty} ${it.unit} (abhi ${it.stock} bacha)`);
  return `*${shopName}* — Maal Order 📦\n\n${lines.join('\n')}\n\nJaldi bhejne ki kripa karein. Dhanyavaad! 🙏`;
}

/** Phone se wa.me link banao (null = number nahi hai) */
export function waLink(phone: string | undefined, text: string): string | null {
  const digits = (phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  if (digits.length < 10) return null;
  const full = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

/** Low-stock item ke liye suggested order qty (minStock ka 2x ya kami + buffer) */
export function suggestOrderQty(p: Pick<Product, 'stock' | 'minStock'>): number {
  const shortage = Math.max(0, p.minStock - p.stock);
  return Math.max(shortage + Math.ceil(p.minStock / 2), 1);
}

/** Expiry status helper (shared: Inventory + AI + alerts) */
export function expiryStatus(expiryDate?: string): 'expired' | 'soon' | 'ok' | 'none' {
  if (!expiryDate) return 'none';
  const today = new Date().toISOString().split('T')[0];
  if (expiryDate < today) return 'expired';
  const soonLimit = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  if (expiryDate <= soonLimit) return 'soon';
  return 'ok';
}

/** Central send: wa.me (number hai) → navigator.share → clipboard. Returns method used. */
export function sendWhatsAppText(
  text: string,
  phone?: string
): 'whatsapp' | 'share' | 'clipboard' | 'failed' {
  try {
    const link = waLink(phone, text);
    if (link) {
      window.open(link, '_blank');
      return 'whatsapp';
    }
    if (navigator.share) {
      navigator.share({ text }).catch(() => undefined);
      return 'share';
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => undefined);
      return 'clipboard';
    }
  } catch {
    /* noop */
  }
  return 'failed';
}
