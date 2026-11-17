'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Lock,
  AlertTriangle,
  CreditCard,
  FileSpreadsheet,
  Receipt,
  Download,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { API_BASE_URL, apiFetch, formatDOP } from '../../../lib/api';
import { AntekLogo } from '../../../components/AntekLogo';

export default function SuspendedPage() {
  const router = useRouter();
  const [loadingPay, setLoadingPay] = useState(false);
  const [subData, setSubData] = useState<any>(null);
  const [checkoutModal, setCheckoutModal] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const data = await apiFetch<any>('/v1/billing/subscription');
      setSubData(data);
    } catch {
      // Fallback local
      setSubData({
        status: 'SUSPENDED',
        plan: { name: 'Plan Medio', priceDop: 2450 },
      });
    }
  };

  const handlePay = async () => {
    setLoadingPay(true);
    try {
      const res = await apiFetch<any>('/v1/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({
          planCode: subData?.planCode || 'MEDIUM',
          billingCycle: 'MONTHLY',
          gateway: 'MOCK',
        }),
      });

      if (res.checkoutUrl) {
        setCheckoutModal(res.checkoutUrl);
      }
    } catch (err: any) {
      alert(err.message || 'Error generando link de pago.');
    } finally {
      setLoadingPay(false);
    }
  };

  const handleConfirmReactivation = async () => {
    setLoadingPay(true);
    try {
      // Simular confirmación inmediata de pago para reactivar
      await apiFetch<any>('/v1/webhooks/payments', {
        method: 'POST',
        body: JSON.stringify({
          status: 'PAID',
          gateway: 'MOCK',
        }),
      });
      alert('¡Pago verificado por el servidor! Tu servicio ha sido reactivado.');
      router.push('/app/dashboard');
    } catch (err: any) {
      alert(err.message || 'Error reactivando.');
    } finally {
      setLoadingPay(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-3xl border-2 border-rose-300 shadow-2xl p-6 sm:p-10 space-y-8 animate-in fade-in duration-200">
        {/* Header de Bloqueo */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-8 h-8" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Emisión Fiscal Suspendida · HTTP 402</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Servicio Suspendido por Falta de Pago
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
            El plazo reglamentario de <strong>5 días calendario de gracia</strong> ha vencido sin registrarse el pago de tu suscripción. La emisión de nuevos comprobantes e-CF y timbrados DGII se encuentra temporalmente bloqueada.
          </p>
        </div>

        {/* Card de Reactivación con Link de Pago */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <div className="text-[11px] text-sky-400 font-bold uppercase tracking-wider">
                Plan a Regularizar
              </div>
              <div className="text-lg font-black text-white">
                {subData?.plan?.name || 'Plan Medio'} — {formatDOP(subData?.plan?.priceDop || 2450)} / mes
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 self-start sm:self-auto">
              Cuota Vencida
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Puedes reactivar tu cuenta en menos de 1 minuto mediante <strong>Link de Pago Seguro</strong> con tarjeta de débito o crédito nacional (CardNet / Azul) o internacional (Stripe).
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="button"
              disabled={loadingPay}
              onClick={handlePay}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" />
              <span>{loadingPay ? 'Generando...' : 'Generar Link de Pago y Reactivar'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <Link
              href="/app/settings/billing"
              className="text-xs text-slate-400 hover:text-white font-medium underline text-center"
            >
              Ir a Centro de Pagos
            </Link>
          </div>
        </div>

        {/* Compliance Legal DGII: Descarga de Comprobantes Históricos */}
        <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200/90 text-amber-950 space-y-3">
          <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Garantía de Acceso Histórico · Ley 32-23 DGII</span>
          </div>

          <p className="text-[11px] text-amber-800 leading-relaxed">
            Por normativa de la Dirección General de Impuestos Internos y de conformidad con nuestros términos legales, la suspensión <strong>nunca bloquea el acceso a tus comprobantes ya emitidos</strong>. Puedes consultar y descargar tus archivos XML firmados y Libros 606/607 en cualquier momento.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Link
              href="/app/invoices"
              className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs"
            >
              <Receipt className="w-3.5 h-3.5 text-amber-700" />
              <span>Ver Facturas Emitidas</span>
            </Link>

            <Link
              href="/app/reports"
              className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Descargar Excel Libro 606 & 607</span>
            </Link>
          </div>
        </div>

        {/* Modal Simulado de Checkout */}
        {checkoutModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900">Link de Pago Seguro Generado</h3>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                  256-bit TLS
                </span>
              </div>

              <p className="text-xs text-slate-500">
                Paga de forma inmediata para levantar la suspensión en el servidor:
              </p>

              <div className="p-3 bg-slate-50 rounded-xl font-mono text-[11px] text-slate-700 break-all border border-slate-200">
                {checkoutModal}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCheckoutModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReactivation}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simular Pago Exitoso (Reactivar)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
