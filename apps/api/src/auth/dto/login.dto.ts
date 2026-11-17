import { IsNotEmpty, IsString, MinLength, MaxLength, IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'Correo electrónico o usuario (ej. rootfacturas)', example: 'rootfacturas' })
  @IsNotEmpty({ message: 'El correo o nombre de usuario es obligatorio.' })
  @IsString({ message: 'El usuario debe ser una cadena de texto válida.' })
  @MaxLength(100, { message: 'El usuario no puede exceder 100 caracteres.' })
  email!: string;

  @ApiProperty({ description: 'Contraseña de acceso cifrada con bcrypt', example: '••••••••••••' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  @IsString({ message: 'La contraseña debe ser una cadena de texto válida.' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(128, { message: 'La contraseña no puede exceder 128 caracteres.' })
  password!: string;

  @ApiPropertyOptional({ description: 'Código TOTP de 6 dígitos para autenticación de dos factores (2FA)' })
  @IsOptional()
  @IsString({ message: 'El código 2FA debe ser una cadena de texto.' })
  @Length(6, 6, { message: 'El código 2FA debe tener exactamente 6 dígitos numéricos.' })
  totpCode?: string;
}
