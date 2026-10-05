import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { SCOPES_KEY, type Rol, type UsuarioToken } from '../roles';

interface PayloadToken {
  sub: string;
  email: string;
  name: string;
  role: Rol;
  scope: string;
}

/**
 * Revisa la cabecera "Authorization: Bearer <token>":
 * 1) que el token exista, esté firmado por este servidor y no haya vencido (si no, 401);
 * 2) que tenga los scopes que pide el endpoint (si no, 403).
 */
@Injectable()
export class AutenticacionGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; usuario?: UsuarioToken }>();
    const [tipo, token] = (req.headers['authorization'] ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) {
      throw new UnauthorizedException('Debes iniciar sesión para hacer esta operación');
    }

    let payload: PayloadToken;
    try {
      payload = await this.jwt.verifyAsync<PayloadToken>(token);
    } catch {
      throw new UnauthorizedException('La sesión no es válida o ya venció. Inicia sesión de nuevo');
    }

    const usuario: UsuarioToken = {
      id: payload.sub,
      email: payload.email,
      nombre: payload.name,
      rol: payload.role,
      scopes: (payload.scope ?? '').split(' ').filter(Boolean),
    };

    const requeridos = this.reflector.getAllAndOverride<string[]>(SCOPES_KEY, [context.getHandler(), context.getClass()]) ?? [];
    const faltan = requeridos.filter((s) => !usuario.scopes.includes(s));
    if (faltan.length > 0) {
      throw new ForbiddenException(`No tienes permiso para esta operación. Se requiere: ${faltan.join(', ')}`);
    }

    req.usuario = usuario;
    return true;
  }
}
