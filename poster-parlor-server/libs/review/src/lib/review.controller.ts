// Body → request body se data lene ke liye
// Controller → is class ko controller mark karta hai
// Delete, Get, Post, Put → HTTP methods
// Param → URL params lene ke liye
// Query → query params lene ke liye
// UploadedFiles → files ko access karne ke liye
// UseInterceptors → file upload ke interceptor use karne ke liye
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

// Review related business logic service
import { ReviewService } from './review.service';

// Auth related decorators
// Auth → protected route
// CurrentUser → logged-in user ka data
// Public → route ko public banata hai
import { Auth, CurrentUser, Public } from '@poster-parler/auth';

// File upload ke liye interceptor
import { FileFieldsInterceptor } from '@nestjs/platform-express';

// AuthenticatedUser → logged in user ka type
// FileStructure → uploaded files ka structure
import { AuthenticatedUser, FileStructure } from '@poster-parler/common';

// DTO and UserRole enum
import { createReviewDto, UserRole } from '@poster-parler/models';

// Standard HTTP response wrapper
import { HttpResponseUtil } from '@poster-parler/utils';

// Ye controller /review route ko handle karega
@Controller('review')
export class ReviewController {
  // ReviewService ko inject kar rahe hai
  constructor(private readonly reviewService: ReviewService) {}

  // ================= CREATE REVIEW =================

  // POST /review/:id → ek product par review create karne ke liye
  @Post(':id')

  // Public route hai (login optional)
  @Public()

  // Images upload karne ke liye interceptor
  // Maximum 5 images allow kar rahe hai
  @UseInterceptors(FileFieldsInterceptor([{ name: 'images', maxCount: 5 }]))
  async createReview(
    // URL se posterId nikal rahe hai
    @Param('id') id: string,

    // Uploaded images ko receive kar rahe hai
    @UploadedFiles() files: { images?: FileStructure[] },

    // Review ka text, rating, etc body se aa raha hai
    @Body() reviewDetails: createReviewDto,

    // Current logged in user ka data
    @CurrentUser() user: AuthenticatedUser
  ) {
    // Agar images nahi aaye to empty array use karenge
    const newImages = files.images || [];

    // Logged in user ka ID
    const userId = user.id;

    // Product / poster ka ID
    const posterId = id;

    // Service ko call karke review create kar rahe hai
    const review = await this.reviewService.createReview(
      reviewDetails,
      newImages,
      userId,
      posterId
    );

    // Standard success response return kar rahe hai
    return HttpResponseUtil.created(review, 'Review created successfully');
  }

  // ================= UPDATE REVIEW =================

  // PUT /review/:id → existing review update karne ke liye
  @Put(':id')

  // Auth required (logged in hona zaroori hai)
  @Auth()
  async updateReview(
    // URL se reviewId mil raha hai
    @Param('id') id: string,

    // Updated review details body se aa rahi hai
    @Body() reviewDetails: createReviewDto,

    // Updated images agar aaye ho
    @UploadedFiles() files: { images?: FileStructure[] },

    // Current logged in user
    @CurrentUser() user: AuthenticatedUser
  ) {
    // User ka ID
    const userId = user.id;

    // User ka role (ADMIN / USER)
    const role = user.role;

    // New images agar ho to, warna empty
    const newImages = files.images || [];

    // Service ko call karke review update kar rahe hai
    const updatedReview = await this.reviewService.updateReview(
      id,
      role,
      reviewDetails,
      userId,
      newImages
    );

    // Success response return
    return HttpResponseUtil.updated(
      updatedReview,
      'Review updated successfully'
    );
  }

  // ================= GET PRODUCT REVIEWS =================

  // GET /review/:id → product ke saare reviews fetch karne ke liye
  @Get(':id')

  // Public route (koi bhi dekh sakta hai)
  @Public()
  async getProductReview(
    // URL se posterId
    @Param('id') id: string,

    // Pagination ke liye page number
    @Query('page') page = 1,

    // Ek page me kitne reviews chahiye
    @Query('limit') limit = 10,

    // Sorting option
    // newest, oldest, highest, lowest
    @Query('sort') sort = 'newest',

    // Specific rating filter (1-5)
    @Query('rating') rating: number,

    // Sirf image wale reviews chahiye ya nahi
    @Query('hasImages') hasImages?: string
  ) {
    // Service call karke product ke reviews la rahe hai
    const review = await this.reviewService.getProductReview(
      id,
      page,
      limit,
      sort,
      rating,
      hasImages === 'true'
    );

    // Success response return
    return HttpResponseUtil.success(
      review,
      'Product reviews fetched successfully'
    );
  }

  // ================= DELETE REVIEW =================

  // DELETE /review/:id → review delete karne ke liye
  @Delete(':id')

  // Sirf ADMIN ko delete permission hai
  @Auth(UserRole.ADMIN)
  async deleteReview(
    // URL se reviewId
    @Param('id') id: string,

    // Logged in admin user
    @CurrentUser() user: AuthenticatedUser
  ) {
    // Service call karke review delete kar rahe hai
    await this.reviewService.deleteReview(id, user.id, user.role);

    // Delete success response
    return HttpResponseUtil.deleted('Review deleted successfully');
  }
}
