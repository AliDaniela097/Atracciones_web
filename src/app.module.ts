import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { CommonModule } from './common/common.module';
//import { AlojamientosModule } from './modules/alojamientos/alojamientos.module';
// import { AutosModule } from './modules/autos/autos.module';
import { AtraccionesModule } from './modules/atracciones/atracciones.module';
import { AuthModule } from './modules/auth/auth.module';
// import { VuelosModule } from './modules/vuelos/vuelos.module';

@Module({
  imports: [
    // Carga de variables de entorno globales
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Configuración centralizada de TypeORM usando DATABASE_URL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const enProduccion = configService.get<string>('NODE_ENV') === 'production';
        return {
          type: 'postgres',
          url: configService.get<string>('DATABASE_URL'),
          autoLoadEntities: true,
          // Este proyecto no tiene migraciones, así que el esquema se crea/actualiza
          // sincronizando las entidades. DB_SYNCHRONIZE permite apagarlo explícitamente
          // (por ejemplo, una vez que la base de producción ya tiene el esquema creado
          // y se prefiere evitar que TypeORM vuelva a tocarla en cada despliegue).
          synchronize: configService.get<string>('DB_SYNCHRONIZE') !== 'false',
          // Neon (y la mayoría de Postgres administrados) exigen TLS; en local no es necesario.
          ssl: enProduccion ? { rejectUnauthorized: false } : false,
        };
      },
    }),

    // Seguridad: límite de peticiones por IP (100 por minuto). Si se supera responde 429.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
      errorMessage: 'Demasiadas peticiones. Intente de nuevo en un minuto.',
    }),

    // Módulos Compartidos
    CommonModule,

    // Autenticación con tokens JWT (scopes del contrato: attractions:read, book, cancel, write)
    AuthModule,

    // =========================================================================
    // ATENCIÓN ALUMNO: Descomenta solo el módulo que corresponde a tu grupo
    // =========================================================================
    //AlojamientosModule,
    // AutosModule,
    AtraccionesModule,
    // VuelosModule,
  ],
  controllers: [],
  // El límite de peticiones se aplica a todos los endpoints
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
