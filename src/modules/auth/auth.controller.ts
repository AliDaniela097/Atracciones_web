import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { GoogleLoginDto, LoginDto, RegistroDto, TokenResponseDto, UsuarioDto } from './dto/auth.dto';
import { RequiereScopes, UsuarioActual } from './requiere-scopes.decorator';
import { SCOPES, type UsuarioToken } from './roles';

/** Intentos de login/registro: máximo 5 por minuto por IP (frena ataques de fuerza bruta) */
const LIMITE_LOGIN = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('registro')
  @Throttle(LIMITE_LOGIN)
  @ApiOperation({ summary: 'Crear una cuenta de cliente y recibir su token' })
  @ApiResponse({ status: 201, type: TokenResponseDto })
  @ApiResponse({ status: 409, description: 'El correo ya está registrado.' })
  registrar(@Body() dto: RegistroDto) {
    return this.auth.registrar(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(LIMITE_LOGIN)
  @ApiOperation({ summary: 'Iniciar sesión y recibir un token Bearer (JWT)' })
  @ApiResponse({ status: 200, type: TokenResponseDto })
  @ApiResponse({ status: 401, description: 'Correo o contraseña incorrectos.' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('proveedores')
  @ApiOperation({ summary: 'Inicio de sesión con Google disponible (datos públicos para el frontend)' })
  proveedores() {
    return this.auth.proveedores();
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @Throttle(LIMITE_LOGIN)
  @ApiOperation({ summary: 'Ingresar o crear cuenta de cliente con Google (verifica el ID token)' })
  @ApiResponse({ status: 200, type: TokenResponseDto })
  @ApiResponse({ status: 401, description: 'Token de Google inválido, vencido o de otra aplicación.' })
  @ApiResponse({ status: 403, description: 'La cuenta del operador no puede usar Google.' })
  @ApiResponse({ status: 404, description: 'Google no está configurado en el servidor.' })
  conGoogle(@Body() dto: GoogleLoginDto) {
    return this.auth.conGoogle(dto.credential);
  }

  @Get('me')
  @RequiereScopes(SCOPES.LEER)
  @ApiOperation({ summary: 'Datos de la cuenta que inició sesión' })
  @ApiResponse({ status: 200, type: UsuarioDto })
  perfil(@UsuarioActual() usuario: UsuarioToken) {
    return this.auth.perfil(usuario);
  }
}
