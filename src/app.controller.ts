import { Controller, Get, Param } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('balance/:address')
  getBalance(@Param('address') address: string): Promise<{
    address: string;
    ethBalance: number;
    erc20Balance: {
      name: string;
      symbol: string;
      balance: number;
      decimals: number;
    }[];
  }> {
    return this.appService.getBalance(address);
  }
  @Get('healthcheck')
  healthcheck() {
    return 'OK';
  }
}
