'use client';

import React, { useEffect, useState } from 'react';
import { Download, Monitor, X, CheckCircle2 } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Verificar si ya corre en ventana independiente (standalone)
    const checkStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (checkStandalone) {
      setIsStandalone(true);
      return;
    }

    // Registrar Service Worker para soporte PWA y auto-actualizaciones
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          reg.update().catch(() => {});
          // Chequear actualizaciones del SW automáticamente
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('Nueva versión de ANTEK Factura disponible.');
                }
              };
            }
          };
        })
        .catch((err) => console.error('Error registrando Service Worker PWA:', err));
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Solo mostrar si no lo ha cerrado previamente en esta sesión
      const dismissed = sessionStorage.getItem('antek_pwa_dismissed');
      if (!dismissed) {
        setIsVisible(true);
      }
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Si el navegador no disparó el evento (ej. Safari en Mac o Chrome en menú), dar instrucción
      alert('Para instalar ANTEK Factura: Haz clic en el ícono de instalación (icono de computadora o flecha hacia abajo) en la barra de direcciones de tu navegador.');
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('antek_pwa_dismissed', 'true');
  };

  if (isStandalone || installed || !isVisible) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Instalación de aplicación de escritorio"
      className="fixed bottom-5 right-5 z-50 max-w-sm bg-slate-950/95 text-white p-4 rounded-2xl shadow-2xl border border-sky-500/30 backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-sky-600 to-blue-500 rounded-xl text-white shadow-md shadow-sky-500/20">
            <Monitor className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              Instalar en PC / Mac
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                PWA
              </span>
            </h4>
            <p className="text-xs text-slate-300 mt-0.5 leading-tight">
              Abre ANTEK Factura desde tu escritorio como una aplicación nativa sin barra de navegador.
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-white transition-colors p-1 -mr-1 -mt-1"
          aria-label="Cerrar notificación de instalación"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          Actualizaciones automáticas
        </span>
        <button
          onClick={handleInstallClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md hover:from-sky-400 hover:to-blue-500 active:scale-95 transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          Instalar ahora
        </button>
      </div>
    </div>
  );
}
