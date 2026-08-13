import apiClient from './client';

export interface OfficerAuditLog {
  id: string;
  action: string;
  target?: string;
  officer_id?: string;
  officer_email?: string;
  status: string;
  created_at: string;
}

const auditApi = {
  list: async () => {
    const response = await apiClient.get<OfficerAuditLog[]>('/audit/logs');
    return response.data;
  },
};

export default auditApi;
