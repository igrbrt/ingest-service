import { SetMetadata } from '@nestjs/common';
import type { ApiKeyKind } from './api-key-kind.js';

export const REQUIRE_API_KEY = 'requireApiKey';

export const RequireApiKey = (
  kind: ApiKeyKind,
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRE_API_KEY, kind);
