import apiClient from './client';

export interface FinancialAnalysisResults {
  file_name: string;
  status: string;
  total_records: number;
  top_payees?: Array<{ name: string; total_amount: number }>;
  largest_transactions?: Array<{ date: string; description: string; amount: number }>;
  error?: string;
}

export const financialApi = {
  analyze: async (evidenceId: string): Promise<FinancialAnalysisResults> => {
    const response = await apiClient.post(`/financial/${evidenceId}/analyze`);
    return response.data;
  },
  
  traceCrypto: async (address: string, coin: string = 'btc'): Promise<any> => {
    const response = await apiClient.get(`/financial/crypto/trace`, {
      params: { address, coin }
    });
    return response.data;
  }
};

export default financialApi;
