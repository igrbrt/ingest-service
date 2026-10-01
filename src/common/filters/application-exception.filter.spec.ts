import { type ArgumentsHost } from '@nestjs/common';
import { ApplicationException } from '../errors/application.exception.js';
import { ApplicationCode } from '../messages/application-code.js';
import { ApplicationExceptionFilter } from './application-exception.filter.js';

describe('ApplicationExceptionFilter', () => {
  it('renders the error contract', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({
          originalUrl: '/events',
          url: '/events',
          correlationId: 'corr-9',
        }),
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;
    new ApplicationExceptionFilter().catch(
      new ApplicationException(ApplicationCode.VALIDATION_FAILED),
      host,
    );
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        path: '/events',
        correlationId: 'corr-9',
      }),
    );
  });
});
