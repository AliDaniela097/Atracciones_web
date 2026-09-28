import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ciudad } from '../entities/ciudad.entity';

/**
 * Ciudades de Ecuador con aeropuerto y vuelos comerciales regulares.
 * Fuentes:
 *  - Aeropuertos con vuelos regulares: https://www.flightconnections.com/airports-in-ecuador-ec
 *  - Códigos IATA y coordenadas: https://en.wikipedia.org/wiki/List_of_airports_in_Ecuador
 *  - Coordenadas del aeropuerto actual de Quito (Tababela):
 *    https://en.wikipedia.org/wiki/Mariscal_Sucre_International_Airport
 *
 * IMPORTANTE: los ids (1..9) son provisionales. Deben coincidir con los
 * códigos de ciudad que acuerde el grupo, porque viajan en el campo "city".
 */
export const CIUDADES_ECUADOR: Ciudad[] = [
  { id: 1, nombre: 'Quito', provincia: 'Pichincha', codigoIata: 'UIO', nombreAeropuerto: 'Aeropuerto Internacional Mariscal Sucre', latitud: -0.113333, longitud: -78.358611 },
  { id: 2, nombre: 'Guayaquil', provincia: 'Guayas', codigoIata: 'GYE', nombreAeropuerto: 'Aeropuerto Internacional José Joaquín de Olmedo', latitud: -2.157778, longitud: -79.883611 },
  { id: 3, nombre: 'Cuenca', provincia: 'Azuay', codigoIata: 'CUE', nombreAeropuerto: 'Aeropuerto Mariscal Lamar', latitud: -2.889444, longitud: -78.984444 },
  { id: 4, nombre: 'Manta', provincia: 'Manabí', codigoIata: 'MEC', nombreAeropuerto: 'Aeropuerto Internacional Eloy Alfaro', latitud: -0.945833, longitud: -80.678611 },
  { id: 5, nombre: 'Loja (Catamayo)', provincia: 'Loja', codigoIata: 'LOH', nombreAeropuerto: 'Aeropuerto Ciudad de Catamayo', latitud: -3.995833, longitud: -79.371944 },
  { id: 6, nombre: 'Coca (Francisco de Orellana)', provincia: 'Orellana', codigoIata: 'OCC', nombreAeropuerto: 'Aeropuerto Francisco de Orellana', latitud: -0.462778, longitud: -76.986667 },
  { id: 7, nombre: 'Santa Rosa', provincia: 'El Oro', codigoIata: 'ETR', nombreAeropuerto: 'Aeropuerto Santa Rosa', latitud: -3.435278, longitud: -79.977778 },
  { id: 8, nombre: 'Isla Baltra', provincia: 'Galápagos', codigoIata: 'GPS', nombreAeropuerto: 'Aeropuerto Seymour', latitud: -0.453889, longitud: -90.265833 },
  { id: 9, nombre: 'San Cristóbal', provincia: 'Galápagos', codigoIata: 'SCY', nombreAeropuerto: 'Aeropuerto San Cristóbal', latitud: -0.910278, longitud: -89.6175 },
];

/**
 * Al arrancar la API, inserta SOLO las ciudades que todavía no existen en la base.
 * Si ya existen (o las modificaste en la base), NO las toca: la base de datos manda.
 */
@Injectable()
export class CiudadesSeed implements OnApplicationBootstrap {
  private readonly logger = new Logger(CiudadesSeed.name);

  constructor(@InjectRepository(Ciudad) private readonly ciudades: Repository<Ciudad>) {}

  async onApplicationBootstrap() {
    const antes = await this.ciudades.count();
    await this.ciudades
      .createQueryBuilder()
      .insert()
      .into(Ciudad)
      .values(CIUDADES_ECUADOR)
      .orIgnore() // si el id ya existe, no hace nada
      .execute();
    const despues = await this.ciudades.count();
    this.logger.log(`Ciudades con aeropuerto en la base: ${despues} (nuevas: ${despues - antes})`);
  }
}