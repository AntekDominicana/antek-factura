import axios, { AxiosInstance } from 'axios';
import {
  FiscalProviderInterface,
  FiscalEmissionResult,
  TenantFiscalCredentials,
  DomainInvoice,
  GtiTokenResponse,
  GtiRecepcionResponse,
  GtiConsultaEstadoResponse,
  GtiSecuenciaItem,
  GtiSecuenciaResponse,
  GtiPdfResponse,
} from '../types/fiscal.types';
import { FiscalValidator } from '../validators/fiscal-validator';
import { GtiMapper } from '../mappers/gti-mapper';
import { FiscalValidationException, GTI_ERROR_CODES } from '../constants/gti-error-codes';

export interface TokenCacheInterface {
  get(key: string): Promise<string | null>;
  set(key: string, token: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

export class InMemoryTokenCache implements TokenCacheInterface {
  private cache = new Map<string, { token: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.token;
  }

  async set(key: string, token: string, ttlSeconds: number): Promise<void> {
    this.cache.set(key, {
      token,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }
}

export class GtiAdapter implements FiscalProviderInterface {
  public readonly name = 'GTI';
  private httpClient: AxiosInstance;
  private tokenCache: TokenCacheInterface;

  constructor(tokenCache?: TokenCacheInterface) {
    this.tokenCache = tokenCache || new InMemoryTokenCache();
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private getBaseUrl(credentials: TenantFiscalCredentials): string {
    if (credentials.baseUrl) {
      return credentials.baseUrl.replace(/\/+$/, '');
    }
    return credentials.environment === 'PRODUCTION'
      ? 'https://facturadominicana.do/apicargafactura'
      : 'https://pruebas.facturadominicana.do/apicargafactura';
  }

  /**
   * Obtiene o renueva el Bearer Token con caché de 55 minutos (3300 segundos).
   */
  public async getAuthToken(credentials: TenantFiscalCredentials, forceRefresh = false): Promise<string> {
    const cacheKey = `gti_token:${credentials.environment}:${credentials.rnc}`;

    if (!forceRefresh) {
      const cachedToken = await this.tokenCache.get(cacheKey);
      if (cachedToken) {
        return cachedToken;
      }
    }

    if (!credentials.gtiUsuario || !credentials.gtiClave) {
      throw new FiscalValidationException(
        102,
        'Credenciales de GTI no configuradas para este emisor (falta usuario o clave).'
      );
    }

    const baseUrl = this.getBaseUrl(credentials);
    const url = `${baseUrl}/api/Authz/Token`;

    try {
      const response = await this.httpClient.post<GtiTokenResponse>(
        url,
        {},
        {
          headers: {
            Usuario: credentials.gtiUsuario,
            Clave: credentials.gtiClave,
          },
        }
      );

      if (response.data.codigoEstado === 200 && response.data.datos?.token) {
        const token = response.data.datos.token;
        // Cachear durante 55 minutos (TTL = 3300 s)
        await this.tokenCache.set(cacheKey, token, 3300);
        return token;
      }

      const errCode = response.data.respuesta?.[0]?.codigo || 102;
      const errMsg = response.data.respuesta?.[0]?.mensaje || 'No se pudo generar el token GTI';
      throw new FiscalValidationException(errCode, errMsg);
    } catch (error: any) {
      if (error instanceof FiscalValidationException) throw error;
      const statusCode = error.response?.status;
      const resData = error.response?.data;
      const code = resData?.respuesta?.[0]?.codigo || statusCode || 500;
      const msg = resData?.respuesta?.[0]?.mensaje || error.message || 'Error de conexión con GTI Authz';
      throw new FiscalValidationException(code, msg);
    }
  }

  /**
   * Emite un comprobante electrónico (e-CF) hacia la API de GTI.
   */
  public async emitInvoice(
    credentials: TenantFiscalCredentials,
    invoice: DomainInvoice,
    options?: { returnXml?: 0 | 1 }
  ): Promise<FiscalEmissionResult> {
    // 1. Validación previa exhaustiva según normas DGII
    FiscalValidator.validate(invoice);

    // 2. Mapeo al formato JSON exacto de GTI (con omisión de campos cero)
    const payload = GtiMapper.toGtiPayload(invoice);

    // 3. Obtener token con soporte de reintento automático si expira
    let token = await this.getAuthToken(credentials);
    const baseUrl = this.getBaseUrl(credentials);
    const url = `${baseUrl}/api/eCF/Recepcion`;

    const returnXmlInt: 0 | 1 = options?.returnXml !== undefined ? options.returnXml : 1;
    const medioEmision = credentials.medioEmision || process.env.GTI_MEDIO_EMISION || 'xy1fcYHxWxjJ10t3ZD5Hlg==';

    const makeRequest = async (authToken: string) => {
      return this.httpClient.post<GtiRecepcionResponse>(url, payload, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          MedioEmision: medioEmision,
          RetornarXml: returnXmlInt, // ENTERO: 0 o 1
        },
      });
    };

    let response;
    try {
      response = await makeRequest(token);
    } catch (err: any) {
      // Reintentar si el token expiró (HTTP 401 o código 101)
      if (err.response?.status === 401 || err.response?.data?.respuesta?.[0]?.codigo === 101) {
        token = await this.getAuthToken(credentials, true);
        response = await makeRequest(token);
      } else {
        const resData = err.response?.data;
        const errCode = resData?.respuesta?.[0]?.codigo || err.response?.status || 500;
        const errMsg = resData?.respuesta?.[0]?.mensaje || err.message;
        const errDetail = resData?.respuesta?.[0]?.detalle;
        throw new FiscalValidationException(errCode, `${errMsg}${errDetail ? ` (${errDetail})` : ''}`, resData);
      }
    }

    const data = response.data;

    if (data.codigoEstado === 200 && data.datos) {
      return {
        success: true,
        status: 'ACCEPTED',
        encf: data.datos.numeroFactura,
        externalDocId: data.datos.numeroFacturaInternaEmisor || invoice.externalDocId,
        externalDocumentId: data.datos.idDocumento,
        urlQr: data.datos.urlqr,
        codigoSeguridad: data.datos.CodigoSeguridad,
        fechaHoraFirma: data.datos.FechaHoraFirma,
        xmlSigned: data.datos.DocumentoXml,
        rawResponse: data,
      };
    }

    const errItem = data.respuesta?.[0];
    const code = errItem?.codigo ? String(errItem.codigo) : 'ERROR';
    const message = errItem?.mensaje || 'Error no especificado al emitir e-CF en GTI';

    return {
      success: false,
      status: 'REJECTED',
      encf: invoice.encf || '',
      errorCode: code,
      errorMessage: message,
      rawResponse: data,
    };
  }

  /**
   * Consulta el estado del e-CF ante la DGII.
   */
  public async checkStatus(
    credentials: TenantFiscalCredentials,
    encf: string
  ): Promise<GtiConsultaEstadoResponse> {
    let token = await this.getAuthToken(credentials);
    const baseUrl = this.getBaseUrl(credentials);
    const url = `${baseUrl}/api/ConsultaEcf/EstadoDgii`;

    const makeRequest = async (authToken: string) => {
      return this.httpClient.post<GtiConsultaEstadoResponse>(
        url,
        {},
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'e-NCF': encf,
          },
        }
      );
    };

    try {
      const response = await makeRequest(token);
      return response.data;
    } catch (err: any) {
      if (err.response?.status === 401) {
        token = await this.getAuthToken(credentials, true);
        const retryRes = await makeRequest(token);
        return retryRes.data;
      }
      throw err;
    }
  }

  /**
   * Configura las secuencias autorizadas en GTI.
   */
  public async configureSequences(
    credentials: TenantFiscalCredentials,
    sequences: GtiSecuenciaItem[]
  ): Promise<GtiSecuenciaResponse> {
    if (sequences.length > 10) {
      throw new FiscalValidationException(1901, 'El número máximo de secuencias por petición es de 10.');
    }

    let token = await this.getAuthToken(credentials);
    const baseUrl = this.getBaseUrl(credentials);
    const url = `${baseUrl}/api/Configuracion/Secuencia`;

    const body = {
      Rnc: credentials.rnc,
      Secuencias: sequences,
    };

    const response = await this.httpClient.post<GtiSecuenciaResponse>(url, body, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  }

  /**
   * Descarga el PDF oficial de la factura en los formatos disponibles (1..6).
   */
  public async downloadPdf(
    credentials: TenantFiscalCredentials,
    encf: string,
    templateFormat = 1
  ): Promise<Buffer> {
    let token = await this.getAuthToken(credentials);
    const baseUrl = this.getBaseUrl(credentials);
    const url = `${baseUrl}/api/Consulta/PDF`;

    const response = await this.httpClient.post<GtiPdfResponse>(
      url,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'e-NCF': encf,
          RNC: credentials.rnc,
          FormatoPlantilla: templateFormat,
        },
      }
    );

    if (response.data.codigoEstado === 200 && response.data.datos?.pdfFactura) {
      return Buffer.from(response.data.datos.pdfFactura, 'base64');
    }

    const err = response.data.respuesta?.[0]?.mensaje || 'No fue posible obtener el PDF';
    throw new Error(`Error descargando PDF: ${err}`);
  }
}
