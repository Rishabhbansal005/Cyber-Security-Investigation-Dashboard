import apiClient from './client';

export interface ImageAuthFace {
  index: number;
  box: { x: number; y: number; w: number; h: number } | null;
  manipulated_probability: number;
  label: string;
  note?: string;
}

export interface FileFactRow {
  label: string;
  value: string;
  plain?: string;
}

export interface CameraDiaryRow {
  label: string;
  value: string;
  present?: boolean;
}

export interface ImageAuthFlag {
  level: string;
  en: string;
  hi: string;
}

export interface AiScreenResult {
  available: boolean;
  concern_level?: 'low' | 'medium' | 'high' | 'unavailable';
  ai_generated_probability?: number | null;
  suspected_type?: string;
  scoring_mode?: string;
  disclaimer?: string;
  officer_notes?: string[];
  lab_test_auc?: number;
}

export interface ImageAuthResult {
  filename: string;
  image_size: { width: number; height: number };
  concern_level: 'low' | 'medium' | 'high' | 'inconclusive';
  suspected_type: string;
  aggregate_manipulated_probability: number;
  faces_detected: number;
  scoring_mode: string;
  faces: ImageAuthFace[];
  ai_screen?: AiScreenResult;
  officer_notes?: string[];
  disclaimer: string;
  sha256: string;
  bytes: number;
  file_facts?: { format?: string; rows: FileFactRow[] };
  camera_diary?: { has_exif: boolean; has_gps: boolean; rows: CameraDiaryRow[]; plain: string };
  flags?: ImageAuthFlag[];
  ela_png?: string | null;
  case_note?: { en: string; hi: string };
}

export interface ImageAuthCompare {
  victim: ImageAuthResult;
  disputed: ImageAuthResult;
  comparison: {
    same_file: boolean;
    summary_en: string;
    summary_hi: string;
    next_en: string;
    next_hi: string;
  };
}

const formHeaders = { timeout: 120000, headers: { 'Content-Type': undefined as unknown as string } };

const imageAuthApi = {
  analyze(file: File) {
    const body = new FormData();
    body.append('file', file);
    return apiClient.post<ImageAuthResult>('/image-auth/analyze', body, formHeaders).then((r) => r.data);
  },
  compare(victim: File, disputed: File) {
    const body = new FormData();
    body.append('victim', victim);
    body.append('disputed', disputed);
    return apiClient.post<ImageAuthCompare>('/image-auth/compare', body, formHeaders).then((r) => r.data);
  },
};

export default imageAuthApi;
