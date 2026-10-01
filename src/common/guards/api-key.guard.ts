import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppConstants } from '@/app.constants.js';
import type { AppConfig } from '@/config/app-config.js';
import { ApplicationException } from '@/common/errors/application.exception.js';
import { API_KEY_HEADER } from '@/common/http/http-headers.js';
import { ApplicationCode } from '@/common/messages/application-code.js';
import { apiKeysMatch } from '@/common/utils/api-keys-match.js';
import { readSingleHeader } from '@/common/utils/helper.js';
import type { ApiKeyKind } from '@/common/guards/api-key-kind.js';
import { REQUIRE_API_KEY } from '@/common/guards/require-api-key.decorator.js';
import type { CorrelatedRequest } from '@/common/http/correlated-request.js';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AppConstants.APP_CONFIG_TOKEN) private readonly config: AppConfig,
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
