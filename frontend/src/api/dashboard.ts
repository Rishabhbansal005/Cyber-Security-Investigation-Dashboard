import apiClient from './client';
import type { DashboardStats, Hotspot } from '@/types';

const dashboardApi = {
  getStats: async () => {
    const response = await apiClient.get<DashboardStats>('/dashboard/stats');
    return response.data;
  },
  getHotspots: async () => {
    const response = await apiClient.get<Hotspot[]>('/dashboard/hotspots');
    return response.data;
  },
  getTopSyndicate: async () => {
    const response = await apiClient.get<any>('/dashboard/top-syndicate');
    return response.data;
  },
  getAlerts: async () => {
    const response = await apiClient.get<Array<{ title: string; url?: string | null; source?: string }>>('/dashboard/alerts');
    return response.data;
  },
  getForensicNews: async () => {
    const response = await apiClient.get<Array<{ title: string; url?: string | null; source?: string }>>('/dashboard/forensic-news');
    return response.data;
  },
  getForensicTools: async () => {
    const response = await apiClient.get<{ tools: Array<{ tool?: string; name?: string; available?: boolean }>; available_count: number }>('/forensics/tools');
    return response.data;
  },
};

export default dashboardApi;
