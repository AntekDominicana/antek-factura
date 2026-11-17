import { IsNotEmpty, IsString, IsEmail, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: 'RNC (9 dígitos) o Cédula (11 dígitos) dominicana', example: '131880738' })
  @IsNotEmpty({ message: 'El RNC o Cédula es obligatorio.' })
  @IsString({ message: 'El RNC debe ser texto.' })
  @Matches(/^[0-9]{9}$|^[0-9]{11}$/, { message: 'El RNC debe tener 9 dígitos y la Cédula 11 dígitos numéricos.' })
  rnc!: string;

  @ApiProperty({ description: 'Razón Social legal registrada en DGII', example: 'EMPRESA EJEMPLO SRL' })
  @IsNotEmpty({ message: 'La razón social es obligatoria.' })
  @IsString()
  @MaxLength(255)
  razonSocial!: string;

  @ApiPropertyOptional({ description: 'Nombre comercial de la empresa' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nombreComercial?: string;

  @ApiProperty({ description: 'Dirección física del domicilio fiscal' })
  @IsNotEmpty({ message: 'La dirección es obligatoria.' })
  @IsString()
  @MaxLength(255)
  direccion!: string;

  @ApiProperty({ description: 'Correo electrónico corporativo del administrador', example: 'admin@empresa.com.do' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio.' })
  @IsEmail({}, { message: 'Debe ingresar un correo electrónico válido.' })
  @MaxLength(120)
  correo!: string;

  @ApiProperty({ description: 'Nombre completo del usuario administrador' })
  @IsNotEmpty({ message: 'El nombre completo es obligatorio.' })
  @IsString()
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ description: 'Contraseña segura (mínimo 8 caracteres)', example: 'ContrasenaSegura2026!' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ description: 'Código del plan a suscribir (BASIC, MEDIUM, PRO)' })
  @IsOptional()
  @IsString()
  planCode?: string;
}
