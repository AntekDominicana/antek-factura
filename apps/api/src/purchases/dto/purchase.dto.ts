import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
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

  @ApiPropertyOptional({ description: 'Observación opcional' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class RegisterBatchQrDto {
  @ApiProperty({ description: 'Lista de facturas escaneadas en lote para guardar en el Libro 606', type: [RegisterQrPurchaseDto] })
  @IsArray({ message: 'El campo items debe ser un arreglo de facturas.' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos 1 factura escaneada.' })
  @ArrayMaxSize(100, { message: 'Máximo 100 facturas por lote.' })
  @ValidateNested({ each: true })
  @Type(() => RegisterQrPurchaseDto)
  items!: RegisterQrPurchaseDto[];
}
