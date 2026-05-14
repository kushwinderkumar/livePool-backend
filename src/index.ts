import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { initSocket } from './socket/socketManager';
import authRoutes from './routes/authRoutes';
import pollRoutes from './routes/pollRoutes';
import { errorHandler, notFound } from './middleware/errorHandler';
import { query } from './config/database';

dotenv.config();

const app = express();
const httpServer = http.createServer(app);

// Initialize Socket.io
initSocket(httpServer);

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later' },
});
app.use('/api', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Health check
app.get('/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'poll-platform-api' });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/polls', pollRoutes);

// 404 & Error handlers
app.use(notFound);
app.use(errorHandler);

// Auto-run migrations on startup
const runMigrations = async (): Promise<void> => {
  const fs = await import('fs');
  const path = await import('path');
  const { default: pool } = await import('./config/database');

  // Works in both ts-node (src/) and compiled (dist/) environments
  const sqlPath = path.join(__dirname, 'config', 'schema.sql');

  if (!fs.existsSync(sqlPath)) {
    console.warn('⚠️  schema.sql not found at', sqlPath, '– skipping auto-migration');
    return;
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    await pool.query(sql);
    console.log('✅ Database schema ready');
  } catch (err) {
    console.error('❌ Migration error:', err);
  }
};

const PORT = parseInt(process.env.PORT || '5000', 10);

const start = async () => {
  await runMigrations();
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 WebSocket server ready`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  });
};

start().catch(console.error);

export default app;
