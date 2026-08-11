import apiClient from './client';

export interface OsintFinding {
  id: string;
  entity: string;
  type: string;
  source: string;
  severity: string;
  time: string;
  url?: string;
}

export interface OsintStats {
  mentions: number;
  leaks: number;
}

export interface OsintSearchResponse {
  success: boolean;
  type?: string;
  error?: string;
  pulse_count?: number;
  findings: OsintFinding[];
  stats: OsintStats;
}

// CVE Lookup
export interface CveResult {
  success: boolean;
  error?: string;
  cve?: string;
  cvss?: number;
  summary?: string;
  references?: string[];
}



// Domain Reputation
export interface DomainPulse {
  name: string;
  tags: string[];
  modified: string;
}
export interface DomainReputationResult {
  success: boolean;
  error?: string;
  domain?: string;
  pulse_count?: number;
  reputation?: string;
  rep_color?: string;
  whois?: string;
  alexa_rank?: string;
  country?: string;
  validation?: string[];
  recent_pulses?: DomainPulse[];
}



// IP Geolocation
export interface IpGeoResult {
  success: boolean;
  error?: string;
  ip?: string;
  country?: string;
  city?: string;
  isp?: string;
  org?: string;
  lat?: number;
  lon?: number;
}



// Nmap Scan
export interface OpenPort {
  port: number;
  service: string;
  state: string;
}
export interface NmapResult {
  success: boolean;
  error?: string;
  target?: string;
  scan_type?: string;
  total_scanned?: number;
  open_ports?: OpenPort[];
}

// WHOIS
export interface WhoisResult {
  success: boolean;
  error?: string;
  domain?: string;
  registrar?: string;
  creation_date?: string;
  expiration_date?: string;
  nameservers?: string[];
}

// Shodan
export interface ShodanResult {
  success: boolean;
  error?: string;
  ip?: string;
  org?: string;
  isp?: string;
  os?: string;
  ports?: number[];
  vulns?: string[];
  hostnames?: string[];
}

export const osintApi = {
  search: async (query: string): Promise<OsintSearchResponse> => {
    const response = await apiClient.get<OsintSearchResponse>('/osint/search', {
      params: { query },
    });
    return response.data;
  },

  lookupCve: async (cveId: string): Promise<CveResult> => {
    const response = await apiClient.get<CveResult>('/osint/cve', {
      params: { cve_id: cveId },
    });
    return response.data;
  },



  checkDomain: async (domain: string): Promise<DomainReputationResult> => {
    const response = await apiClient.get<DomainReputationResult>('/osint/domain', {
      params: { domain },
    });
    return response.data;
  },



  checkIpGeo: async (ip: string): Promise<IpGeoResult> => {
    const response = await apiClient.get<IpGeoResult>('/osint/ip-geo', {
      params: { ip },
    });
    return response.data;
  },



  runNmap: async (target: string): Promise<NmapResult> => {
    const response = await apiClient.get<NmapResult>('/osint/nmap', {
      params: { target, scan_type: 'quick' },
    });
    return response.data;
  },



  generateReport: async (findings: OsintFinding[]): Promise<Blob> => {
    const response = await apiClient.post('/osint/report', { findings }, {
      responseType: 'blob',
    });
    return response.data;
  },



  lookupWhois: async (domain: string): Promise<WhoisResult> => {
    const response = await apiClient.get<WhoisResult>('/osint/whois', {
      params: { domain },
    });
    return response.data;
  },

  lookupShodan: async (ip: string): Promise<ShodanResult> => {
    const response = await apiClient.get<ShodanResult>('/osint/shodan', {
      params: { ip },
    });
    return response.data;
  },

  lookupSocmint: async (username: string): Promise<any> => {
    const response = await apiClient.get<any>('/osint/socmint', {
      params: { username, _t: new Date().getTime() },
    });
    return response.data;
  }
};

