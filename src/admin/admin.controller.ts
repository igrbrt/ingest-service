import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { RequireApiKey } from '../common/guards/require-api-key.decorator.js';
import type { AcceptedEventResponse } from '../events/dto/accepted-event.response.js';
import { AdminService } from './admin.service.js';
import type { DeadLetterEventResponse } from './dead-letter-event.response.js';
import type { QueueStatusResponse } from './queue-status.response.js';

@Controller('admin')
@RequireApiKey('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dead-letter-events')
  async listDeadLetterEvents(): Promise<DeadLetterEventResponse[]> {
    return this.adminService.listDeadLetterEvents();
  }

  @Post('dead-letter-events/:id/reprocess')
  @HttpCode(HttpStatus.ACCEPTED)
  async reprocessDeadLetterEvent(
    @Param('id') id: string,
  ): Promise<AcceptedEventResponse> {
    return this.adminService.reprocessDeadLetterEvent(id);
  }

  @Get('queues/status')
  async readQueueStatus(): Promise<QueueStatusResponse> {
    return this.adminService.readQueueStatus();
  }
}
