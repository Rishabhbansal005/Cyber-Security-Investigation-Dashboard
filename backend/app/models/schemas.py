from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, UUID4, EmailStr, Field


# ============================================================
# Base
# ============================================================

class TimestampMixin(BaseModel):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ============================================================
# User Schemas
# ============================================================

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: str = "investigator"
    badge_number: Optional[str] = None
    department: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    badge_number: Optional[str] = None
    department: Optional[str] = None
    avatar_url: Optional[str] = None


class UserResponse(UserBase, TimestampMixin):
    id: str
    is_active: bool = True
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================================
# Case Schemas
# ============================================================

class CaseBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    incident_date: Optional[datetime] = None
    status: str = "open"
    priority: str = "medium"
    category: Optional[str] = None
    jurisdiction: Optional[str] = None
    assigned_to: Optional[str] = None
    tags: List[str] = []


class CaseCreate(CaseBase):
    pass


class CaseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    incident_date: Optional[datetime] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    jurisdiction: Optional[str] = None
    assigned_to: Optional[str] = None
    tags: Optional[List[str]] = None


class CaseResponse(CaseBase, TimestampMixin):
    id: str
    case_number: str
    created_by: str
    assignee: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class CaseListResponse(BaseModel):
    items: List[CaseResponse]
    total: int
    page: int
    page_size: int


# ============================================================
# Evidence Schemas
# ============================================================

class ChainOfCustodyEvent(BaseModel):
    action: str  # e.g. "acquired", "transferred", "analyzed"
    user_id: str
    user_name: Optional[str] = None
    timestamp: datetime
    notes: Optional[str] = None
    location: Optional[str] = None


class EvidenceBase(BaseModel):
    file_name: str
    original_file_name: str
    file_type: str
    mime_type: Optional[str] = None
    file_size: int = 0
    evidence_type: str = "digital"
    source_device: Optional[str] = None
    source_location: Optional[str] = None
    acquisition_method: Optional[str] = None
    tags: List[str] = []


class EvidenceCreate(EvidenceBase):
    case_id: str
    storage_path: str
    hash_md5: Optional[str] = None
    hash_sha1: Optional[str] = None
    hash_sha256: Optional[str] = None
    hash_sha512: Optional[str] = None
    suspect_id: Optional[str] = None


class EvidenceUpdate(BaseModel):
    evidence_type: Optional[str] = None
    source_device: Optional[str] = None
    source_location: Optional[str] = None
    acquisition_method: Optional[str] = None
    analysis_notes: Optional[str] = None
    processing_status: Optional[str] = None
    tags: Optional[List[str]] = None
    is_verified: Optional[bool] = None
    suspect_id: Optional[str] = None


class EvidenceResponse(EvidenceBase, TimestampMixin):
    id: str
    case_id: str
    suspect_id: Optional[str] = None
    evidence_number: str
    storage_path: str
    storage_bucket: str
    public_url: Optional[str] = None
    hash_md5: Optional[str] = None
    hash_sha1: Optional[str] = None
    hash_sha256: Optional[str] = None
    hash_sha512: Optional[str] = None
    chain_of_custody: List[ChainOfCustodyEvent] = []
    processing_status: str = "pending"
    forensic_tool: Optional[str] = None
    analysis_notes: Optional[str] = None
    is_verified: bool = False
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    uploaded_by: str
    uploaded_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================
# Finding Schemas
# ============================================================

class IOCIndicator(BaseModel):
    type: str  # ip, domain, hash, email, url, etc.
    value: str
    context: Optional[str] = None
    confidence: int = 50  # 0-100


class FindingBase(BaseModel):
    title: str = Field(..., min_length=3)
    description: str
    severity: str = "medium"
    category: Optional[str] = None
    mitre_tactic: Optional[str] = None
    mitre_technique: Optional[str] = None
    status: str = "open"
    tags: List[str] = []
    ioc_indicators: List[IOCIndicator] = []
    recommendations: Optional[str] = None
    analysis_source: Optional[str] = None


class FindingCreate(FindingBase):
    case_id: str
    evidence_id: Optional[str] = None


class FindingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    category: Optional[str] = None
    mitre_tactic: Optional[str] = None
    mitre_technique: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None
    ioc_indicators: Optional[List[IOCIndicator]] = None
    recommendations: Optional[str] = None


class FindingResponse(FindingBase, TimestampMixin):
    id: str
    case_id: str
    evidence_id: Optional[str] = None
    finding_number: str
    created_by: str
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================
# Timeline Schemas
# ============================================================

class TimelineEventBase(BaseModel):
    event_time: datetime
    title: str = Field(..., min_length=3)
    description: Optional[str] = None
    event_type: str = "other"
    source: Optional[str] = None
    source_artifact: Optional[str] = None
    importance: str = "normal"
    is_confirmed: bool = False
    tags: List[str] = []
    raw_data: Dict[str, Any] = {}


class TimelineEventCreate(TimelineEventBase):
    case_id: str
    evidence_id: Optional[str] = None
    finding_id: Optional[str] = None


class TimelineEventUpdate(BaseModel):
    event_time: Optional[datetime] = None
    title: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[str] = None
    source: Optional[str] = None
    importance: Optional[str] = None
    is_confirmed: Optional[bool] = None
    tags: Optional[List[str]] = None


class TimelineEventResponse(TimelineEventBase, TimestampMixin):
    id: str
    case_id: str
    evidence_id: Optional[str] = None
    finding_id: Optional[str] = None
    created_by: str
    
    case: Optional[Dict[str, Any]] = None
    evidence: Optional[Dict[str, Any]] = None
    finding: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


# ============================================================
# Risk Assessment Schemas
# ============================================================

class ThreatActor(BaseModel):
    name: str
    type: str  # nation-state, criminal, insider, hacktivist
    motivation: Optional[str] = None
    sophistication: Optional[str] = None


class AffectedAsset(BaseModel):
    name: str
    type: str  # server, workstation, database, network, etc.
    criticality: str = "medium"
    description: Optional[str] = None


class RiskAssessmentBase(BaseModel):
    likelihood: int = Field(..., ge=1, le=5)
    impact: int = Field(..., ge=1, le=5)
    threat_actors: List[ThreatActor] = []
    affected_assets: List[AffectedAsset] = []
    vulnerabilities: List[Dict[str, Any]] = []
    mitigation_measures: List[Dict[str, Any]] = []
    residual_risk: Optional[str] = None
    analyst_notes: Optional[str] = None


class RiskAssessmentCreate(RiskAssessmentBase):
    case_id: str


class RiskAssessmentUpdate(BaseModel):
    likelihood: Optional[int] = Field(None, ge=1, le=5)
    impact: Optional[int] = Field(None, ge=1, le=5)
    threat_actors: Optional[List[ThreatActor]] = None
    affected_assets: Optional[List[AffectedAsset]] = None
    vulnerabilities: Optional[List[Dict[str, Any]]] = None
    mitigation_measures: Optional[List[Dict[str, Any]]] = None
    residual_risk: Optional[str] = None
    analyst_notes: Optional[str] = None


class RiskAssessmentResponse(RiskAssessmentBase, TimestampMixin):
    id: str
    case_id: str
    overall_risk_score: int
    risk_level: str
    assessed_by: Optional[str] = None
    assessed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================
# Report Schemas
# ============================================================

class ReportBase(BaseModel):
    title: str = Field(..., min_length=3)
    report_type: str = "investigation"
    report_format: str = "pdf"
    include_executive_summary: bool = True
    include_timeline: bool = True
    include_findings: bool = True
    include_evidence_list: bool = True
    include_risk_assessment: bool = True


class ReportCreate(ReportBase):
    case_id: str


class ReportResponse(ReportBase, TimestampMixin):
    id: str
    case_id: str
    status: str
    storage_path: Optional[str] = None
    file_size: Optional[int] = None
    generated_by: str
    generated_at: Optional[datetime] = None
    error_message: Optional[str] = None
    version: int = 1

    class Config:
        from_attributes = True

