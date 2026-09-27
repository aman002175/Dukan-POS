/**
 * productLookup.ts — Barcode se product naam/brand auto-fill (OpenFoodFacts).
 * Free, no API key, CORS-open (*), offline-safe (fail → null, manual entry).
 * NOTE: Price barcode/API se KABHI nahi aata (barcode mein sirf product number
 * hota hai) — sale/purchase rate dukandar haath se dalega.
 */

export interface ProductLookupResult {
  name: string;
  brand?: string;
  quantity?: string;
  image?: string;
  barcode: string;
}

/** Sirf digits rakho (spaces/dashes hatao) */
export function normalizeBarcode(raw: string): string {
  return (raw || '').replace(/\D/g, '');
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/[\s\-_]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * EAN/UPC barcode → OpenFoodFacts product.
 * @returns null jab: offline / nahi mila / invalid barcode
 */
export async function lookupBarcode(rawCode: string): Promise<ProductLookupResult | null> {
  const code = normalizeBarcode(rawCode);
  if (code.length < 8 || code.length > 14) return null;
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.status !== 1 || !data?.product) return null;
    const p = data.product;
    const rawName: string = p.product_name || p.product_name_en || '';
    if (!rawName.trim()) return null;
    const result: ProductLookupResult = {
      name: titleCase(rawName.trim()),
      barcode: code,
    };
    if (p.brands) result.brand = String(p.brands).split(',')[0].trim();
    if (p.quantity) result.quantity = String(p.quantity).trim();
    if (p.image_url) result.image = String(p.image_url);
    return result;
  } catch {
    return null; // offline ya network fail → manual entry
  }
}
