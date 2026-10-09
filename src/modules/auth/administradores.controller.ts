import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdministradoresService } from './administradores.service';
import { AdministradorDto, CrearAdministradorDto } from './dto/administradores.dto';
import { RequiereScopes, UsuarioActual } from './requiere-scopes.decorator';
import { SCOPES, type UsuarioToken } from './roles';

/**
 * Endpoints INTERNOS del panel (no forman parte del contrato del grupo).
 * Exigen el scope attractions:write y además ser el administrador principal.
 */
@ApiTags('Administradores (principal)')
@Controller('administradores')
export class AdministradoresController {
  constructor(private readonly administradores: AdministradoresService) {}

  @Get()
  @RequiereScopes(SCOPES.ESCRIBIR)
  @ApiOperation({ summary: 'Listar las cuentas de administrador' })
  @ApiResponse({ status: 200, type: [AdministradorDto] })
  listar(@UsuarioActual() usuario: UsuarioToken) {
    return this.administradores.listar(usuario);
  }

  @Post()
  @RequiereScopes(SCOPES.ESCRIBIR)
  @ApiOperation({ summary: 'Crear un administrador. El correo se arma solo: nombre.apellido@atracciones.ec' })
  @ApiResponse({ status: 201, type: AdministradorDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos, o el nombre no permite armar un correo.' })
  @ApiResponse({ status: 403, description: 'Solo el administrador principal puede crear administradores.' })
  @ApiResponse({ status: 409, description: 'No hay un correo libre para ese nombre y apellido.' })
  crear(@UsuarioActual() usuario: UsuarioToken, @Body() dto: CrearAdministradorDto) {
    return this.administradores.crear(usuario, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequiereScopes(SCOPES.ESCRIBIR)
  @ApiOperation({ summary: 'Eliminar un administrador (el principal no se puede eliminar)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Administrador eliminado.' })
  @ApiResponse({ status: 404, description: 'El administrador no existe.' })
  @ApiResponse({ status: 409, description: 'Es el administrador principal.' })
  eliminar(@UsuarioActual() usuario: UsuarioToken, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.administradores.eliminar(usuario, id);
  }
}