class MemoryAnalysisResult(BaseModel):
    id: UUID4
    evidence_id: UUID4
    analysis_status: str
    memory_profile: Optional[str] = None
    process_list: List[Dict[str, Any]] = []
    process_tree: List[Dict[str, Any]] = []
    suspicious_processes: List[Dict[str, Any]] = []
    analysis_summary: Dict[str, Any] = {}
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

# ============================================================
# Phase 4: Browser Analysis Types
# ============================================================

class BrowserAnalysisResult(BaseModel):
    id: UUID4
    evidence_id: UUID4
    analysis_status: str
    browser_type: Optional[str] = None
    history_entries: List[Dict[str, Any]] = []
    downloads: List[Dict[str, Any]] = []
    cookies: List[Dict[str, Any]] = []
    bookmarks: List[Dict[str, Any]] = []
    suspicious_urls: List[Dict[str, Any]] = []
    search_terms: List[Dict[str, Any]] = []
    analysis_summary: Dict[str, Any] = {}
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

# ============================================================
# Phase 4: USB Analysis Types
# ============================================================

class UsbAnalysisResult(BaseModel):
    id: UUID4
    evidence_id: UUID4
    analysis_status: str
    connected_devices: List[Dict[str, Any]] = []
    suspicious_devices: List[Dict[str, Any]] = []
    analysis_summary: Dict[str, Any] = {}
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

# ============================================================
# Suspect Schemas
# ============================================================

class SuspectBase(BaseModel):
    name: str = Field(..., min_length=2)
    aliases: List[str] = []
    mobile_numbers: List[str] = []
    email_ids: List[str] = []
    ip_addresses: List[str] = []
    criminal_history: Optional[str] = None
    social_media_accounts: List[Dict[str, Any]] = []
    notes: Optional[str] = None

class SuspectCreate(SuspectBase):
    case_id: str

class SuspectUpdate(BaseModel):
    name: Optional[str] = None
    aliases: Optional[List[str]] = None
    mobile_numbers: Optional[List[str]] = None
    email_ids: Optional[List[str]] = None
    ip_addresses: Optional[List[str]] = None
    criminal_history: Optional[str] = None
    social_media_accounts: Optional[List[Dict[str, Any]]] = None
    notes: Optional[str] = None

class SuspectResponse(SuspectBase, TimestampMixin):
    id: str
    case_id: str
    created_by: Optional[str] = None
    
    class Config:
        from_attributes = True

# ============================================================
# Dashboard Stats
# ============================================================

class DashboardStats(BaseModel):
    total_cases: int
    open_cases: int
    active_cases: int
    closed_cases: int
    total_evidence: int
    total_findings: int
    critical_findings: int
    reports_generated: int
    total_correlations: int = 0
    critical_correlations: int = 0
    funds_frozen: float = 0.0
    suspects_tracked: int = 0
    gangs_identified: int = 0
    recent_activity: List[Dict[str, Any]] = []
    priority_distribution: List[Dict[str, Any]] = []
    trend_data: List[Dict[str, Any]] = []

class Hotspot(BaseModel):
    id: int
    label: str
    left: float
    top: float
    severe: bool
    city: str


# ============================================================
# Generic Responses
# ============================================================

# ============================================================
# Phase 5 Schemas: Correlations & Attack Chains
# ============================================================

class CorrelationBase(BaseModel):
    correlation_type: str
    ioc: str
    ioc_type: str
    confidence_score: int = 50
    correlation_severity: str = "medium"
    related_sources: List[str] = []
    related_evidence: List[str] = []
    related_findings: List[str] = []
    enrichment_data: Dict[str, Any] = {}
    description: Optional[str] = None


class CorrelationCreate(CorrelationBase):
    case_id: str


class CorrelationResponse(CorrelationBase, TimestampMixin):
    id: str
    case_id: str

    class Config:
        from_attributes = True


class AttackChainBase(BaseModel):
    title: str
    description: Optional[str] = None
    severity: str = "high"
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    correlations: List[str] = []


class AttackChainCreate(AttackChainBase):
    case_id: str


class AttackChainResponse(AttackChainBase, TimestampMixin):
    id: str
    case_id: str

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    message: str
    detail: Optional[Any] = None


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[Any] = None
