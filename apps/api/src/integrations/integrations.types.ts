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
  descuento?: number;
}

export interface PublicInvoiceCreateInput {
  external_id: string;
  tipo_ecf?: 31 | 32;
  comprador?: PublicInvoiceBuyerInput;
  items: PublicInvoiceItemInput[];
  forma_pago: PublicPaymentMethod;
  canal?: PublicSalesChannel;
  notas?: string;
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
