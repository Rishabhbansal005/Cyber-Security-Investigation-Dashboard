import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const apiClient = axios.create({
  baseURL: `${API_URL}/threat-intel`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface ThreatFoxEvent {
  id: string;
  ioc: string;
  ioc_type: string;
  threat_type: string;
  threat_type_desc: string;
  malware_family: string | null;
  malware_printable: string | null;
  confidence_level: number;
  first_seen: string;
  last_seen: string | null;
  reporter: string;
  source: string;
}

export interface OTXPulse {
  id: string;
  name: string;
  description: string;
  malware_family: string | null;
}

export interface OTXEnrichment {
  ioc: string;
  ioc_type: string;
  pulse_count: number;
  pulses: Array<{
    id: string;
    name: string;
    description: string;
    tags: string[];
    references: string[];
    malware_families: string[];
    attack_ids: string[];
    attack_names: string[];
    author: string;
    created: string | null;
    modified: string | null;
    indicator_count: number;
  }>;
  tags: string[];
  references: string[];
  attack_ids: string[];
  malware_families: string[];
}

export interface ThreatObject {
  id: string;
  threat_name: string;
  threat_score: number;
  confidence: number;
  sources: string[];
  ioc_list: string[];
  malware_family: string | null;
  related_urls: string[];
  first_seen: string | null;
  last_seen: string | null;
  indicator_count: number;
  related_events: any[];
  otx_pulses: OTXPulse[];
  otx_tags: string[];
  otx_references: string[];
  otx_attack_ids: string[];
  otx_threat_actor: string | null;
}

export interface ThreatFoxResponse {
  success: boolean;
  data: ThreatFoxEvent[];
  error?: string;
}

export interface CorrelatedThreatsResponse {
  success: boolean;
  data: ThreatObject[];
  total_events: number;
  total_threats: number;
  error?: string;
}

export interface IOCEnrichResponse {
  success: boolean;
  data: OTXEnrichment | null;
  message?: string;
  error?: string;
}

export interface TimelineBucket {
  label: string;
  count: number;
}

export interface TimelineResponse {
  success: boolean;
  range: string;
  data: TimelineBucket[];
}

export const threatIntelApi = {
  getRecentThreatFoxIOCs: async (): Promise<ThreatFoxResponse> => {
    const { data } = await apiClient.get<ThreatFoxResponse>('/threatfox/recent');
    return data;
  },
  getRecentURLhausIOCs: async (): Promise<ThreatFoxResponse> => {
    const { data } = await apiClient.get<ThreatFoxResponse>('/urlhaus/recent');
    return data;
  },
  getRecentOTXPulses: async (): Promise<{ success: boolean; data: any[]; pulse_count?: number }> => {
    const { data } = await apiClient.get('/otx/recent');
    return data;
  },
  getCorrelatedThreats: async (): Promise<CorrelatedThreatsResponse> => {
    const { data } = await apiClient.get<CorrelatedThreatsResponse>('/correlated');
    return data;
  },
  getIOCEnrichment: async (ioc: string): Promise<IOCEnrichResponse> => {
    const { data } = await apiClient.get<IOCEnrichResponse>('/ioc/enrich', {
      params: { ioc },
    });
    return data;
  },
  getTimeline: async (range: '1h' | '24h' | '7d' = '24h'): Promise<TimelineResponse> => {
    const { data } = await apiClient.get<TimelineResponse>('/timeline', {
      params: { range },
    });
    return data;
  },
};
