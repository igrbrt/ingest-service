import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PatientEventStatus } from '@prisma/client';
import type { Clock } from '../common/clock/clock.js';
import { CLOCK } from '../common/clock/clock.token.js';
import type { AppConfig } from '../config/app-config.js';
import { APP_CONFIG } from '../config/app-config.token.js';
import { PatientEventService } from '../events/patient-event.service.js';
import { PatientQueueProducer } from '../queue/patient-queue.producer.js';

const RECONCILE_BATCH_SIZE = 500;

@Injectable()
export class ReconcilerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconcilerService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly patientEventService: PatientEventService,
    private readonly patientQueueProducer: PatientQueueProducer,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.reconcile().catch((error: unknown) => {
        const name = error instanceof Error ? error.name : 'UnknownError';
        this.logger.error(`Reconciliation failed: ${name}`);
      });
    }, this.config.reconcilerIntervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async reconcile(): Promise<void> {
    const now = this.clock.now();
    await this.patientEventService.releaseExpiredPatientEventLeases({ now });
    const candidates =
      await this.patientEventService.findEligiblePendingPatientEvents({
        now,
        reorderWindowMs: this.config.reorderWindowMs,
        limit: RECONCILE_BATCH_SIZE,
      });
    const seenPatientIds = new Set<string>();
    for (const candidate of candidates) {
      if (seenPatientIds.has(candidate.patientId)) {
        continue;
      }
      seenPatientIds.add(candidate.patientId);
      const oldest = await this.patientEventService.findOldestOpenPatientEvent(
        candidate.patientId,
      );
      if (!oldest || oldest.id !== candidate.id) {
        continue;
      }
      if (oldest.status !== PatientEventStatus.PENDING) {
        continue;
      }
      if (oldest.nextRetryAt && oldest.nextRetryAt.getTime() > now.getTime()) {
        continue;
      }
      await this.patientQueueProducer.enqueuePatient({
        patientId: candidate.patientId,
      });
    }
  }
}
