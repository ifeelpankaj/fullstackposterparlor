import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrderDocument = Order & Document;

export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export interface OrderItem {
  posterId: Types.ObjectId | string; // Can be populated
  quantity: number;
  price: number;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface PaymentDetails {
  method: string;
  transactionId: string;
  amount: number;
  currency: string;
}

export interface CustomerInfo {
  userId: Types.ObjectId | string; // Can be populated
  name: string;
  email?: string;
  phone: string;
}

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  @Prop({
    required: true,
    type: {
      userId: { type: Types.ObjectId, ref: 'User' },
      name: String,
      email: String,
      phone: String,
    },
  })
  customer!: CustomerInfo;

  @Prop({
    required: true,
    type: [
      {
        posterId: { type: Types.ObjectId, ref: 'Poster', required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },
      },
    ],
  })
  items!: OrderItem[];

  @Prop({
    required: true,
    type: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
  })
  shippingAddress!: ShippingAddress;

  @Prop({
    required: true,
    type: {
      method: String,
      transactionId: String,
      amount: Number,
      currency: String,
    },
  })
  paymentDetails!: PaymentDetails;

  @Prop({
    required: true,
    enum: OrderStatus,
    default: OrderStatus.PENDING,
    index: true,
  })
  status!: OrderStatus;

  @Prop({ default: false })
  isPaid!: boolean;

  @Prop({ required: true, min: 0 })
  shippingCost!: number;

  @Prop({ required: true, min: 0 })
  taxAmount!: number;

  @Prop({ required: true, min: 0 })
  totalPrice!: number;

  @Prop({ type: String })
  trackingNumber?: string;

  @Prop({ type: String })
  notes?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// Add indexes for common queries
OrderSchema.index({ 'customer.userId': 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ 'paymentDetails.transactionId': 1 });
