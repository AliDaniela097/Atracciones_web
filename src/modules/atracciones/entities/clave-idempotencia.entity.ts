import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Guarda cada Idempotency-Key usada y la respuesta que se devolvió.
 * Si el cliente repite la misma clave, se devuelve la misma respuesta
 * en vez de crear otra reserva o cancelar dos veces.
 */
@Entity('claves_idempotencia')
export class ClaveIdempotencia {
  @PrimaryColumn({ type: 'uuid' })
  clave: string;

  @Column({ type: 'varchar', length: 255 })
  endpoint: string;

  @Column({ type: 'int' })
  codigoHttp: number;

  @Column({ type: 'jsonb' })
  respuesta: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}