import { Prisma } from '@prisma/client';

const UNAVAILABLE_CODES = new Set(['P1001', 'P1002', 'P1017']);

export function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

export function isDatabaseUnavailable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return true;
  }
  
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    UNAVAILABLE_CODES.has(error.code)
  );
}

export function isInvalidObjectId(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2023'
  );
}
