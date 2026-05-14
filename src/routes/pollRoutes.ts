import { Router } from 'express';
import { body } from 'express-validator';
import {
  createPoll,
  getMyPolls,
  getPollById,
  getPublicPoll,
  submitResponse,
  getPollAnalytics,
  publishPoll,
  updatePoll,
  deletePoll,
} from '../controllers/pollController';
import { authenticate, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// Protected routes (creator)
router.post(
  '/',
  authenticate,
  [
    body('title').trim().isLength({ min: 3, max: 500 }).withMessage('Title must be 3-500 characters'),
    body('is_anonymous').isBoolean().withMessage('is_anonymous must be boolean'),
    body('questions').isArray({ min: 1 }).withMessage('At least one question required'),
    body('questions.*.text').trim().notEmpty().withMessage('Question text required'),
    body('questions.*.is_mandatory').isBoolean().withMessage('is_mandatory must be boolean'),
    body('questions.*.options').isArray({ min: 2 }).withMessage('At least 2 options per question'),
    body('questions.*.options.*').trim().notEmpty().withMessage('Option text cannot be empty'),
    body('expires_at').optional().isISO8601().withMessage('Invalid expiry date format'),
  ],
  validate,
  createPoll
);

router.get('/my', authenticate, getMyPolls);
router.get('/:id', authenticate, getPollById);
router.put('/:id', authenticate, updatePoll);
router.delete('/:id', authenticate, deletePoll);
router.get('/:id/analytics', authenticate, getPollAnalytics);
router.post('/:id/publish', authenticate, publishPoll);

// Public routes
router.get('/public/:link', optionalAuth, getPublicPoll);
router.post(
  '/public/:link/respond',
  optionalAuth,
  [
    body('answers').isArray({ min: 1 }).withMessage('Answers required'),
    body('answers.*.question_id').isUUID().withMessage('Valid question ID required'),
    body('answers.*.option_id').isUUID().withMessage('Valid option ID required'),
  ],
  validate,
  submitResponse
);

export default router;
