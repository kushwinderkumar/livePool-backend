"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const pollController_1 = require("../controllers/pollController");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
// Protected routes (creator)
router.post('/', auth_1.authenticate, [
    (0, express_validator_1.body)('title').trim().isLength({ min: 3, max: 500 }).withMessage('Title must be 3-500 characters'),
    (0, express_validator_1.body)('is_anonymous').isBoolean().withMessage('is_anonymous must be boolean'),
    (0, express_validator_1.body)('questions').isArray({ min: 1 }).withMessage('At least one question required'),
    (0, express_validator_1.body)('questions.*.text').trim().notEmpty().withMessage('Question text required'),
    (0, express_validator_1.body)('questions.*.is_mandatory').isBoolean().withMessage('is_mandatory must be boolean'),
    (0, express_validator_1.body)('questions.*.options').isArray({ min: 2 }).withMessage('At least 2 options per question'),
    (0, express_validator_1.body)('questions.*.options.*').trim().notEmpty().withMessage('Option text cannot be empty'),
    (0, express_validator_1.body)('expires_at').optional().isISO8601().withMessage('Invalid expiry date format'),
], validate_1.validate, pollController_1.createPoll);
router.get('/my', auth_1.authenticate, pollController_1.getMyPolls);
router.get('/:id', auth_1.authenticate, pollController_1.getPollById);
router.put('/:id', auth_1.authenticate, pollController_1.updatePoll);
router.delete('/:id', auth_1.authenticate, pollController_1.deletePoll);
router.get('/:id/analytics', auth_1.authenticate, pollController_1.getPollAnalytics);
router.post('/:id/publish', auth_1.authenticate, pollController_1.publishPoll);
// Public routes
router.get('/public/:link', auth_1.optionalAuth, pollController_1.getPublicPoll);
router.post('/public/:link/respond', auth_1.optionalAuth, [
    (0, express_validator_1.body)('answers').isArray({ min: 1 }).withMessage('Answers required'),
    (0, express_validator_1.body)('answers.*.question_id').isUUID().withMessage('Valid question ID required'),
    (0, express_validator_1.body)('answers.*.option_id').isUUID().withMessage('Valid option ID required'),
], validate_1.validate, pollController_1.submitResponse);
exports.default = router;
//# sourceMappingURL=pollRoutes.js.map