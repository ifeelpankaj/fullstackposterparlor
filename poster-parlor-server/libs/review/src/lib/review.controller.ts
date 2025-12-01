import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { Auth, CurrentUser, Public } from '@poster-parler/auth';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AuthenticatedUser, FileStructure } from '@poster-parler/common';
import { createReviewDto, UserRole } from '@poster-parler/models';
import { HttpResponseUtil } from '@poster-parler/utils';

@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post(':id')
  @Public()
  @UseInterceptors(FileFieldsInterceptor([{ name: 'images', maxCount: 5 }]))
  async createReview(
    @Param('id') id: string,
    @UploadedFiles() files: { images?: FileStructure[] },
    @Body() reviewDetails: createReviewDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    // Implementation for creating a review
    const newImages = files.images || [];
    const userId = user.id;
    const posterId = id;
    const review = await this.reviewService.createReview(
      reviewDetails,
      newImages,
      userId,
      posterId
    );
    return HttpResponseUtil.created(review, 'Review created successfully');
  }

  @Put(':id')
  @Auth()
  async updateReview(
    @Param('id') id: string,
    @Body() reviewDetails: createReviewDto,
    @UploadedFiles() files: { images?: FileStructure[] },
    @CurrentUser() user: AuthenticatedUser
  ) {
    // Implementation for updating a review
    const userId = user.id;
    const role = user.role;
    const newImages = files.images || [];
    const updatedReview = await this.reviewService.updateReview(
      id,
      role,
      reviewDetails,
      userId,
      newImages
    );
    return HttpResponseUtil.updated(
      updatedReview,
      'Review updated successfully'
    );
  }

  @Get(':id')
  @Public()
  async getProductReview(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('sort') sort = 'newest', // newest, oldest, highest, lowest, helpful
    @Query('rating') rating: number, // Filter by specific rating (1-5)
    @Query('hasImages') hasImages?: string // 'true' to filter reviews with images
  ) {
    const review = await this.reviewService.getProductReview(
      id,
      page,
      limit,
      sort,
      rating,
      hasImages === 'true'
    );
    return HttpResponseUtil.success(
      review,
      'Product reviews fetched successfully'
    );
  }

  @Delete(':id')
  @Auth(UserRole.ADMIN)
  async deleteReview(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    await this.reviewService.deleteReview(id, user.id, user.role);
    return HttpResponseUtil.deleted('Review deleted successfully');
  }
}
