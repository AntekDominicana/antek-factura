import React from 'react';
import Link from 'next/link';
import { AntekLogo } from './AntekLogo';
import { ShieldCheck, ExternalLink, Mail, Phone, MapPin } from 'lucide-react';

export function PublicFooter() {
  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-800 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand info */}
          <div className="space-y-3 md:col-span-1">
            <AntekLogo theme="dark" size="md" />
            <p className="text-slate-400 text-xs leading-relaxed">
              Plataforma líder en República Dominicana para facturación electrónica (e-CF), timbrado fiscal oficial y punto de venta para negocios de todos los tamaños.
            </p>
            <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Conforme a la Ley 32-23 de la DGII</span>
            </div>
          </div>

          {/* Producto */}
          <div>
            <h4 className="font-bold text-white uppercase text-[11px] tracking-wider mb-3">
              Producto
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/#caracteristicas" className="hover:text-sky-400 transition">
                  Facturación e-CF Oficial
                </Link>
              </li>
              <li>
                <Link href="/#pos" className="hover:text-sky-400 transition">
                  Punto de Venta (POS) Táctil
                </Link>
              </li>
              <li>
                <Link href="/#scanner" className="hover:text-sky-400 transition">
                  Escáner Móvil QR de Gastos (606)
                </Link>
              </li>
              <li>
                <Link href="/#planes" className="hover:text-sky-400 transition">
                  Planes de Precios
                </Link>
              </li>
            </ul>
          </div>

          {/* Desarrolladores & Legal */}
          <div>
            <h4 className="font-bold text-white uppercase text-[11px] tracking-wider mb-3">
              Desarrolladores & Legal
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/docs" className="hover:text-sky-400 transition">
                  Documentación del API
                </Link>
              </li>
              <li>
                <Link href="/docs#llms" className="hover:text-sky-400 transition">
                  Guía para Agentes de IA (llms-full.txt)
                </Link>
              </li>
              <li>
                <Link href="/legal/terminos" className="hover:text-sky-400 transition">
                  Términos y Condiciones del Servicio
                </Link>
              </li>
              <li>
                <Link href="/legal/privacidad" className="hover:text-sky-400 transition">
                  Política de Privacidad (Ley 172-13)
                </Link>
              </li>
            </ul>
          </div>

          {/* Contacto ANTEK */}
          <div>
            <h4 className="font-bold text-white uppercase text-[11px] tracking-wider mb-3">
              ANTEK Dominicana
            </h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://antek.com.do"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 hover:underline inline-flex items-center gap-1 font-semibold"
                >
                  antek.com.do <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span>contacto@antek.com.do</span>
              </li>
              <li className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>Santo Domingo, República Dominicana</span>
              </li>
              <li className="text-xs text-slate-400 pt-1">
                Cifrado y firma digital XMLDSig activa
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} ANTEK Dominicana. Todos los derechos reservados.</p>
          <p className="flex items-center gap-3">
            <span>Compatible con e-CF Ley 32-23 · <strong>antek</strong></span>
            <span>•</span>
            <span className="text-emerald-400">Cifrado y firma digital ✓</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
