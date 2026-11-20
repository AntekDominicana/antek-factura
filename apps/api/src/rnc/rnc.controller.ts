import { Controller, Get, Param, Query, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { RncService, RncLookupResult } from './rnc.service';

@ApiTags('RNC & Contribuyentes DGII')
@Controller(['rnc', 'v1/rnc'])
export class RncController {
  constructor(private readonly rncService: RncService) {}

  @Get('lookup')
  @ApiOperation({ summary: 'Consulta y validación de RNC o Cédula por query param (?rnc=...)' })
  @ApiQuery({ name: 'rnc', required: true, description: 'RNC (9 dígitos) o Cédula (11 dígitos)' })
  @ApiResponse({ status: 200, description: 'Datos del contribuyente encontrados o validados' })
  @Header('Cache-Control', 'public, max-age=3600')
  async lookupQuery(@Query('rnc') rnc: string): Promise<RncLookupResult> {
    return this.rncService.lookup(rnc || '');
  }

  @Get(':rnc')
  @ApiOperation({ summary: 'Consulta y validación de RNC o Cédula en el padrón DGII' })
  @ApiParam({ name: 'rnc', description: 'RNC (9 dígitos) o Cédula (11 dígitos)' })
  @ApiResponse({ status: 200, description: 'Datos del contribuyente encontrados o validados' })
  @Header('Cache-Control', 'public, max-age=3600')
  async lookup(@Param('rnc') rnc: string): Promise<RncLookupResult> {
    return this.rncService.lookup(rnc);
  }
}
