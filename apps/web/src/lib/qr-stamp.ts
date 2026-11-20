'use client';

export interface QrStampMetadata {
  encf: string;
  tipoEcf?: number;
  rncEmisor?: string;
  razonSocialEmisor?: string;
  codigoSeguridad?: string | null;
  fechaEmision?: string | null;
  fechaFirma?: string | null;
  montoTotal?: number | null;
  rncComprador?: string | null;
  razonSocialComprador?: string | null;
  brandColor?: string;
}

function resolveSvgElement(target: HTMLElement | SVGSVGElement | null): SVGSVGElement | null {
  if (!target) return null;
  if (target instanceof SVGSVGElement) return target;
  return target.querySelector('svg');
}

function sanitizeFilenamePart(value: string): string {
  return (value || 'eCF').replace(/[^a-zA-Z0-9_-]/g, '');
}

function formatDateTimeDisplay(iso?: string | null): string {
  if (!iso) return 'Pendiente';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-DO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatAmountDop(amount?: number | null): string {
  if (amount === undefined || amount === null || Number.isNaN(Number(amount))) return '';
  return `RD$ ${Number(amount).toLocaleString('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function svgToImage(svgEl: SVGSVGElement, size: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(size));
    clone.setAttribute('height', String(size));

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

function triggerCanvasDownload(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No se pudo generar la imagen PNG'));
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        resolve();
      },
      'image/png',
      1.0,
    );
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 3 && ctx.measureText(`${trimmed}...`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}...`;
}

/**
 * Descarga únicamente el código QR escaneable en formato PNG de alta resolución (sin branding de terceros).
 */
export async function downloadRawQrPng(
  target: HTMLElement | SVGSVGElement | null,
  encf: string,
): Promise<void> {
  const svgEl = resolveSvgElement(target);
  if (!svgEl) {
    throw new Error('No se encontró el código QR para exportar.');
  }

  const size = 640;
  const padding = 48;
  const qrSize = size - padding * 2;
  const img = await svgToImage(svgEl, qrSize);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Contexto gráfico 2D no disponible.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, padding, padding, qrSize, qrSize);

  const safeEncf = sanitizeFilenamePart(encf);
  await triggerCanvasDownload(canvas, `QR_${safeEncf}.png`);
}

/**
 * Descarga el Timbre Fiscal Digital completo (.png) con QR, e-NCF, RNC emisor,
 * Código de Seguridad y Fecha/Hora de Firma Digital, 100% marca blanca (sin logo de ANTEK).
 */
