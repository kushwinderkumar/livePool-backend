"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const socketManager_1 = require("./socket/socketManager");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const pollRoutes_1 = __importDefault(require("./routes/pollRoutes"));
const errorHandler_1 = require("./middleware/errorHandler");
const database_1 = require("./config/database");
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = http_1.default.createServer(app);
// Initialize Socket.io
(0, socketManager_1.initSocket)(httpServer);
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    message: { success: false, message: 'Too many requests, please try again later' },
});
app.use('/api', limiter);
// Body parsing
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Logging
if (process.env.NODE_ENV !== 'test') {
    app.use((0, morgan_1.default)(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}
// Health check
app.get('/health', async (_req, res) => {
    try {
        await (0, database_1.query)('SELECT 1');
        res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'poll-platform-api' });
    }
    catch {
        res.status(503).json({ status: 'error', message: 'Database unavailable' });
    }
});
// API Routes
app.use('/api/auth', authRoutes_1.default);
app.use('/api/polls', pollRoutes_1.default);
// 404 & Error handlers
app.use(errorHandler_1.notFound);
app.use(errorHandler_1.errorHandler);
// Auto-run migrations on startup
const runMigrations = async () => {
    const fs = await Promise.resolve().then(() => __importStar(require('fs')));
    const path = await Promise.resolve().then(() => __importStar(require('path')));
    const { default: pool } = await Promise.resolve().then(() => __importStar(require('./config/database')));
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
    }
    catch (err) {
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
exports.default = app;
//# sourceMappingURL=index.js.map