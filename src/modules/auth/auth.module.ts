import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from './entities/usuario.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AutenticacionGuard } from './guards/autenticacion.guard';
import { OperadorSeed } from './seeds/operador.seed';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        let secreto = config.get<string>('JWT_SECRET');
        if (!secreto) {
          if (config.get('NODE_ENV') === 'production') {
            throw new Error('Falta JWT_SECRET en las variables de entorno');
          }
          secreto = 'solo-para-desarrollo-cambiar-en-el-env';
          new Logger('AuthModule').warn('JWT_SECRET no está en el .env: se usa una clave de desarrollo');
        }
        return { secret: secreto, signOptions: { issuer: 'atracciones-api' }, verifyOptions: { issuer: 'atracciones-api' } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AutenticacionGuard, OperadorSeed],
  exports: [JwtModule, AutenticacionGuard],
})
export class AuthModule {}
