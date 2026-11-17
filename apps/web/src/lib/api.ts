export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')
    ? 'https://antek-factura-api.onrender.com'
    : 'https://antek-factura-api.onrender.com');

export async function apiFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const err: any = new Error(
      typeof data === 'object' && data?.message ? data.message : `HTTP Error ${res.status}`
    );
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return data as T;
}

export const ECF_TYPE_LABELS: Record<number, string> = {
  31: '31 - Factura de Crédito Fiscal Electrónica',
  32: '32 - Factura de Consumo Electrónica',
  33: '33 - Nota de Débito Electrónica',
  34: '34 - Nota de Crédito Electrónica',
  41: '41 - Comprobante de Compras Electrónico',
  43: '43 - Comprobante Gastos Menores Electrónico',
  44: '44 - Regímenes Especiales Electrónica',
  45: '45 - Gubernamental Electrónica',
  46: '46 - Comprobante Exportaciones Electrónico',
  47: '47 - Pagos al Exterior Electrónico',
};

export function formatDOP(val?: number | null): string {
  if (val === undefined || val === null) return 'RD$ 0.00';
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
  }).format(val);
}
