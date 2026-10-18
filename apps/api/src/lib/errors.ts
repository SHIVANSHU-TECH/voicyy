export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(
    message: string,
    options: {
      statusCode?: number;
      code?: string;
      details?: unknown;
      expose?: boolean;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? 'INTERNAL_ERROR';
    this.details = options.details;
    this.expose = options.expose ?? this.statusCode < 500;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, { statusCode: 404, code: 'NOT_FOUND' });
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, { statusCode: 400, code: 'VALIDATION_ERROR', details });
    this.name = 'ValidationError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, { statusCode: 409, code: 'CONFLICT', details });
    this.name = 'ConflictError';
  }
}
