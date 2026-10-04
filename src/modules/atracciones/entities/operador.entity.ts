import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { Atraccion } from './atraccion.entity';

/**
 * Empresa que opera el tour o vende la entrada (Operator del contrato: id entero + name).
 * El id NO es autoincremental: lo envía el cliente en "operator.id" y se guarda tal cual.
 */
@Entity('operadores')
export class Operador {
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @OneToMany(() => Atraccion, (atraccion) => atraccion.operador)
  atracciones: Atraccion[];
}