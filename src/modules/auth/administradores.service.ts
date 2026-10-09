import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Usuario } from './entities/usuario.entity';
import { AdministradorDto, CrearAdministradorDto } from './dto/administradores.dto';
import { esCorreoPrincipal, Rol, type UsuarioToken } from './roles';

const RONDAS_BCRYPT = 10;
export const DOMINIO_ADMIN = 'atracciones.ec';
const MAX_INTENTOS_CORREO = 99;

/** Quita tildes y deja solo a-z y 0-9: "Ñandú-Pérez" -> "nanduperez" */
function aCorreoSeguro(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Gestión de administradores (cuentas con rol OPERADOR).
 * Solo el administrador PRINCIPAL (el de OPERADOR_EMAIL en el .env) puede crear, listar y eliminar administradores.
 */
@Injectable()
export class AdministradoresService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly config: ConfigService,
  ) {}

  private esPrincipal(email: string) {
    return esCorreoPrincipal(this.config.get<string>('OPERADOR_EMAIL'), email);
  }

  private exigirPrincipal(usuario: UsuarioToken) {
    if (!this.esPrincipal(usuario.email)) {
      throw new ForbiddenException('Solo el administrador principal puede gestionar administradores.');
    }
  }

  async listar(usuario: UsuarioToken): Promise<AdministradorDto[]> {
    this.exigirPrincipal(usuario);
    const filas = await this.usuarios.find({ where: { rol: Rol.OPERADOR }, order: { createdAt: 'ASC' } });
    return filas.map((u) => this.aDto(u));
  }

  async crear(usuario: UsuarioToken, dto: CrearAdministradorDto): Promise<AdministradorDto> {
    this.exigirPrincipal(usuario);

    const nombre = aCorreoSeguro(dto.first_name.split(' ')[0]);
    const apellido = aCorreoSeguro(dto.last_name.split(' ')[0]);
    if (!nombre || !apellido) {
      throw new BadRequestException('No se pudo armar el correo con ese nombre y apellido. Usa letras del alfabeto latino.');
    }

    const correo = await this.correoLibre(`${nombre}.${apellido}`);
    try {
      const creado = await this.usuarios.save(
        this.usuarios.create({
          nombre: `${dto.first_name} ${dto.last_name}`,
          email: correo,
          claveHash: await bcrypt.hash(dto.password, RONDAS_BCRYPT),
          rol: Rol.OPERADOR,
        }),
      );
      return this.aDto(creado);
    } catch (e) {
      // Dos altas simultáneas con el mismo nombre pueden elegir el mismo correo: lo frena el índice único
      if ((e as { code?: string })?.code === '23505') {
        throw new ConflictException('Ese correo se acaba de crear. Intenta de nuevo.');
      }
      throw e;
    }
  }

  async eliminar(usuario: UsuarioToken, id: string): Promise<void> {
    this.exigirPrincipal(usuario);
    const objetivo = await this.usuarios.findOne({ where: { id } });
    // Solo se eliminan administradores: una cuenta de cliente responde como si no existiera
    if (!objetivo || objetivo.rol !== Rol.OPERADOR) throw new NotFoundException(`El administrador ${id} no existe`);
    if (this.esPrincipal(objetivo.email)) {
      throw new ConflictException('El administrador principal no se puede eliminar.');
    }
    await this.usuarios.delete({ id });
  }

  /** nombre.apellido@atracciones.ec; si ya existe, nombre.apellido2@..., nombre.apellido3@... */
  private async correoLibre(base: string) {
    for (let n = 1; n <= MAX_INTENTOS_CORREO; n++) {
      const correo = `${base}${n === 1 ? '' : n}@${DOMINIO_ADMIN}`;
      if (!(await this.usuarios.exists({ where: { email: correo } }))) return correo;
    }
    throw new ConflictException('Ya hay demasiados administradores con ese nombre y apellido.');
  }

  private aDto(u: Usuario): AdministradorDto {
    return {
      id: u.id,
      name: u.nombre,
      email: u.email,
      principal: this.esPrincipal(u.email),
      created_at: u.createdAt.toISOString(),
    };
  }
}
