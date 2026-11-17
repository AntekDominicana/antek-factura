'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { API_BASE_URL, apiFetch } from '../lib/api';

export interface TenantData {
  id?: string;
  rnc: string;
  razonSocial: string;
  nombreComercial?: string;
  actividadEconomica?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  isConfigured: boolean;
  logoBase64?: string;
  brandColor?: string;
  invoiceFooter?: string;
  fiscalProvider?: 'DGII_DIRECT' | 'GTI';
  dgiiLiveMode?: boolean;
  contingencyMode?: boolean;
  environment?: string;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  gracePeriodEndsAt?: string;
}

interface AppContextType {
  tenant: TenantData | null;
  loading: boolean;
  refreshTenant: () => Promise<void>;
  updateTenant: (updates: Partial<TenantData>) => Promise<void>;
}

const defaultTenant: TenantData = {
  rnc: '',
  razonSocial: '',
  isConfigured: false,
  brandColor: '#0284c7',
  invoiceFooter: 'Gracias por preferirnos — Comprobante Fiscal Electrónico emitido con ANTEK Factura',
  fiscalProvider: 'DGII_DIRECT',
  dgiiLiveMode: false,
  subscriptionPlan: 'business-pro',
  subscriptionStatus: 'ACTIVE',
};

const AppContext = createContext<AppContextType>({
  tenant: defaultTenant,
  loading: true,
  refreshTenant: async () => {},
  updateTenant: async () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<TenantData | null>(defaultTenant);
  const [loading, setLoading] = useState<boolean>(true);

  const hydrateFromLocalUser = () => {
    if (typeof window === 'undefined') return null;
    const cached = localStorage.getItem('antek_tenant_cache');
    if (cached) {
      try {
        return JSON.parse(cached) as TenantData;
      } catch {}
    }
    const rawUser = localStorage.getItem('antek_user');
    if (rawUser) {
      try {
        const u = JSON.parse(rawUser);
        if (u?.rnc || u?.tenantName) {
          return {
            ...defaultTenant,
            id: u.tenantId,
            rnc: u.rnc || '',
            razonSocial: u.tenantName || '',
            isConfigured: Boolean(u.rnc),
            subscriptionPlan: u.plan || 'pro',
          } as TenantData;
        }
      } catch {}
    }
    return null;
  };

  const refreshTenant = async () => {
    const localFallback = hydrateFromLocalUser();
    if (localFallback) {
      setTenant((prev) => ({ ...(prev || defaultTenant), ...localFallback }));
    }

    try {
      const data = await apiFetch('/v1/dgii/config');
      if (data?.tenant) {
        setTenant(data.tenant);
        if (typeof window !== 'undefined') {
          localStorage.setItem('antek_tenant_cache', JSON.stringify(data.tenant));
        }
      }
    } catch {
      if (localFallback) {
        setTenant(localFallback);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateTenant = async (updates: Partial<TenantData>) => {
    const next = { ...(tenant || defaultTenant), ...updates };
    setTenant(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('antek_tenant_cache', JSON.stringify(next));
    }
    try {
      const res = await apiFetch('/v1/tenant/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res?.tenant) {
        setTenant(res.tenant);
        if (typeof window !== 'undefined') {
          localStorage.setItem('antek_tenant_cache', JSON.stringify(res.tenant));
        }
      }
    } catch (err) {
      console.warn('Config updated locally, backend sync failed', err);
    }
  };

  useEffect(() => {
    refreshTenant();
  }, []);

  return (
    <AppContext.Provider value={{ tenant, loading, refreshTenant, updateTenant }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
