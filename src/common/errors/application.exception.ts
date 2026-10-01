import type { ApplicationCode } from '../messages/application-code.type.js';

export class ApplicationException extends Error {
  constructor(readonly code: ApplicationCode) {
    super(code);
    this.name = 'ApplicationException';
  }
}
