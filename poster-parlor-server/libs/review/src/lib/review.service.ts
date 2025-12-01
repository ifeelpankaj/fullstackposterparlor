import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FileStructure } from '@poster-parler/common';
import { CloudinaryService } from '@poster-parler/inventory';
import {
  createReviewDto,
  Review,
  ReviewDocument,
  ReviewImage,
  updateReviewDto,
  UserRole,
} from '@poster-parler/models';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ValidationException,
} from '@poster-parler/utils';
import { UploadApiResponse } from 'cloudinary';
import mongoose, { FilterQuery, Model } from 'mongoose';

@Injectable()
export class ReviewService {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>
  ) {}
  public async createReview(
    reviewDetails: createReviewDto,
    images: FileStructure[],
    userId: string,
    posterId: string
  ): Promise<Review> {
    if (!userId || !posterId) {
      throw new Error('User ID and Poster ID are required to create a review.');
    }
    if (!this.isValidObjectId(userId) || !this.isValidObjectId(posterId)) {
      throw new Error('Invalid User ID or Poster ID format.');
    }

    // Check if user has already reviewed this product
    const existingReview = await this.reviewModel.findOne({
      userId: userId,
      posterId: posterId,
    });

    if (existingReview) {
      throw new ConflictException(
        'You have already reviewed this product. You can only submit one review per product.'
      );
    }

    let uploadResults: UploadApiResponse[] = [];
    try {
      if (images && images.length > 0) {
        uploadResults = await this.cloudinaryService.uploadMultipleImages(
          images
        );
      }

      // Transform to match schema
      const imageUploadResults: ReviewImage[] = uploadResults.map((result) => ({
        url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
      }));

      // Create the review with all details
      const newReview = new this.reviewModel({
        userId,
        posterId,
        ...reviewDetails,
        images: imageUploadResults,
      });

      return await newReview.save();
    } catch (error) {
      // Cleanup uploaded images if review creation fails
      if (uploadResults.length > 0) {
        await this.cloudinaryService.deleteMultipleImages(
          uploadResults.map((result) => result.public_id)
        );
      }
      throw error;
    }
  }
  public async updateReview(
    reviewId: string,
    role: UserRole,
    reviewDetails: updateReviewDto,
    userId: string,
    images: FileStructure[]
  ) {
    if (!userId || !reviewId) {
      throw new NotFoundException(
        'User ID and Review ID are required to update a review.'
      );
    }
    if (!this.isValidObjectId(userId) || !this.isValidObjectId(reviewId)) {
      throw new ValidationException('Invalid User ID or Review ID format.');
    }

    const existingReview = await this.reviewModel.findById(reviewId);
    if (!existingReview) {
      throw new NotFoundException('Review not found.');
    }
    if (
      role !== UserRole.ADMIN &&
      existingReview.userId.toString() !== userId
    ) {
      throw new ForbiddenException('You can only update your own reviews.');
    }

    let uploadedImages: UploadApiResponse[] = [];
    let imagesToDeleteFromCloud: string[] = [];

    try {
      // Get existing images from the review
      const existingImages = existingReview.images || [];
      let finalImages: ReviewImage[] = [];

      // Handle image actions
      if (reviewDetails.imageAction === 'replace') {
        // REPLACE MODE: Delete all existing images and use only new ones
        if (existingImages.length > 0) {
          imagesToDeleteFromCloud = existingImages.map((img) => img.public_id);
        }

        // Upload new images if provided
        if (images && images.length > 0) {
          uploadedImages = await this.cloudinaryService.uploadMultipleImages(
            images
          );
          finalImages = uploadedImages.map((result) => ({
            url: result.secure_url,
            public_id: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height,
          }));
        }

        // Delete old images from Cloudinary after successful upload
        if (imagesToDeleteFromCloud.length > 0) {
          await this.cloudinaryService.deleteMultipleImages(
            imagesToDeleteFromCloud
          );
        }
      } else {
        // ADD MODE (or default): Keep existing images and add new ones

        // Start with existing images
        finalImages = [...existingImages];

        // Handle specific image deletions if requested
        if (
          reviewDetails.imagesToDelete &&
          reviewDetails.imagesToDelete.length > 0
        ) {
          const publicIdsToDelete = reviewDetails.imagesToDelete;

          // Remove from finalImages array
          finalImages = finalImages.filter(
            (img) => !publicIdsToDelete.includes(img.public_id)
          );

          // Mark for deletion from Cloudinary
          imagesToDeleteFromCloud = publicIdsToDelete;
        }

        // Upload and add new images
        if (images && images.length > 0) {
          uploadedImages = await this.cloudinaryService.uploadMultipleImages(
            images
          );
          const newReviewImages: ReviewImage[] = uploadedImages.map(
            (result) => ({
              url: result.secure_url,
              public_id: result.public_id,
              format: result.format,
              width: result.width,
              height: result.height,
            })
          );
          finalImages = [...finalImages, ...newReviewImages];
        }

        // Delete specified images from Cloudinary
        if (imagesToDeleteFromCloud.length > 0) {
          await this.cloudinaryService.deleteMultipleImages(
            imagesToDeleteFromCloud
          );
        }
      }

      // Validate total images (optional - adjust max count as needed)
      if (finalImages.length > 5) {
        throw new ValidationException('Maximum 5 images allowed per review');
      }

      // Prepare update data
      const { ...reviewFields } = reviewDetails;
      const updatedReview: Partial<Review> = {
        ...reviewFields,
        images: finalImages,
      };

      // Update the review
      const updateData = await this.reviewModel.findByIdAndUpdate(
        reviewId,
        updatedReview,
        { new: true }
      );

      return updateData;
    } catch (error) {
      // Cleanup: Delete newly uploaded images if update fails
      if (uploadedImages.length > 0) {
        const uploadedPublicIds = uploadedImages.map((img) => img.public_id);
        await this.cloudinaryService.deleteMultipleImages(uploadedPublicIds);
      }
      throw error;
    }
  }

  async getProductReview(
    posterId: string,
    page = 1,
    limit = 10,
    sort = 'newest',
    rating?: number,
    hasImages?: boolean
  ): Promise<{
    reviews: Review[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalReviews: number;
      limit: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
    stats: {
      averageRating: number;
      totalReviews: number;
      ratingDistribution: { [key: number]: number };
    };
  }> {
    if (!this.isValidObjectId(posterId)) {
      throw new ValidationException('Invalid Poster ID format.');
    }

    // Validate pagination parameters
    if (page < 1) page = 1;
    if (limit < 1 || limit > 100) limit = 10; // Max 100 reviews per page

    const skip = (page - 1) * limit;

    // Build filter query
    const filter: FilterQuery<ReviewDocument> = { posterId };

    // Filter by rating if provided
    if (rating && rating >= 1 && rating <= 5) {
      filter.rating = rating;
    }

    // Filter by images if requested
    if (hasImages) {
      filter['images.0'] = { $exists: true }; // Has at least one image
    }

    // Determine sort order
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sortOption: any = {};
    switch (sort) {
      case 'newest':
        sortOption = { createdAt: -1 };
        break;
      case 'oldest':
        sortOption = { createdAt: 1 };
        break;
      case 'highest':
        sortOption = { rating: -1, createdAt: -1 };
        break;
      case 'lowest':
        sortOption = { rating: 1, createdAt: -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    // Execute queries in parallel for better performance
    const [reviews, totalReviews, ratingStats] = await Promise.all([
      // Get paginated reviews
      this.reviewModel
        .find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email') // Populate user details
        .lean()
        .exec(),

      // Get total count for pagination
      this.reviewModel.countDocuments(filter),

      // Get rating statistics
      this.reviewModel.aggregate([
        { $match: { posterId: new mongoose.Types.ObjectId(posterId) } },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Calculate rating distribution (1-5 stars)
    const ratingDistribution = await this.reviewModel.aggregate([
      { $match: { posterId: new mongoose.Types.ObjectId(posterId) } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
    ]);

    // Format rating distribution
    const distribution: { [key: number]: number } = {};
    for (let i = 1; i <= 5; i++) {
      distribution[i] = 0;
    }
    ratingDistribution.forEach((item) => {
      distribution[item._id] = item.count;
    });

    const totalPages = Math.ceil(totalReviews / limit);

    return {
      reviews,
      pagination: {
        currentPage: page,
        totalPages,
        totalReviews,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      stats: {
        averageRating: ratingStats[0]?.averageRating || 0,
        totalReviews: ratingStats[0]?.totalReviews || 0,
        ratingDistribution: distribution,
      },
    };
  }
  async deleteReview(reviewId: string, userId: string, role: UserRole) {
    if (!this.isValidObjectId(reviewId)) {
      throw new ValidationException('Invalid Review ID format.');
    }
    const existingReview = await this.reviewModel.findById(reviewId);
    if (!existingReview) {
      throw new NotFoundException('Review not found.');
    }
    if (
      role !== UserRole.ADMIN &&
      existingReview.userId.toString() !== userId
    ) {
      throw new ForbiddenException('You can only delete your own reviews.');
    }
    await this.reviewModel.findByIdAndDelete(reviewId);
  }
  private isValidObjectId(id: string): boolean {
    return /^[0-9a-fA-F]{24}$/.test(id);
  }
}
