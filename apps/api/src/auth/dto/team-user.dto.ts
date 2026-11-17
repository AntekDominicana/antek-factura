import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTeamUserDto {
  @ApiProperty({ description: 'Nombre completo del colaborador' })
  @IsNotEmpty({ message: 'El nombre completo es obligatorio.' })
  @IsString()
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ description: 'Correo electrónico corporativo del colaborador' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio.' })
  @IsEmail({}, { message: 'Debe ingresar un correo electrónico válido.' })
  @MaxLength(120)
  email!: string;

  @ApiPropertyOptional({ description: 'Contraseña inicial (mínimo 8 caracteres)' })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({ description: 'Rol asignado: ADMIN, BILLER o ACCOUNTANT' })
  @IsOptional()
  @IsString()
  role?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Contraseña actual' })
  @IsNotEmpty({ message: 'La contraseña actual es obligatoria.' })
  @IsString()
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ description: 'Nueva contraseña (mínimo 8 caracteres)' })
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria.' })
  @IsString()
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(128)
  newPassword!: string;
}
