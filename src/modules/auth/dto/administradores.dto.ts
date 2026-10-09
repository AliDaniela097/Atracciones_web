import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Solo letras (con tildes y ñ), espacios, apóstrofo y guion. Debe empezar con una letra. */
const SOLO_LETRAS = /^\p{L}[\p{L}\s'’-]*$/u;
const limpiar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);

export class CrearAdministradorDto {
  @ApiProperty({ example: 'María José', description: 'Nombres. Para el correo se usa el primero.' })
  @Transform(limpiar)
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(SOLO_LETRAS, { message: 'Los nombres solo pueden tener letras' })
  first_name: string;

  @ApiProperty({ example: 'Pérez Andrade', description: 'Apellidos. Para el correo se usa el primero.' })
  @Transform(limpiar)
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(SOLO_LETRAS, { message: 'Los apellidos solo pueden tener letras' })
  last_name: string;

  @ApiProperty({ example: 'ClaveSegura2026', description: 'Contraseña inicial. Mínimo 8 caracteres.' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72) // límite de bcrypt
  password: string;
}

export class AdministradorDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'María José Pérez Andrade' }) name: string;
  @ApiProperty({ example: 'maria.perez@atracciones.ec', description: 'Correo con el que ingresa al sitio' }) email: string;
  @ApiProperty({ description: 'true si es el administrador principal (no se puede eliminar)' }) principal: boolean;
  @ApiProperty({ format: 'date-time' }) created_at: string;
}
