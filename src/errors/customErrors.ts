/**
 * @file 自定义错误类，用于提供统一的错误响应。
 */

/**
 * @class HttpError
 * @extends Error
 * @description 基础 HTTP 错误类。
 */
export class HttpError extends Error {
  public statusCode: number;
  public details?: any;
  public isOperational: boolean; // 标识操作性错误

  constructor(
    statusCode: number,
    message: string,
    details?: any,
    isOperational: boolean = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational; // 默认为操作性错误
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

/**
 * @class ApiError
 * @extends HttpError
 * @description 通用 API 错误类，允许自定义状态码。
 */
export class ApiError extends HttpError {
  constructor(statusCode: number, message: string, details?: any) {
    super(statusCode, message, details);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * @class AuthenticationError
 * @extends HttpError
 * @description 认证失败错误 (401 Unauthorized)。
 */
export class UnauthorizedError extends HttpError {
  constructor(message: string = '认证失败或未授权', details?: any) {
    super(401, message, details);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/**
 * @class ForbiddenError
 * @extends HttpError
 * @description 权限不足错误 (403 Forbidden)。
 */
export class ForbiddenError extends HttpError {
  constructor(message: string = '无权访问此资源', details?: any) {
    super(403, message, details);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * @class NotFoundError
 * @extends HttpError
 * @description 资源未找到错误 (404 Not Found)。
 */
export class NotFoundError extends HttpError {
  constructor(message: string = '资源未找到', details?: any) {
    super(404, message, details);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * @class ValidationError
 * @extends HttpError
 * @description 请求数据校验失败错误 (400 Bad Request)。
 */
export class ValidationError extends HttpError {
  constructor(message: string = '请求数据校验失败', details?: any) {
    super(400, message, details);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * @class InternalServerError
 * @extends HttpError
 * @description 服务器内部错误 (500 Internal Server Error)。
 */
export class InternalServerError extends HttpError {
  constructor(message: string = '服务器内部错误', details?: any) {
    super(500, message, details);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}
