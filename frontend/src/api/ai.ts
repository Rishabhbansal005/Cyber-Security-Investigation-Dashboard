import apiClient from './client';

export interface OSINTSummaryPayload {
  indicator: string;
  indicator_type: string;
  otx_data?: any;
  data_classification?: 'synthetic' | 'real_case_data';
  case_id?: string;
}

export interface CyberCopilotPayload {
  question: string;
  context?: string;
  data_classification?: 'synthetic' | 'real_case_data';
  case_id?: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
}

export interface AIResponse {
  success: boolean;
  summary?: string;
  answer?: string;
  narrative?: string;
  threat_level?: string;
  status: 'success' | 'blocked' | 'failed' | 'disabled';
  error_message?: string;
  audit_log_id?: string;
  review_status?: 'ai_draft' | 'officer_reviewed' | 'officer_approved';
  disclaimer?: string;
  provider_used?: string;
}

export const aiApi = {
  getOsintSummary: async (payload: OSINTSummaryPayload): Promise<AIResponse> => {
    const res = await apiClient.post<AIResponse>('/ai/osint-summary', payload);
    return res.data;
  },

  askCopilot: async (payload: CyberCopilotPayload): Promise<AIResponse> => {
    const res = await apiClient.post<AIResponse>('/ai/chat', payload);
    return res.data;
  },

  generateCaseNarrative: async (payload: { case_title: string; evidence_summary: string; data_classification?: 'synthetic' | 'real_case_data'; case_id?: string }): Promise<AIResponse> => {
    const res = await apiClient.post<AIResponse>('/ai/case-narrative', payload);
    return res.data;
  },

  approveDraft: async (audit_log_id: string): Promise<{ success: boolean; review_status: string }> => {
    const res = await apiClient.post('/ai/approve-draft', { audit_log_id });
    return res.data;
  }
};

export default aiApi;
