import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AppConfig } from '../../config/app-config.js';
import { APP_CONFIG } from '../../config/app-config.token.js';
import { ApplicationException } from '../errors/application.exception.js';
import { API_KEY_HEADER } from '../http/http-headers.js';
import { ApplicationCode } from '../messages/application-code.js';
import { apiKeysMatch } from '../utils/api-keys-match.js';
import { readSingleHeader } from '../utils/read-single-header.js';
import type { ApiKeyKind } from './api-key-kind.js';
import { REQUIRE_API_KEY } from './require-api-key.decorator.js';
import type { CorrelatedRequest } from '../http/correlated-request.js';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const kind = this.reflector.getAllAndOverride<ApiKeyKind | undefined>(
      REQUIRE_API_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!kind) {
      return true;
    }
    const request = context.switchToHttp().getRequest<CorrelatedRequest>();
    const provided = readSingleHeader(request.header(API_KEY_HEADER));
    const expected =
      kind === 'ingest' ? this.config.ingestApiKey : this.config.adminApiKey;
    if (!provided || !apiKeysMatch(provided, expected)) {
      throw new ApplicationException(ApplicationCode.UNAUTHORIZED);
    }
    return true;
  }
}
