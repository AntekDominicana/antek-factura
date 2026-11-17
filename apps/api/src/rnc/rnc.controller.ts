import { Controller, Get, Param, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { RncService, RncLookupResult } from './rnc.service';

@ApiTags('RNC & Contribuyentes DGII')
@Controller(['rnc', 'v1/rnc'])
export class RncController {
  constructor(private readonly rncService: RncService) {}

  @Get(':rnc')
  @ApiOperation({ summary: 'Consulta y validación de RNC o Cédula en el padrón DGII' })
  @ApiParam({ name: 'rnc', description: 'RNC (9 dígitos) o Cédula (11 dígitos)' })
  @ApiResponse({ status: 200, description: 'Datos del contribuyente encontrados' })
  @Header('Cache-Control', 'public, max-age=86400')
  lookup(@Param('rnc') rnc: string): RncLookupResult {
    return this.rncService.lookup(rnc);
  }
}
