import apiClient from './client';

export interface ContactPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ContactTicket {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  created_at?: string;
}

const contactApi = {
  submit: async (payload: ContactPayload) => {
    const { data } = await apiClient.post<{
      success: boolean;
      message: string;
      submission_id?: string;
      emailed?: boolean;
    }>('/contact', payload);
    return data;
  },

  list: async () => {
    const { data } = await apiClient.get<{ items: ContactTicket[] }>('/contact');
    return data.items || [];
  },
};

export default contactApi;
