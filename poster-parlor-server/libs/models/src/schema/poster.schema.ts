import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PosterDocument = Poster & Document;
export interface PosterImage {
  url: string;
  public_id: string;
  format?: string;
  width?: number;
  height?: number;
}
@Schema({ timestamps: true, collection: 'posters' })
export class Poster {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, min: 0 })
  price!: number;

  @Prop({ required: true, trim: true })
  dimensions!: string;

  @Prop({ trim: true })
  material?: string;

  @Prop({
    type: [
      {
        url: { type: String, required: true },
        public_id: { type: String, required: true },
        format: { type: String },
        width: { type: Number },
        height: { type: Number },
      },
    ],
    required: true,
    validate: [
      (val: PosterImage[]) => val.length > 0,
      'At least one image is required',
    ],
  })
  images!: PosterImage[];

  @Prop({ default: true, index: true })
  isAvailable!: boolean;

  @Prop({ required: true, trim: true, index: true })
  category!: string;

  @Prop({ type: [String], default: [], index: true })
  tags!: string[];

  @Prop({ required: true, min: 0, default: 0 })
  stock!: number;

  @Prop({ trim: true, index: 'text' })
  description?: string;
}

export const PosterSchema = SchemaFactory.createForClass(Poster);
// Unique index
PosterSchema.index({ title: 1 }, { unique: true });

// Text search index (can include title here too)
PosterSchema.index({ title: 'text', description: 'text', tags: 'text' });

// Other indexes
PosterSchema.index({ category: 1, isAvailable: 1 });
PosterSchema.index({ stock: 1, isAvailable: 1 });
