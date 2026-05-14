"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
let io;
const initSocket = (httpServer) => {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:3000',
            methods: ['GET', 'POST'],
            credentials: true,
        },
        transports: ['websocket', 'polling'],
    });
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (token) {
            try {
                const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
                socket.user = decoded;
            }
            catch {
                // Anonymous socket connection
            }
        }
        next();
    });
    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);
        // Join poll room for live response count
        socket.on('join:poll', (pollId) => {
            socket.join(`poll:${pollId}`);
            console.log(`Socket ${socket.id} joined poll:${pollId}`);
        });
        // Join analytics room (creator only)
        socket.on('join:analytics', (pollId) => {
            const user = socket.user;
            if (user) {
                socket.join(`analytics:${pollId}`);
                console.log(`Socket ${socket.id} joined analytics:${pollId}`);
            }
        });
        socket.on('leave:poll', (pollId) => {
            socket.leave(`poll:${pollId}`);
        });
        socket.on('leave:analytics', (pollId) => {
            socket.leave(`analytics:${pollId}`);
        });
        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });
    return io;
};
exports.initSocket = initSocket;
const getIO = () => {
    if (!io)
        throw new Error('Socket.io not initialized');
    return io;
};
exports.getIO = getIO;
//# sourceMappingURL=socketManager.js.map