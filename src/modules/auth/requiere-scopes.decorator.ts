import { applyDecorators, createParamDecorator, ExecutionContext, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AutenticacionGuard } from './guards/autenticacion.guard';
import { SCOPES_KEY, type Scope, type UsuarioToken } from './roles';

/**
 * Protege un endpoint: exige un token Bearer válido y TODOS los scopes indicados.
 * Uso:  @RequiereScopes('attractions:write')
 * Sin token -> 401. Con token pero sin el scope -> 403.
 */
export function RequiereScopes(...scopes: Scope[]) {
  return applyDecorators(
    SetMetadata(SCOPES_KEY, scopes),
    UseGuards(AutenticacionGuard),
    ApiBearerAuth(),
    ApiResponse({ status: 401, description: 'Falta el token o no es válido.' }),
    ApiResponse({ status: 403, description: `Se requiere: ${scopes.join(', ')}` }),
  );
}

/** Inyecta en el controlador el usuario que viene en el token */
export const UsuarioActual = createParamDecorator((_: unknown, ctx: ExecutionContext): UsuarioToken => {
  return ctx.switchToHttp().getRequest<{ usuario: UsuarioToken }>().usuario;
});
