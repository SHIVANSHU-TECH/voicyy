import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError('Route not found', { statusCode: 404, code: 'ROUTE_NOT_FOUND' }));
}

export function createErrorHandler(logger: Logger) {
  return function errorHandler(
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction,
  ): void {
    const appError =
      err instanceof AppError
        ? err
        : new AppError('Unexpected server error', {
            statusCode: 500,
            code: 'INTERNAL_ERROR',
            cause: err,
          });

    const level = appError.statusCode >= 500 ? 'error' : 'warn';
    logger[level](
      {
        err,
        requestId: req.requestId,
        path: req.path,
        method: req.method,
        code: appError.code,
      },
      appError.message,
    );

    const body: Record<string, unknown> = {
      error: {
        code: appError.code,
        message: appError.expose ? appError.message : 'Internal server error',
        requestId: req.requestId,
      },
    };

    if (appError.expose && appError.details !== undefined) {
      (body.error as Record<string, unknown>).details = appError.details;
    }

    res.status(appError.statusCode).json(body);
  };
}
