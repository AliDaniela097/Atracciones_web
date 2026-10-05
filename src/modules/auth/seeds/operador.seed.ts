import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

/**
 * Crea la cuenta del OPERADOR (administrador del catálogo) al arrancar,
 * con los datos de OPERADOR_EMAIL y OPERADOR_PASSWORD del .env. Si ya existe, no la toca.
 */
@Injectable()
export class OperadorSeed implements OnApplicationBootstrap {
  private readonly logger = new Logger(OperadorSeed.name);

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    const email = this.config.get<string>('OPERADOR_EMAIL');
    const clave = this.config.get<string>('OPERADOR_PASSWORD');
    if (!email || !clave) {
      this.logger.warn('No hay operador configurado: agrega OPERADOR_EMAIL y OPERADOR_PASSWORD en el .env');
      return;
    }
    if (clave.length < 8) {
      this.logger.warn('OPERADOR_PASSWORD debe tener al menos 8 caracteres; no se creó el operador');
      return;
    }
    const creado = await this.auth.asegurarOperador(this.config.get('OPERADOR_NOMBRE') ?? 'Operador', email, clave);
    this.logger.log(creado ? `Operador creado: ${email}` : `Operador listo: ${email}`);
  }
}
