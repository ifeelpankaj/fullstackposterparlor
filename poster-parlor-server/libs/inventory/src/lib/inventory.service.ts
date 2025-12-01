import { Injectable } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import {
  FileStructure,
  FilterResponse,
  PosterFilter,
} from '@poster-parler/common';
import {
  BadRequestException,
  NotFoundException,
  ValidationException,
} from '@poster-parler/utils';
import { InjectModel } from '@nestjs/mongoose';
import {
  AddPosterDto,
  Poster,
  PosterDocument,
  PosterImage,
  UpdatePosterDto,
} from '@poster-parler/models';
import { Model, FilterQuery } from 'mongoose';
import { UploadApiResponse } from 'cloudinary';

@Injectable()
export class InventoryService {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
    @InjectModel(Poster.name)
    private readonly posterModel: Model<PosterDocument>
  ) {}
  //Add Inventory Item with Image Upload to Cloudinary
  async addInventoryItem(images: FileStructure[], itemDetails: AddPosterDto) {
    // Validation
    if (itemDetails.stock < 0) {
      throw new BadRequestException('Stock cannot be negative');
    }

    if (images.length === 0) {
      throw new BadRequestException('At least one image is required');
    }

    if (itemDetails.title.trim().length === 0) {
      throw new BadRequestException('Title cannot be empty');
    }

    if (itemDetails.price < 0) {
      throw new BadRequestException('Price cannot be negative');
    }

    let uploadResults: UploadApiResponse[] = [];

    try {
      // Upload all images at once
      uploadResults = await this.cloudinaryService.uploadMultipleImages(images);

      // Transform to match schema
      const imageUploadResults: PosterImage[] = uploadResults.map((result) => ({
        url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
      }));

      // Create the new inventory item
      const newInventoryItem = {
        ...itemDetails,
        images: imageUploadResults,
      };

      const createdInventoryItem = new this.posterModel(newInventoryItem);
      return await createdInventoryItem.save();
    } catch (error) {
      // Clean up uploaded images if anything fails
      if (uploadResults.length > 0) {
        const publicIds = uploadResults.map((result) => result.public_id);
        await this.cloudinaryService.deleteMultipleImages(publicIds);
      }
      throw error;
    }
  }
  //Get all inventory items with filters and pagination
  async getAllInventoryItem(page = 1, limit = 10, filters: PosterFilter = {}) {
    // Validation
    if (page < 1 || limit < 1) {
      throw new BadRequestException('Page and limit must be positive numbers');
    }

    if (limit > 100) {
      throw new BadRequestException('Limit cannot exceed 100');
    }

    // Validate price range
    if (filters.minPrice !== undefined && filters.minPrice < 0) {
      throw new BadRequestException('Minimum price cannot be negative');
    }

    if (
      filters.minPrice !== undefined &&
      filters.maxPrice !== undefined &&
      filters.minPrice > filters.maxPrice
    ) {
      throw new BadRequestException(
        'Minimum price cannot be greater than maximum price'
      );
    }

    // Validate stock range
    if (filters.minStock !== undefined && filters.minStock < 0) {
      throw new BadRequestException('Minimum stock cannot be negative');
    }

    if (
      filters.minStock !== undefined &&
      filters.maxStock !== undefined &&
      filters.minStock > filters.maxStock
    ) {
      throw new BadRequestException(
        'Minimum stock cannot be greater than maximum stock'
      );
    }

    const skip = (page - 1) * limit;
    const query = this.buildQuery(filters);
    const sort = this.buildSort(filters);

    const [posters, total] = await Promise.all([
      this.posterModel
        .find(query)
        .skip(skip)
        .limit(limit)
        .lean()
        .sort(sort)
        .exec(),
      this.posterModel.countDocuments(query),
    ]);

    return {
      posters,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
      filters: filters,
    };
  }
  //Get Inventory Item by ID
  async getInventoryItemById(id: string) {
    if (!id || !this.isValidObjectId(id)) {
      throw new BadRequestException('Invalid task ID format');
    }

    const poster = await this.posterModel.findById(id).lean().exec();

    if (!poster) {
      throw new NotFoundException('Inventory item not found', { itemId: id });
    }

    return poster;
  }
  //search inventory items
  async searchInventoryItems(searchTerm: string, limit = 20) {
    const query: FilterQuery<PosterDocument> = {
      $or: [
        { title: new RegExp(searchTerm, 'i') },
        { description: new RegExp(searchTerm, 'i') },
        { tags: new RegExp(searchTerm, 'i') },
      ],
    };
    const items = await this.posterModel.find(query).limit(limit).lean().exec();
    return items;
  }
  //Update Inventory Item and Delete Images from Cloudinary
  async updateInventoryItem(
    id: string,
    newImages: FileStructure[],
    updateDetails: UpdatePosterDto
  ) {
    // Get existing poster
    const existingPoster = await this.posterModel.findById(id);
    if (!existingPoster) {
      throw new NotFoundException('Poster not found');
    }

    // Validation for non-image fields
    if (updateDetails.stock !== undefined && updateDetails.stock < 0) {
      throw new BadRequestException('Stock cannot be negative');
    }

    if (updateDetails.price !== undefined && updateDetails.price < 0) {
      throw new BadRequestException('Price cannot be negative');
    }

    if (
      updateDetails.title !== undefined &&
      updateDetails.title.trim().length === 0
    ) {
      throw new BadRequestException('Title cannot be empty');
    }

    let uploadedImages: UploadApiResponse[] = [];
    let imagesToCleanup: string[] = [];

    try {
      // Handle image updates ONLY if there's image-related data
      let finalImages = [...existingPoster.images];
      const hasImageUpdates =
        newImages.length > 0 ||
        (updateDetails.imagesToDelete &&
          updateDetails.imagesToDelete.length > 0) ||
        updateDetails.imageAction === 'replace';

      if (hasImageUpdates) {
        // 1. Delete specific images if requested
        if (
          updateDetails.imagesToDelete &&
          updateDetails.imagesToDelete.length > 0
        ) {
          const imagesToDelete = updateDetails.imagesToDelete;
          await this.cloudinaryService.deleteMultipleImages(imagesToDelete);

          finalImages = finalImages.filter(
            (img) => !imagesToDelete.includes(img.public_id)
          );
        }

        // 2. Handle new images upload
        if (newImages.length > 0) {
          uploadedImages = await this.cloudinaryService.uploadMultipleImages(
            newImages
          );
          imagesToCleanup = uploadedImages.map((img) => img.public_id);

          const newImageObjects: PosterImage[] = uploadedImages.map(
            (result) => ({
              url: result.secure_url,
              public_id: result.public_id,
              format: result.format,
              width: result.width,
              height: result.height,
            })
          );

          if (updateDetails.imageAction === 'replace') {
            const oldPublicIds = finalImages.map((img) => img.public_id);
            if (oldPublicIds.length > 0) {
              await this.cloudinaryService.deleteMultipleImages(oldPublicIds);
            }
            finalImages = newImageObjects;
          } else {
            finalImages = [...finalImages, ...newImageObjects];
          }
        }

        // Ensure at least one image remains
        if (finalImages.length === 0) {
          throw new ValidationException('At least one image is required');
        }
      }

      // Prepare update object - extract only poster fields
      const { ...posterFields } = updateDetails;

      const updateData: Partial<Poster> = {
        ...posterFields,
      };

      // Only update images if there were image changes
      if (hasImageUpdates) {
        updateData.images = finalImages;
      }

      // Update the poster
      const updatedPoster = await this.posterModel.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );

      return updatedPoster;
    } catch (error) {
      // Cleanup newly uploaded images if update fails
      if (imagesToCleanup.length > 0) {
        await this.cloudinaryService.deleteMultipleImages(imagesToCleanup);
      }
      throw error;
    }
  }
  //Get all categories
  async getFilters(): Promise<FilterResponse> {
    // Execute all queries in parallel for better performance
    const [categories, materials, dimensions] = await Promise.all([
      this.posterModel.distinct('category').lean().exec(),
      this.posterModel.distinct('material').lean().exec(),
      this.posterModel.distinct('dimensions').lean().exec(),
    ]);

    return {
      categories,
      materials,
      dimensions,
    };
  }
  async getFeaturedPosters(limit = 8): Promise<Poster[]> {
    const featuredPosters = await this.posterModel
      .find({ isAvailable: true })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean()
      .exec();
    return featuredPosters;
  }
  async deleteInventoryItem(id: string): Promise<void> {
    // Validate ID
    if (!id || !this.isValidObjectId(id)) {
      throw new BadRequestException('Invalid inventory item ID format');
    }
    // Find the item to delete
    const itemToDelete = await this.posterModel.findById(id).exec();
    if (!itemToDelete) {
      throw new NotFoundException('Inventory item not found', { itemId: id });
    }
    // Delete associated images from Cloudinary
    const imagePublicIds = itemToDelete.images.map((img) => img.public_id);
    if (imagePublicIds.length > 0) {
      await this.cloudinaryService.deleteMultipleImages(imagePublicIds);
    }
    await this.posterModel.findByIdAndDelete(id).exec();
  }
  async softDeleteInventoryItem(id: string): Promise<void> {
    // Validate ID
    if (!id || !this.isValidObjectId(id)) {
      throw new BadRequestException('Invalid inventory item ID format');
    }
    await this.posterModel
      .findByIdAndUpdate(id, { isAvailable: false }, { new: true })
      .exec();
  }
  ///Helper functions
  private buildQuery(filters: PosterFilter): FilterQuery<PosterDocument> {
    const query: FilterQuery<PosterDocument> = {};

    // Filter by availability
    if (filters.isAvailable !== undefined) {
      query.isAvailable = filters.isAvailable;
    }

    // Filter by category (exact match, case-insensitive)
    if (filters.category) {
      query.category = new RegExp(`^${filters.category}$`, 'i');
    }

    // Filter by tags (can match any tag in the array)
    if (filters.tags) {
      if (Array.isArray(filters.tags)) {
        // Match any of the provided tags
        query.tags = { $in: filters.tags.map((tag) => new RegExp(tag, 'i')) };
      } else {
        // Match single tag
        query.tags = new RegExp(filters.tags, 'i');
      }
    }

    // Filter by title (partial match, case-insensitive)
    if (filters.title) {
      query.title = new RegExp(filters.title, 'i');
    }

    // Filter by dimensions (exact match, case-insensitive)
    if (filters.dimensions) {
      query.dimensions = new RegExp(`^${filters.dimensions}$`, 'i');
    }

    // Filter by material (partial match, case-insensitive)
    if (filters.material) {
      query.material = new RegExp(filters.material, 'i');
    }

    // Filter by price range
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      query.price = {};
      if (filters.minPrice !== undefined) {
        query.price.$gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        query.price.$lte = filters.maxPrice;
      }
    }

    // Filter by stock range
    if (filters.minStock !== undefined || filters.maxStock !== undefined) {
      query.stock = {};
      if (filters.minStock !== undefined) {
        query.stock.$gte = filters.minStock;
      }
      if (filters.maxStock !== undefined) {
        query.stock.$lte = filters.maxStock;
      }
    }

    // Global search across title, description, and tags
    if (filters.search) {
      query.$or = [
        { title: new RegExp(filters.search, 'i') },
        { description: new RegExp(filters.search, 'i') },
        { tags: new RegExp(filters.search, 'i') },
      ];
    }

    return query;
  }

  private buildSort(filters: PosterFilter): FilterQuery<PosterDocument> {
    const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;

    switch (filters.sortBy) {
      case 'price':
        return { price: sortOrder };
      case 'stock':
        return { stock: sortOrder };
      case 'title':
        return { title: sortOrder };
      case 'createdAt':
      default:
        return { createdAt: sortOrder };
    }
  }

  private isValidObjectId(id: string): boolean {
    return /^[0-9a-fA-F]{24}$/.test(id);
  }
}
