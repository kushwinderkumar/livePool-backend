import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, getClient } from '../config/database';
import { createError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { CreatePollRequest } from '../types';
import { getIO } from '../socket/socketManager';

// ── Helper: cast req to AuthRequest ──────────────────────────
const auth = (req: Request): AuthRequest => req as AuthRequest;

// ── Helper: generate short unique public link ─────────────────
const generatePublicLink = (): string =>
  uuidv4().replace(/-/g, '').substring(0, 12);

// ─────────────────────────────────────────────────────────────
//  All handler signatures use (req: Request, ...) so Express
//  accepts them as RequestHandler without type conflicts.
//  req.user is accessed via the auth() cast helper.
// ─────────────────────────────────────────────────────────────

export const createPoll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { title, description, is_anonymous, expires_at, questions }: CreatePollRequest = req.body;
    const creatorId = auth(req).user!.userId;

    let publicLink = generatePublicLink();
    let linkExists = await client.query('SELECT id FROM polls WHERE public_link = $1', [publicLink]);
    while (linkExists.rows.length > 0) {
      publicLink = generatePublicLink();
      linkExists = await client.query('SELECT id FROM polls WHERE public_link = $1', [publicLink]);
    }

    const pollResult = await client.query(
      `INSERT INTO polls (creator_id, title, description, is_anonymous, expires_at, public_link)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [creatorId, title, description || null, is_anonymous, expires_at || null, publicLink]
    );

    const poll = pollResult.rows[0];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const questionResult = await client.query(
        `INSERT INTO questions (poll_id, text, is_mandatory, order_index)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [poll.id, q.text, q.is_mandatory, i]
      );
      const question = questionResult.rows[0];
      for (let j = 0; j < q.options.length; j++) {
        await client.query(
          `INSERT INTO options (question_id, text, order_index) VALUES ($1, $2, $3)`,
          [question.id, q.options[j], j]
        );
      }
    }

    await client.query('COMMIT');
    const fullPoll = await getFullPoll(poll.id);
    res.status(201).json({ success: true, message: 'Poll created successfully', data: { poll: fullPoll } });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

