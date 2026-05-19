import { HttpError } from '../errors/HttpError.js';

export class DomainError extends HttpError {
  readonly code: string;

  constructor(code: string, message = code, statusCode = 400) {
    super(message, statusCode, code);
    this.code = code;
  }
}
