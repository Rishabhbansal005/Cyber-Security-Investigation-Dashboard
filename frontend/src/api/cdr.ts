import apiClient from './client';

export interface CdrAnalysisResults {
  file_name: string;
  status: string;
  total_records: number;
  frequent_called_numbers?: Array<{ number: string; count: number }>;
  tower_locations?: Array<{ location: string; count: number }>;
  timeline_events?: any[];
  error?: string;
}

export const cdrApi = {
  analyze: async (evidenceId: string): Promise<CdrAnalysisResults> => {
    const response = await apiClient.post(`/cdr/${evidenceId}/analyze`);
    return response.data;
  },
};

export default cdrApi;
