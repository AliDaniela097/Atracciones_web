import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Usuario } from './entities/usuario.entity';
import { LoginDto, RegistroDto, TokenResponseDto, UsuarioDto } from './dto/auth.dto';
import { Rol, SCOPES_POR_ROL, UsuarioToken } from './roles';

const RONDAS_BCRYPT = 10;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** POST /auth/registro: crea una cuenta de CLIENTE (los operadores no se registran solos) */
  async registrar(dto: RegistroDto): Promise<TokenResponseDto> {
    const existe = await this.usuarios.exists({ where: { email: dto.email } });
    if (existe) throw new ConflictException('Ya existe una cuenta con ese correo');

    const usuario = await this.usuarios.save(
      this.usuarios.create({
        nombre: dto.name.trim(),
        email: dto.email,
        claveHash: await bcrypt.hash(dto.password, RONDAS_BCRYPT),
        rol: Rol.CLIENTE,
      }),
    );
    return this.emitirToken(usuario);
  }

  /** POST /auth/login */
  async login(dto: LoginDto): Promise<TokenResponseDto> {
    const usuario = await this.usuarios
      .createQueryBuilder('u')
      .addSelect('u.claveHash')
      .where('u.email = :email', { email: dto.email })
      .getOne();

    // Mismo mensaje si el correo no existe o si la clave está mal: no se revela qué cuentas existen
    const valida = usuario ? await bcrypt.compare(dto.password, usuario.claveHash) : false;
    if (!usuario || !valida) throw new UnauthorizedException('Correo o contraseña incorrectos');

    return this.emitirToken(usuario);
  }

  /** GET /auth/me */
  async perfil(u: UsuarioToken): Promise<UsuarioDto> {
    const usuario = await this.usuarios.findOne({ where: { id: u.id } });
    if (!usuario) throw new UnauthorizedException('La cuenta ya no existe');
    return this.aDto(usuario);
  }

  /** Crea un operador si no existe (lo usa el seed con los datos del .env) */
  async asegurarOperador(nombre: string, email: string, clave: string) {
    const correo = email.trim().toLowerCase();
    if (await this.usuarios.exists({ where: { email: correo } })) return false;
    await this.usuarios.save(
      this.usuarios.create({ nombre, email: correo, claveHash: await bcrypt.hash(clave, RONDAS_BCRYPT), rol: Rol.OPERADOR }),
    );
    return true;
  }

  private async emitirToken(usuario: Usuario): Promise<TokenResponseDto> {
    const scope = SCOPES_POR_ROL[usuario.rol].join(' ');
    const expiraEn = Number(this.config.get('JWT_EXPIRES_IN_SECONDS') ?? 3600);
    const access_token = await this.jwt.signAsync(
      { sub: usuario.id, email: usuario.email, name: usuario.nombre, role: usuario.rol, scope },
      { expiresIn: expiraEn },
    );
    return { access_token, token_type: 'Bearer', expires_in: expiraEn, scope, user: this.aDto(usuario) };
  }

  private aDto(u: Usuario): UsuarioDto {
    return { id: u.id, name: u.nombre, email: u.email, role: u.rol };
  }
}
