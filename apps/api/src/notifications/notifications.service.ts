import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly secretKey = process.env.SHARE_SIGNING_KEY || 'antek-share-whatsapp-secret-rd-2026';

  /**
   * Genera un enlace público firmado con validez de 72 horas para compartir por WhatsApp
   */
  generateWhatsAppShareUrl(invoice: {
    id: string;
    encf: string;
    rncEmisor: string;
    montoTotal: number | string;
    baseUrl?: string;
  }): { publicViewUrl: string; whatsAppShareUrl: string } {
    const expiresAt = Date.now() + 72 * 60 * 60 * 1000; // 72 horas
    const dataToSign = `${invoice.id}:${invoice.encf}:${expiresAt}`;
    const token = crypto.createHmac('sha256', this.secretKey).update(dataToSign).digest('hex');

    const origin = invoice.baseUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
    const publicViewUrl = `${origin}/invoice/view/${invoice.id}?encf=${invoice.encf}&exp=${expiresAt}&token=${token}`;

    const message = encodeURIComponent(
      `Hola, le compartimos su Factura Electrónica DGII (${invoice.encf}) emitida por RNC ${invoice.rncEmisor} por un monto de DOP $${Number(invoice.montoTotal).toLocaleString('es-DO', { minimumFractionDigits: 2 })}.\n\nPuede ver y descargar su comprobante fiscal en:\n${publicViewUrl}`
    );

    const whatsAppShareUrl = `https://api.whatsapp.com/send?text=${message}`;

    return {
      publicViewUrl,
      whatsAppShareUrl,
    };
  }

  /**
   * Notificación automática por correo electrónico al receptor de la factura
   */
  async sendInvoiceEmail(options: {
    to: string;
    recipientName: string;
    encf: string;
    rncEmisor: string;
    razonSocialEmisor: string;
    montoTotal: number;
    xmlSigned: string;
    pdfUrl?: string;
  }): Promise<{ sent: boolean; messageId: string }> {
    this.logger.log(
      `[Email Dispatch] Enviando factura ${options.encf} a ${options.to} (${options.recipientName}) con XML y PDF adjuntos.`
    );

    // Mock funcional de despacho SMTP / Resend / SendGrid
    return {
      sent: true,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };
  }
}
