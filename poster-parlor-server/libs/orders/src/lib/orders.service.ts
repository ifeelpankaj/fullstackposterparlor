// Import Injectable decorator to mark this class as a NestJS provider
import { Injectable } from '@nestjs/common';
// Import InjectModel decorator to inject Mongoose models into the service
import { InjectModel } from '@nestjs/mongoose';
// Import all required model types and DTOs from the shared models package
import {
  CreateOrderDto, // Data Transfer Object for creating new orders
  Order, // Order model schema definition
  OrderDocument, // TypeScript type for Order documents with Mongoose methods
  OrderStatus, // Enum containing order status values (PENDING, PROCESSING, etc.)
  Poster, // Poster model schema definition
  PosterDocument, // TypeScript type for Poster documents with Mongoose methods
  User, // User model schema definition
  UserDocument, // TypeScript type for User documents with Mongoose methods
} from '@poster-parlor-api/models';
// Import custom exception classes for error handling
import {
  BadRequestException, // Exception for invalid client requests (400 errors)
  NotFoundException, // Exception for resources not found (404 errors)
} from '@poster-parlor-api/utils';
// Import Mongoose Model type for database operations
import { Model } from 'mongoose';

// Interface defining the structure of paginated order response
export interface PaginatedOrdersResponse {
  orders: OrderDocument[]; // Array of order documents for current page
  pagination: { // Pagination metadata object
    currentPage: number; // Current page number being displayed
    totalPages: number; // Total number of pages available
    totalOrders: number; // Total count of all orders in the database
    limit: number; // Maximum number of orders per page
    hasNextPage: boolean; // Boolean indicating if there's a next page
    hasPrevPage: boolean; // Boolean indicating if there's a previous page
  };
}

