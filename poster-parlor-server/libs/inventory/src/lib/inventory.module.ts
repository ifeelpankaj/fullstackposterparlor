import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Poster, PosterSchema } from '@poster-parler/models';
import { CloudinaryService } from './cloudinary.service';
import { InventoryService } from './inventory.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Poster.name, schema: PosterSchema }]),
  ],
  controllers: [InventoryController],
  providers: [CloudinaryService, InventoryService],
  exports: [InventoryService, CloudinaryService],
})
export class InventoryModule {}
