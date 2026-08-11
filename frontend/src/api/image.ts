import apiClient from './client';

export interface ImageAnalysisResults {
  analysis_summary: {
    has_exif: boolean;
    has_gps: boolean;
  };
  exif_data?: Record<string, string>;
  gps_coordinates?: {
    lat: number;
    lon: number;
  };
  timeline_events?: any[];
}

export const imageApi = {
  analyze: async (evidenceId: string): Promise<ImageAnalysisResults> => {
    const response = await apiClient.post(`/image/${evidenceId}/analyze`);
    return response.data;
  },
};

export default imageApi;
