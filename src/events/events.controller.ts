import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RequireApiKey } from '@/common/guards/require-api-key.decorator.js';
import { IdempotencyKey } from '@/common/http/idempotency-key.decorator.js';
import type { AcceptedEventResponse } from '@/events/dto/accepted-event.response.js';
import { CreatePatientEventDto } from '@/events/dto/create-patient-event.dto.js';
import { EventIngestionService } from '@/events/event-ingestion.service.js';

@Controller('events')
@RequireApiKey('ingest')
export class EventsController {
  constructor(private readonly eventIngestionService: EventIngestionService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async acceptEvent(
    @Body() body: CreatePatientEventDto,
    @IdempotencyKey() idempotencyKey?: string,
  ): Promise<AcceptedEventResponse> {
    return this.eventIngestionService.acceptEvent({ body, idempotencyKey });
  }
}
