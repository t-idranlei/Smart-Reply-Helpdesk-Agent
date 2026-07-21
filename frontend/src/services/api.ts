import axios from 'axios';

const API_BASE = 'http://localhost:8000';

export interface ReplyRequest {
  email_subject: string;
  email_body: string;
  sender: string;
  sender_name?: string;
  tone?: string;
  include_context?: boolean;
  max_length?: number;
  language?: string;
}

export interface ReplyData {
  draft_id: string;
  email_id: string;
  subject: string;
  body: string;
  confidence: number;
  tone_used: string;
  language: string;
  word_count: number;
  context_used: string[];
  context_confidence: number;
  requires_review: boolean;
  suggested_actions: string[];
}

export interface ApiResponse {
  status: 'success' | 'error';
  message: string;
  error_code: string | null;
  details: any;
  timestamp: string;
  request_id: string;
  processing_time_ms: number;
  data: ReplyData | null;
}

export const generateReply = async (data: ReplyRequest): Promise<ApiResponse> => {
  const response = await axios.post<ApiResponse>(`${API_BASE}/api/reply`, data);
  return response.data;
};