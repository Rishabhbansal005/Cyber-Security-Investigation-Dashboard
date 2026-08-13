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
};

export default dashboardApi;
