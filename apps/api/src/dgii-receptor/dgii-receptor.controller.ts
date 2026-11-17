import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { FiscalService } from '../fiscal/fiscal.service';

@ApiTags('Receptor Electrónico DGII (/fe/*)')
@Controller('fe')
export class DgiiReceptorController {
  constructor(private readonly fiscalService: FiscalService) {}

  @Get('autenticacion/api/semilla')
  @ApiOperation({
    summary: 'Endpoint estándar DGII: Genera Semilla XML para autenticación de Emisor-Receptor',
  })
  getSemilla(@Res() res: Response) {
    const seedXml = this.fiscalService.generateReceptorAuthSeed();
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.send(seedXml);
  }

  @Post('autenticacion/api/validacioncertificado')
  @ApiOperation({
    summary: 'Endpoint estándar DGII: Valida Semilla XML firmada y emite JWT Token',
  })
  async validateSemilla(@Body() body: any, @Req() req: Request) {
    const xml =
      typeof body === 'string'
        ? body
        : body?.xml || (req as any).rawBody || JSON.stringify(body);
    const token = await this.fiscalService.verifyReceptorSignedSeed(xml);
    return {
      token,
      expira: new Date(Date.now() + 3600 * 1000).toISOString(),
      expedido: new Date().toISOString(),
    };
  }

  @Post('recepcion/api/ecf')
  @ApiOperation({
    summary: 'Endpoint estándar DGII: Recibe e-CF XML de otro contribuyente y retorna Acuse <ARECF> firmado',
  })
  async receiveEcf(
    @Body() body: any,
    @Headers('authorization') authHeader: string,
    @Res() res: Response
  ) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta token Bearer de autorización Emisor-Receptor.');
    }
    const token = authHeader.replace('Bearer ', '').trim();
    const incomingXml = typeof body === 'string' ? body : body?.xml || '';
    const { signedArecfXml } = await this.fiscalService.processIncomingReceptorEcf(
      incomingXml,
      token
    );

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.send(signedArecfXml);
  }

  @Post('aprobacioncomercial/api/ecf')
  @ApiOperation({
    summary: 'Endpoint estándar DGII: Recibe Aprobación Comercial (<ACECF>) de clientes',
  })
  async receiveCommercialApproval(
    @Body() body: any,
    @Headers('authorization') authHeader?: string
  ) {
    const xml = typeof body === 'string' ? body : body?.xml || '';
    return this.fiscalService.registerIncomingCommercialApproval(xml, authHeader);
  }
}
