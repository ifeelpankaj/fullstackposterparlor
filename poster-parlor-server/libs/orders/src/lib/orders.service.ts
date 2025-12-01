import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  CreateOrderDto,
  Order,
  OrderDocument,
  OrderStatus,
  Poster,
  PosterDocument,
  User,
  UserDocument,
} from '@poster-parler/models';
import { BadRequestException, NotFoundException } from '@poster-parler/utils';
import { Model } from 'mongoose';
@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Poster.name) private posterModel: Model<PosterDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>
  ) {}

  private isValidObjectId(id: string): boolean {
    return /^[0-9a-fA-F]{24}$/.test(id);
  }
  public async createOrder(
    orderDetail: CreateOrderDto
  ): Promise<OrderDocument> {
    try {
      // ------------------ ID VALIDATION ------------------
      if (
        (orderDetail.userId && !this.isValidObjectId(orderDetail.userId)) ||
        orderDetail.items?.some((item) => !this.isValidObjectId(item.posterId))
      ) {
        throw new BadRequestException('Invalid ID format');
      }

      // ------------------ ITEM VALIDATION ------------------
      let subtotal = 0;
      const validatedItems = [];
      for (const item of orderDetail.items) {
        const poster = await this.posterModel.findById(item.posterId).lean();
        if (!poster) {
          throw new NotFoundException(
            `Poster with ID ${item.posterId} not found`
          );
        }

        // Check stock availability
        if (poster.stock !== undefined && poster.stock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for poster "${poster.title}". Available: ${poster.stock}, Requested: ${item.quantity}`
          );
        }

        // Verify price matches (avoid price manipulation)
        if (Math.abs(item.price - poster.price) > 0.01) {
          throw new BadRequestException(
            `Price mismatch for poster "${poster.title}". Expected: ${poster.price}, Received: ${item.price}`
          );
        }

        validatedItems.push({
          posterId: item.posterId,
          quantity: item.quantity,
          price: poster.price,
        });

        subtotal += poster.price * item.quantity;
      }

      // ------------------ CUSTOMER INFO ------------------
      let customerInfo = null;

      if (orderDetail.userId) {
        const user = await this.userModel.findById(orderDetail.userId);
        if (!user) {
          throw new NotFoundException('User not found');
        }

        customerInfo = {
          userId: orderDetail.userId,
          name: orderDetail.customer?.name || user.name,
          email: orderDetail.customer?.email || user.email,
          phone: orderDetail.customer?.phone,
        };
      }

      // ------------------ CALCULATIONS ------------------
      const shippingCost =
        orderDetail.shippingCost ??
        this.calculateShipping(
          orderDetail.items.reduce((sum, item) => sum + item.quantity, 0),
          orderDetail.shippingAddress.state
        );

      const taxAmount = orderDetail.taxAmount ?? this.calculateTax(subtotal);

      const totalPrice =
        orderDetail.totalPrice ?? subtotal + shippingCost + taxAmount;

      // Payment amount must match
      if (Math.abs(orderDetail.paymentDetails.amount - totalPrice) > 0.01) {
        throw new BadRequestException(
          `Payment amount mismatch. Expected: ${totalPrice}, Received: ${orderDetail.paymentDetails.amount}`
        );
      }
      // ------------------ PAYMENT METHOD VALIDATION ------------------
      //will add in future
      // ------------------ CREATE ORDER ------------------
      const order = new this.orderModel({
        customer: customerInfo,
        items: validatedItems,
        shippingAddress: orderDetail.shippingAddress,
        paymentDetails: orderDetail.paymentDetails,
        status: orderDetail.status || OrderStatus.PENDING,
        isPaid:
          orderDetail.isPaid ?? orderDetail.paymentDetails.method !== 'COD',
        shippingCost,
        taxAmount,
        totalPrice,
        notes: orderDetail.notes,
      });

      const savedOrder = await order.save();
      if (!savedOrder) {
        throw new BadRequestException('Failed to create order');
      }

      // ------------------ UPDATE STOCK ------------------
      for (const item of validatedItems) {
        await this.posterModel.findByIdAndUpdate(item.posterId, {
          $inc: { stock: -item.quantity },
        });
      }

      return savedOrder;
    } catch (error) {
      // Log the error for debugging replace with proper logging in real app
      console.error('Order Creation Failed:', error);

      // global error handler will handle it
      throw error;
    }
  }

  public async getOrdersByUserId(
    userId: string
  ): Promise<OrderDocument[] | null> {
    if (!this.isValidObjectId(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const userOrders = await this.orderModel
      .find({ 'customer.userId': userId })
      .exec();
    if (userOrders.length === 0) {
      return null;
    }
    return userOrders;
  }
  // Helper methods for calculations
  private calculateShipping(totalQuantity: number, state: string): number {
    const baseShipping = 50;
    const perItemShipping = 20;

    // Add state-based shipping (example: higher for remote areas)
    const remoteStates = ['Jammu and Kashmir', 'Arunachal Pradesh', 'Ladakh'];
    const remoteCharge = remoteStates.includes(state) ? 150 : 0;

    return baseShipping + (totalQuantity - 1) * perItemShipping + remoteCharge;
  }

  private calculateTax(subtotal: number): number {
    // 18% GST for India
    return subtotal * 0.18;
  }
}