// Mark this class as a NestJS injectable service
@Injectable()
export class OrdersService {
  // Constructor with dependency injection of Mongoose models
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>, // Inject Order model for database operations
    @InjectModel(Poster.name) private posterModel: Model<PosterDocument>, // Inject Poster model to validate poster data
    @InjectModel(User.name) private userModel: Model<UserDocument> // Inject User model to fetch user information
  ) {}

  // Private helper method to validate MongoDB ObjectId format
  private isValidObjectId(id: string): boolean {
    // Test if the ID matches MongoDB's 24-character hexadecimal format
    return /^[0-9a-fA-F]{24}$/.test(id);
  }

  /**
   * Validate order items and return pricing info
   * Used for payment initiation to verify amounts before processing payment
   */
  public async validateOrderItems(
    // Array of items to validate - each item contains poster ID, quantity, and price
    items: { posterId: string; quantity: number; price: number }[]
  ): Promise<{
    // Return type: validated items array and calculated subtotal
    validatedItems: { posterId: string; quantity: number; price: number }[];
    subtotal: number;
  }> {
    // Check if items array exists and has at least one item
    if (!items || items.length === 0) {
      // Throw error if cart is empty
      throw new BadRequestException('Order must have at least one item');
    }

    // Validate that all poster IDs are valid MongoDB ObjectIds
    if (items.some((item) => !this.isValidObjectId(item.posterId))) {
      // Throw error if any ID has invalid format
      throw new BadRequestException('Invalid poster ID format');
    }

    // Initialize subtotal accumulator to calculate total price
    let subtotal = 0;
    // Initialize array to store validated items with confirmed prices
    const validatedItems = [];

    // Loop through each item in the order to validate
    for (const item of items) {
      // Fetch poster details from database using lean() for better performance
      const poster = await this.posterModel.findById(item.posterId).lean();
      // Check if poster exists in database
      if (!poster) {
        // Throw error if poster not found
        throw new NotFoundException(
          `Poster with ID ${item.posterId} not found`
        );
      }

      // Check if poster has sufficient stock for the requested quantity
      if (poster.stock !== undefined && poster.stock < item.quantity) {
        // Throw error with specific stock availability information
        throw new BadRequestException(
          `Insufficient stock for poster "${poster.title}". Available: ${poster.stock}, Requested: ${item.quantity}`
        );
      }

      // Verify that the price sent by client matches the actual poster price
      // Using 0.01 tolerance to handle floating point precision issues
      if (Math.abs(item.price - poster.price) > 0.01) {
        // Throw error to prevent price manipulation attacks
        throw new BadRequestException(
          `Price mismatch for poster "${poster.title}". Expected: ${poster.price}, Received: ${item.price}`
        );
      }

      // Add validated item with confirmed price from database
      validatedItems.push({
        posterId: item.posterId, // Poster's unique identifier
        quantity: item.quantity, // Quantity requested by customer
        price: poster.price, // Price confirmed from database (trusted source)
      });

      // Add item's total price to running subtotal
      subtotal += poster.price * item.quantity;
    }

    // Return validated items and calculated subtotal
    return { validatedItems, subtotal };
  }

  // Public method to create a new order in the database
  public async createOrder(
    orderDetail: CreateOrderDto, // Order details from the client
    paymentInfo?: { razorpayPaymentId?: string; razorpayOrderId?: string } // Optional payment info from Razorpay
  ): Promise<OrderDocument> {
    try {
      // ------------------ ID VALIDATION ------------------
      // Validate all MongoDB ObjectIds in the order (user ID and poster IDs)
      if (
        (orderDetail.userId && !this.isValidObjectId(orderDetail.userId)) || // Check user ID format if provided
        orderDetail.items?.some((item) => !this.isValidObjectId(item.posterId)) // Check all poster ID formats
      ) {
        // Throw error if any ID is invalid
        throw new BadRequestException('Invalid ID format');
      }

      // ------------------ ITEM VALIDATION ------------------
      // Initialize subtotal for calculating total order value
      let subtotal = 0;
      // Array to store items after validation
      const validatedItems = [];
      
      // Iterate through each item to validate stock, price, and availability
      for (const item of orderDetail.items) {
        // Fetch poster from database using lean() for performance
        const poster = await this.posterModel.findById(item.posterId).lean();
        // Check if poster exists
        if (!poster) {
          // Throw error if poster not found
          throw new NotFoundException(
            `Poster with ID ${item.posterId} not found`
          );
        }

        // Verify stock availability before creating order
        if (poster.stock !== undefined && poster.stock < item.quantity) {
          // Throw error with specific stock information
          throw new BadRequestException(
            `Insufficient stock for poster "${poster.title}". Available: ${poster.stock}, Requested: ${item.quantity}`
          );
        }

        // Verify price to prevent price manipulation from client side
        if (Math.abs(item.price - poster.price) > 0.01) {
          // Throw error if prices don't match
          throw new BadRequestException(
            `Price mismatch for poster "${poster.title}". Expected: ${poster.price}, Received: ${item.price}`
          );
        }

        // Add validated item with database-confirmed price
        validatedItems.push({
          posterId: item.posterId, // Poster identifier
          quantity: item.quantity, // Quantity ordered
          price: poster.price, // Price from database (trusted)
        });

        // Add this item's total to subtotal
        subtotal += poster.price * item.quantity;
      }

      // ------------------ CUSTOMER INFO ------------------
      // Initialize customer information object
      let customerInfo = null;

      // If order is from a logged-in user, fetch and use their details
      if (orderDetail.userId) {
        // Fetch user details from database
        const user = await this.userModel.findById(orderDetail.userId);
        // Check if user exists
        if (!user) {
          // Throw error if user not found
          throw new NotFoundException('User not found');
        }

        // Build customer info object, preferring order-specific details over user profile
        customerInfo = {
          userId: orderDetail.userId, // Reference to user document
          name: orderDetail.customer?.name || user.name, // Use provided name or fallback to user's name
          email: orderDetail.customer?.email || user.email, // Use provided email or fallback to user's email
          phone: orderDetail.customer?.phone, // Phone number if provided
        };
      }

      // ------------------ CALCULATIONS ------------------
      // Calculate shipping cost using provided value or calculate based on subtotal and state
      const shippingCost =
        orderDetail.shippingCost ?? // Use provided shipping cost if available
        this.calculateShipping(subtotal, orderDetail.shippingAddress.state); // Otherwise calculate based on location

      // Calculate tax amount using provided value or calculate based on subtotal
      const taxAmount = orderDetail.taxAmount ?? this.calculateTax(subtotal); // Calculate 18% GST if not provided

      // Calculate final total price including all charges
      const totalPrice =
        orderDetail.totalPrice ?? subtotal + shippingCost + taxAmount; // Use provided total or calculate

      // Verify that payment amount matches calculated total price
      if (Math.abs(orderDetail.paymentDetails.amount - totalPrice) > 0.01) {
        // Throw error if payment amount doesn't match to prevent fraud
        throw new BadRequestException(
          `Payment amount mismatch. Expected: ${totalPrice}, Received: ${orderDetail.paymentDetails.amount}`
        );
      }
      
      // ------------------ PAYMENT METHOD VALIDATION ------------------
      // Build payment details object with Razorpay transaction ID if available
      const paymentDetails = {
        ...orderDetail.paymentDetails, // Spread existing payment details
        transactionId:
          paymentInfo?.razorpayPaymentId || // Use Razorpay payment ID if available
          orderDetail.paymentDetails.transactionId || // Or use provided transaction ID
          '', // Or empty string as fallback
      };

      // ------------------ CREATE ORDER ------------------
      // Create new order document with validated and calculated data
      const order = new this.orderModel({
        customer: customerInfo, // Customer information (from user or guest)
        items: validatedItems, // Validated order items with confirmed prices
        shippingAddress: orderDetail.shippingAddress, // Delivery address
        paymentDetails, // Payment information including transaction ID
        status: orderDetail.status || OrderStatus.PENDING, // Order status (default: PENDING)
        isPaid:
          orderDetail.isPaid ?? orderDetail.paymentDetails.method !== 'COD', // Mark as paid if not Cash on Delivery
        shippingCost, // Calculated or provided shipping cost
        taxAmount, // Calculated or provided tax amount
        totalPrice, // Final total price
        notes: orderDetail.notes, // Optional order notes
      });

      // Save order to database
      const savedOrder = await order.save();
      // Check if save was successful
      if (!savedOrder) {
        // Throw error if save failed
        throw new BadRequestException('Failed to create order');
      }

      // ------------------ UPDATE STOCK ------------------
      // Reduce poster stock for each ordered item
      for (const item of validatedItems) {
        // Use atomic $inc operation to decrement stock count
        await this.posterModel.findByIdAndUpdate(item.posterId, {
          $inc: { stock: -item.quantity }, // Decrement stock by ordered quantity
        });
      }

      // Return the successfully created order
      return savedOrder;
    } catch (error) {
      // Log the error for debugging purposes (replace with proper logging in production)
      console.error('Order Creation Failed:', error);

      // Re-throw the error to be handled by global error handler
      throw error;
    }
  }

  // Public method to fetch all orders for a specific user with pagination
  public async getOrdersByUserId(
    userId: string, // User's unique identifier
    page: number = 1, // Page number (default: first page)
    limit: number = 10 // Items per page (default: 10)
  ): Promise<PaginatedOrdersResponse> {
    // Validate user ID format
    if (!this.isValidObjectId(userId)) {
      // Throw error if user ID is invalid
      throw new BadRequestException('Invalid user ID format');
    }

    // Ensure page number is at least 1
    const validPage = Math.max(1, page);
    // Ensure limit is between 1 and 50 to prevent performance issues
    const validLimit = Math.min(50, Math.max(1, limit)); // Max 50 items per page
    // Calculate how many documents to skip for pagination
    const skip = (validPage - 1) * validLimit;

    // Get total count of orders for this user (needed for pagination metadata)
    const totalOrders = await this.orderModel
      .countDocuments({ 'customer.userId': userId }) // Count orders where customer.userId matches
      .exec();

    // Fetch paginated orders for the user
    const orders = await this.orderModel
      .find({ 'customer.userId': userId }) // Filter orders by user ID
      .sort({ createdAt: -1 }) // Sort by creation date, newest first
      .skip(skip) // Skip documents for previous pages
      .limit(validLimit) // Limit results to page size
      .exec();

    // Calculate total number of pages
    const totalPages = Math.ceil(totalOrders / validLimit);

    // Return orders with pagination metadata
    return {
      orders, // Array of order documents for current page
      pagination: {
        currentPage: validPage, // Current page number
        totalPages, // Total number of pages
        totalOrders, // Total count of all orders
        limit: validLimit, // Number of items per page
        hasNextPage: validPage < totalPages, // Boolean: is there a next page?
        hasPrevPage: validPage > 1, // Boolean: is there a previous page?
      },
    };
  }

  // Public method to fetch a single order by its ID
  public async getOrderById(
    orderId: string, // Order's unique identifier
    userId?: string // Optional user ID to verify ownership
  ): Promise<OrderDocument> {
    // Validate order ID format
    if (!this.isValidObjectId(orderId)) {
      // Throw error if order ID is invalid
      throw new BadRequestException('Invalid order ID format');
    }

    // Fetch order from database with populated poster details
    const order = await this.orderModel
      .findById(orderId) // Find order by ID
      .populate({
        path: 'items.posterId', // Populate the posterId field in items array
        model: 'Poster', // Reference Poster model
        select: 'title images dimensions material category', // Select only specific fields
      })
      .exec();

    // Check if order exists
    if (!order) {
      // Throw error if order not found
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // If userId is provided, verify that the order belongs to the requesting user
    if (userId && order.customer?.userId?.toString() !== userId) {
      // Throw not found error (don't reveal that order exists for security)
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Return the order document with populated poster details
    return order;
  }

  // Helper methods for calculations
  // NOTE: These calculations must match the frontend pricing utils at:
  // web/src/lib/utils/pricing.utils.ts
  
  // Private method to calculate shipping cost based on subtotal and delivery state
  private calculateShipping(subtotal: number, state: string): number {
    // Base shipping charge for orders below free shipping threshold
    const baseShipping = 50;
    // Minimum order value for free shipping
    const freeShippingThreshold = 250;

    // Determine base shipping: free if subtotal >= ₹250, otherwise ₹50 flat fee
    const shipping = subtotal >= freeShippingThreshold ? 0 : baseShipping;

    // Array of remote states that require additional shipping charges
    const remoteStates = ['Jammu and Kashmir', 'Arunachal Pradesh', 'Ladakh'];
    // Additional charge for remote states (₹150 extra)
    const remoteCharge = remoteStates.includes(state) ? 150 : 0;

    // Return total shipping cost: base shipping + remote area charge
    // Formula: (0 or 50) + remote charge (150 for remote states)
    return shipping + remoteCharge;
  }

  // Private method to calculate tax amount (GST) on the subtotal
  private calculateTax(subtotal: number): number {
    // Calculate 18% GST (Goods and Services Tax) for India
    // Round to nearest integer to avoid decimal issues with currency
    return Math.round(subtotal * 0.18);
  }
}
