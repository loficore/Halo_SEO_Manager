/**
 * @file 全局错误处理中间件，用于统一处理应用程序中的错误。
 */

import { Request, Response, NextFunction } from 'express';
import {
  HttpError,
  ApiError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  InternalServerError,
} from '../errors/customErrors';
import { log, Modules } from '../logger';

/**
 * 全局错误处理中间件。
 * 捕获 Express 应用程序中抛出的所有错误，并根据错误类型发送统一的 JSON 响应。
 * 对于自定义错误，根据其 statusCode 发送相应的响应。
 * 对于非自定义错误，将其视为 InternalServerError (500)。
 *
 * @param {Error | HttpError} err - 捕获到的错误对象。
 * @param {Request} req - Express 请求对象。
 * @param {Response} res - Express 响应对象。
 * @param {NextFunction} next - Express next 函数。
 */
export const errorHandler = (
  err: Error | HttpError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let statusCode = 500;
  let message = '服务器内部错误';
  let details: any = undefined;

  // 识别自定义错误
  if (err instanceof HttpError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof Error) {
    // 对于非自定义的 Error 实例，也视为 InternalServerError
    message = err.message; // 可以选择暴露错误消息，或者在生产环境中隐藏
    // 可以在开发环境中暴露更多信息
    if (process.env.NODE_ENV === 'development') {
      details = { stack: err.stack, name: err.name };
    }
  }

  // 记录错误
  log('error', Modules.ErrorHandler, message, {
    statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    errorName: err.name,
    errorMessage: err.message,
    errorStack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    requestBody: req.body, // 记录请求体，有助于调试
    errorDetails: details,
  });

  // 发送 JSON 错误响应
  res.status(statusCode).json({
    success: false,
    status: statusCode,
    message,
    ...(details && { details }), // 如果存在 details，则包含在响应中
  });
};
