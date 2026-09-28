import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Convierte TODOS los errores al formato RFC 7807 (application/problem+json),
 * como exige el contrato:  { type, title, status, detail, instance }
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      body = typeof r === 'string' ? { message: r } : (r as Record<string, unknown>);
    } else {
      // Error inesperado: se registra en consola, pero no se muestra el detalle al cliente.
      this.logger.error(exception);
    }

    // Si el error ya viene en formato RFC 7807 (por ejemplo, del IdempotencyKeyGuard), se respeta.
    const yaEsProblem = typeof body.type === 'string' && typeof body.title === 'string';

    const mensaje = body.message;
    const detail = Array.isArray(mensaje) ? mensaje.join('; ') : (mensaje as string | undefined);

    const problem = yaEsProblem
      ? { ...body, status, instance: req.originalUrl }
      : {
          type: `https://api.booking-hub.com/errors/${status}`,
          title: this.titulo(status),
          status,
          detail: status === 500 ? 'Ocurrió un error interno. Intente más tarde.' : detail,
          instance: req.originalUrl,
        };

    res.status(status).type('application/problem+json').json(problem);
  }

  private titulo(status: number): string {
    const titulos: Record<number, string> = {
      400: 'Petición inválida',
      401: 'No autenticado',
      403: 'Acceso denegado',
      404: 'Recurso no encontrado',
      409: 'Conflicto',
      422: 'Entidad no procesable',
      500: 'Error interno del servidor',
    };
    return titulos[status] ?? 'Error';
  }
}
