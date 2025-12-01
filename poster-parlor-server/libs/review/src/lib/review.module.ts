import { Module } from '@nestjs/common';
import { CloudinaryService, InventoryModule } from '@poster-parler/inventory';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Review, ReviewSchema } from '@poster-parler/models';
@Module({
  imports: [
    InventoryModule,
    MongooseModule.forFeature([{ name: Review.name, schema: ReviewSchema }]),
  ],
  controllers: [ReviewController],
  providers: [ReviewService, CloudinaryService],
  exports: [ReviewService],
})
export class ReviewModule {}
