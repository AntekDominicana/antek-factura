export interface GtiErrorDefinition {
  code: number;
  seccion: string;
  mensajeGti: string;
  mensajeHumano: string;
  remediation: string;
}

export const GTI_ERROR_CODES: Record<number, GtiErrorDefinition> = {
  100: {
    code: 100,
    seccion: 'Authz',
    mensajeGti: 'TOKEN Generado',
    mensajeHumano: 'Token de autenticación generado con éxito.',
    remediation: 'Ninguna acción requerida.',
  },
  101: {
    code: 101,
    seccion: 'Authz',
    mensajeGti: 'Error: El TOKEN no es válido',
    mensajeHumano: 'La sesión o token de autenticación ha expirado o no es válido.',
    remediation: 'Renovar el token de autenticación contra la API de GTI.',
  },
  102: {
    code: 102,
    seccion: 'Authz',
    mensajeGti: 'Error: Las CREDENCIALES no son válidas',
    mensajeHumano: 'Usuario o clave de GTI incorrectos.',
    remediation: 'Verifique las credenciales de GTI configuradas para la empresa.',
  },
  103: {
    code: 103,
    seccion: 'Authz',
    mensajeGti: 'Error: El TOKEN es requerido',
    mensajeHumano: 'Falta la cabecera Authorization con el Bearer Token.',
    remediation: 'Asegúrese de solicitar un token e incluirlo en la cabecera Authorization.',
  },
  105: {
    code: 105,
    seccion: 'Authz',
    mensajeGti: 'Error: El USUARIO es requerido',
    mensajeHumano: 'No se envió la cabecera Usuario para solicitar el token.',
    remediation: 'Configure el nombre de usuario de GTI en los ajustes del tenant.',
  },
  107: {
    code: 107,
    seccion: 'Authz',
    mensajeGti: 'Error: La CLAVE es requerida',
    mensajeHumano: 'No se envió la cabecera Clave para solicitar el token.',
    remediation: 'Configure la contraseña de GTI en los ajustes del tenant.',
  },
  120: {
    code: 120,
    seccion: 'Empresa',
    mensajeGti: 'Error: La empresa se encuentra inactiva',
    mensajeHumano: 'El emisor está inactivo en la plataforma fiscal.',
    remediation: 'Contacte al soporte de GTI o active la empresa en el panel fiscal.',
  },
  121: {
    code: 121,
    seccion: 'Certificado',
    mensajeGti: 'Error: La empresa no tiene un certificado configurado',
    mensajeHumano: 'La empresa no cuenta con un certificado digital .p12 activo cargado en GTI.',
    remediation: 'Suba el certificado digital .p12 con su clave correspondiente.',
  },
  122: {
    code: 122,
    seccion: 'Empresa',
    mensajeGti: 'Error: La EMPRESA no es válida',
    mensajeHumano: 'RNC o identificación de empresa no registrada o inválida.',
    remediation: 'Verifique que el RNC del emisor coincida con el registrado en GTI.',
  },
  124: {
    code: 124,
    seccion: 'Encabezado',
    mensajeGti: 'Error: El MEDIO EMISION es requerido',
    mensajeHumano: 'No se incluyó la cabecera de partner MedioEmision.',
    remediation: 'Verifique la configuración global de GTI_MEDIO_EMISION en el servidor.',
  },
  201: {
    code: 201,
    seccion: 'Saldo',
    mensajeGti: 'Error: La cantidad de documentos es insuficiente, por favor recargue la cuenta',
    mensajeHumano: 'Se ha agotado el balance de comprobantes contratados.',
    remediation: 'Adquiera un paquete adicional de comprobantes en su suscripción.',
  },
  202: {
    code: 202,
    seccion: 'Secuencia',
    mensajeGti: 'Error: El consecutivo (e-NCF) se encuentra vencido',
    mensajeHumano: 'El rango de secuencias autorizado por la DGII ha caducado.',
    remediation: 'Solicite un nuevo rango en DGII y regístrelo en la plataforma.',
  },
  203: {
    code: 203,
    seccion: 'Secuencia',
    mensajeGti: 'Error: El consecutivo (e-NCF) {0} no se encuentra configurado en el sistema',
    mensajeHumano: 'No hay secuencias autorizadas cargadas para este tipo de e-CF.',
    remediation: 'Configure el rango de secuencias autorizado para este tipo de comprobante.',
  },
  1000: {
    code: 1000,
    seccion: 'Esquema',
    mensajeGti: 'Error: El ESQUEMA no es válido',
    mensajeHumano: 'El JSON enviado no cumple con la estructura XML/JSON requerida por DGII.',
    remediation: 'Valide los tipos de datos y campos obligatorios del comprobante.',
  },
  1101: {
    code: 1101,
    seccion: 'IdDoc',
    mensajeGti: 'Sección: Ident. Documento, Error: Campo TipoeCF no válido',
    mensajeHumano: 'El tipo de comprobante e-CF especificado no es válido.',
    remediation: 'Use un tipo de e-CF soportado: 31, 32, 33, 34, 41, 43, 44, 45, 46, 47.',
  },
  1102: {
    code: 1102,
    seccion: 'IdDoc',
    mensajeGti: 'Sección: Ident. Documento, Error: Campo IndicadorMontoGravado es requerido',
    mensajeHumano: 'Debe indicar si los precios de los ítems incluyen ITBIS (1) o no (0).',
    remediation: 'Establezca IndicadorMontoGravado en 0 o 1 según sus precios.',
  },
  1103: {
    code: 1103,
    seccion: 'IdDoc',
    mensajeGti: 'Sección: Ident. Documento, Error: Campo IndicadorMontoGravado no es requerido',
    mensajeHumano: 'No se debe indicar IndicadorMontoGravado si no hay ítems gravados con ITBIS.',
    remediation: 'Omitir IndicadorMontoGravado en facturas completamente exentas.',
  },
  1104: {
    code: 1104,
    seccion: 'IdDoc',
    mensajeGti: 'Sección: Ident. Documento, Error: Campo FechaLimitePago solo es requerido para facturas con TipoPago 2 (Crédito)',
    mensajeHumano: 'La fecha límite de pago solo debe enviarse si la venta es a crédito.',
    remediation: 'Retire FechaLimitePago en ventas al contado.',
  },
  1105: {
    code: 1105,
    seccion: 'IdDoc',
    mensajeGti: 'Sección: Ident. Documento, Error: Valor del campo FechaLimitePago no válido, debe ser mayor a FechaEmision',
    mensajeHumano: 'La fecha de vencimiento del crédito debe ser posterior a la fecha de emisión.',
    remediation: 'Ajuste la FechaLimitePago para que sea mayor que la FechaEmision.',
  },
  1106: {
    code: 1106,
    seccion: 'IdDoc',
    mensajeGti: 'Sección: Ident. Documento, Error: Forma de pago 5 solo es permitida en TipoeCF 32',
    mensajeHumano: 'El pago con Bonos/Certificados de Regalo solo está permitido en Facturas de Consumo (32).',
    remediation: 'Cambie el tipo de e-CF a 32 o seleccione otra forma de pago.',
  },
  1301: {
    code: 1301,
    seccion: 'Receptor',
    mensajeGti: 'Sección: Receptor, Error: RNCComprador es un campo obligatorio para el tipo de documento {0}',
    mensajeHumano: 'El RNC del comprador es obligatorio para este tipo de comprobante (ej. e-CF 31 Crédito Fiscal).',
    remediation: 'Proporcione el RNC o Cédula válido del cliente receptor.',
  },
  1302: {
    code: 1302,
    seccion: 'Receptor',
    mensajeGti: 'Sección: Receptor, Error: RazonSocialComprador es obligatorio para el tipo de documento {0}',
    mensajeHumano: 'La razón social o nombre del comprador es obligatoria.',
    remediation: 'Indique el nombre o razón social oficial del comprador.',
  },
  1303: {
    code: 1303,
    seccion: 'Receptor',
    mensajeGti: 'Sección: Receptor, Error: RNCComprador obligatorio cuando TipoeCF es 32 y monto >= 250,000 DOP',
    mensajeHumano: 'Por norma DGII, facturas de consumo iguales o superiores a RD$250,000 exigen RNC/Cédula.',
    remediation: 'Ingrese el RNC o Cédula del comprador para montos mayores o iguales a RD$250,000.',
  },
  1304: {
    code: 1304,
    seccion: 'Receptor',
    mensajeGti: 'Sección: Receptor, Error: RazonSocialComprador obligatorio cuando TipoeCF es 32 y monto >= 250,000 DOP',
    mensajeHumano: 'Por norma DGII, facturas de consumo iguales o superiores a RD$250,000 exigen el Nombre/Razón Social.',
    remediation: 'Ingrese la Razón Social del comprador para montos mayores o iguales a RD$250,000.',
  },
  1305: {
    code: 1305,
    seccion: 'Receptor',
    mensajeGti: 'Sección: Receptor, Error: RNCComprador no debe existir si ya existe IdentificadorExtranjero o viceversa',
    mensajeHumano: 'No puede enviar simultáneamente RNCComprador e IdentificadorExtranjero.',
    remediation: 'Envíe únicamente uno de los dos campos identificadores.',
  },
  1306: {
    code: 1306,
    seccion: 'Receptor',
    mensajeGti: 'Sección: Receptor, Error: RNCComprador obligatorio cuando TipoeCF es 32, 33 o 34 y monto >= 250,000 DOP',
    mensajeHumano: 'Para comprobantes 32, 33 o 34 con monto >= RD$250,000, el RNCComprador es obligatorio.',
    remediation: 'Ingrese el RNC o Cédula del cliente.',
  },
  1307: {
    code: 1307,
    seccion: 'Receptor',
    mensajeGti: 'Sección: Receptor, Error: RazonSocialComprador obligatorio cuando TipoeCF es 32, 33 o 34 y monto >= 250,000 DOP',
    mensajeHumano: 'Para comprobantes 32, 33 o 34 con monto >= RD$250,000, la Razón Social es obligatoria.',
    remediation: 'Ingrese la Razón Social del cliente.',
  },
  1308: {
    code: 1308,
    seccion: 'Receptor',
    mensajeGti: 'Sección: Receptor, Error: RNCComprador o IdentificadorExtranjero obligatorio en Factura Exportación (46)',
    mensajeHumano: 'Las facturas de exportación (46) requieren RNCComprador o IdentificadorExtranjero, no ambos.',
    remediation: 'Especifique un IdentificadorExtranjero para el cliente de exportación.',
  },
  1404: {
    code: 1404,
    seccion: 'Totales',
    mensajeGti: 'Sección: Totales, Error: Campo MontoGravadoI1 no requerido, no existe línea con IndicadorFacturacion 1 (18%)',
    mensajeHumano: 'Se envió MontoGravadoI1 en totales pero ninguna línea de detalle tiene ITBIS 18%.',
    remediation: 'No incluya campos de impuestos en cero si no existen ítems gravados a esa tasa.',
  },
  1407: {
    code: 1407,
    seccion: 'Totales',
    mensajeGti: 'Sección: Totales, Error: Campo MontoGravadoI2 no requerido, no existe línea con IndicadorFacturacion 2 (16%)',
    mensajeHumano: 'Se envió MontoGravadoI2 en totales pero ninguna línea tiene ITBIS 16%.',
    remediation: 'Omitir MontoGravadoI2 e ITBIS2 si no hay productos al 16%.',
  },
  1410: {
    code: 1410,
    seccion: 'Totales',
    mensajeGti: 'Sección: Totales, Error: Campo MontoGravadoI3 no requerido, no existe línea con IndicadorFacturacion 3 (0%)',
    mensajeHumano: 'Se envió MontoGravadoI3 en totales pero ninguna línea tiene ITBIS 0%.',
    remediation: 'Omitir MontoGravadoI3 e ITBIS3 si no hay productos a tasa cero.',
  },
  1413: {
    code: 1413,
    seccion: 'Totales',
    mensajeGti: 'Sección: Totales, Error: Campo MontoExento no requerido, no existe línea con IndicadorFacturacion 4 (Exento)',
    mensajeHumano: 'Se envió MontoExento en totales pero no hay ítems marcados como exentos.',
    remediation: 'Omitir MontoExento en totales si todos los ítems están gravados.',
  },
  1450: {
    code: 1450,
    seccion: 'Totales',
    mensajeGti: 'Sección: Totales, Error: Valor del campo MontoTotal no válido (Sumatoria GravadoTotal + Exento + TotalITBIS + ImpuestosAdicionales)',
    mensajeHumano: 'El MontoTotal no coincide exactamente con la suma matemática de sus componentes.',
    remediation: 'Verifique los redondeos a 2 decimales en el cálculo de subtotales e impuestos.',
  },
  1504: {
    code: 1504,
    seccion: 'Referencia',
    mensajeGti: 'Sección: Información Referencia, Error: Para Notas de Débito y Crédito es requerida la Información de Referencia',
    mensajeHumano: 'Las Notas de Débito (33) y Crédito (34) deben hacer referencia obligatoria a un comprobante modificado.',
    remediation: 'Incluya el e-NCF original, la fecha del NCF modificado y el código de modificación.',
  },
  1507: {
    code: 1507,
    seccion: 'Referencia',
    mensajeGti: 'Sección: Información Referencia, Error: Indicador de Nota de Crédito incorrecto según tiempo transcurrido',
    mensajeHumano: 'El indicador de nota de crédito debe ser 0 si han pasado <= 30 días, o 1 si han pasado > 30 días.',
    remediation: 'Verifique la fecha del e-NCF modificado y asigne el indicador correcto.',
  },
  1804: {
    code: 1804,
    seccion: 'Detalle',
    mensajeGti: 'Sección: Detalles Items, Error: IndicadorFacturacion debe ser 4 (Exento) para e-CF 43, 44 y 47',
    mensajeHumano: 'Para comprobantes de Gastos Menores (43), Regímenes Especiales (44) y Pagos al Exterior (47), los ítems deben ser exentos (4).',
    remediation: 'Configure los ítems como exentos (IndicadorFacturacion = 4).',
  },
  1805: {
    code: 1805,
    seccion: 'Detalle',
    mensajeGti: 'Sección: Detalles Items, Error: IndicadorFacturacion debe ser 3 (Tasa cero) para e-CF 46 (Exportación)',
    mensajeHumano: 'En Facturas de Exportación (46), todos los bienes y servicios deben tener IndicadorFacturacion = 3 (Tasa 0%).',
    remediation: 'Cambie el IndicadorFacturacion de los ítems exportados a 3 (Tasa Cero).',
  },
  1806: {
    code: 1806,
    seccion: 'Detalle',
    mensajeGti: 'Sección: Detalles Items, Error: IndicadorBienoServicio debe ser 2 (Servicio) para e-CF 47 (Pagos al Exterior)',
    mensajeHumano: 'Los comprobantes de Pagos al Exterior (47) solo admiten servicios (IndicadorBienoServicio = 2).',
    remediation: 'Cambie el tipo de ítem a Servicio (2).',
  },
  1820: {
    code: 1820,
    seccion: 'Detalle',
    mensajeGti: 'Sección: Detalles Items, Error: Valor del campo NumeroLinea no cumple con la condición secuencial',
    mensajeHumano: 'Las líneas de detalle deben estar numeradas estrictamente en secuencia: 1, 2, 3, etc.',
    remediation: 'Numere las líneas de detalle secuencialmente desde 1.',
  },
};

export class FiscalValidationException extends Error {
  public readonly code: number;
  public readonly seccion: string;
  public readonly remediation: string;
  public readonly details?: any;

  constructor(code: number, customMessage?: string, details?: any) {
    const errorDef = GTI_ERROR_CODES[code];
    const message = customMessage || (errorDef ? errorDef.mensajeHumano : `Error fiscal código ${code}`);
    super(message);
    this.name = 'FiscalValidationException';
    this.code = code;
    this.seccion = errorDef?.seccion || 'General';
    this.remediation = errorDef?.remediation || 'Revise los parámetros fiscales del comprobante.';
    this.details = details;
    Object.setPrototypeOf(this, FiscalValidationException.prototype);
  }
}
