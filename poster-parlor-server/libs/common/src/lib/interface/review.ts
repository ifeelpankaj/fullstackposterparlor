import { ReviewImage } from '@poster-parler/models';

export interface Review {
  id?: string;
  posterId?: string;
  userId?: string;
  rating: number;
  comment: string;
  images?: ReviewImage[];
}
