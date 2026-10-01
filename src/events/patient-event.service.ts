import { Injectable } from '@nestjs/common';
import {
  PatientEventStatus,
  Prisma,
  type PatientEvent,
} from '@prisma/client';
import { isInvalidObjectId } from '../database/prisma-error.js';
import { PatientEventRepository } from './repository/patient-event.repository.js';

const OBJECT_ID = /^[a-f\d]{24}$/i;
const OPEN_STATUSES: PatientEventStatus[] = [
  PatientEventStatus.PENDING,
  PatientEventStatus.PROCESSING,
  PatientEventStatus.DEAD_LETTER,
];

@Injectable()
export class PatientEventService {
  constructor(private readonly patientEventRepository: PatientEventRepository) {}

  async createPatientEvent(input: {
    patientId: string;
    type: string;
    data: Prisma.InputJsonObject;
    occurredAt: Date;
    idempotencyKey: string;
    receivedAt: Date;
  }): Promise<PatientEvent> {
    return this.patientEventRepository.create({
      data: {
        patientId: input.patientId,
        type: input.type,
        data: input.data,
        occurredAt: input.occurredAt,
        idempotencyKey: input.idempotencyKey,
        receivedAt: input.receivedAt,
        status: PatientEventStatus.PENDING,
        attemptCount: 0,
      },
    });
  }

  async findPatientEventByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<PatientEvent | null> {
    return this.patientEventRepository.findUnique({
      where: { idempotencyKey },
    });
  }

  async findPatientEventById(id: string): Promise<PatientEvent | null> {
    if (!OBJECT_ID.test(id)) {
      return null;
    }
    try {
      return await this.patientEventRepository.findUnique({ where: { id } });
    } catch (error) {
      if (isInvalidObjectId(error)) {
        return null;
      }
      throw error;
    }
  }

  async findOldestOpenPatientEvent(
    patientId: string,
  ): Promise<PatientEvent | null> {
    return this.patientEventRepository.findFirst({
      where: { patientId, status: { in: OPEN_STATUSES } },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    });
  }

  async findLatestProcessedPatientEvent(
    patientId: string,
  ): Promise<PatientEvent | null> {
    return this.patientEventRepository.findFirst({
      where: { patientId, status: PatientEventStatus.PROCESSED },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    });
  }

  async claimPatientEvent(input: {
    id: string;
    owner: string;
    leaseUntil: Date;
  }): Promise<boolean> {
    const count = await this.patientEventRepository.updateMany({
      where: { id: input.id, status: PatientEventStatus.PENDING },
      data: {
        status: PatientEventStatus.PROCESSING,
        leaseOwner: input.owner,
        leaseUntil: input.leaseUntil,
      },
    });
    return count === 1;
  }

  async completePatientEvent(input: {
    id: string;
    owner: string;
    processedAt: Date;
    result: Prisma.InputJsonObject;
  }): Promise<boolean> {
    const count = await this.patientEventRepository.updateMany({
      where: {
        id: input.id,
        status: PatientEventStatus.PROCESSING,
        leaseOwner: input.owner,
      },
      data: {
        status: PatientEventStatus.PROCESSED,
        processedAt: input.processedAt,
        processingResult: input.result,
        leaseOwner: null,
        leaseUntil: null,
      },
    });
    return count === 1;
  }

  async schedulePatientEventRetry(input: {
    id: string;
    owner: string;
    attemptCount: number;
    nextRetryAt: Date;
    errorCode: string;
  }): Promise<boolean> {
    const count = await this.patientEventRepository.updateMany({
      where: {
        id: input.id,
        status: PatientEventStatus.PROCESSING,
        leaseOwner: input.owner,
      },
      data: {
        status: PatientEventStatus.PENDING,
        attemptCount: input.attemptCount,
        nextRetryAt: input.nextRetryAt,
        lastErrorCode: input.errorCode,
        leaseOwner: null,
        leaseUntil: null,
      },
    });
    return count === 1;
  }

  async movePatientEventToDeadLetter(input: {
    id: string;
    owner: string;
    attemptCount: number;
    errorCode: string;
  }): Promise<boolean> {
    const count = await this.patientEventRepository.updateMany({
      where: {
        id: input.id,
        status: PatientEventStatus.PROCESSING,
        leaseOwner: input.owner,
      },
      data: {
        status: PatientEventStatus.DEAD_LETTER,
        attemptCount: input.attemptCount,
        nextRetryAt: null,
        lastErrorCode: input.errorCode,
        leaseOwner: null,
        leaseUntil: null,
      },
    });
    return count === 1;
  }

  async markPatientEventForReconciliation(id: string): Promise<boolean> {
    const count = await this.patientEventRepository.updateMany({
      where: { id, status: PatientEventStatus.PENDING },
      data: { status: PatientEventStatus.RECONCILIATION_REQUIRED },
    });
    return count === 1;
  }

  async releaseExpiredPatientEventLeases(input: {
    now: Date;
    patientId?: string;
  }): Promise<number> {
    return this.patientEventRepository.updateMany({
      where: {
        status: PatientEventStatus.PROCESSING,
        leaseUntil: { lt: input.now },
        ...(input.patientId ? { patientId: input.patientId } : {}),
      },
      data: {
        status: PatientEventStatus.PENDING,
        leaseOwner: null,
        leaseUntil: null,
      },
    });
  }

  async findEligiblePendingPatientEvents(input: {
    now: Date;
    reorderWindowMs: number;
    limit: number;
    patientId?: string;
  }): Promise<PatientEvent[]> {
    const eligibleBefore = new Date(
      input.now.getTime() - input.reorderWindowMs,
    );
    return this.patientEventRepository.findMany({
      where: {
        status: PatientEventStatus.PENDING,
        receivedAt: { lte: eligibleBefore },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: input.now } }],
        ...(input.patientId ? { patientId: input.patientId } : {}),
      },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      take: input.limit,
    });
  }

  async listDeadLetterPatientEvents(limit: number): Promise<PatientEvent[]> {
    return this.patientEventRepository.findMany({
      where: { status: PatientEventStatus.DEAD_LETTER },
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }

  async resetDeadLetterPatientEvent(id: string): Promise<PatientEvent | null> {
    const count = await this.patientEventRepository.updateMany({
      where: { id, status: PatientEventStatus.DEAD_LETTER },
      data: {
        status: PatientEventStatus.PENDING,
        attemptCount: 0,
        nextRetryAt: null,
        lastErrorCode: null,
        leaseOwner: null,
        leaseUntil: null,
        processedAt: null,
        processingResult: null,
      },
    });
    if (count !== 1) {
      return null;
    }
    return this.findPatientEventById(id);
  }

  async pingDatabase(): Promise<void> {
    await this.patientEventRepository.ping();
  }
}
