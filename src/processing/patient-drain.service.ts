import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PatientEventStatus, type PatientEvent } from '@prisma/client';
import { PatientEventService } from '@/events/patient-event.service.js';
import { PatientQueueProducer } from '@/queue/patient-queue.producer.js';
import {
  computeNextRetryAt,
  readProcessingErrorCode,
} from '@/common/utils/helper.js';
import type { PatientLockPort } from '@/processing/interface/patient-lock.port.js';
import { ProcessingRuntime } from '@/processing/processing-runtime.js';
import { AppConstants } from '@/app.constants.js';

type DrainStep = 'applied' | 'idle' | 'waiting' | 'blocked';

@Injectable()
export class PatientDrainService {
  private readonly logger = new Logger(PatientDrainService.name);
  private readonly owner = randomUUID();

  constructor(
    private readonly patientEventService: PatientEventService,
    @Inject(AppConstants.PATIENT_LOCK_TOKEN) private readonly patientLock: PatientLockPort,
    private readonly patientQueueProducer: PatientQueueProducer,
    private readonly runtime: ProcessingRuntime,
  ) {}

  async drainPatient(input: { patientId: string }): Promise<void> {
    const ttlMs = this.runtime.config.leaseMs;
    const acquired = await this.patientLock.acquire({
      patientId: input.patientId,
      owner: this.owner,
      ttlMs,
    });

    if (!acquired) {
      return;
    }

    try {
      await this.patientEventService.releaseExpiredPatientEventLeases({
        now: this.runtime.clock.now(),
        patientId: input.patientId,
      });

      await this.drainAvailableEvents(input.patientId);
    } finally {
      await this.patientLock.release({
        patientId: input.patientId,
        owner: this.owner,
      });

      await this.enqueueIfStillEligible(input.patientId);
    }
  }

  private async drainAvailableEvents(patientId: string): Promise<void> {
    while (await this.extendLock(patientId)) {
      const step = await this.applyNextEvent(patientId);

      if (step === 'applied') {
        continue;
      }

      const rechecked = await this.applyNextEvent(patientId);

      if (rechecked !== 'applied') {
        return;
      }
    }
  }

  private async extendLock(patientId: string): Promise<boolean> {
    return this.patientLock.extend({
      patientId,
      owner: this.owner,
      ttlMs: this.runtime.config.leaseMs,
    });
  }

  private async applyNextEvent(patientId: string): Promise<DrainStep> {
    const now = this.runtime.clock.now();
    const next = await this.patientEventService.findOldestOpenPatientEvent(patientId);

    if (!next) {
      return 'idle';
    }

    if (next.status === PatientEventStatus.DEAD_LETTER) {
      return 'blocked';
    }

    if (next.status === PatientEventStatus.PROCESSING) {
      if (next.leaseUntil && next.leaseUntil.getTime() > now.getTime()) {
        return 'blocked';
      }

      await this.patientEventService.releaseExpiredPatientEventLeases({
        now,
        patientId,
      });

      return 'applied';
    }

    if (next.nextRetryAt && next.nextRetryAt.getTime() > now.getTime()) {
      return 'waiting';
    }

    const eligibleAt = next.receivedAt.getTime() + this.runtime.config.reorderWindowMs;

    if (now.getTime() < eligibleAt) {
      return 'waiting';
    }

    const watermark = await this.patientEventService.findLatestProcessedPatientEvent(patientId);

    if (
      watermark &&
      next.occurredAt.getTime() < watermark.occurredAt.getTime()
    ) {
      await this.patientEventService.markPatientEventForReconciliation(next.id);
      return 'applied';
    }

    return this.applyClaimedEvent(next, now);
  }

  private async applyClaimedEvent(
    event: PatientEvent,
    now: Date,
  ): Promise<DrainStep> {
    const leaseUntil = new Date(now.getTime() + this.runtime.config.leaseMs);
    const claimed = await this.patientEventService.claimPatientEvent({
      id: event.id,
      owner: this.owner,
      leaseUntil,
    });

    if (!claimed) {
      return 'blocked';
    }

    try {
      const result = await this.runtime.externalProcessor.applyEvent({
        idempotencyKey: event.idempotencyKey,
        patientId: event.patientId,
        type: event.type,
        data: event.data,
        occurredAt: event.occurredAt,
      });

      const completed = await this.patientEventService.completePatientEvent({
        id: event.id,
        owner: this.owner,
        processedAt: this.runtime.clock.now(),
        result: { outcome: result.outcome },
      });

      if (!completed) {
        this.logger.warn(`Lost processing lease for event ${event.id}`);
        return 'blocked';
      }

      return 'applied';
    } catch (error) {
      await this.recordFailure(event, readProcessingErrorCode(error));

      return 'blocked';
    }
  }

  private async recordFailure(
    event: PatientEvent,
    errorCode: string,
  ): Promise<void> {
    const attemptCount = event.attemptCount + 1;

    if (attemptCount >= this.runtime.config.maxAttempts) {
      const moved = await this.patientEventService.movePatientEventToDeadLetter(
        {
          id: event.id,
          owner: this.owner,
          attemptCount,
          errorCode,
        },
      );

      if (!moved) {
        this.logger.warn(`Could not dead-letter event ${event.id}`);
      }

      return;
    }

    const scheduled = await this.patientEventService.schedulePatientEventRetry({
      id: event.id,
      owner: this.owner,
      attemptCount,
      errorCode,
      nextRetryAt: computeNextRetryAt({
        attemptCount,
        baseDelayMs: this.runtime.config.retryBaseDelayMs,
        now: this.runtime.clock.now(),
      }),
    });

    if (!scheduled) {
      this.logger.warn(`Could not schedule retry for event ${event.id}`);
    }
  }

  private async enqueueIfStillEligible(patientId: string): Promise<void> {
    const now = this.runtime.clock.now();
    const eligible = await this.patientEventService.findEligiblePendingPatientEvents({
      now,
      reorderWindowMs: this.runtime.config.reorderWindowMs,
      limit: 1,
      patientId,
    });

    const candidate = eligible[0];

    if (!candidate) {
      return;
    }

    const oldest = await this.patientEventService.findOldestOpenPatientEvent(patientId);

    if (!oldest || oldest.id !== candidate.id) {
      return;
    }

    try {
      await this.patientQueueProducer.enqueuePatient({ patientId });
    } catch (error) {
      const name = error instanceof Error ? error.name : 'UnknownError';

      this.logger.warn(`Follow-up enqueue failed (${name}) for ${patientId}`);
    }
  }
}
