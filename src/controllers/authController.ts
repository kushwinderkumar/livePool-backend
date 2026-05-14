import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { query } from '../config/database';
import { createError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, name, password } = req.body;

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return next(createError('Email already registered', 409));
    }

    const password_hash = await bcrypt.hash(password, 12);

    const result = await query(
      'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
      [email, name, password_hash]
    );

    const user = result.rows[0];
    const jwtOptions: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'],
    };
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET as string,
      jwtOptions
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: { user: { id: user.id, email: user.email, name: user.name }, token },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return next(createError('Invalid email or password', 401));
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return next(createError('Invalid email or password', 401));
    }

    const jwtOptions: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'],
    };
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET as string,
      jwtOptions
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: { user: { id: user.id, email: user.email, name: user.name }, token },
    });
  } catch (error) {
    next(error);
  }
};

// Use Request signature — cast to AuthRequest internally to access req.user
export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const result = await query(
      'SELECT id, email, name, created_at FROM users WHERE id = $1',
      [authReq.user?.userId]
    );

    if (result.rows.length === 0) {
      return next(createError('User not found', 404));
    }

    res.json({ success: true, data: { user: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};
