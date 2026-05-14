import { Request, Response, NextFunction } from 'express';
export declare const createPoll: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getMyPolls: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getPollById: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getPublicPoll: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const submitResponse: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getPollAnalytics: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const publishPoll: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const updatePoll: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const deletePoll: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=pollController.d.ts.map