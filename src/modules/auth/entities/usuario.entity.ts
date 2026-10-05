import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Rol } from '../roles';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'varchar', length: 180, unique: true })
  email: string;

  /** Contraseña cifrada con bcrypt. Nunca se guarda ni se devuelve la contraseña real. */
  @Column({ type: 'varchar', length: 100, select: false })
  claveHash: string;

  @Column({ type: 'enum', enum: Rol, default: Rol.CLIENTE })
  rol: Rol;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
