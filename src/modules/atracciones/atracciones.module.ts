import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AtraccionesService } from './atracciones.service';
import { AtraccionesController } from './atracciones.controller';
import { CommonModule } from '../../common/common.module';
import { Atraccion } from './entities/atraccion.entity';
import { Ciudad } from './entities/ciudad.entity';
import { Operador } from './entities/operador.entity';
import { UbicacionAtraccion } from './entities/ubicacion-atraccion.entity';
import { FotoAtraccion } from './entities/foto-atraccion.entity';
import { Reserva } from './entities/reserva.entity';
import { ClaveIdempotencia } from './entities/clave-idempotencia.entity';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([
      Atraccion,
      Ciudad,
      Operador,
      UbicacionAtraccion,
      FotoAtraccion,
      Reserva,
      ClaveIdempotencia,
    ]),
  ],
  controllers: [AtraccionesController],
  providers: [AtraccionesService],
})
export class AtraccionesModule {}