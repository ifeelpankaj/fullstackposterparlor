import {
  Bind,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Auth, Public } from '@poster-parler/auth';
import { FileStructure, PosterFilter } from '@poster-parler/common';

import { AddPosterDto, UpdatePosterDto, UserRole } from '@poster-parler/models';
import { InventoryService } from './inventory.service';
import { HttpResponseUtil } from '@poster-parler/utils';
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}
  @Post()
  @Auth(UserRole.ADMIN)
  @Bind(UploadedFiles())
  @UseInterceptors(FileFieldsInterceptor([{ name: 'images', maxCount: 5 }]))
  async createInventoryItem(
    files: { images?: FileStructure[] },
    @Body() itemDetails: AddPosterDto
  ) {
    const images = files.images || [];

    const poster = await this.inventoryService.addInventoryItem(
      images,
      itemDetails
    );

    return poster;
  }
  @Get('featured')
  @Public()
  async getFeaturedPosters() {
    const posters = await this.inventoryService.getFeaturedPosters(8);
    return posters;
  }
  @Get()
  @Public()
  async getAllInventory(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('isAvailable') isAvailable?: string,
    @Query('category') category?: string,
    @Query('tags') tags?: string,
    @Query('title') title?: string,
    @Query('dimensions') dimensions?: string,
    @Query('material') material?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('minStock') minStock?: string,
    @Query('maxStock') maxStock?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: 'price' | 'stock' | 'createdAt' | 'title',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc'
  ) {
    const filters: PosterFilter = {};

    // Parse boolean
    if (isAvailable !== undefined) {
      filters.isAvailable = isAvailable === 'true';
    }

    // String filters
    if (category) filters.category = category;
    if (title) filters.title = title;
    if (dimensions) filters.dimensions = dimensions;
    if (material) filters.material = material;
    if (search) filters.search = search;

    // Tags (can be comma-separated)
    if (tags) {
      filters.tags = tags.includes(',')
        ? tags.split(',').map((t) => t.trim())
        : tags;
    }

    // Number filters
    if (minPrice) filters.minPrice = parseFloat(minPrice);
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice);
    if (minStock) filters.minStock = parseInt(minStock, 10);
    if (maxStock) filters.maxStock = parseInt(maxStock, 10);

    // Sort filters
    if (sortBy) filters.sortBy = sortBy;
    if (sortOrder) filters.sortOrder = sortOrder;

    const result = await this.inventoryService.getAllInventoryItem(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
      filters
    );
    return result;
  }

  @Get(':id')
  @Public()
  async getInventoryItemById(@Param('id') id: string) {
    const poster = await this.inventoryService.getInventoryItemById(id);
    return poster;
  }

  @Get('search')
  @Public()
  async searchInventoryItems(
    @Query('q') query: string,
    @Query('limit', ParseIntPipe) limit = 20
  ) {
    const items = await this.inventoryService.searchInventoryItems(
      query,
      limit
    );

    return items;
  }

  @Put(':id')
  @Auth(UserRole.ADMIN)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'images', maxCount: 10 }]))
  async updateInventoryItem(
    @Param('id') id: string,
    @UploadedFiles() files: { images?: FileStructure[] },
    @Body() updateDetails: UpdatePosterDto
  ) {
    const newImages = files.images || [];

    const updatedPoster = await this.inventoryService.updateInventoryItem(
      id,
      newImages,
      updateDetails
    );

    return updatedPoster;
  }

  @Get('categories/list')
  @Public()
  async getAllFilters() {
    const filters = await this.inventoryService.getFilters();
    return filters;
  }
  @Delete(':id')
  @Auth(UserRole.ADMIN)
  async softDeleteInventoryItem(@Param('id') id: string) {
    await this.inventoryService.softDeleteInventoryItem(id);
    return HttpResponseUtil.deleted('Inventory item soft-deleted successfully');
  }
  @Delete(':id/hard')
  @Auth(UserRole.ADMIN)
  async deleteInventoryItem(@Param('id') id: string) {
    await this.inventoryService.deleteInventoryItem(id);
    return HttpResponseUtil.deleted('Inventory item deleted successfully');
  }
}
