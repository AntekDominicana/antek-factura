export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://antek-factura-api.onrender.com';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('antek_token');
    if (stored) return stored;

    const cookieToken = readCookie('antek_client_token') || readCookie('access_token');
    if (cookieToken) {
      localStorage.setItem('antek_token', cookieToken);
      return cookieToken;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchSessionToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.accessToken) {
      try {
        localStorage.setItem('antek_token', data.accessToken);
      } catch {}
      return data.accessToken;
    }
  } catch {}
  return null;
}

export async function ensureAuthToken(): Promise<string | null> {
  const existing = getAuthToken();
  if (existing) return existing;
  return fetchSessionToken();
}

export async function apiFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
  const buildHeaders = (token: string | null): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options?.headers as Record<string, string>) || {}),
    };
    if (token && !headers['Authorization'] && !headers['authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  let token = await ensureAuthToken();
  let res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: buildHeaders(token),
  });

  if (res.status === 401 && typeof window !== 'undefined') {
    const freshToken = await fetchSessionToken();
    if (freshToken && freshToken !== token) {
      token = freshToken;
      res = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        credentials: 'include',
        headers: buildHeaders(token),
      });
    }
  }

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

export async function apiDownload(path: string, fallbackFilename: string): Promise<void> {
  let token = await ensureAuthToken();
  const makeHeaders = (t: string | null): Record<string, string> =>
    t ? { Authorization: `Bearer ${t}` } : {};

  let res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: makeHeaders(token),
  });

  if (res.status === 401 && typeof window !== 'undefined') {
    const freshToken = await fetchSessionToken();
    if (freshToken && freshToken !== token) {
      token = freshToken;
      res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'GET',
        credentials: 'include',
        headers: makeHeaders(token),
      });
    }
  }

  if (!res.ok) {
    let msg = `Error descargando archivo (${res.status})`;
    try {
      const errData = await res.json();
      if (errData?.message) msg = errData.message;
    } catch {}
    throw new Error(msg);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || fallbackFilename;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
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
