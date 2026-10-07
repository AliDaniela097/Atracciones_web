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

  /**
   * Contraseña cifrada con bcrypt. Nunca se guarda ni se devuelve la contraseña real.
   * Es null en cuentas creadas con Google (esas cuentas no tienen contraseña).
   */
  @Column({ type: 'varchar', length: 100, select: false, nullable: true })
  claveHash: string | null;

  /** Identificador de la cuenta de Google ("sub" del ID token), si la persona entró con Google */
  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  googleId: string | null;

  @Column({ type: 'enum', enum: Rol, default: Rol.CLIENTE })
  rol: Rol;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
