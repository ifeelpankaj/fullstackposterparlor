export interface FileStructure {
  fieldname: string;
  originalname: string;
  encoding?: string;
  mimetype: string;
  size: number;
  url?: string;
  public_id?: string;
  width?: number;
  height?: number;
  format?: string;
  buffer: Buffer;
}
export interface PosterFilter {
  isAvailable?: boolean;
  category?: string;
  tags?: string | string[]; // Single tag or array of tags
  title?: string; // Search by title (partial match)
  dimensions?: string;
  material?: string;
  minPrice?: number;
  maxPrice?: number;
  minStock?: number;
  maxStock?: number;
  search?: string; // Global search across title, description, tags
  sortBy?: 'price' | 'stock' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}
export interface FilterResponse {
  categories: string[];
  materials: string[];
  dimensions: string[];
}
export interface PosterImage {
  url: string;
  public_id: string;
  format?: string;
  width?: number;
  height?: number;
}
