/**
 * aiActions.ts
 * ──────────────────────────────────────────────────────────────────
 * SINGLE shared AI-action dispatcher.
 *
 * AISection (chat) aur FloatingMic (voice) DONO isi ko use karte hain —
 * taaki koi action type ek jagah handle ho aur doosri jagah chhoot na jaye.
 * (Pehle drift bug tha: chat se add_product drop ho jata tha!)
 *
 * @returns true agar koi app event dispatch hua (action execute hua)
 * ──────────────────────────────────────────────────────────────────
 */

import type { AIAction } from './aiService';
import type { TabType } from '@/types';

function emit(name: string, detail: unknown): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function dispatchAIActionEvents(action: AIAction | undefined): boolean {
  if (!action || action.type === 'none') return false;

  switch (action.type) {
    // ── Cart & Billing ──
    case 'add_to_cart': {
      const items = action.items || [];
      if (items.length === 0) return false;
      items.forEach(item => {
        emit('ai-add-to-cart', {
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity || 1,
          unit: item.unit,
        });
      });
      return true;
    }
    case 'record_cash': {
      emit('ai-record-bill', { type: 'cash', items: action.items, total: action.total });
      return true;
    }
    case 'record_udhaar': {
      emit('ai-record-bill', {
        type: 'udhaar',
        customerId: action.customerId,
        customerName: action.customerName,
        items: action.items,
        total: action.total,
      });
      return true;
    }
    case 'record_payment': {
      emit('ai-record-payment', {
        customerId: action.customerId,
        customerName: action.customerName,
        amount: action.amount,
      });
      return true;
    }
    case 'record_purchase': {
      emit('ai-record-purchase', { ...action });
      return true;
    }

    // ── Inventory ──
    case 'add_product': { emit('ai-add-product', { ...action }); return true; }
    case 'edit_product': { emit('ai-edit-product', { ...action }); return true; }
    case 'delete_product': { emit('ai-delete-product', { ...action }); return true; }
    case 'update_stock': { emit('ai-update-stock', { ...action }); return true; }
    case 'bulk_import': { emit('ai-bulk-import', { ...action }); return true; }

    // ── Customers ──
    case 'add_customer': { emit('ai-add-customer', { ...action }); return true; }
    case 'edit_customer': { emit('ai-edit-customer', { ...action }); return true; }
    case 'delete_customer': { emit('ai-delete-customer', { ...action }); return true; }

    // ── Bills ──
    case 'delete_sale': { emit('ai-delete-sale', { ...action }); return true; }

    // ── Navigation (read-only actions ko bhi actionable banao) ──
    case 'show_report': { emit('ai-switch-tab', { tab: 'reports' as TabType }); return true; }
    case 'show_customer': { emit('ai-switch-tab', { tab: 'customers' as TabType }); return true; }
    case 'search_product': { emit('ai-switch-tab', { tab: 'inventory' as TabType }); return true; }
    case 'search_customer': { emit('ai-switch-tab', { tab: 'customers' as TabType }); return true; }

    // ── Baaki (clarify_*, suggestions, whatsapp): sirf text jawab kaafi —
    // clarify popup AISection khud handle karta hai, whatsapp bhi AISection mein.
    default: return false;
  }
}
