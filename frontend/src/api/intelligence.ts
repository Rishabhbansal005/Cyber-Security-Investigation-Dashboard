import apiClient from './client';

export interface CategoryClassification {
  predicted_category: string;
  confidence: number;
  probabilities: Record<string, number>;
  indicators: string[];
  model_version: string;
  is_prototype: boolean;
  disclaimer: string;
}

export interface ExtractedEntity {
  type?: string;
  entity_type?: string;
  value_raw: string;
  value_masked: string;
  normalized?: string;
  amount_inr?: number;
}

export interface SimilarCase {
  case_id: string;
  case_number?: string;
  title?: string;
  similarity: number;
  label?: string;
}

export interface PriorityResult {
  priority_label: string;
  priority_score: number;
  model_class?: string;
  class_probabilities?: Record<string, number>;
  reasons: string[];
  features_used: string[];
  labeling_note?: string;
  model_version?: string;
  is_prototype?: boolean;
}

export interface IdentifierHit {
  type: string;
  value: string;
  count: number;
  cases: SimilarCase[];
}

export interface NcrpDraft {
  suggested_category?: string;
  amount_lost_inr?: number | null;
  upi_id?: string;
  phone?: string;
  url?: string;
  transaction_id?: string;
  email?: string;
  incident_date?: string | null;
  narrative_preview?: string;
}

export interface AnalyzeComplaintResponse {
  case_id: string;
  complaint_text: string;
  classification: CategoryClassification;
  entities: ExtractedEntity[];
  similar_cases: SimilarCase[];
  identifier_hits?: IdentifierHit[];
  ncrp_draft?: NcrpDraft;
  priority: PriorityResult;
  embedding_version?: string;
  is_prototype: boolean;
  disclaimer: string;
  persisted?: boolean;
}

export interface StoredAnalysis {
  case_id: string;
  predicted_category: string;
  category_scores: Record<string, number>;
  category_confidence: number;
  priority_score: number;
  priority_label: string;
  explanation: string[];
  features_used: string[];
  model_versions: Record<string, string>;
  is_prototype: boolean;
  disclaimer?: string;
  analyzed_at?: string;
}

export interface MlStats {
  analyzed_count: number;
  high_priority_ai: number;
  potentially_linked: number;
  crime_type_mix: { category: string; count: number }[];
  by_case: Record<string, { predicted_category: string; priority_label: string; priority_score?: number }>;
  disclaimer: string;
  tables_ready: boolean;
}

const intelligenceApi = {
  analyzeComplaint: async (caseId: string) => {
    const response = await apiClient.post<AnalyzeComplaintResponse>(
      '/analyze/complaint',
      { case_id: caseId },
      { timeout: 120000 },
    );
    return response.data;
  },
  getAnalysis: async (caseId: string) => {
    try {
      const response = await apiClient.get<StoredAnalysis>(`/cases/${caseId}/analysis`);
      return response.data;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) return null;
      throw err;
    }
  },
  getSimilar: async (caseId: string) => {
    const response = await apiClient.get<{ items: SimilarCase[] }>(`/cases/${caseId}/similar`);
    return response.data.items;
  },
  getEntities: async (caseId: string) => {
    const response = await apiClient.get<{ items: ExtractedEntity[] }>(`/cases/${caseId}/entities`);
    return response.data.items;
  },
  getMlStats: async () => {
    const response = await apiClient.get<MlStats>('/dashboard/ml-stats');
    return response.data;
  },
  analyzeFile: async (payload: { file?: File; text?: string; caseId?: string }) => {
    if (!payload.file && payload.text) {
      const response = await apiClient.post<{
        source: string;
        count: number;
        items: AnalyzeComplaintResponse[];
        training_note: string;
        disclaimer?: string;
      }>('/analyze/text', {
        text: payload.text,
        case_id: payload.caseId || null,
        title: 'pasted-text',
      }, { timeout: 120000 });
      return response.data;
    }
    const form = new FormData();
    if (payload.file) form.append('file', payload.file);
    if (payload.text) form.append('text', payload.text);
    if (payload.caseId) form.append('case_id', payload.caseId);
    const response = await apiClient.post<{
      source: string;
      count: number;
      items: AnalyzeComplaintResponse[];
      training_note: string;
      disclaimer?: string;
    }>('/analyze/complaint-file', form, {
      timeout: 120000,
      headers: { 'Content-Type': undefined as unknown as string },
    });
    return response.data;
  },
  sendFeedback: async (payload: {
    complaint_text: string;
    predicted_category?: string;
    correct_category: string;
    agreed: boolean;
  }) => {
    const response = await apiClient.post('/analyze/feedback', payload);
    return response.data;
  },
};

export default intelligenceApi;
