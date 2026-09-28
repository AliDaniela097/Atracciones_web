import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ColumnNumericTransformer } from '../../../common/transformers/column-numeric.transformer';
import { Atraccion } from './atraccion.entity';
import { Ciudad } from './ciudad.entity';

/** Ubicación de una atracción (Location del contrato). */
@Entity('ubicaciones_atraccion')
export class UbicacionAtraccion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Atraccion, (a) => a.ubicaciones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'atraccionId' })
  atraccion: Atraccion;

  @Column({ type: 'varchar', length: 255 })
  direccion: string;

  @ManyToOne(() => Ciudad, { nullable: false })
  @JoinColumn({ name: 'ciudadId' })
  ciudad: Ciudad;

  @Column({ type: 'int' })
  ciudadId: number;

  @Column({ type: 'varchar', length: 2, default: 'ec' })
  pais: string;

  @Column('numeric', { precision: 10, scale: 6, transformer: new ColumnNumericTransformer() })
  latitud: number;

  @Column('numeric', { precision: 10, scale: 6, transformer: new ColumnNumericTransformer() })
  longitud: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tipo: string | null;
}
