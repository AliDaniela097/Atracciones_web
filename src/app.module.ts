import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { CommonModule } from './common/common.module';
//import { AlojamientosModule } from './modules/alojamientos/alojamientos.module';
// import { AutosModule } from './modules/autos/autos.module';
import { AtraccionesModule } from './modules/atracciones/atracciones.module';
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
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: configService.get<string>('NODE_ENV') !== 'production', // Precaución en producción
      }),
    }),

    // Seguridad: límite de peticiones por IP (100 por minuto). Si se supera responde 429.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
      errorMessage: 'Demasiadas peticiones. Intente de nuevo en un minuto.',
    }),

    // Módulos Compartidos
    CommonModule,

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
