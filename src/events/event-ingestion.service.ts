import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PatientEvent } from '@prisma/client';
import type { Clock } from '@/common/clock/clock.js';
import { AppConstants } from '@/app.constants.js';
import { ApplicationException } from '@/common/errors/application.exception.js';
import { ApplicationCode } from '@/common/messages/application-code.js';
import { buildIdempotencyKey } from '@/common/utils/build-idempotency-key.js';
import {
  toAcceptedEventResponse,
  toJsonObject,
} from '@/common/utils/helper.js';
import {
  isDatabaseUnavailable,
  isUniqueConstraintViolation,
} from '@/common/prisma/prisma-error.js';
import { PatientQueueProducer } from '@/queue/patient-queue.producer.js';
import type { AcceptedEventResponse } from '@/events/dto/accepted-event.response.js';
import type { CreatePatientEventDto } from '@/events/dto/create-patient-event.dto.js';
import { PatientEventService } from '@/events/patient-event.service.js';

@Injectable()
export class EventIngestionService {
  private readonly logger = new Logger(EventIngestionService.name);

  constructor(
    private readonly patientEventService: PatientEventService,
    private readonly patientQueueProducer: PatientQueueProducer,
    @Inject(AppConstants.CLOCK_TOKEN) private readonly clock: Clock,
  ) {}

  async acceptEvent(input: {
    body: CreatePatientEventDto;
    idempotencyKey?: string;
  }): Promise<AcceptedEventResponse> {
    const idempotencyKey = buildIdempotencyKey({
      headerValue: input.idempotencyKey,
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

  private async findOriginalEvent(
    idempotencyKey: string,
  ): Promise<PatientEvent> {
    try {
      const existing = await this.patientEventService.findPatientEventByIdempotencyKey(idempotencyKey);

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
