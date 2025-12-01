import { Body, Controller, Get, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from '@poster-parler/models';
import { Auth, CurrentUser } from '@poster-parler/auth';
import { AuthenticatedUser } from '@poster-parler/common';

@Controller('order')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Auth()
  async createOrder(
    @Body() orderDetail: CreateOrderDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    if (user) {
      orderDetail.userId = user.id;
    }
    const order = await this.ordersService.createOrder(orderDetail);
    return order;
  }

  @Get()
  @Auth()
  async getUserOrders(@CurrentUser() user: AuthenticatedUser) {
    const orders = await this.ordersService.getOrdersByUserId(user.id);
    return orders;
  }
  //   @Put()
  //   @Auth()
  //   async updateOrder() {
  //     // Implementation for updating an order will go here
  //     const order = await this.ordersService.updateOrder();
  //     return HttpResponseUtil.success(order, 'Order updated successfully');
  //   }
}
