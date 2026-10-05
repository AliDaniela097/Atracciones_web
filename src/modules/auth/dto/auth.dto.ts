import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Rol } from '../roles';

const limpiarEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class RegistroDto {
  @ApiProperty({ example: 'Ana Torres' })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'ana@correo.com' })
  @Transform(limpiarEmail)
  @IsEmail({}, { message: 'El correo no es válido' })
  @MaxLength(180)
  email: string;

  @ApiProperty({ example: 'MiClaveSegura2026', description: 'Mínimo 8 caracteres' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72) // límite de bcrypt
  password: string;
}

export class LoginDto {
  @ApiProperty({ example: 'ana@correo.com' })
  @Transform(limpiarEmail)
  @IsEmail({}, { message: 'El correo no es válido' })
  email: string;

  @ApiProperty({ example: 'MiClaveSegura2026' })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string;
}

export class UsuarioDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ enum: Rol }) role: Rol;
}

/** Respuesta con el mismo formato de un token OAuth2 (RFC 6749, sección 5.1) */
export class TokenResponseDto {
  @ApiProperty() access_token: string;
  @ApiProperty({ example: 'Bearer' }) token_type: 'Bearer';
  @ApiProperty({ example: 3600, description: 'Segundos de validez' }) expires_in: number;
  @ApiProperty({ example: 'attractions:read attractions:book attractions:cancel' }) scope: string;
  @ApiProperty({ type: UsuarioDto }) user: UsuarioDto;
}
