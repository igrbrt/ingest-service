import { ApplicationCode } from '@/common/messages/application-code.js';

export type ApplicationCode =
  (typeof ApplicationCode)[keyof typeof ApplicationCode];
