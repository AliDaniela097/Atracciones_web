import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { ColumnNumericTransformer } from '../../../common/transformers/column-numeric.transformer';
import { ReservationStatus } from '../dto/reservation.dto';
import { Atraccion } from './atraccion.entity';

@Entity('reservas')
export class Reserva {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Atraccion, { nullable: false })
  @JoinColumn({ name: 'atraccionId' })
  atraccion: Atraccion;

  @Column({ type: 'uuid' })
  atraccionId: string;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  hora: string | null;

  @Column({ type: 'int' })
  cantidadTickets: number;

  @Column({ type: 'varchar', length: 150 })
  nombreCliente: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  emailCliente: string | null;

  @Column('numeric', { precision: 10, scale: 2, transformer: new ColumnNumericTransformer() })
  precioTotal: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  moneda: string;

  @Column({ type: 'enum', enum: ReservationStatus, default: ReservationStatus.CONFIRMED })
  estado: ReservationStatus;

  @Column({ type: 'text', nullable: true })
  motivoCancelacion: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}