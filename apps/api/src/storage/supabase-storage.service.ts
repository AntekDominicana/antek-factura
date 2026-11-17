import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private supabase: SupabaseClient | null = null;
  private readonly bucketName: string;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'ecf-documents';

    if (supabaseUrl && serviceRoleKey) {
      this.supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      this.ensureBucketExists().catch((err) => {
        this.logger.warn(`No se pudo verificar el bucket de Supabase: ${err.message}`);
      });
    } else {
      this.logger.warn('Credenciales de Supabase no configuradas; fallback local activo.');
    }
  }

  private async ensureBucketExists() {
    if (!this.supabase) return;
    try {
      const { data: buckets } = await this.supabase.storage.listBuckets();
      const exists = buckets?.some((b) => b.name === this.bucketName);
      if (!exists) {
        await this.supabase.storage.createBucket(this.bucketName, {
          public: false, // Bucket privado para documentos fiscales e-CF confidenciales
        });
        this.logger.log(`Bucket privado '${this.bucketName}' creado exitosamente en Supabase.`);
      }
    } catch (err: any) {
      this.logger.debug(`Verificación de bucket Supabase: ${err.message}`);
    }
  }

  /**
   * Sube un documento fiscal (XML o PDF) al bucket privado de Supabase
   */
  async uploadDocument(
    filePath: string,
    content: Buffer | string,
    contentType: 'application/xml' | 'application/pdf' | string
  ): Promise<{ success: boolean; storageKey: string }> {
    if (!this.supabase) {
      return { success: true, storageKey: `local://${filePath}` };
    }

    const fileBuffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
    const cleanPath = filePath.replace(/^\/+/, '');

    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(cleanPath, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      this.logger.error(`Error subiendo documento a Supabase Storage: ${error.message}`);
      return { success: false, storageKey: `local://${filePath}` };
    }

    this.logger.log(`Documento '${cleanPath}' subido exitosamente a Supabase Storage.`);
    return { success: true, storageKey: `supabase://${this.bucketName}/${cleanPath}` };
  }

  /**
   * Genera un Signed URL con expiración de 72 horas para descargar el comprobante e-CF
   */
  async getSignedUrl(filePath: string, expiresInSeconds = 72 * 3600): Promise<string> {
    if (!this.supabase) {
      return `/v1/invoices/${filePath}/download`;
    }

    const cleanPath = filePath.replace(/^supabase:\/\/[^/]+\//, '').replace(/^\/+/, '');
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(cleanPath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      return `/v1/invoices/${cleanPath}/download`;
    }

    return data.signedUrl;
  }
}
