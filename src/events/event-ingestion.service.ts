import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PatientEvent } from '@prisma/client';
import type { Clock } from '../common/clock/clock.js';
import { CLOCK } from '../common/clock/clock.token.js';
import { ApplicationException } from '../common/errors/application.exception.js';
import { ApplicationCode } from '../common/messages/application-code.js';
import { buildIdempotencyKey } from '../common/utils/build-idempotency-key.js';
import { readSingleHeader } from '../common/utils/read-single-header.js';
import {
  isDatabaseUnavailable,
  isUniqueConstraintViolation,
} from '../database/prisma-error.js';
import { PatientQueueProducer } from '../queue/patient-queue.producer.js';
import type { AcceptedEventResponse } from './dto/accepted-event.response.js';
import type { CreatePatientEventDto } from './dto/create-patient-event.dto.js';
import { toAcceptedEventResponse } from './dto/to-accepted-event-response.js';
import { toJsonObject } from './dto/to-json-object.js';
import { PatientEventService } from './patient-event.service.js';

const MAX_IDEMPOTENCY_KEY_LENGTH = 256;

@Injectable()
export class EventIngestionService {
  private readonly logger = new Logger(EventIngestionService.name);

  constructor(
    private readonly patientEventService: PatientEventService,
    private readonly patientQueueProducer: PatientQueueProducer,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async acceptEvent(input: {
    body: CreatePatientEventDto;
    idempotencyKey: string | string[] | undefined;
  }): Promise<AcceptedEventResponse> {
    const header = readSingleHeader(input.idempotencyKey)?.trim();
    if (header && header.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      throw new ApplicationException(ApplicationCode.VALIDATION_FAILED);
    }
    const idempotencyKey = buildIdempotencyKey({
      headerValue: header,
      payload: {
        patientId: input.body.patientId,
        type: input.body.type,
        data: input.body.data,
        ts: input.body.ts,
      },
    });
    const occurredAt = new Date(input.body.ts);
    if (Number.isNaN(occurredAt.getTime())) {
      throw new ApplicationException(ApplicationCode.VALIDATION_FAILED);
    }
    try {
      const created = await this.patientEventService.createPatientEvent({
        patientId: input.body.patientId,
        type: input.body.type,
        data: toJsonObject(input.body.data),
        occurredAt,
        idempotencyKey,
        receivedAt: this.clock.now(),
      });
      await this.enqueuePatient(created.patientId);
      return toAcceptedEventResponse(created);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        const existing = await this.findOriginalEvent(idempotencyKey);
        return toAcceptedEventResponse(existing);
      }
      if (isDatabaseUnavailable(error)) {
        throw new ApplicationException(ApplicationCode.SERVICE_UNAVAILABLE);
      }
      if (error instanceof ApplicationException) {
        throw error;
      }
      throw new ApplicationException(ApplicationCode.INTERNAL_ERROR);
    }
  }

  private async findOriginalEvent(idempotencyKey: string): Promise<PatientEvent> {
    try {
      const existing =
        await this.patientEventService.findPatientEventByIdempotencyKey(
          idempotencyKey,
        );
      if (!existing) {
        throw new ApplicationException(ApplicationCode.SERVICE_UNAVAILABLE);
      }
      return existing;
    } catch (error) {
      if (error instanceof ApplicationException) {
        throw error;
      }
      throw new ApplicationException(ApplicationCode.SERVICE_UNAVAILABLE);
    }
  }

  private async enqueuePatient(patientId: string): Promise<void> {
    try {
      await this.patientQueueProducer.enqueuePatient({ patientId });
    } catch (error) {
      const name = error instanceof Error ? error.name : 'UnknownError';
      this.logger.warn(`Patient enqueue failed (${name}) for ${patientId}`);
    }
  }
}
