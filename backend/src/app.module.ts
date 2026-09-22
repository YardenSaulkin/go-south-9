import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CurrentUserService } from './auth/current-user.service.js';
import { AdminController } from './controllers/admin.controller.js';
import { AuthController } from './controllers/auth.controller.js';
import { PocController } from './controllers/poc.controller.js';
import { ContextController } from './controllers/context.controller.js';
import { DashboardController } from './controllers/dashboard.controller.js';
import { DestinationController } from './controllers/destination.controller.js';
import { DistributionController } from './controllers/distribution.controller.js';
import { PackingController } from './controllers/packing.controller.js';
import { ReceivingController } from './controllers/receiving.controller.js';
import { ShipmentController } from './controllers/shipment.controller.js';
import { AdminService } from './services/admin.service.js';
import { PocService } from './services/poc.service.js';
import { AuthService } from './services/auth.service.js';
import { DashboardService } from './services/dashboard.service.js';
import { DestinationService } from './services/destination.service.js';
import { OrgHierarchyService } from './services/org-hierarchy.service.js';
import { DistributionService } from './services/distribution.service.js';
import { PackingService } from './services/packing.service.js';
import { ReceivingService } from './services/receiving.service.js';
import { ShipmentService } from './services/shipment.service.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

// Distributed tracing, auto-correlated logs, request/job metrics, error
// telemetry, alarms, and more — out of the box. Sign up at
// https://observe.nestjs.com and set the two variables below. Without real
// credentials the collector answers 401 on every batch, so the module stays
// unregistered until they are provided.
const observeAppKey = process.env.OBSERVE_APP_KEY;
const observeAppSecret = process.env.OBSERVE_APP_SECRET;

@Module({
  imports:
    observeAppKey && observeAppSecret
      ? [
          ObserveModule.forRoot({
            appKey: observeAppKey,
            appSecret: observeAppSecret,
            serviceId: 'backend',
          }),
        ]
      : [],
  controllers: [
    AppController,
    AdminController,
    AuthController,
    ContextController,
    DestinationController,
    PackingController,
    ShipmentController,
    ReceivingController,
    DistributionController,
    DashboardController,
    PocController,
  ],
  providers: [
    AppService,
    AdminService,
    AuthService,
    DestinationService,
    CurrentUserService,
    OrgHierarchyService,
    PackingService,
    ShipmentService,
    ReceivingService,
    DistributionService,
    DashboardService,
    PocService,
  ],
})
export class AppModule {}
