// ============================================================
// Core TypeScript Interfaces for CCID Platform
// ============================================================

export type UserRole = 'admin' | 'investigator' | 'viewer';

export interface User {
  id: string;
  email: string;
  full_name?: string;
  role: UserRole;
  badge_number?: string;
  department?: string;
  avatar_url?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Case Types
// ============================================================

export type CaseStatus = 'open' | 'active' | 'pending_review' | 'closed' | 'archived';
export type CasePriority = 'low' | 'medium' | 'high' | 'critical';
export type CaseCategory =
  | 'cybercrime'
  | 'data_breach'
  | 'malware'
  | 'ransomware'
  | 'phishing'
  | 'insider_threat'
  | 'fraud'
  | 'ddos'
  | 'espionage'
  | 'other';

export interface Case {
  id: string;
  case_number: string;
  title: string;
  description?: string;
  incident_date?: string;
  status: CaseStatus;
  priority: CasePriority;
  category?: CaseCategory;
  jurisdiction?: string;
  assigned_to?: string;
  assignee?: Pick<User, 'id' | 'full_name' | 'email' | 'role'>;
  created_by: string;
  tags: string[];
  fir_number?: string;
  police_station?: string;
  ncrp_complaint_id?: string;
  complainant_name?: string;
  sections_of_law?: string[];
  funds_frozen_inr?: number;
  created_at: string;
  updated_at: string;
}

export interface CaseCreate {
  title: string;
  description?: string;
  incident_date?: string;
  status?: CaseStatus;
  priority?: CasePriority;
  category?: CaseCategory;
  jurisdiction?: string;
  assigned_to?: string;
  tags?: string[];
  fir_number?: string;
  police_station?: string;
  ncrp_complaint_id?: string;
  complainant_name?: string;
  sections_of_law?: string[];
  funds_frozen_inr?: number;
}

export interface CaseUpdate extends Partial<CaseCreate> {}

export interface CaseListResponse {
  items: Case[];
  total: number;
  page: number;
  page_size: number;
}

export interface CaseStats {
  evidence_count: number;
  findings_count: number;
  timeline_events: number;
  critical_findings: number;
}

// ============================================================
// Evidence Types
// ============================================================

export type EvidenceType =
  | 'digital'
  | 'network_capture'
  | 'memory_dump'
  | 'disk_image'
  | 'log_file'
  | 'document'
  | 'screenshot'
  | 'email'
  | 'other';

export type ProcessingStatus = 'pending' | 'processing' | 'analyzed' | 'error' | 'skipped';

export interface ChainOfCustodyEvent {
  action: string;
  user_id: string;
  user_name?: string;
  timestamp: string;
  notes?: string;
  location?: string;
}

export interface Evidence {
  id: string;
  case_id: string;
  suspect_id?: string;
  evidence_number: string;
  file_name: string;
  original_file_name: string;
  file_type: string;
  mime_type?: string;
  file_size: number;
  storage_path: string;
  storage_bucket: string;
  public_url?: string;
  hash_md5?: string;
  hash_sha1?: string;
  hash_sha256?: string;
  hash_sha512?: string;
  evidence_type: EvidenceType;
  source_device?: string;
  source_location?: string;
  acquisition_method?: string;
  chain_of_custody: ChainOfCustodyEvent[];
  processing_status: ProcessingStatus;
  forensic_tool?: string;
  analysis_notes?: string;
  is_verified: boolean;
  verified_by?: string;
  verified_at?: string;
  tags: string[];
  uploaded_by: string;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}

export interface EvidenceUpdate extends Partial<Omit<Evidence, 'id' | 'case_id' | 'created_at' | 'updated_at'>> {}

// ============================================================
// Finding Types
// ============================================================

export type FindingSeverity = 'informational' | 'low' | 'medium' | 'high' | 'critical';
export type FindingStatus = 'open' | 'investigating' | 'confirmed' | 'false_positive' | 'resolved';

export interface IOCIndicator {
  type: 'ip' | 'domain' | 'hash' | 'email' | 'url' | 'filename' | 'registry' | 'other';
  value: string;
  context?: string;
  confidence: number; // 0–100
}

export interface Finding {
  id: string;
  case_id: string;
  evidence_id?: string;
  finding_number: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  category?: string;
  mitre_tactic?: string;
  mitre_technique?: string;
  status: FindingStatus;
  tags: string[];
  ioc_indicators: IOCIndicator[];
  recommendations?: string;
  analysis_source?: string;
  created_by: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Timeline Types
// ============================================================

export type EventType =
  | 'system'
  | 'network'
  | 'user_action'
  | 'file'
  | 'registry'
  | 'process'
  | 'authentication'
  | 'email'
  | 'web'
  | 'evidence'
  | 'integrity'
  | 'memory_analysis'
  | 'network_analysis'
  | 'finding'
  | 'risk_assessment'
  | 'other';

export type EventImportance = 'informational' | 'low' | 'normal' | 'medium' | 'high' | 'critical';

export interface TimelineEvent {
  id: string;
  case_id: string;
  evidence_id?: string;
  finding_id?: string;
  event_time: string;
  title: string;
  description?: string;
  event_type: EventType;
  source?: string;
  source_artifact?: string;
  importance: EventImportance;
  is_confirmed: boolean;
  tags: string[];
  raw_data: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Risk Assessment Types
// ============================================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskAssessment {
  id: string;
  case_id: string;
  overall_risk_score: number; // 1–25
  likelihood: number; // 1–5
  impact: number; // 1–5
  risk_level: RiskLevel;
  threat_actors: string[];
  affected_assets: string[];
  vulnerabilities: string[];
  mitigation_measures: string[];
  residual_risk?: string;
  analyst_notes?: string;
  assessed_by?: string;
  assessed_at?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Report Types
// ============================================================

export type ReportStatus = 'draft' | 'generating' | 'ready' | 'failed';
export type ReportType = 'investigation' | 'executive_summary' | 'technical' | 'chain_of_custody' | 'custom';

export interface Report {
  id: string;
  case_id: string;
  title: string;
  report_type: ReportType;
  status: ReportStatus;
  storage_path?: string;
  file_size?: number;
  include_executive_summary: boolean;
  include_timeline: boolean;
  include_findings: boolean;
  include_evidence_list: boolean;
  include_risk_assessment: boolean;
  generated_by: string;
  generated_at?: string;
  error_message?: string;
  version: number;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Dashboard Types
// ============================================================

export interface Hotspot {
  id: number;
  label: string;
  left: number;
  top: number;
  severe: boolean;
  city: string;
  case_count?: number;
}

export interface DashboardStats {
  total_cases: number;
  open_cases: number;
  active_cases: number;
  closed_cases: number;
  total_evidence: number;
  total_findings: number;
  critical_findings: number;
  reports_generated: number;
  total_correlations: number;
  critical_correlations: number;
  funds_frozen: number;
  suspects_tracked: number;
  gangs_identified: number;
  arrests_made: number;
  recent_activity: ActivityItem[];
  priority_distribution: { name: string; value: number }[];
  trend_data: Array<{
    month: string;
    year: number;
    monthIndex: number;
    cases: number;
    closed: number;
  }>;
  broadcast_alert?: string;
}

export interface ActivityItem {
  id: string;
  type: 'case' | 'evidence' | 'finding' | 'report';
  action: string;
  description: string;
  user_id: string;
  user_name?: string;
  timestamp: string;
  case_id?: string;
  case_number?: string;
}

// ============================================================
// Network Analysis Types
// ============================================================

export interface IPConversation {
  ip_a: string;
  ip_b: string;
  packets: number;
  bytes: number;
}

export interface DNSQuery {
  query_name: string;
  query_type: string;
  query?: string;
  type?: string;
  response_code?: string;
  answers?: string[];
}

export interface SuspiciousIndicator {
  type: string;
  value: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  reason?: string;
}

// ============================================================
// Memory Analysis Types
// ============================================================

export interface ProcessItem {
  PID: number;
  PPID: number;
  ImageFileName: string;
  Offset: number;
  Threads: number;
  Handles: number;
  SessionId: number;
  Wow64: boolean;
  CreateTime: string;
  ExitTime: string;
}

export interface MalfindHit {
  PID: number;
  Process: string;
  Start: number;
  End: number;
  Protection: string;
  CommitCharge: number;
  PrivateMemory: number;
  FileOutput: string;
  Hexdump: string;
  Disassembly: string;
}

export interface MemoryAnalysisSummary {
  total_processes: number;
  suspicious_processes_count: number;
  malfind_hits: number;
}

export interface MemoryAnalysisResult {
  id: string;
  evidence_id: string;
  analysis_status: 'pending' | 'processing' | 'completed' | 'failed';
  memory_profile?: string;
  process_list: ProcessItem[];
  process_tree: any[]; // Depends on Volatility pstree format, often similar to pslist with depth
  suspicious_processes: MalfindHit[];
  analysis_summary: MemoryAnalysisSummary;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface NetworkAnalysisResult {
  id: string;
  evidence_id: string;
  analysis_status: 'pending' | 'analyzing' | 'completed' | 'failed';
  protocol_stats: Record<string, number>;
  conversations: IPConversation[];
  dns_queries: DNSQuery[];
  suspicious_indicators: SuspiciousIndicator[];
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface BrowserAnalysisResult {
  id: string;
  evidence_id: string;
  analysis_status: 'pending' | 'analyzing' | 'completed' | 'failed';
  browser_type?: string;
  history_entries: any[];
  downloads: any[];
  cookies: any[];
  bookmarks: any[];
  suspicious_urls: any[];
  search_terms: any[];
  analysis_summary: Record<string, any>;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface UsbAnalysisResult {
  id: string;
  evidence_id: string;
  analysis_status: 'pending' | 'analyzing' | 'completed' | 'failed';
  connected_devices: any[];
  suspicious_devices: any[];
  analysis_summary: Record<string, any>;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// API Response Types
// ============================================================

export interface ApiError {
  error: string;
  detail?: unknown;
}

export interface MessageResponse {
  message: string;
  detail?: unknown;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// ============================================================
// UI Helper Types
// ============================================================

export interface SelectOption {
  value: string;
  label: string;
}

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

// ============================================================
// Phase 5 Types: Correlations & Attack Chains
// ============================================================

export type CorrelationSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Correlation {
  id: string;
  case_id: string;
  correlation_type: string;
  ioc: string;
  ioc_type: string;
  confidence_score: number;
  correlation_severity: CorrelationSeverity;
  related_sources: string[];
  related_evidence: string[];
  related_findings: string[];
  enrichment_data: Record<string, any>;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface AttackChain {
  id: string;
  case_id: string;
  title: string;
  description?: string;
  severity: CorrelationSeverity;
  nodes: any[];
  edges: any[];
  correlations: string[];
  created_at: string;
  updated_at: string;
}

export interface GraphData {
  nodes: any[];
  edges: any[];
}

// ============================================================
// Suspect Types
// ============================================================

export interface Suspect {
  id: string;
  case_id: string;
  name: string;
  aliases: string[];
  mobile_numbers: string[];
  email_ids: string[];
  ip_addresses: string[];
  criminal_history?: string;
  social_media_accounts: Record<string, any>[];
  notes?: string;
  status?: 'under_investigation' | 'arrested' | 'absconding' | 'discharged';
  funds_linked_inr?: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SuspectCreate {
  case_id: string;
  name: string;
  aliases?: string[];
  mobile_numbers?: string[];
  email_ids?: string[];
  ip_addresses?: string[];
  criminal_history?: string;
  social_media_accounts?: Record<string, any>[];
  notes?: string;
  status?: 'under_investigation' | 'arrested' | 'absconding' | 'discharged';
  funds_linked_inr?: number;
}

export interface SuspectUpdate extends Partial<Omit<SuspectCreate, 'case_id'>> {}
