import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { Rol } from '../roles';

/**
 * Cuenta de CLIENTE de prueba para demostrar el sistema (por ejemplo, en la presentación).
 * Se crea al arrancar con CLIENTE_DEMO_EMAIL y CLIENTE_DEMO_PASSWORD del .env,
 * SOLO si NODE_ENV no es "production": en el servidor real nunca existe una cuenta de prueba.
 * Si ya existe, no la toca.
 */
@Injectable()
export class ClienteDemoSeed implements OnApplicationBootstrap {
  private readonly logger = new Logger(ClienteDemoSeed.name);

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    const email = this.config.get<string>('CLIENTE_DEMO_EMAIL')?.trim();
    const clave = this.config.get<string>('CLIENTE_DEMO_PASSWORD');
    if (!email || !clave) return;
    if (this.config.get<string>('NODE_ENV') === 'production') {
      this.logger.warn('CLIENTE_DEMO_* se ignora en producción: no se crean cuentas de prueba en el servidor real');
      return;
    }
    const nombre = this.config.get<string>('CLIENTE_DEMO_NOMBRE') ?? 'Cliente de prueba';
    const creado = await this.auth.asegurarCuenta(nombre, email, clave, Rol.CLIENTE);
    this.logger.log(creado ? `Cliente de prueba creado: ${email}` : `Cliente de prueba listo: ${email}`);
  }
}
