import {
  Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn,
  DeleteDateColumn, ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { ColumnNumericTransformer } from '../../../common/transformers/column-numeric.transformer';
import { ProductType } from '../dto/create-atraccion.dto';
import { Operador } from './operador.entity';
import { UbicacionAtraccion } from './ubicacion-atraccion.entity';
import { FotoAtraccion } from './foto-atraccion.entity';

@Entity('atracciones')
export class Atraccion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  nombre: string;

  @Column({ type: 'text' })
  descripcion: string;

  /** Duración en formato ISO 8601. Ej: PT2H = 2 horas, PT8H = 8 horas. */
  @Column({ type: 'varchar', length: 20 })
  duracion: string;

  @Column('numeric', { precision: 10, scale: 2, transformer: new ColumnNumericTransformer() })
  precioTicket: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  moneda: string;

  @Column({ type: 'enum', enum: ProductType })
  tipoProducto: ProductType;

  @Column({ type: 'boolean', default: false })
  cancelacionGratuita: boolean;

  @Column('text', { array: true, default: '{}' })
  categorias: string[];

  @Column('text', { array: true, default: '{}' })
  insignias: string[];

  @Column('text', { array: true, default: '{}' })
  incluye: string[];

  @Column('text', { array: true, default: '{}' })
  idiomas: string[];

  /** Entradas disponibles por cada fecha y horario. */
  @Column({ type: 'int', default: 20 })
  cupoDiario: number;

  /** Horarios de inicio. Ej: ["09:00", "14:00"] */
  @Column('text', { array: true, default: '{}' })
  horarios: string[];

  @Column('numeric', { precision: 2, scale: 1, nullable: true, transformer: new ColumnNumericTransformer() })
  puntuacion: number | null;

  @Column({ type: 'int', default: 0 })
  numeroResenas: number;

  @Column({ type: 'boolean', default: true })
  estaActivo: boolean;

  @ManyToOne(() => Operador, (operador) => operador.atracciones, { nullable: false, eager: true })
  @JoinColumn({ name: 'operadorId' })
  operador: Operador;

  @Column({ type: 'int' })
  operadorId: number;

  @OneToMany(() => UbicacionAtraccion, (u) => u.atraccion, { cascade: true, eager: true })
  ubicaciones: UbicacionAtraccion[];

  @OneToMany(() => FotoAtraccion, (f) => f.atraccion, { cascade: true, eager: true })
  fotos: FotoAtraccion[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}