export async function downloadSignedQrStampPng(
  target: HTMLElement | SVGSVGElement | null,
  meta: QrStampMetadata,
): Promise<void> {
  const svgEl = resolveSvgElement(target);
  if (!svgEl) {
    throw new Error('No se encontró el código QR para exportar el timbre fiscal.');
  }

  const width = 1040;
  const height = 460;
  const accent = meta.brandColor || '#0f172a';
  const qrSize = 264;
  const qrImg = await svgToImage(svgEl, qrSize);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Contexto gráfico 2D no disponible.');

  // Fondo blanco puro y borde exterior limpio
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  drawRoundedRect(ctx, 12, 12, width - 24, height - 24, 18);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#cbd5e1';
  ctx.stroke();

  // Franja superior con color de marca del emisor (marca blanca, sin ANTEK)
  ctx.save();
  drawRoundedRect(ctx, 12, 12, width - 24, 62, 18);
  ctx.clip();
  ctx.fillStyle = accent;
  ctx.fillRect(12, 12, width - 24, 62);
  ctx.restore();
  // Rectificar esquinas inferiores de la franja superior
  ctx.fillStyle = accent;
  ctx.fillRect(12, 54, width - 24, 20);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
  ctx.fillText('REPRESENTACIÓN GRÁFICA DE TIMBRE FISCAL ELECTRÓNICO (e-CF)', 38, 45);

  ctx.font = '600 13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#e2e8f0';
  const docTag = meta.tipoEcf ? `e-CF Tipo ${meta.tipoEcf} · DGII Ley 32-23` : 'DGII Ley 32-23';
  const tagWidth = ctx.measureText(docTag).width;
  ctx.fillText(docTag, width - 38 - tagWidth, 45);

  // Recuadro del código QR (izquierda)
  const qrBoxX = 38;
  const qrBoxY = 98;
  const qrBoxSize = 296;
  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 14);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#cbd5e1';
  ctx.stroke();

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qrImg, qrBoxX + 16, qrBoxY + 16, qrSize, qrSize);
  ctx.imageSmoothingEnabled = true;

  // Panel de datos de firma digital (derecha)
  const colX = 368;
  const maxTextW = width - colX - 42;

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.fillText('EMISOR AUTORIZADO', colX, 114);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 21px "Segoe UI", Arial, sans-serif';
  ctx.fillText(
    truncateText(ctx, (meta.razonSocialEmisor || 'Contribuyente Emisor').toUpperCase(), maxTextW),
    colX,
    140,
  );

  ctx.fillStyle = '#334155';
  ctx.font = '600 15px Consolas, "Courier New", monospace';
  ctx.fillText(`RNC Emisor: ${meta.rncEmisor || 'No especificado'}`, colX, 165);

  // Caja destacada e-NCF y Código de Seguridad
  drawRoundedRect(ctx, colX, 184, maxTextW, 88, 12);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#e2e8f0';
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.fillText('COMPROBANTE FISCAL (e-NCF)', colX + 18, 208);
  ctx.fillText('CÓDIGO DE SEGURIDAD', colX + 350, 208);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px Consolas, "Courier New", monospace';
  ctx.fillText(meta.encf || 'N/A', colX + 18, 244);

  ctx.fillStyle = accent === '#0f172a' ? '#0284c7' : accent;
  ctx.font = 'bold 28px Consolas, "Courier New", monospace';
  ctx.fillText(meta.codigoSeguridad || 'PENDIENTE', colX + 350, 245);

  // Fechas y monto
  const yRow1 = 304;
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.fillText('FECHA Y HORA DE FIRMA DIGITAL', colX, yRow1);
  ctx.fillText('FECHA DE EMISIÓN', colX + 350, yRow1);

  ctx.fillStyle = '#0f172a';
  ctx.font = '600 15px "Segoe UI", Arial, sans-serif';
  ctx.fillText(formatDateTimeDisplay(meta.fechaFirma || meta.fechaEmision), colX, yRow1 + 22);
  ctx.fillText(formatDateTimeDisplay(meta.fechaEmision), colX + 350, yRow1 + 22);

  const yRow2 = 358;
  const amountStr = formatAmountDop(meta.montoTotal);
  if (amountStr) {
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    ctx.fillText('MONTO TOTAL FACTURADO', colX, yRow2);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
    ctx.fillText(amountStr, colX, yRow2 + 23);
  }

  if (meta.rncComprador || meta.razonSocialComprador) {
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    ctx.fillText('RECEPTOR / COMPRADOR', colX + 350, yRow2);

    ctx.fillStyle = '#334155';
    ctx.font = '600 14px "Segoe UI", Arial, sans-serif';
    const buyerText = [meta.rncComprador ? `RNC ${meta.rncComprador}` : '', meta.razonSocialComprador || '']
      .filter(Boolean)
      .join(' · ');
    ctx.fillText(truncateText(ctx, buyerText, 270), colX + 350, yRow2 + 23);
  }

  // Pie de página oficial (cero branding de terceros)
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(38, 412);
  ctx.lineTo(width - 38, 412);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '500 12px "Segoe UI", Arial, sans-serif';
  ctx.fillText(
    'Firma Digital XMLDSig SHA-256 (.p12) · Escanea el código QR para validar autenticidad en el portal oficial de la DGII.',
    38,
    434,
  );

  const safeEncf = sanitizeFilenamePart(meta.encf);
  await triggerCanvasDownload(canvas, `QR_Firma_${safeEncf}.png`);
}
