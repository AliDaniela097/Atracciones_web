import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Atraccion } from './atraccion.entity';

/** Empresa que opera el tour o vende la entrada (Operator del contrato: id entero + name). */
@Entity('operadores')
export class Operador {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 150, unique: true })
  nombre: string;

  @OneToMany(() => Atraccion, (atraccion) => atraccion.operador)
  atracciones: Atraccion[];
}