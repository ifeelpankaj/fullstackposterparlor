import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsPostalCode,
  IsString,
  Min,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '../schema/order.schema';

export class OrderItemDto {
  @IsMongoId()
  @IsNotEmpty()
  posterId!: string;

  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  quantity!: number;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  price!: number; // Price per unit at time of order
}

export class ShippingAddressDto {
  @IsString()
  @IsNotEmpty()
  addressLine1!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;

  @IsPostalCode('IN')
  @IsNotEmpty()
  pincode!: string;

  @IsPhoneNumber('IN')
  @IsNotEmpty()
  phone!: string;
}

export class PaymentDetailsDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['ONLINE', 'COD']) // Add your payment methods
  method!: string;

  @IsString()
  @IsNotEmpty()
  transactionId!: string;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amount!: number; // Total amount paid

  @IsString()
  @IsNotEmpty()
  @IsIn(['INR', 'USD']) // Add supported currencies
  currency!: string;
}

export class CustomerInfoDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsPhoneNumber('IN')
  @IsNotEmpty()
  phone!: string;
}
export class CreateOrderDto {
  // Customer Information (optional for authenticated users)
  @ValidateNested()
  @Type(() => CustomerInfoDto)
  @IsOptional()
  customer?: CustomerInfoDto;

  // Internal use - will be set by controller if user is authenticated
  @IsMongoId()
  @IsOptional()
  userId?: string;

  // Order Items (support multiple items)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  @IsNotEmpty()
  items!: OrderItemDto[];

  // Shipping Address
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  @IsNotEmpty()
  shippingAddress!: ShippingAddressDto;

  // Payment Details
  @ValidateNested()
  @Type(() => PaymentDetailsDto)
  @IsNotEmpty()
  paymentDetails!: PaymentDetailsDto;

  // Order Status (usually set by system, not client)
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  // Payment Status
  @IsBoolean()
  @IsOptional()
  isPaid?: boolean;

  // Pricing Details (optional - can be calculated by backend)
  @IsNumber()
  @Min(0)
  @IsOptional()
  shippingCost?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  taxAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  totalPrice?: number;

  // Optional notes
  @IsString()
  @IsOptional()
  notes?: string;
}
