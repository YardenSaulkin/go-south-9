import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CurrentUserService } from './auth/current-user.service.js';
import { AuthController } from './controllers/auth.controller.js';
import { ContextController } from './controllers/context.controller.js';
import { DashboardController } from './controllers/dashboard.controller.js';
import { DestinationController } from './controllers/destination.controller.js';
import { DistributionController } from './controllers/distribution.controller.js';
import { PackingController } from './controllers/packing.controller.js';
import { ReceivingController } from './controllers/receiving.controller.js';
import { ShipmentController } from './controllers/shipment.controller.js';
import { AuthService } from './services/auth.service.js';
import { DashboardService } from './services/dashboard.service.js';
import { DestinationService } from './services/destination.service.js';
import { DistributionService } from './services/distribution.service.js';
import { PackingService } from './services/packing.service.js';
import { ReceivingService } from './services/receiving.service.js';
import { ShipmentService } from './services/shipment.service.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'backend',
    }),
  ],
  controllers: [
    AppController,
    AuthController,
    ContextController,
    DestinationController,
    PackingController,
    ShipmentController,
    ReceivingController,
    DistributionController,
    DashboardController,
  ],
  providers: [
    AppService,
    AuthService,
    DestinationService,
    CurrentUserService,
    PackingService,
    ShipmentService,
    ReceivingService,
    DistributionService,
    DashboardService,
  ],
})
export class AppModule {}
