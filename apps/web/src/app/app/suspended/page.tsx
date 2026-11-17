'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Lock,
  AlertTriangle,
  CreditCard,
  FileSpreadsheet,
  Receipt,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Landmark,
  FileText,
  MessageCircle,
} from 'lucide-react';
import { apiFetch, formatDOP } from '../../../lib/api';

export default function SuspendedPage() {
  const [loadingPay, setLoadingPay] = useState(false);
  const [subData, setSubData] = useState<any>(null);
  const [checkoutOrder, setCheckoutOrder] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const data = await apiFetch<any>('/v1/billing/subscription');
      setSubData(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo consultar el estado de tu suscripción.');
    }
  };

  const handlePay = async () => {
    setLoadingPay(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch<any>('/v1/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({
          planCode: subData?.planCode || 'MEDIUM',
          billingCycle: 'MONTHLY',
          gateway: subData?.paymentSettings?.activeGateway || 'CARDNET',
        }),
      });
      setCheckoutOrder(res);
      await fetchSubscription();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error generando orden de pago.');
    } finally {
      setLoadingPay(false);
    }
  };

  const handleOpenReceipt = async (paymentId: string) => {
    try {
      const html = await apiFetch<string>(`/v1/billing/payments/${paymentId}/receipt`);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo abrir la factura.');
    }
  };

  const activeLink =
    checkoutOrder?.checkoutUrl ||
    subData?.pendingPayment?.checkoutUrl ||
    subData?.lastPaymentLinkUrl ||
    '';
  const hasExternalLink =
    Boolean(activeLink) &&
    activeLink.startsWith('http') &&
    !activeLink.includes('/app/settings/billing?order=');
  const bankAccounts =
    checkoutOrder?.paymentSettings?.bankAccounts || subData?.paymentSettings?.bankAccounts || [];
  const supportWhatsapp =
    checkoutOrder?.paymentSettings?.supportWhatsapp || subData?.paymentSettings?.supportWhatsapp || '';
  const activePaymentId = checkoutOrder?.paymentId || subData?.pendingPayment?.id;

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-3xl border-2 border-rose-300 shadow-2xl p-6 sm:p-10 space-y-6">
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
            El plazo reglamentario de <strong>5 días calendario de gracia</strong> venció sin registrarse el pago de tu suscripción. La emisión de nuevos comprobantes e-CF está temporalmente bloqueada hasta validar el pago.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <div className="text-[11px] text-sky-400 font-bold uppercase tracking-wider">
                Plan a Regularizar
              </div>
              <div className="text-lg font-black text-white">
                {subData?.plan?.name || 'Suscripción'} — {formatDOP(subData?.plan?.priceDop || 0)} / mes
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 self-start sm:self-auto">
              Cuota Vencida
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Regulariza tu cuenta pagando mediante el Link de Pago Seguro o transferencia bancaria. Una vez verificado el pago, la administración reactivará tu suscripción de inmediato.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {hasExternalLink ? (
              <a
                href={activeLink}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition"
              >
                <CreditCard className="w-4 h-4" />
                <span>Abrir Link de Pago Oficial</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <button
                type="button"
                disabled={loadingPay}
                onClick={handlePay}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>{loadingPay ? 'Generando Orden...' : 'Generar Orden / Link de Pago'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {activePaymentId && (
              <button
                type="button"
                onClick={() => handleOpenReceipt(activePaymentId)}
                className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Ver Factura</span>
              </button>
            )}

            <Link
              href="/app/settings/billing"
              className="text-xs text-slate-300 hover:text-white font-semibold underline"
            >
              Ir a Planes y Pagos
            </Link>
          </div>
        </div>

        {bankAccounts.length > 0 && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-sky-600" />
              <span>Cuentas Bancarias Oficiales para Transferencia</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {bankAccounts.map((acc: any, idx: number) => (
                <div key={idx} className="p-3 rounded-xl bg-white border border-slate-200">
                  <div className="font-bold text-slate-900">{acc.bankName}</div>
                  <div className="font-mono font-bold text-sky-700">{acc.accountNumber}</div>
                  <div className="text-[11px] text-slate-500">
                    {acc.accountType} · {acc.holderName}
                  </div>
                </div>
              ))}
            </div>
            {supportWhatsapp && (
              <a
                href={`https://wa.me/${supportWhatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-emerald-700 font-bold hover:underline pt-1"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Enviar comprobante por WhatsApp</span>
              </a>
            )}
          </div>
        )}

        <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200/90 text-amber-950 space-y-3">
          <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Garantía de Acceso Histórico · Ley 32-23 DGII</span>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            La suspensión nunca bloquea la consulta ni descarga de tus comprobantes históricos o Libros 606/607.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Link
              href="/app/invoices"
              className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 text-xs font-bold inline-flex items-center gap-1.5 transition"
            >
              <Receipt className="w-3.5 h-3.5 text-amber-700" />
              <span>Ver Facturas Emitidas</span>
            </Link>
            <Link
              href="/app/reports"
              className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 text-xs font-bold inline-flex items-center gap-1.5 transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Descargar Libro 606 &amp; 607</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
