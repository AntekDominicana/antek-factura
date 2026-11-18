'use client';

import React from 'react';

interface AntekLogoProps {
  className?: string;
  variant?: 'full' | 'mark' | 'horizontal';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  theme?: 'dark' | 'light' | 'auto';
}

export function AntekLogo({
  className = '',
  variant = 'full',
  size = 'md',
  theme = 'dark',
}: AntekLogoProps) {
  const sizeMap = {
    sm: { height: 36, emblemSize: 30, horizontalWidth: 168, textClass: 'text-sm' },
    md: { height: 48, emblemSize: 38, horizontalWidth: 224, textClass: 'text-base' },
    lg: { height: 58, emblemSize: 48, horizontalWidth: 270, textClass: 'text-xl' },
    xl: { height: 72, emblemSize: 60, horizontalWidth: 330, textClass: 'text-2xl' },
  };

  const { height, emblemSize, horizontalWidth, textClass } = sizeMap[size];

  // 2. Icono independiente (A): para favicon, app, menú lateral y perfil
  if (variant === 'mark') {
    return (
      <div className={`inline-flex items-center shrink-0 ${className}`}>
        <img
          src="/brand/icon-a.png"
          alt="ANTEK"
          width={emblemSize}
          height={emblemSize}
          style={{ width: emblemSize, height: emblemSize }}
          className="shrink-0 rounded-lg object-contain"
        />
      </div>
    );
  }

  // 4. Logo para fondo blanco: facturas PDF, impresiones, reportes y página pública clara
  if (theme === 'light') {
    return (
      <div className={`inline-flex items-center gap-2.5 shrink-0 ${className}`}>
        <img
          src="/brand/logo-light.png"
          alt="ANTEK Factura"
          width={emblemSize}
          height={emblemSize}
          style={{ width: emblemSize, height: emblemSize }}
          className="shrink-0 object-contain rounded-lg"
        />
        <div className="flex flex-col select-none leading-none">
          <span className={`font-black tracking-wide text-slate-900 ${textClass}`}>
            ANTEK <span className="text-sky-600">FACTURA</span>
          </span>
          <span className="text-[9px] font-bold tracking-wider uppercase text-slate-500 mt-0.5">
            e-CF DGII · antek.com.do
          </span>
        </div>
      </div>
    );
  }

  // 1 & 3. Logo horizontal principal / fondo oscuro (OG Image): navbar, web, login, panel oscuro
  return (
    <div className={`inline-flex items-center shrink-0 ${className}`}>
      <img
        src="/brand/logo-dark.png"
        alt="ANTEK Factura"
        width={horizontalWidth}
        height={height}
        style={{ height, width: 'auto' }}
        className="shrink-0 object-contain"
      />
    </div>
  );
}
