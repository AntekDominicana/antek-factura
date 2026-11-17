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
  theme = 'auto',
}: AntekLogoProps) {
  const sizeMap = {
    sm: { height: 28, emblemSize: 28, textClass: 'text-sm', subText: 'text-[8px]' },
    md: { height: 38, emblemSize: 36, textClass: 'text-base', subText: 'text-[9px]' },
    lg: { height: 48, emblemSize: 46, textClass: 'text-xl', subText: 'text-[10px]' },
    xl: { height: 62, emblemSize: 60, textClass: 'text-2xl', subText: 'text-xs' },
  };

  const { emblemSize, textClass, subText } = sizeMap[size];

  // Emblema geométrico 3D "A" poligonal idéntico al banner oficial de ANTEK
  const Emblem = (
    <svg
      width={emblemSize}
      height={emblemSize}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 drop-shadow-[0_0_16px_rgba(14,165,233,0.55)] transition-transform hover:scale-105 duration-200"
    >
      <defs>
        {/* Gradiente azul eléctrico del pilar superior */}
        <linearGradient id="antekPillarTop" x1="20" y1="90" x2="65" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0369a1" />
          <stop offset="45%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>

        {/* Gradiente de faceta 3D angular derecha */}
        <linearGradient id="antekFacetRight" x1="65" y1="20" x2="110" y2="95" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="40%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#0c4a6e" />
        </linearGradient>

        {/* Gradiente de prisma biselado inferior */}
        <linearGradient id="antekBaseTrapezoid" x1="45" y1="65" x2="105" y2="85" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00d8ff" />
          <stop offset="60%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>

        {/* Brillo de neón superior */}
        <linearGradient id="antekEdgeGlow" x1="65" y1="18" x2="18" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="30%" stopColor="#7dd3fc" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Sombra de apoyo en suelo */}
      <ellipse cx="60" cy="108" rx="46" ry="6" fill="#0284c7" fillOpacity="0.22" />

      {/* Pilar Primario Izquierdo (Brazo ascendente con corte limpio) */}
      <path
        d="M 64 22 L 20 98 L 42 98 L 64 56 L 86 98 L 108 98 L 64 22 Z"
        fill="url(#antekPillarTop)"
      />

      {/* Faceta 3D Lateral Derecha (Profundidad isométrica) */}
      <path
        d="M 64 22 L 86 98 L 110 98 L 64 22 Z"
        fill="url(#antekFacetRight)"
      />

      {/* Bloque geométrico inferior inclinado (Trapezoide estilo ANTEK) */}
      <path
        d="M 44 68 L 94 68 L 84 84 L 34 84 Z"
        fill="url(#antekBaseTrapezoid)"
      />

      {/* Borde biselado con resplandor (Neon Edge) */}
      <path
        d="M 64 22 L 20 98 L 24 98 L 64 26 L 104 98 L 108 98 L 64 22 Z"
        fill="url(#antekEdgeGlow)"
      />

      {/* Punto de luz en el vértice superior */}
      <circle cx="64" cy="24" r="3.5" fill="#ffffff" opacity="0.8" />
    </svg>
  );

  if (variant === 'mark') {
    return <div className={`inline-flex items-center ${className}`}>{Emblem}</div>;
  }

  const isDark = theme === 'dark';

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {Emblem}
      <div className="flex flex-col select-none leading-none">
        <div className="flex items-center gap-2">
          {/* Logo tipográfico ANTEK con chevron en la 'A' y barra cian en la 'E' */}
          <div className="flex items-center tracking-widest font-black font-sans">
            <span className={isDark ? 'text-white' : 'text-slate-900'}>
              ΛNT
            </span>
            {/* Letra E estilizada con barra central cian (#00d8ff) */}
            <span className="relative inline-flex items-center justify-center">
              <span className={isDark ? 'text-white' : 'text-slate-900'}>E</span>
              <span className="absolute left-[3px] right-[2px] top-[47%] h-[2.5px] bg-[#00d8ff] rounded-xs shadow-[0_0_6px_#00d8ff]" />
            </span>
            <span className={isDark ? 'text-white' : 'text-slate-900'}>
              K
            </span>
          </div>

          <span
            className={`font-black tracking-wider uppercase bg-gradient-to-r from-sky-400 via-sky-500 to-indigo-500 bg-clip-text text-transparent ${textClass}`}
          >
            FACTURA
          </span>
        </div>

        {/* Subtítulo oficial con antek.com.do */}
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`font-bold tracking-wider uppercase text-sky-500 ${subText}`}>
            e-CF DGII
          </span>
          <span className="text-slate-400 font-semibold">•</span>
          <span className={`font-semibold tracking-tight ${isDark ? 'text-slate-400' : 'text-slate-500'} ${subText}`}>
            antek.com.do
          </span>
        </div>
      </div>
    </div>
  );
}
