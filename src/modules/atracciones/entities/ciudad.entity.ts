import { Column, Entity, PrimaryColumn } from 'typeorm';
import { ColumnNumericTransformer } from '../../../common/transformers/column-numeric.transformer';

/**
 * Ciudades de Ecuador con aeropuerto comercial.
 * El "id" es el número que viaja en el campo "city" del contrato (Location.city: integer).
 */
@Entity('ciudades')
export class Ciudad {
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 100 })
  provincia: string;

  @Column({ type: 'varchar', length: 3, unique: true })
  codigoIata: string;

  @Column({ type: 'varchar', length: 150 })
  nombreAeropuerto: string;

  @Column('numeric', { precision: 10, scale: 6, transformer: new ColumnNumericTransformer() })
  latitud: number;

  @Column('numeric', { precision: 10, scale: 6, transformer: new ColumnNumericTransformer() })
  longitud: number;
}