export const getMyPolls = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await query(
      `SELECT p.*,
        COUNT(DISTINCT r.id) as response_count,
        (SELECT COUNT(*) FROM questions WHERE poll_id = p.id) as question_count
       FROM polls p
       LEFT JOIN responses r ON r.poll_id = p.id
       WHERE p.creator_id = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [auth(req).user!.userId]
    );
    res.json({ success: true, data: { polls: result.rows } });
  } catch (error) {
    next(error);
  }
};

export const getPollById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const poll = await getFullPoll(id);
    if (!poll) return next(createError('Poll not found', 404));
    if (poll.creator_id !== auth(req).user!.userId) return next(createError('Unauthorized', 403));
    res.json({ success: true, data: { poll } });
  } catch (error) {
    next(error);
  }
};

export const getPublicPoll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { link } = req.params;
    const pollResult = await query('SELECT * FROM polls WHERE public_link = $1', [link]);
    if (pollResult.rows.length === 0) return next(createError('Poll not found', 404));

    const poll = pollResult.rows[0];

    if (poll.expires_at && new Date(poll.expires_at) < new Date()) {
      poll.is_active = false;
    }

    if (poll.is_published) {
      const analytics = await buildAnalytics(poll);
      res.json({ success: true, data: { poll, analytics, view: 'results' } });
      return;
    }

    if (!poll.is_active) {
      res.json({ success: true, data: { poll, view: 'expired' } });
      return;
    }

    let alreadyResponded = false;
    const user = auth(req).user;
    if (user) {
      const existing = await query(
        'SELECT id FROM responses WHERE poll_id = $1 AND respondent_id = $2',
        [poll.id, user.userId]
      );
      alreadyResponded = existing.rows.length > 0;
    }

    const questions = await getQuestionsWithOptions(poll.id);
    res.json({ success: true, data: { poll, questions, alreadyResponded, view: 'form' } });
  } catch (error) {
    next(error);
  }
};

export const submitResponse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { link } = req.params;
    const { answers } = req.body;

    const pollResult = await client.query('SELECT * FROM polls WHERE public_link = $1', [link]);
    if (pollResult.rows.length === 0) return next(createError('Poll not found', 404));

    const poll = pollResult.rows[0];

    if (poll.expires_at && new Date(poll.expires_at) < new Date()) {
      return next(createError('This poll has expired', 410));
    }
    if (!poll.is_active) return next(createError('This poll is no longer active', 410));
    if (poll.is_published) return next(createError('This poll is closed', 410));

    const user = auth(req).user;

    if (!poll.is_anonymous) {
      if (!user) return next(createError('Authentication required for this poll', 401));
      const existing = await client.query(
        'SELECT id FROM responses WHERE poll_id = $1 AND respondent_id = $2',
        [poll.id, user.userId]
      );
      if (existing.rows.length > 0) return next(createError('You have already responded to this poll', 409));
    }

    const questionsResult = await client.query(
      'SELECT * FROM questions WHERE poll_id = $1 ORDER BY order_index',
      [poll.id]
    );
    const questions = questionsResult.rows;
    const mandatoryIds = questions.filter((q) => q.is_mandatory).map((q) => q.id);
    const answeredIds = answers.map((a: { question_id: string }) => a.question_id);
    const missingMandatory = mandatoryIds.filter((id: string) => !answeredIds.includes(id));
    if (missingMandatory.length > 0) {
      return next(createError('Please answer all mandatory questions', 400));
    }

    for (const answer of answers) {
      const optionCheck = await client.query(
        'SELECT id FROM options WHERE id = $1 AND question_id = $2',
        [answer.option_id, answer.question_id]
      );
      if (optionCheck.rows.length === 0) {
        return next(createError('Invalid option selected', 400));
      }
    }

    const ipAddress = req.ip ?? null;

    const responseResult = await client.query(
      `INSERT INTO responses (poll_id, respondent_id, ip_address) VALUES ($1, $2, $3) RETURNING *`,
      [poll.id, user?.userId || null, ipAddress]
    );
    const response = responseResult.rows[0];

    for (const answer of answers) {
      await client.query(
        `INSERT INTO answers (response_id, question_id, option_id) VALUES ($1, $2, $3)`,
        [response.id, answer.question_id, answer.option_id]
      );
    }

    await client.query('COMMIT');

    const io = getIO();
    const countResult = await query('SELECT COUNT(*) FROM responses WHERE poll_id = $1', [poll.id]);
    const totalResponses = parseInt(countResult.rows[0].count);
    io.to(`poll:${poll.id}`).emit('response:new', { pollId: poll.id, totalResponses });

    const analytics = await buildAnalytics(poll);
    io.to(`analytics:${poll.id}`).emit('analytics:update', { analytics });

    res.status(201).json({
      success: true,
      message: 'Response submitted successfully',
      data: { responseId: response.id },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

export const getPollAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const pollResult = await query('SELECT * FROM polls WHERE id = $1', [id]);
    if (pollResult.rows.length === 0) return next(createError('Poll not found', 404));
    const poll = pollResult.rows[0];
    if (poll.creator_id !== auth(req).user!.userId) return next(createError('Unauthorized', 403));
    const analytics = await buildAnalytics(poll);
    res.json({ success: true, data: { analytics } });
  } catch (error) {
    next(error);
  }
};

export const publishPoll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const pollResult = await query('SELECT * FROM polls WHERE id = $1', [id]);
    if (pollResult.rows.length === 0) return next(createError('Poll not found', 404));
    const poll = pollResult.rows[0];
    if (poll.creator_id !== auth(req).user!.userId) return next(createError('Unauthorized', 403));
    await query('UPDATE polls SET is_published = true, is_active = false WHERE id = $1', [id]);
    const io = getIO();
    io.to(`poll:${poll.id}`).emit('poll:published', { pollId: poll.id });
    res.json({ success: true, message: 'Poll results published successfully' });
  } catch (error) {
    next(error);
  }
};

export const updatePoll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, expires_at, is_active } = req.body;
    const pollResult = await query('SELECT * FROM polls WHERE id = $1', [id]);
    if (pollResult.rows.length === 0) return next(createError('Poll not found', 404));
    if (pollResult.rows[0].creator_id !== auth(req).user!.userId) return next(createError('Unauthorized', 403));
    const result = await query(
      `UPDATE polls SET title = COALESCE($1, title), description = COALESCE($2, description),
       expires_at = $3, is_active = COALESCE($4, is_active) WHERE id = $5 RETURNING *`,
      [title, description, expires_at || null, is_active, id]
    );
    res.json({ success: true, data: { poll: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

export const deletePoll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const pollResult = await query('SELECT * FROM polls WHERE id = $1', [id]);
    if (pollResult.rows.length === 0) return next(createError('Poll not found', 404));
    if (pollResult.rows[0].creator_id !== auth(req).user!.userId) return next(createError('Unauthorized', 403));
    await query('DELETE FROM polls WHERE id = $1', [id]);
    res.json({ success: true, message: 'Poll deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ─── Helpers ─────────────────────────────────────────────────

async function getFullPoll(pollId: string) {
  const pollResult = await query('SELECT * FROM polls WHERE id = $1', [pollId]);
  if (pollResult.rows.length === 0) return null;
  const poll = pollResult.rows[0];
  poll.questions = await getQuestionsWithOptions(pollId);
  return poll;
}

async function getQuestionsWithOptions(pollId: string) {
  const questionsResult = await query(
    'SELECT * FROM questions WHERE poll_id = $1 ORDER BY order_index',
    [pollId]
  );
  const questions: Record<string, unknown>[] = questionsResult.rows;
  for (const q of questions) {
    const optionsResult = await query(
      'SELECT * FROM options WHERE question_id = $1 ORDER BY order_index',
      [q.id as string]
    );
    q.options = optionsResult.rows;
  }
  return questions;
}

async function buildAnalytics(poll: Record<string, unknown>) {
  const pollId = poll.id as string;
  const totalResult = await query('SELECT COUNT(*) FROM responses WHERE poll_id = $1', [pollId]);
  const totalResponses = parseInt(totalResult.rows[0].count);

  const questions = await getQuestionsWithOptions(pollId);

  const questionAnalytics = await Promise.all(
    questions.map(async (q: Record<string, unknown>) => {
      const totalAnswers = await query(
        `SELECT COUNT(*) FROM answers a
         JOIN responses r ON r.id = a.response_id
         WHERE a.question_id = $1 AND r.poll_id = $2`,
        [q.id as string, pollId]
      );
      const answered = parseInt(totalAnswers.rows[0].count);

      const optionAnalytics = await Promise.all(
        (q.options as Record<string, unknown>[]).map(async (opt: Record<string, unknown>) => {
          const countResult = await query(
            `SELECT COUNT(*) FROM answers WHERE question_id = $1 AND option_id = $2`,
            [q.id as string, opt.id as string]
          );
          const count = parseInt(countResult.rows[0].count);
          return {
            option: opt,
            count,
            percentage: answered > 0 ? Math.round((count / answered) * 100) : 0,
          };
        })
      );

      return {
        question: q,
        options: optionAnalytics,
        total_answers: answered,
        response_rate: totalResponses > 0 ? Math.round((answered / totalResponses) * 100) : 0,
      };
    })
  );

  const recentResult = await query(
    `SELECT r.submitted_at, u.name as respondent_name
     FROM responses r
     LEFT JOIN users u ON u.id = r.respondent_id
     WHERE r.poll_id = $1
     ORDER BY r.submitted_at DESC LIMIT 10`,
    [pollId]
  );

  return {
    poll,
    total_responses: totalResponses,
    questions: questionAnalytics,
    participation_rate: totalResponses,
    recent_responses: recentResult.rows,
  };
}
