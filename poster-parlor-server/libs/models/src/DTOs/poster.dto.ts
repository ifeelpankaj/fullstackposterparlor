import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class AddPosterDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsNotEmpty()
  price!: number;

  @IsString()
  @IsNotEmpty()
  dimensions!: string;

  @IsString()
  @IsOptional()
  material?: string;

  @IsBoolean()
  @IsNotEmpty()
  isAvailable!: boolean;

  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  tags!: string[];

  @IsNumber()
  @IsNotEmpty()
  stock!: number;

  @IsString()
  @IsNotEmpty()
  category!: string;
}

export class UpdatePosterDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsString()
  @IsOptional()
  material?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imagesToDelete?: string[]; // Array of public_ids to delete

  @IsOptional()
  @IsEnum(['replace', 'add'])
  imageAction?: 'replace' | 'add'; // 'replace' = replace all, 'add' = add to existing
}
export class ImageUpdateDto {
  @IsOptional()
  @IsString()
  public_id?: string; // For identifying which image to delete/update

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  format?: string;

  @IsOptional()
  @IsNumber()
  width?: number;

  @IsOptional()
  @IsNumber()
  height?: number;
}
