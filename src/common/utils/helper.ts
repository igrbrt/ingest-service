import { createHash } from 'node:crypto';
import { Prisma, type PatientEvent } from '@prisma/client';
import type { ConnectionOptions } from 'bullmq';
import type { DeadLetterEventResponse } from '@/admin/dto/dead-letter-event.response.js';
import { ApplicationException } from '@/common/errors/application.exception.js';
import { ApplicationCode } from '@/common/messages/application-code.js';
import type { AppConfig } from '@/config/app-config.js';
import type { AcceptedEventResponse } from '@/events/dto/accepted-event.response.js';

export function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export function readSingleHeader(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function computeNextRetryAt(input: {
  attemptCount: number;
  baseDelayMs: number;
  now: Date;
}): Date {
  const exponent = Math.max(input.attemptCount - 1, 0);

  return new Date(input.now.getTime() + input.baseDelayMs * 2 ** exponent);
}

export function readProcessingErrorCode(error: unknown): string {
  if (error instanceof ApplicationException) {
    return error.code;
  }

  return ApplicationCode.PROCESSING_FAILED;
}

export function buildPatientJobId(patientId: string): string {
  return createHash('sha256').update(patientId).digest('hex');
}

export function buildRedisConnection(config: AppConfig): ConnectionOptions {
  return {
    host: config.redisHost,
    port: config.redisPort,
    maxRetriesPerRequest: null,
  };
}

export function toJsonObject(
  value: Record<string, unknown>,
): Prisma.InputJsonObject {
  const serialized: unknown = JSON.parse(JSON.stringify(value));

  if (
    serialized === null ||
    typeof serialized !== 'object' ||
    Array.isArray(serialized)
  ) {
    throw new ApplicationException(ApplicationCode.VALIDATION_FAILED);
  }

  return serialized as Prisma.InputJsonObject;
}

export function toAcceptedEventResponse(
  event: PatientEvent,
): AcceptedEventResponse {
  return {
    id: event.id,
    patientId: event.patientId,
    type: event.type,
    occurredAt: event.occurredAt.toISOString(),
    status: event.status,
    idempotencyKey: event.idempotencyKey,
    receivedAt: event.receivedAt.toISOString(),
  };
}

export function toDeadLetterEventResponse(
  event: PatientEvent,
): DeadLetterEventResponse {
  return {
    id: event.id,
    patientId: event.patientId,
    type: event.type,
    data: event.data,
    occurredAt: event.occurredAt.toISOString(),
    receivedAt: event.receivedAt.toISOString(),
    attemptCount: event.attemptCount,
    lastErrorCode: event.lastErrorCode,
    status: event.status,
  };
}
