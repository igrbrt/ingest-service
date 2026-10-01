import type { ApplicationCode } from '@/common/messages/application-code.type.js';

export class ApplicationException extends Error {
  constructor(readonly code: ApplicationCode) {
    super(code);
    this.name = 'ApplicationException';
  }
}
