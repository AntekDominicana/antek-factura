export enum EcfType {
  CREDITO_FISCAL = 31,
  CONSUMO = 32,
  NOTA_DEBITO = 33,
  NOTA_CREDITO = 34,
  COMPRAS = 41,
  GASTOS_MENORES = 43,
  REGIMENES_ESPECIALES = 44,
  GUBERNAMENTAL = 45,
  EXPORTACION = 46,
  PAGOS_AL_EXTERIOR = 47,
}

export enum IndicadorFacturacion {
  NO_FACTURABLE = 0,
  ITBIS_18 = 1,
  ITBIS_16 = 2,
  ITBIS_0 = 3,
  EXENTO = 4,
}

export enum IndicadorBienServicio {
  BIEN = 1,
  SERVICIO = 2,
}

export enum IndicadorMontoGravado {
  SIN_ITBIS_INCLUIDO = 0,
  CON_ITBIS_INCLUIDO = 1,
}

export enum TipoPago {
  CONTADO = 1,
  CREDITO = 2,
  GRATUITO = 3,
}

export enum FormaPago {
  EFECTIVO = 1,
  CHEQUE_TRANSFERENCIA_DEPOSITO = 2,
  TARJETA_DEBITO_CREDITO = 3,
  VENTA_A_CREDITO = 4,
  BONOS_CERTIFICADOS_REGALO = 5,
  PERMUTA = 6,
  NOTA_CREDITO = 7,
  OTRAS = 8,
}

export enum CodigoModificacion {
  ANULA = 1,
  CORRIGE_TEXTO = 2,
  CORRIGE_MONTOS = 3,
  REEMPLAZO_NCF_CONTINGENCIA = 4,
  REFERENCIA_FACTURA_CONSUMO = 5,
}

export enum IndicadorNotaCredito {
  MENOR_IGUAL_30_DIAS = 0,
  MAYOR_30_DIAS = 1,
}

export interface DomainInvoiceItem {
  numeroLinea: number;
  indicadorFacturacion: IndicadorFacturacion;
  indicadorBienServicio: IndicadorBienServicio;
  nombreItem: string;
  descripcionItem?: string;
  cantidadItem: number;
  precioUnitarioItem: number;
  unidadMedida?: number; // default 43: Unidad
  descuentoMonto?: number;
  recargoMonto?: number;
  montoItem?: number; // Calculado
  montoItbisRetenido?: number;
  montoIsrRetenido?: number;
  indicadorAgenteRetencion?: number; // 1: R, 2: P
  codigoItem?: string;
  tipoCodigo?: string;
  // Moneda alternativa
  precioOtraMoneda?: number;
  montoItemOtraMoneda?: number;
}

export interface DomainReference {
  numeroLinea?: number;
  ncfModificado: string;
  fechaNcfModificado: Date | string; // dd-MM-yyyy o ISO
  codigoModificacion: CodigoModificacion;
  razonModificacion?: string;
  indicadorNotaCredito?: IndicadorNotaCredito;
}

export interface DomainOtraMoneda {
  tipoMoneda: string; // e.g. "USD", "EUR"
  tipoCambio: number; // e.g. 60.25
}

export interface DomainEmisor {
  rnc: string;
  razonSocial?: string;
  nombreComercial?: string;
  sucursal?: string;
  direccion?: string;
  municipio?: string;
  provincia?: string;
  telefono?: string;
  correo?: string;
  actividadEconomica?: string;
  numeroSucursal?: number;
  emisorPorDefecto?: boolean;
}

export interface DomainComprador {
  rncComprador?: string;
  identificadorExtranjero?: string;
  razonSocialComprador?: string;
  contactoComprador?: string;
  correoComprador?: string;
  direccionComprador?: string;
  municipioComprador?: string;
  provinciaComprador?: string;
  paisComprador?: string;
}

export interface DomainInvoice {
  tipoEcf: EcfType;
  encf?: string; // Opcional si GTI autogenera
  externalDocId?: string; // NumeroFacturaInternaEmisor (referencia interna del cliente)
  indicadorMontoGravado?: IndicadorMontoGravado;
  tipoIngresos?: string; // "01", "02", etc.
  tipoPago?: TipoPago;
  fechaEmision?: Date | string;
  fechaVencimientoSecuencia?: Date | string;
  fechaLimitePago?: Date | string;
  terminoPago?: string;
  formaPago?: FormaPago;
  montoPago?: number;

  emisor?: DomainEmisor;
  comprador?: DomainComprador;
  items: DomainInvoiceItem[];
  references?: DomainReference[];
  otraMoneda?: DomainOtraMoneda;

