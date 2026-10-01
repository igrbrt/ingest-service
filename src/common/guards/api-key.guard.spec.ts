import { type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AppConfig } from '@/config/app-config.js';
import { ApplicationException } from '@/common/errors/application.exception.js';
import { ApplicationCode } from '@/common/messages/application-code.js';
import { apiKeysMatch } from '@/common/utils/api-keys-match.js';
import { ApiKeyGuard } from '@/common/guards/api-key.guard.js';
import type { ApiKeyKind } from '@/common/guards/api-key-kind.js';

const config = {
  ingestApiKey: 'test-ingest-key',
  adminApiKey: 'test-admin-key',
} as AppConfig;

function createContext(header?: string): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({
        header: () => header,
      }),
    }),
  } as unknown as ExecutionContext;
}

function createGuard(kind: ApiKeyKind | undefined): ApiKeyGuard {
  const reflector = {
    getAllAndOverride: () => kind,
  } as unknown as Reflector;
  return new ApiKeyGuard(reflector, config);
}

describe('ApiKeyGuard', () => {
  it('allows public routes and matching digests', () => {
    expect(createGuard(undefined).canActivate(createContext())).toBe(true);
    expect(
      createGuard('ingest').canActivate(createContext('test-ingest-key')),
    ).toBe(true);
    expect(apiKeysMatch('short', 'a-much-longer-key')).toBe(false);
  });

  it('rejects a missing or wrong key without distinguishing them', () => {
    expect(() => createGuard('admin').canActivate(createContext())).toThrow(
      ApplicationException,
    );
    expect(() =>
      createGuard('admin').canActivate(createContext('test-ingest-key')),
    ).toThrow(new ApplicationException(ApplicationCode.UNAUTHORIZED));
  });
});
