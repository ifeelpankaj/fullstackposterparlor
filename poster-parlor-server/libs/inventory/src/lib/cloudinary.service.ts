import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  v2 as cloudinary,
  UploadApiResponse,
  DeleteApiResponse,
} from 'cloudinary';
import { config_keys } from '@poster-parler/config';
import { FileStructure } from '@poster-parler/common';
import { Readable } from 'stream';
import { CustomHttpException } from '@poster-parler/utils';

@Injectable()
export class CloudinaryService {
  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>(
        config_keys.CLOUDINARY_CLOUD_NAME
      ),
      api_key: this.configService.get<string>(config_keys.CLOUDINARY_API_KEY),
      api_secret: this.configService.get<string>(
        config_keys.CLOUDINARY_API_SECRET
      ),
    });
  }

  async uploadImage(file: FileStructure): Promise<UploadApiResponse> {
    try {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'Posters', resource_type: 'image' },
          (error, result) => {
            if (error) return reject(error);
            resolve(result as UploadApiResponse);
          }
        );

        const readable = this.bufferToReadable(file.buffer);
        readable.pipe(uploadStream);
      });

      if (!result || !result.secure_url) {
        throw new CustomHttpException(
          'Cloudinary upload failed: no url returned'
        );
      }

      return result;
    } catch (err) {
      console.error('Cloudinary upload error:', err);
      throw new CustomHttpException(
        'Failed to upload image to Cloudinary',
        500
      );
    }
  }
  async uploadMultipleImages(
    files: FileStructure[]
  ): Promise<UploadApiResponse[]> {
    if (!files || files.length === 0) {
      throw new CustomHttpException('No files provided for upload', 400);
    }

    const uploadPromises = files.map((file) => this.uploadImage(file));

    try {
      const results = await Promise.all(uploadPromises);
      return results;
    } catch (err) {
      throw new CustomHttpException(
        'Failed to upload one or more images to Cloudinary',
        500,
        `${(err as Error).message}`,
        err
      );
    }
  }
  async deleteImage(publicId: string): Promise<DeleteApiResponse> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
      });

      if (result.result !== 'ok' && result.result !== 'not found') {
        throw new CustomHttpException(
          `Cloudinary delete failed: ${result.result}`
        );
      }

      return result;
    } catch (err) {
      console.error('Cloudinary delete error:', err);
      throw new CustomHttpException(
        'Failed to delete image from Cloudinary',
        500
      );
    }
  }

  async deleteMultipleImages(publicIds: string[]): Promise<void> {
    try {
      const deletePromises = publicIds.map((publicId) =>
        this.deleteImage(publicId)
      );
      await Promise.all(deletePromises);
    } catch (err) {
      console.error('Cloudinary bulk delete error:', err);
      throw new CustomHttpException(
        'Failed to delete multiple images from Cloudinary',
        500
      );
    }
  }

  bufferToReadable(buffer: Buffer): Readable {
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    return stream;
  }
}
