import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { IDEMPOTENCY_KEY_HEADER } from '../common/http/http-headers.js';
import { RequireApiKey } from '../common/guards/require-api-key.decorator.js';
import type { AcceptedEventResponse } from './dto/accepted-event.response.js';
import { CreatePatientEventDto } from './dto/create-patient-event.dto.js';
import { EventIngestionService } from './event-ingestion.service.js';

@Controller('events')
@RequireApiKey('ingest')
export class EventsController {
  constructor(private readonly eventIngestionService: EventIngestionService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async acceptEvent(
    @Body() body: CreatePatientEventDto,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string | string[],
  ): Promise<AcceptedEventResponse> {
    return this.eventIngestionService.acceptEvent({ body, idempotencyKey });
  }
}
