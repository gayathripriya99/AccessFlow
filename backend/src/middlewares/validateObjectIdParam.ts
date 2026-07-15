import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { isValidObjectId } from '../utils/objectId';

export function validateObjectIdParam(paramName = 'id') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!isValidObjectId(req.params[paramName])) {
      next(ApiError.badRequest(`Invalid ${paramName}`));
      return;
    }
    next();
  };
}
