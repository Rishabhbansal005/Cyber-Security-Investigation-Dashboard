import apiClient from './client';
import type { Case, CaseCreate, CaseUpdate, CaseListResponse, CaseStats } from '@/types';

export const casesApi = {
  list: async (params?: {
    page?: number;
    page_size?: number;
    status?: string;
    priority?: string;
    search?: string;
  }) => {
    const response = await apiClient.get<CaseListResponse>('/cases', { params });
    return response.data;
  },

  get: (id: string) =>
    apiClient.get<Case>(`/cases/${id}`).then((r) => r.data),

  create: (data: CaseCreate) =>
    apiClient.post<Case>('/cases', data).then((r) => r.data),

  update: (id: string, data: CaseUpdate) =>
    apiClient.put<Case>(`/cases/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/cases/${id}`).then((r) => r.data),

  getStats: (id: string) =>
    apiClient.get<CaseStats>(`/cases/${id}/stats`).then((r) => r.data),
};

export default casesApi;
