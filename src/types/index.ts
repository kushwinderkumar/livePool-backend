export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export interface Poll {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  is_anonymous: boolean;
  expires_at: Date | null;
  is_published: boolean;
  is_active: boolean;
  public_link: string;
  created_at: Date;
  updated_at: Date;
}

export interface Question {
  id: string;
  poll_id: string;
  text: string;
  is_mandatory: boolean;
  order_index: number;
  created_at: Date;
}

export interface Option {
  id: string;
  question_id: string;
  text: string;
  order_index: number;
  created_at: Date;
}

export interface Response {
  id: string;
  poll_id: string;
  respondent_id: string | null;
  submitted_at: Date;
  ip_address: string | null;
}

export interface Answer {
  id: string;
  response_id: string;
  question_id: string;
  option_id: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Express.Request {
  user?: JwtPayload;
}

// API Request/Response types
export interface CreatePollRequest {
  title: string;
  description?: string;
  is_anonymous: boolean;
  expires_at?: string;
  questions: CreateQuestionRequest[];
}

export interface CreateQuestionRequest {
  text: string;
  is_mandatory: boolean;
  options: string[];
}

export interface SubmitResponseRequest {
  answers: {
    question_id: string;
    option_id: string;
  }[];
}

export interface PollAnalytics {
  poll: Poll;
  total_responses: number;
  questions: QuestionAnalytics[];
  participation_rate: number;
  recent_responses: RecentResponse[];
}

export interface QuestionAnalytics {
  question: Question;
  options: OptionAnalytics[];
  total_answers: number;
  response_rate: number;
}

export interface OptionAnalytics {
  option: Option;
  count: number;
  percentage: number;
}

export interface RecentResponse {
  submitted_at: Date;
  respondent_name?: string;
}
