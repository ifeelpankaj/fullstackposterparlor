// Injectable decorator tells NestJS that this class can be injected as a dependency
import { Injectable } from '@nestjs/common';

// Used to inject Mongoose model into the service
import { InjectModel } from '@nestjs/mongoose';

// File structure used for handling uploaded images
import { FileStructure } from '@poster-parler/common';

// Cloudinary service used to upload and delete images
import { CloudinaryService } from '@poster-parler/inventory';

// Review related DTOs, schema, enums
import {
  createReviewDto,
  Review,
  ReviewDocument,
  ReviewImage,
  updateReviewDto,
  UserRole,
} from '@poster-parler/models';

// Custom exceptions used across the project
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ValidationException,
} from '@poster-parler/utils';

// Cloudinary response type
import { UploadApiResponse } from 'cloudinary';

// Mongoose utilities
import mongoose, { FilterQuery, Model } from 'mongoose';

// Mark this class as injectable so NestJS can manage it
@Injectable()
export class ReviewService {
  constructor(
    // Inject Cloudinary service to handle image uploads/deletions
    private readonly cloudinaryService: CloudinaryService,

    // Inject Review mongoose model
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>
  ) {}

  // ================= CREATE REVIEW =================
  public async createReview(
    reviewDetails: createReviewDto,
    images: FileStructure[],
    userId: string,
    posterId: string
  ): Promise<Review> {

    // First validate required parameters
    if (!userId || !posterId) {
      throw new Error('User ID and Poster ID are required to create a review.');
    }

    // Validate MongoDB ObjectId format
    if (!this.isValidObjectId(userId) || !this.isValidObjectId(posterId)) {
      throw new Error('Invalid User ID or Poster ID format.');
    }

    // Check if the user has already reviewed this product
    const existingReview = await this.reviewModel.findOne({
      userId: userId,
      posterId: posterId,
    });

    // If review already exists, prevent duplicate review
    if (existingReview) {
      throw new ConflictException(
        'You have already reviewed this product. You can only submit one review per product.'
      );
    }

    // Store Cloudinary upload results
    let uploadResults: UploadApiResponse[] = [];

    try {
      // If images are provided, upload them to Cloudinary
      if (images && images.length > 0) {
        uploadResults = await this.cloudinaryService.uploadMultipleImages(
          images
        );
      }

      // Convert Cloudinary response into ReviewImage schema format
      const imageUploadResults: ReviewImage[] = uploadResults.map((result) => ({
        url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
      }));

      // Create new review document
      const newReview = new this.reviewModel({
        userId,
        posterId,
        ...reviewDetails,
        images: imageUploadResults,
      });

      // Save review to database
      return await newReview.save();
    } catch (error) {

      // If something fails, cleanup already uploaded images
      if (uploadResults.length > 0) {
        await this.cloudinaryService.deleteMultipleImages(
          uploadResults.map((result) => result.public_id)
        );
      }

      // Re-throw error
      throw error;
    }
  }