  // Totales (opcional si se calculan con TaxCalculator)
  totalesCalculados?: {
    montoGravadoTotal?: number;
    montoGravadoI1?: number;
    montoGravadoI2?: number;
    montoGravadoI3?: number;
    itbis1?: number;
    itbis2?: number;
    itbis3?: number;
    totalItbis?: number;
    totalItbis1?: number;
    totalItbis2?: number;
    totalItbis3?: number;
    montoExento?: number;
    montoNoFacturable?: number;
    montoImpuestoAdicional?: number;
    totalItbisRetenido?: number;
    totalIsrRetencion?: number;
    montoTotal: number;
    // Otra Moneda
    montoGravadoTotalOtraMoneda?: number;
    montoGravado1OtraMoneda?: number;
    montoGravado2OtraMoneda?: number;
    montoGravado3OtraMoneda?: number;
    montoExentoOtraMoneda?: number;
    totalItbisOtraMoneda?: number;
    totalItbis1OtraMoneda?: number;
    totalItbis2OtraMoneda?: number;
    totalItbis3OtraMoneda?: number;
    montoTotalOtraMoneda?: number;
  };
}

// ==========================================
// ESTRUCTURA EXACTA GTI API
// ==========================================
export interface GtiIdDoc {
  TipoeCF: number;
  eNCF?: string;
  FechaVencimientoSecuencia?: string;
  IndicadorEnvioDiferido?: number;
  IndicadorMontoGravado?: number;
  TipoIngresos?: string;
  TipoPago?: number;
  FechaLimitePago?: string;
  TerminoPago?: string;
  TablaFormasPago?: Array<{
    FormaPago: number;
    MontoPago: number;
  }>;
}

export interface GtiEmisor {
  RNCEmisor?: string;
  RazonSocialEmisor?: string;
  NombreComercial?: string;
  Sucursal?: string;
  DireccionEmisor?: string;
  Municipio?: string;
  Provincia?: string;
  FechaEmision: string; // dd-MM-yyyy
  EmisorPorDefecto?: boolean;
  NumeroSucursal?: number;
  NumeroFacturaInterna?: string;
}

export interface GtiComprador {
  RNCComprador?: string;
  IdentificadorExtranjero?: string;
  RazonSocialComprador?: string;
  ContactoComprador?: string;
  CorreoComprador?: string;
  DireccionComprador?: string;
  MunicipioComprador?: string;
  ProvinciaComprador?: string;
  PaisComprador?: string;
}

export interface GtiTotales {
  MontoGravadoTotal?: number;
  MontoGravadoI1?: number;
  MontoGravadoI2?: number;
  MontoGravadoI3?: number;
  MontoExento?: number;
  ITBIS1?: number;
  ITBIS2?: number;
  ITBIS3?: number;
  TotalITBIS?: number;
  TotalITBIS1?: number;
  TotalITBIS2?: number;
  TotalITBIS3?: number;
  MontoImpuestoAdicional?: number;
  MontoNoFacturable?: number;
  TotalITBISRetenido?: number;
  TotalISRRetencion?: number;
  MontoTotal: number;
}

export interface GtiTotalesOtraMoneda {
  TipoMoneda: string;
  TipoCambio: number;
  MontoGravadoTotalOtraMoneda?: number;
  MontoGravado1OtraMoneda?: number;
  MontoGravado2OtraMoneda?: number;
  MontoGravado3OtraMoneda?: number;
  MontoExentoOtraMoneda?: number;
  TotalITBISOtraMoneda?: number;
  TotalITBIS1OtraMoneda?: number;
  TotalITBIS2OtraMoneda?: number;
  TotalITBIS3OtraMoneda?: number;
  MontoTotalOtraMoneda: number;
}

export interface GtiDetalleItem {
  NumeroLinea: number;
  TablaCodigosItem?: Array<{
    TipoCodigo: string;
    CodigoItem: string;
  }>;
  IndicadorFacturacion: number;
  NombreItem: string;
  IndicadorBienoServicio: number;
  DescripcionItem?: string;
  CantidadItem: number;
  UnidadMedida?: number;
  PrecioUnitarioItem: number;
  DescuentoMonto?: number;
  TablaSubDescuento?: Array<{
    TipoSubDescuento: string;
    SubDescuentoPorcentaje?: number;
    MontoSubDescuento: number;
  }>;
  MontoItem: number;
  Retencion?: {
    IndicadorAgenteRetencionoPercepcion: number;
    MontoITBISRetenido?: number;
    MontoISRRetenido?: number;
  };
  OtraMonedaDetalle?: {
    PrecioOtraMoneda: number;
    MontoItemOtraMoneda: number;
  };
}

