import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

let io: SocketServer;

export const initSocket = (httpServer: HttpServer): SocketServer => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
        (socket as Socket & { user?: JwtPayload }).user = decoded;
      } catch {
        // Anonymous socket connection
      }
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join poll room for live response count
    socket.on('join:poll', (pollId: string) => {
      socket.join(`poll:${pollId}`);
      console.log(`Socket ${socket.id} joined poll:${pollId}`);
    });

    // Join analytics room (creator only)
    socket.on('join:analytics', (pollId: string) => {
      const user = (socket as Socket & { user?: JwtPayload }).user;
      if (user) {
        socket.join(`analytics:${pollId}`);
        console.log(`Socket ${socket.id} joined analytics:${pollId}`);
      }
    });

    socket.on('leave:poll', (pollId: string) => {
      socket.leave(`poll:${pollId}`);
    });

    socket.on('leave:analytics', (pollId: string) => {
      socket.leave(`analytics:${pollId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): SocketServer => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};
