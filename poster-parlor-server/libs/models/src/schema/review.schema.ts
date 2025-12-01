import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReviewDocument = Review & Document;

export interface ReviewImage {
  url: string;
  public_id: string;
  format?: string;
  width?: number;
  height?: number;
}

@Schema({ timestamps: true, collection: 'reviews' }) // <-- FIXED COLLECTION NAME
export class Review {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: string; // <-- USER ID

  @Prop({ type: Types.ObjectId, ref: 'Poster', required: true })
  posterId!: string; // <-- POSTER ID

  @Prop({ required: true, min: 1, max: 5 })
  rating!: number;

  @Prop({ trim: true })
  comment?: string;

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
  })
  images?: ReviewImage[];
}

export const ReviewSchema = SchemaFactory.createForClass(Review);
