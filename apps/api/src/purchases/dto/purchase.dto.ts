import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ParseQrDto {
  @ApiProperty({ description: 'URL o cadena cruda decodificada del QR de timbre DGII' })
  @IsNotEmpty({ message: 'El campo qrRaw es requerido.' })
  @IsString()
  @MaxLength(2000)
  qrRaw!: string;
}

export class RegisterQrPurchaseDto {
  @ApiPropertyOptional({ description: 'URL o texto decodificado del código QR de la factura' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  qrRaw?: string;

  @ApiPropertyOptional({ description: 'RNC o Cédula del emisor / suplidor' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  rncEmisor?: string;

  @ApiPropertyOptional({ description: 'Razón social o nombre del suplidor' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  razonSocialEmisor?: string;

  @ApiPropertyOptional({ description: 'Número de comprobante e-NCF o NCF (ej. E310000000001)' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  encf?: string;

  @ApiPropertyOptional({ description: 'Fecha de emisión de la factura' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  fechaEmision?: string;

  @ApiPropertyOptional({ description: 'Monto total de la factura' })
  @IsOptional()
  @IsNumber()
  montoTotal?: number;

  @ApiPropertyOptional({ description: 'Total de ITBIS facturado' })
  @IsOptional()
  @IsNumber()
  totalItbis?: number;

  @ApiPropertyOptional({ description: 'Código de clasificación de gasto Formato 606 (01-11)' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  tipoGasto606?: string;
}

export class ImportXmlPurchaseDto {
  @ApiProperty({ description: 'Contenido completo del archivo XML e-CF del proveedor' })
  @IsNotEmpty({ message: 'El contenido XML es obligatorio.' })
  @IsString()
  xmlContent!: string;

  @ApiPropertyOptional({ description: 'Código de clasificación de gasto Formato 606 (01-11)' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  tipoGasto606?: string;
}

export class CommercialApprovalDto {
  @ApiProperty({ description: 'Decisión comercial ante la DGII', enum: ['APPROVED', 'REJECTED'] })
  @IsNotEmpty()
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({ description: 'Comentario u observación del rechazo/aprobación' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
