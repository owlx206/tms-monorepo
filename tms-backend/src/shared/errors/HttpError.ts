export class HttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}
