import { Module } from '@nestjs/common';
import { EventsModule } from '@/events/events.module.js';
import { QueueModule } from '@/queue/queue.module.js';
import { AdminController } from '@/admin/admin.controller.js';
import { AdminService } from '@/admin/admin.service.js';

@Module({
  imports: [EventsModule, QueueModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
