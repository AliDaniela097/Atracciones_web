import { ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Usuario } from './entities/usuario.entity';
import { LoginDto, RegistroDto, TokenResponseDto, UsuarioDto } from './dto/auth.dto';
import { Rol, SCOPES_POR_ROL, UsuarioToken } from './roles';
import { ErrorProveedor, verificarFacebook, verificarGoogle, type IdentidadSocial } from './proveedores-sociales';

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
    // Las cuentas creadas con Google o Facebook no tienen contraseña
    const valida = usuario?.claveHash ? await bcrypt.compare(dto.password, usuario.claveHash) : false;
    if (!usuario || !valida) throw new UnauthorizedException('Correo o contraseña incorrectos');

    return this.emitirToken(usuario);
  }

  /** GET /auth/proveedores: qué inicios de sesión sociales están configurados (datos públicos) */
  proveedores() {
    const google = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim() || null;
    const facebookId = this.config.get<string>('FACEBOOK_APP_ID')?.trim() || null;
    const facebookSecret = this.config.get<string>('FACEBOOK_APP_SECRET')?.trim();
    return { google: google ? { clientId: google } : null, facebook: facebookId && facebookSecret ? { appId: facebookId } : null };
  }

  /** POST /auth/google: recibe el ID token de Google, lo verifica y entrega NUESTRO token */
  async conGoogle(credential: string): Promise<TokenResponseDto> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim();
    if (!clientId) throw new NotFoundException('El inicio de sesión con Google no está configurado.');
    return this.entrarConIdentidad(await this.verificar(() => verificarGoogle(credential, clientId)));
  }

  /** POST /auth/facebook: recibe el access token de Facebook, lo verifica y entrega NUESTRO token */
  async conFacebook(accessToken: string): Promise<TokenResponseDto> {
    const appId = this.config.get<string>('FACEBOOK_APP_ID')?.trim();
    const secret = this.config.get<string>('FACEBOOK_APP_SECRET')?.trim();
    if (!appId || !secret) throw new NotFoundException('El inicio de sesión con Facebook no está configurado.');
    return this.entrarConIdentidad(await this.verificar(() => verificarFacebook(accessToken, appId, secret)));
  }

  private async verificar(fn: () => Promise<IdentidadSocial>) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ErrorProveedor) throw new UnauthorizedException(e.message);
      throw new ServiceUnavailableException('No se pudo verificar el inicio de sesión con el proveedor. Intenta de nuevo.');
    }
  }

  /**
   * Busca la cuenta por el id del proveedor; si no existe, por correo (y la vincula);
   * si tampoco existe, crea una cuenta de CLIENTE sin contraseña.
   * Por seguridad, una cuenta de OPERADOR nunca entra con Google o Facebook: solo con su contraseña.
   */
  private async entrarConIdentidad(ident: IdentidadSocial): Promise<TokenResponseDto> {
    const campo = ident.proveedor === 'google' ? 'googleId' : 'facebookId';
    let usuario =
      (await this.usuarios.findOne({ where: { [campo]: ident.id } })) ??
      (await this.usuarios.findOne({ where: { email: ident.email } }));

    if (usuario?.rol === Rol.OPERADOR) {
      throw new ForbiddenException('La cuenta del operador solo puede ingresar con su correo y contraseña.');
    }
    if (!usuario) {
      usuario = this.usuarios.create({ nombre: ident.nombre, email: ident.email, claveHash: null, rol: Rol.CLIENTE });
    }
    if (!usuario[campo]) usuario[campo] = ident.id; // vincula el proveedor a la cuenta existente
    usuario = await this.usuarios.save(usuario);
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
    return this.asegurarCuenta(nombre, email, clave, Rol.OPERADOR);
  }

  /** Crea una cuenta con el rol indicado si el correo no existe (lo usan los seeds). Devuelve true si la creó. */
  async asegurarCuenta(nombre: string, email: string, clave: string, rol: Rol) {
    const correo = email.trim().toLowerCase();
    if (await this.usuarios.exists({ where: { email: correo } })) return false;
    await this.usuarios.save(
      this.usuarios.create({ nombre, email: correo, claveHash: await bcrypt.hash(clave, RONDAS_BCRYPT), rol }),
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
