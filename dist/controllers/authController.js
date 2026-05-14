"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const errorHandler_1 = require("../middleware/errorHandler");
const register = async (req, res, next) => {
    try {
        const { email, name, password } = req.body;
        const existing = await (0, database_1.query)('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return next((0, errorHandler_1.createError)('Email already registered', 409));
        }
        const password_hash = await bcryptjs_1.default.hash(password, 12);
        const result = await (0, database_1.query)('INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name, created_at', [email, name, password_hash]);
        const user = result.rows[0];
        const jwtOptions = {
            expiresIn: (process.env.JWT_EXPIRES_IN || '7d'),
        };
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, jwtOptions);
        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            data: { user: { id: user.id, email: user.email, name: user.name }, token },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.register = register;
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const result = await (0, database_1.query)('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return next((0, errorHandler_1.createError)('Invalid email or password', 401));
        }
        const user = result.rows[0];
        const isValid = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!isValid) {
            return next((0, errorHandler_1.createError)('Invalid email or password', 401));
        }
        const jwtOptions = {
            expiresIn: (process.env.JWT_EXPIRES_IN || '7d'),
        };
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, jwtOptions);
        res.json({
            success: true,
            message: 'Login successful',
            data: { user: { id: user.id, email: user.email, name: user.name }, token },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.login = login;
// Use Request signature — cast to AuthRequest internally to access req.user
const getMe = async (req, res, next) => {
    try {
        const authReq = req;
        const result = await (0, database_1.query)('SELECT id, email, name, created_at FROM users WHERE id = $1', [authReq.user?.userId]);
        if (result.rows.length === 0) {
            return next((0, errorHandler_1.createError)('User not found', 404));
        }
        res.json({ success: true, data: { user: result.rows[0] } });
    }
    catch (error) {
        next(error);
    }
};
exports.getMe = getMe;
//# sourceMappingURL=authController.js.map