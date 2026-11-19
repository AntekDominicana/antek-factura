import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as dotenv from 'dotenv';
import { AppModule } from './app.module';

dotenv.config();

const logger = new Logger('ServerSecurity');

@Catch()
class HardenedExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    // Si es una excepción HTTP controlada (ej. 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      // Si es un error 500+, ocultar detalles técnicos del servidor
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        logger.error(`Error 500 en ${request.method} ${request.url}:`, (exception as any).stack || exception);
        response.status(status).json({
          statusCode: status,
          error: 'Internal Server Error',
          message: 'Ocurrió un error interno en el servidor. El evento ha sido registrado para su análisis.',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      response.status(status).json(
        typeof body === 'object' ? body : { statusCode: status, message: body }
      );
      return;
    }

    // Para cualquier otro error no capturado (ej. base de datos, sintaxis, memoria)
    logger.error(`Fallo no controlado en ${request.method} ${request.url}:`, (exception as any).stack || exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Ocurrió un error interno en el servidor. Los detalles técnicos no se exponen al cliente.',
      timestamp: new Date().toISOString(),
    });
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Ocultar cabecera X-Powered-By de Express y habilitar límites seguros de payload
  app.disable('x-powered-by');
  app.useBodyParser('text', { type: ['application/xml', 'text/xml'], limit: '20mb' });
  app.useBodyParser('json', {
    limit: '35mb',
    verify: (req: any, _res: any, buf: Buffer) => {
      req.rawBody = buf;
    },
  });

  // Forzar HTTPS en producción y cabeceras de Hardening
  app.use((req: any, res: any, next: any) => {
    // Redirección HTTPS forzosa si la petición entra por HTTP plano
    if (process.env.NODE_ENV === 'production') {
      const proto = req.headers['x-forwarded-proto'];
      if (proto && proto === 'http') {
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
      }
    }

    res.setHeader('X-Developer', 'antek');
    res.setHeader('X-Brand-System', 'ANTEK Factura');
    res.setHeader('X-Security-Policy', 'blind-llm-agents-active; no-data-scraping; rls-enforced');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    next();
  });

  // Validación estricta en el servidor para todo lo que escriba el usuario
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Elimina automáticamente propiedades que no estén en el DTO
      forbidNonWhitelisted: true, // Rechaza la petición con 400 si se envían propiedades no autorizadas
      transform: true, // Transforma tipos automáticamente según el DTO
      forbidUnknownValues: true, // Bloquea objetos desconocidos
    })
  );

  app.useGlobalFilters(new HardenedExceptionFilter());

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const staticAllowedOrigins = new Set([
    frontendUrl,
    'https://factura.antek.com.do',
    'https://www.factura.antek.com.do',
    'https://antek.com.do',
    'https://www.antek.com.do',
    'https://antek-factura.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (
        staticAllowedOrigins.has(origin) ||
        origin.endsWith('.antek.com.do') ||
        origin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    exposedHeaders: ['X-XML-SHA256', 'Content-Disposition', 'X-Integrity-Signature'],
  });

  const config = new DocumentBuilder()
    .setTitle('ANTEK Factura - API Pública SaaS (e-CF DGII)')
    .setDescription(
      'Plataforma SaaS Multi-tenant de Facturación Electrónica (e-CF) República Dominicana - Cumplimiento DGII Ley 32-23, XMLDSig Directo, Auto-Reportes y Blindaje Anti-Ingeniería Inversa'
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'X-API-Key')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 ANTEK Factura API running at http://localhost:${port}`);
  console.log(`📚 Swagger OpenAPI Docs at http://localhost:${port}/api/docs`);
}

bootstrap();
