import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

// Extend Express Request — only add what we need, never override existing props
export interface AuthRequest extends Request {
  user?: JwtPayload;
}

// Typed middleware helper so routes accept these handlers without casting
type AuthMiddleware = RequestHandler;

export const authenticate: AuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Access token required' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    (req as AuthRequest).user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

export const optionalAuth: AuthMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
      (req as AuthRequest).user = decoded;
    } catch {
      // Invalid token — continue as unauthenticated
    }
  }

  next();
};
