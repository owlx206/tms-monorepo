import { DomainError as SharedDomainError } from '../errors/domain.error.js';

export class DomainError extends SharedDomainError {
  readonly code: string;

  constructor(code: string, message = code, statusCode = 400) {
    super(message, statusCode, code);
    this.code = code;
  }
}
