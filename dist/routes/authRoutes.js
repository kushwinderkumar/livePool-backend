"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
router.post('/register', [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    (0, express_validator_1.body)('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    (0, express_validator_1.body)('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], validate_1.validate, authController_1.register);
router.post('/login', [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Password required'),
], validate_1.validate, authController_1.login);
router.get('/me', auth_1.authenticate, authController_1.getMe);
exports.default = router;
//# sourceMappingURL=authRoutes.js.map