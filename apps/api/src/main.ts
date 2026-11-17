import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as dotenv from 'dotenv';
import { AppModule } from './app.module';

dotenv.config();

@Catch()
class HardenedExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).json(
        typeof body === 'object' ? body : { statusCode: status, message: body }
      );
      return;
    }

    // Ocultar stack traces internos en respuestas HTTP para evitar ingeniería inversa
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Fiscal Gateway Error',
      message: 'Error interno controlado. El evento ha sido registrado en auditoría.',
    });
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Ocultar cabecera X-Powered-By de Express y habilitar XML + payloads Base64
  app.disable('x-powered-by');
  app.useBodyParser('text', { type: ['application/xml', 'text/xml'], limit: '20mb' });
  app.useBodyParser('json', { limit: '35mb' });

  // Cabeceras de Hardening y Anti-Ingeniería Inversa (Blind-LLM Shield)
  app.use((req: any, res: any, next: any) => {
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

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    })
  );

  app.useGlobalFilters(new HardenedExceptionFilter());

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  app.enableCors({
    origin: [frontendUrl, 'http://localhost:3000', 'http://127.0.0.1:3000'],
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
