import { ApplicationCode } from './application-code.js';

export type ApplicationCode =
  (typeof ApplicationCode)[keyof typeof ApplicationCode];