export interface GtiInformacionReferencia {
  NCFModificado: string;
  FechaNCFModificado: string;
  CodigoModificacion: number;
  RazonModificacion?: string;
}

export interface GtiInvoicePayload {
  Encabezado: {
    IdDoc: GtiIdDoc;
    Emisor: GtiEmisor;
    Comprador?: GtiComprador;
    Totales: GtiTotales;
    TotalesOtraMoneda?: GtiTotalesOtraMoneda;
  };
  DetallesItems: GtiDetalleItem[];
  InformacionReferencia?: GtiInformacionReferencia;
}

// ==========================================
// RESPUESTAS Y CONTRATOS GTI
// ==========================================
export interface GtiTokenResponse {
  codigoEstado: number;
  estado: boolean;
  fecha: string;
  datos: {
    token: string;
    fechaExpiracion: string;
  };
  respuesta: Array<{
    codigo: number;
    mensaje: string;
  }>;
}

export interface GtiRecepcionResponse {
  codigoEstado: number;
  estado: boolean;
  fecha: string;
  datos?: {
    idDocumento: number;
    numeroFactura: string;
    numeroFacturaInternaEmisor?: string;
    urlqr: string;
    CodigoSeguridad: string;
    FechaHoraFirma: string;
    DocumentoXml?: string;
  };
  respuesta?: Array<{
    codigo: number;
    mensaje: string;
    detalle?: string;
  }>;
}

export interface GtiConsultaEstadoResponse {
  codigoEstado: number;
  estado: boolean;
  fecha: string;
  datos?: {
    eNCF: string;
    codigo: number;
    estado: string; // "Aceptado", "Rechazado", etc.
    RespuestaDGII?: {
      Codigo?: number;
      Valor?: string;
    };
  };
  respuesta?: Array<{
    codigo: number;
    mensaje: string;
  }>;
}

export interface GtiSecuenciaItem {
  IdTipoDocumento: string | number;
  IdRangoSecuencia: number;
  UltimoConsecutivo: number;
  CantidadAutorizado: number;
  ConsecutivoDesde: number;
  ConsecutivoHasta: number;
  Vencimiento?: string; // dd-MM-yyyy (no requerido para 32 y 34)
}

export interface GtiSecuenciaPayload {
  Rnc: string;
  Secuencias: GtiSecuenciaItem[];
}

export interface GtiSecuenciaResponse {
  codigoEstado: number;
  estado: boolean;
  fecha: string;
  datos?: {
    rnc: string;
  };
  respuesta?: Array<{
    codigo: number;
    mensaje: string;
  }>;
}

export interface GtiPdfResponse {
  codigoEstado: number;
  estado: boolean;
  fecha: string;
  datos?: {
    rnc: string;
    eNCF: string;
    pdfFactura: string; // base64
  };
  respuesta?: Array<{
    codigo: number;
    mensaje: string;
  }>;
}

export interface TenantFiscalCredentials {
  rnc: string;
  gtiUsuario?: string;
  gtiClave?: string;
  medioEmision?: string; // Partner header hash
  baseUrl?: string;
  environment: 'SANDBOX' | 'PRODUCTION';
}

export interface FiscalEmissionResult {
  success: boolean;
  status: 'ACCEPTED' | 'REJECTED' | 'CONDITIONAL' | 'ERROR';
  encf: string;
  externalDocId?: string;
  externalDocumentId?: number | string;
  urlQr?: string;
  codigoSeguridad?: string;
  fechaHoraFirma?: string;
  xmlSigned?: string;
  errorCode?: string;
  errorMessage?: string;
  rawResponse?: any;
}

export interface FiscalProviderInterface {
  name: string;
  emitInvoice(
    credentials: TenantFiscalCredentials,
    invoice: DomainInvoice,
    options?: { returnXml?: 0 | 1 }
  ): Promise<FiscalEmissionResult>;

  checkStatus(
    credentials: TenantFiscalCredentials,
    encf: string
  ): Promise<GtiConsultaEstadoResponse>;

  configureSequences(
    credentials: TenantFiscalCredentials,
    sequences: GtiSecuenciaItem[]
  ): Promise<GtiSecuenciaResponse>;

  downloadPdf(
    credentials: TenantFiscalCredentials,
    encf: string,
    templateFormat?: number
  ): Promise<Buffer>;
}
