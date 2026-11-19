export type ExternalSaleOrigin = 'pos' | 'ubereats' | 'pedidosya';
export type ExternalSaleStatus = 'pendiente' | 'emitido' | 'error' | 'cancelado' | 'alerta_nota_credito';
export type PublicPaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto';
export type PublicSalesChannel = 'salon' | 'para_llevar' | 'kiosko';
export type ItbisRate = 0 | 16 | 18;

export interface PublicInvoiceBuyerInput {
  rnc?: string;
  nombre?: string;
}

export interface PublicInvoiceItemInput {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  itbis_tasa: ItbisRate;
  descuento?: number; // % (0-100) si precio_incluye_itbis=true, o monto si false
}

export interface PublicInvoiceCreateInput {
  external_id: string;
  tipo_ecf?: 31 | 32;
  precio_incluye_itbis?: boolean;
  comprador?: PublicInvoiceBuyerInput;
  items: PublicInvoiceItemInput[];
  forma_pago: PublicPaymentMethod;
  canal?: PublicSalesChannel;
  notas?: string;
}

export interface TaxInclusiveLineBreakdown {
  total_linea: number;
  base_linea: number;
  itbis_linea: number;
  precio_unitario_sin_itbis: number;
  recargoMonto: number;
  descuentoMonto: number;
  montoItem: number;
}

export interface PublicInvoiceResponse {
  id: string;
  external_id?: string;
  origen?: ExternalSaleOrigin;
  encf: string | null;
  estado: string;
  total: number;
  itbis_total: number;
  qr_url: string | null;
  pdf_url: string;
  fecha_emision: string;
}

export interface DeliveryMapperOptions {
  incluirEnvio?: boolean;
  incluirPropina?: boolean;
}
