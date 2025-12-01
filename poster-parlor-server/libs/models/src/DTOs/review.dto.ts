import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class createReviewDto {
  @IsMongoId()
  @IsOptional()
  posterId?: string;

  @IsMongoId()
  @IsOptional()
  userId?: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @IsOptional()
  @Max(500)
  comment?: string;
}

export class updateReviewDto {
  @IsMongoId()
  @IsOptional()
  posterId?: string;

  @IsMongoId()
  @IsOptional()
  userId?: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @IsOptional()
  @Max(500)
  comment?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imagesToDelete?: string[];

  @IsOptional()
  @IsEnum(['replace', 'add'])
  imageAction?: 'replace' | 'add';
}
