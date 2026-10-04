import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString } from 'class-validator';

export class DetailsRequestDto {
  @ApiProperty({ description: 'Array de IDs de atracciones', example: ['PRahAzWtTraa'] })
  @IsArray()
  @ArrayMaxSize(50, { message: 'Máximo 50 atracciones por petición' })
  @IsString({ each: true })
  attractions: string[];

  @ApiProperty({ description: 'Idiomas solicitados', example: ['en-gb'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  languages?: string[];
}
