import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  
  // Seguridad (OWASP A05): cabeceras HTTP seguras (X-Frame-Options, HSTS, nosniff, CSP...).
  // crossOriginResourcePolicy 'cross-origin': la API la consumen el frontend y otros sistemas (Booking).
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        // En local se trabaja con http://; esta directiva solo se activa en producción (HTTPS),
        // si no, el navegador intentaría cargar Swagger por https://localhost y fallaría.
        directives: { upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null },
      },
    }),
  );

  // CORS: solo los navegadores de los orígenes permitidos pueden llamar a la API.
  // Se configuran en .env (CORS_ORIGINS, separados por coma). Las llamadas servidor a servidor no se ven afectadas.
  // exposedHeaders: deja que el navegador lea el total de la paginación y la ubicación del recurso creado.
  const origenes = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origenes, exposedHeaders: ['X-Total-Count', 'Location'] });

  // Todos los errores salen en formato RFC 7807, como pide el contrato
  app.useGlobalFilters(new ProblemDetailsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Booking Prototipo API')
    .setDescription('API base para los dominios de Alojamientos, Autos, Atracciones y Vuelos.')
    .setVersion('1.0')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
