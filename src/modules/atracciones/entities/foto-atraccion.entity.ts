import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Atraccion } from './atraccion.entity';

/** Foto de una atracción (Photo del contrato). */
@Entity('fotos_atraccion')
export class FotoAtraccion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Atraccion, (a) => a.fotos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'atraccionId' })
  atraccion: Atraccion;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'int', default: 0 })
  orden: number;
}