  // ================= UPDATE REVIEW =================
  public async updateReview(
    reviewId: string,
    role: UserRole,
    reviewDetails: updateReviewDto,
    userId: string,
    images: FileStructure[]
  ) {

    // Validate required parameters
    if (!userId || !reviewId) {
      throw new NotFoundException(
        'User ID and Review ID are required to update a review.'
      );
    }

    // Validate ObjectId format
    if (!this.isValidObjectId(userId) || !this.isValidObjectId(reviewId)) {
      throw new ValidationException('Invalid User ID or Review ID format.');
    }

    // Fetch existing review
    const existingReview = await this.reviewModel.findById(reviewId);

    // If review not found
    if (!existingReview) {
      throw new NotFoundException('Review not found.');
    }

    // Authorization check: user can update only their own review unless admin
    if (
      role !== UserRole.ADMIN &&
      existingReview.userId.toString() !== userId
    ) {
      throw new ForbiddenException('You can only update your own reviews.');
    }

    // Store newly uploaded images
    let uploadedImages: UploadApiResponse[] = [];

    // Store public IDs of images to delete
    let imagesToDeleteFromCloud: string[] = [];

    try {
      // Get existing images
      const existingImages = existingReview.images || [];

      // Final image list after update
      let finalImages: ReviewImage[] = [];

      // Handle image replacement mode
      if (reviewDetails.imageAction === 'replace') {

        // Mark all existing images for deletion
        if (existingImages.length > 0) {
          imagesToDeleteFromCloud = existingImages.map((img) => img.public_id);
        }

        // Upload new images
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

        // Delete old images after successful upload
        if (imagesToDeleteFromCloud.length > 0) {
          await this.cloudinaryService.deleteMultipleImages(
            imagesToDeleteFromCloud
          );
        }
      } else {
        // ADD MODE: keep existing images
        finalImages = [...existingImages];

        // Handle selective image deletion
        if (
          reviewDetails.imagesToDelete &&
          reviewDetails.imagesToDelete.length > 0
        ) {
          const publicIdsToDelete = reviewDetails.imagesToDelete;

          // Remove deleted images from final array
          finalImages = finalImages.filter(
            (img) => !publicIdsToDelete.includes(img.public_id)
          );

          // Store them for Cloudinary deletion
          imagesToDeleteFromCloud = publicIdsToDelete;
        }

        // Upload new images and append
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

        // Delete removed images from Cloudinary
        if (imagesToDeleteFromCloud.length > 0) {
          await this.cloudinaryService.deleteMultipleImages(
            imagesToDeleteFromCloud
          );
        }
      }

      // Validate max image count
      if (finalImages.length > 5) {
        throw new ValidationException('Maximum 5 images allowed per review');
      }

      // Prepare update object
      const { ...reviewFields } = reviewDetails;

      const updatedReview: Partial<Review> = {
        ...reviewFields,
        images: finalImages,
      };

      // Update review in database
      const updateData = await this.reviewModel.findByIdAndUpdate(
        reviewId,
        updatedReview,
        { new: true }
      );

      return updateData;
    } catch (error) {

      // Cleanup newly uploaded images if update fails
      if (uploadedImages.length > 0) {
        const uploadedPublicIds = uploadedImages.map((img) => img.public_id);
        await this.cloudinaryService.deleteMultipleImages(uploadedPublicIds);
      }

      throw error;
    }
  }

  // ================= GET PRODUCT REVIEWS =================
  async getProductReview(
    posterId: string,
    page = 1,
    limit = 10,
    sort = 'newest',
    rating?: number,
    hasImages?: boolean
  ) {

    // Validate poster ID
    if (!this.isValidObjectId(posterId)) {
      throw new ValidationException('Invalid Poster ID format.');
    }

    // Sanitize pagination
    if (page < 1) page = 1;
    if (limit < 1 || limit > 100) limit = 10;

    // Calculate skip value
    const skip = (page - 1) * limit;

    // Build base filter
    const filter: FilterQuery<ReviewDocument> = { posterId };

    // Filter by rating if provided
    if (rating && rating >= 1 && rating <= 5) {
      filter.rating = rating;
    }

    // Filter reviews having images
    if (hasImages) {
      filter['images.0'] = { $exists: true };
    }

    // Determine sorting logic
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

    // Run queries in parallel
    const [reviews, totalReviews, ratingStats] = await Promise.all([
      this.reviewModel
        .find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email')
        .lean()
        .exec(),

      this.reviewModel.countDocuments(filter),

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

    // Rating distribution aggregation
    const ratingDistribution = await this.reviewModel.aggregate([
      { $match: { posterId: new mongoose.Types.ObjectId(posterId) } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
    ]);

    // Initialize distribution map
    const distribution: { [key: number]: number } = {};
    for (let i = 1; i <= 5; i++) {
      distribution[i] = 0;
    }

    // Fill distribution
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

  // ================= DELETE REVIEW =================
  async deleteReview(reviewId: string, userId: string, role: UserRole) {

    // Validate review ID
    if (!this.isValidObjectId(reviewId)) {
      throw new ValidationException('Invalid Review ID format.');
    }

    // Fetch review
    const existingReview = await this.reviewModel.findById(reviewId);

    // If not found
    if (!existingReview) {
      throw new NotFoundException('Review not found.');
    }

    // Authorization check
    if (
      role !== UserRole.ADMIN &&
      existingReview.userId.toString() !== userId
    ) {
      throw new ForbiddenException('You can only delete your own reviews.');
    }

    // Delete review
    await this.reviewModel.findByIdAndDelete(reviewId);
  }

  // ================= OBJECT ID VALIDATION =================
  private isValidObjectId(id: string): boolean {
    return /^[0-9a-fA-F]{24}$/.test(id);
  }
}
