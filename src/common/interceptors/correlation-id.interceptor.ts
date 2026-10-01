import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { type Observable } from 'rxjs';
import type { CorrelatedRequest } from '@/common/http/correlated-request.js';
import { CORRELATION_ID_HEADER } from '@/common/http/http-headers.js';
import { readSingleHeader } from '@/common/utils/helper.js';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<CorrelatedRequest>();
    const response = context.switchToHttp().getResponse<{
      setHeader(name: string, value: string): void;
    }>();

    const headerValue = readSingleHeader(request.header(CORRELATION_ID_HEADER));
    const correlationId =
      request.correlationId ??
      (headerValue && headerValue.trim().length > 0
        ? headerValue.trim()
        : randomUUID());

    request.correlationId = correlationId;
    response.setHeader(CORRELATION_ID_HEADER, correlationId);
    
    return next.handle();
  }
}
