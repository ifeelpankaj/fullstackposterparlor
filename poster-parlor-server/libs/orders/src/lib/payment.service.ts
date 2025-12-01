import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { config_keys } from '@poster-parler/config';
import Razorpay from 'razorpay';
@Injectable()
export class PaymentService {
  private razorpay: Razorpay;
  constructor(private configService: ConfigService) {
    this.razorpay = new Razorpay({
      key_id: this.configService.get<string>(config_keys.RAZORPAY_API_KEY),
      key_secret: this.configService.get<string>(
        config_keys.RAZORPAY_API_SECRET
      ),
    });
  }
}
