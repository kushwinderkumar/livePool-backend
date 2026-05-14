import { Request, RequestHandler } from 'express';
import { JwtPayload } from '../types';
export interface AuthRequest extends Request {
    user?: JwtPayload;
}
type AuthMiddleware = RequestHandler;
export declare const authenticate: AuthMiddleware;
export declare const optionalAuth: AuthMiddleware;
export {};
//# sourceMappingURL=auth.d.ts.map