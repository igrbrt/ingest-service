import { Injectable, Logger } from '@nestjs/common';
import { PatientEventStatus } from '@prisma/client';
import { ApplicationException } from '@/common/errors/application.exception.js';
import { ApplicationCode } from '@/common/messages/application-code.js';
import {
  toAcceptedEventResponse,
  toDeadLetterEventResponse,
} from '@/common/utils/helper.js';
import type { AcceptedEventResponse } from '@/events/dto/accepted-event.response.js';
import { PatientEventService } from '@/events/patient-event.service.js';
import { PatientQueueProducer } from '@/queue/patient-queue.producer.js';
import type { DeadLetterEventResponse } from '@/admin/dto/dead-letter-event.response.js';
import type { QueueStatusResponse } from '@/admin/dto/queue-status.response.js';
import { AppConstants } from '@/app.constants.js';


@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly patientEventService: PatientEventService,
    private readonly patientQueueProducer: PatientQueueProducer,
  ) {}

  async listDeadLetterEvents(): Promise<DeadLetterEventResponse[]> {
    const events = await this.patientEventService.listDeadLetterPatientEvents(
      AppConstants.DEAD_LETTER_PAGE_SIZE,
    );

    return events.map((event) => toDeadLetterEventResponse(event));
  }

  async reprocessDeadLetterEvent(id: string): Promise<AcceptedEventResponse> {
    const existing = await this.patientEventService.findPatientEventById(id);

    if (!existing) {
      throw new ApplicationException(ApplicationCode.EVENT_NOT_FOUND);
    }

    if (existing.status !== PatientEventStatus.DEAD_LETTER) {
      throw new ApplicationException(ApplicationCode.EVENT_NOT_REPROCESSABLE);
    }

    const reset = await this.patientEventService.resetDeadLetterPatientEvent(id);

    if (!reset) {
      throw new ApplicationException(ApplicationCode.EVENT_NOT_REPROCESSABLE);
    }

    try {
      await this.patientQueueProducer.enqueuePatient({
        patientId: reset.patientId,
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : 'UnknownError';
      this.logger.warn(
        `Reprocess enqueue failed (${name}) for ${reset.patientId}`,
      );
    }

    return toAcceptedEventResponse(reset);
  }

  async readQueueStatus(): Promise<QueueStatusResponse> {
    return this.patientQueueProducer.readCounts();
  }
}
