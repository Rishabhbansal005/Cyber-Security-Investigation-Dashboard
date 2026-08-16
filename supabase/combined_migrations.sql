-- Migration 001: Create users profile table
-- This extends Supabase Auth users with additional profile fields

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'investigator' CHECK (role IN ('admin', 'investigator', 'viewer')),
    badge_number TEXT,
    department TEXT,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create user profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'investigator')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON TABLE public.users IS 'Extended user profiles linked to Supabase Auth';
-- Migration 002: Create cases table

CREATE TABLE IF NOT EXISTS public.cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    incident_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'active', 'pending_review', 'closed', 'archived')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    category TEXT CHECK (category IN (
        'cybercrime', 'data_breach', 'malware', 'ransomware', 'phishing',
        'insider_threat', 'fraud', 'ddos', 'espionage', 'other'
    )),
    jurisdiction TEXT,
    assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_priority ON public.cases(priority);
CREATE INDEX IF NOT EXISTS idx_cases_assigned_to ON public.cases(assigned_to);
CREATE INDEX IF NOT EXISTS idx_cases_created_by ON public.cases(created_by);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON public.cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_case_number ON public.cases(case_number);

-- Auto-generate case number (e.g. CCID-2024-000001)
CREATE OR REPLACE FUNCTION public.generate_case_number()
RETURNS TRIGGER AS $$
DECLARE
    year_part TEXT;
    seq_num INT;
BEGIN
    year_part := TO_CHAR(NOW(), 'YYYY');
    SELECT COUNT(*) + 1 INTO seq_num
    FROM public.cases
    WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    
    NEW.case_number := 'CCID-' || year_part || '-' || LPAD(seq_num::TEXT, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cases_generate_number
    BEFORE INSERT ON public.cases
    FOR EACH ROW
    WHEN (NEW.case_number IS NULL OR NEW.case_number = '')
    EXECUTE FUNCTION public.generate_case_number();

CREATE TRIGGER cases_updated_at
    BEFORE UPDATE ON public.cases
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.cases IS 'Investigation cases managed by the platform';
COMMENT ON COLUMN public.cases.case_number IS 'Auto-generated unique case identifier (CCID-YYYY-NNNNNN)';
-- Migration 003: Create evidence table

CREATE TABLE IF NOT EXISTS public.evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    evidence_number TEXT NOT NULL,
    file_name TEXT NOT NULL,
    original_file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    mime_type TEXT,
    file_size BIGINT NOT NULL DEFAULT 0,
    storage_path TEXT NOT NULL,
    storage_bucket TEXT NOT NULL DEFAULT 'forensic_uploads',
    public_url TEXT,
    -- Hash verification
    hash_md5 TEXT,
    hash_sha256 TEXT,
    hash_sha512 TEXT,
    -- Evidence metadata
    evidence_type TEXT DEFAULT 'digital' CHECK (evidence_type IN (
        'digital', 'network_capture', 'memory_dump', 'disk_image',
        'log_file', 'document', 'screenshot', 'email', 'other'
    )),
    source_device TEXT,
    source_location TEXT,
    acquisition_method TEXT,
    -- Chain of custody (JSONB array of custody events)
    chain_of_custody JSONB NOT NULL DEFAULT '[]',
    -- Processing status for forensic tool integration
    processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN (
        'pending', 'processing', 'analyzed', 'error', 'skipped'
    )),
    forensic_tool TEXT, -- Which tool processed this (volatility, wireshark, etc.)
    analysis_notes TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    uploaded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_evidence_case_id ON public.evidence(case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_uploaded_by ON public.evidence(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_evidence_type ON public.evidence(evidence_type);
CREATE INDEX IF NOT EXISTS idx_evidence_processing_status ON public.evidence(processing_status);
CREATE INDEX IF NOT EXISTS idx_evidence_created_at ON public.evidence(created_at DESC);

-- Auto-generate evidence number
CREATE OR REPLACE FUNCTION public.generate_evidence_number()
RETURNS TRIGGER AS $$
DECLARE
    ev_count INT;
BEGIN
    SELECT COUNT(*) + 1 INTO ev_count
    FROM public.evidence
    WHERE case_id = NEW.case_id;
    
    NEW.evidence_number := 'EV-' || LPAD(ev_count::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evidence_generate_number
    BEFORE INSERT ON public.evidence
    FOR EACH ROW EXECUTE FUNCTION public.generate_evidence_number();

CREATE TRIGGER evidence_updated_at
    BEFORE UPDATE ON public.evidence
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.evidence IS 'Digital evidence files uploaded to Supabase Storage';
COMMENT ON COLUMN public.evidence.chain_of_custody IS 'JSON array of {action, user_id, timestamp, notes} objects';
-- Migration 004: Create findings table

CREATE TABLE IF NOT EXISTS public.findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    evidence_id UUID REFERENCES public.evidence(id) ON DELETE SET NULL,
    finding_number TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN (
        'informational', 'low', 'medium', 'high', 'critical'
    )),
    category TEXT CHECK (category IN (
        'malware', 'intrusion', 'data_exfiltration', 'privilege_escalation',
        'lateral_movement', 'persistence', 'defense_evasion', 'credential_access',
        'discovery', 'collection', 'command_control', 'exfiltration', 'impact',
        'fraud', 'policy_violation', 'other'
    )),
    -- MITRE ATT&CK mapping
    mitre_tactic TEXT,
    mitre_technique TEXT,
    -- Status
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
        'open', 'investigating', 'confirmed', 'false_positive', 'resolved'
    )),
    tags TEXT[] DEFAULT '{}',
    ioc_indicators JSONB DEFAULT '[]', -- Indicators of Compromise
    recommendations TEXT,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_findings_case_id ON public.findings(case_id);
CREATE INDEX IF NOT EXISTS idx_findings_evidence_id ON public.findings(evidence_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON public.findings(severity);
CREATE INDEX IF NOT EXISTS idx_findings_status ON public.findings(status);

-- Auto-generate finding number per case
CREATE OR REPLACE FUNCTION public.generate_finding_number()
RETURNS TRIGGER AS $$
DECLARE
    fn_count INT;
BEGIN
    SELECT COUNT(*) + 1 INTO fn_count
    FROM public.findings
    WHERE case_id = NEW.case_id;
    
    NEW.finding_number := 'FN-' || LPAD(fn_count::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER findings_generate_number
    BEFORE INSERT ON public.findings
    FOR EACH ROW EXECUTE FUNCTION public.generate_finding_number();

CREATE TRIGGER findings_updated_at
    BEFORE UPDATE ON public.findings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.findings IS 'Investigation findings with MITRE ATT&CK mapping and IOC tracking';
-- Migration 005: Create timeline_events table

CREATE TABLE IF NOT EXISTS public.timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    evidence_id UUID REFERENCES public.evidence(id) ON DELETE SET NULL,
    finding_id UUID REFERENCES public.findings(id) ON DELETE SET NULL,
    event_time TIMESTAMPTZ NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL DEFAULT 'other' CHECK (event_type IN (
        'system', 'network', 'user_action', 'file', 'registry',
        'process', 'authentication', 'email', 'web', 'other'
    )),
    source TEXT, -- e.g. 'Wireshark', 'Volatility', 'Manual', 'Syslog'
    source_artifact TEXT, -- Reference to specific artifact/log
    importance TEXT DEFAULT 'normal' CHECK (importance IN ('low', 'normal', 'high', 'critical')),
    is_confirmed BOOLEAN DEFAULT FALSE,
    tags TEXT[] DEFAULT '{}',
    raw_data JSONB DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_case_id ON public.timeline_events(case_id);
CREATE INDEX IF NOT EXISTS idx_timeline_event_time ON public.timeline_events(event_time);
CREATE INDEX IF NOT EXISTS idx_timeline_event_type ON public.timeline_events(event_type);
CREATE INDEX IF NOT EXISTS idx_timeline_importance ON public.timeline_events(importance);

CREATE TRIGGER timeline_events_updated_at
    BEFORE UPDATE ON public.timeline_events
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Migration 006: Create reports table

CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    report_type TEXT NOT NULL DEFAULT 'investigation' CHECK (report_type IN (
        'investigation', 'executive_summary', 'technical', 'chain_of_custody', 'custom'
    )),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'generating', 'ready', 'failed'
    )),
    storage_path TEXT,
    storage_bucket TEXT DEFAULT 'forensic_uploads',
    file_size BIGINT,
    -- Report configuration
    include_executive_summary BOOLEAN DEFAULT TRUE,
    include_timeline BOOLEAN DEFAULT TRUE,
    include_findings BOOLEAN DEFAULT TRUE,
    include_evidence_list BOOLEAN DEFAULT TRUE,
    include_risk_assessment BOOLEAN DEFAULT TRUE,
    custom_sections JSONB DEFAULT '[]',
    -- Audit
    generated_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    generated_at TIMESTAMPTZ,
    error_message TEXT,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_case_id ON public.reports(case_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_generated_by ON public.reports(generated_by);

CREATE TRIGGER reports_updated_at
    BEFORE UPDATE ON public.reports
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Risk Assessment table (one per case)
CREATE TABLE IF NOT EXISTS public.risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID UNIQUE NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    overall_risk_score INT CHECK (overall_risk_score BETWEEN 1 AND 25),
    likelihood INT CHECK (likelihood BETWEEN 1 AND 5),
    impact INT CHECK (impact BETWEEN 1 AND 5),
    risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    threat_actors JSONB DEFAULT '[]',
    affected_assets JSONB DEFAULT '[]',
    vulnerabilities JSONB DEFAULT '[]',
    mitigation_measures JSONB DEFAULT '[]',
    residual_risk TEXT,
    analyst_notes TEXT,
    assessed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    assessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_case_id ON public.risk_assessments(case_id);

CREATE TRIGGER risk_assessments_updated_at
    BEFORE UPDATE ON public.risk_assessments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.timeline_events IS 'Chronological events for case timeline visualization';
COMMENT ON TABLE public.reports IS 'Generated PDF investigation reports';
COMMENT ON TABLE public.risk_assessments IS 'Per-case risk assessment with 5x5 matrix scoring';
-- Add missing hash_sha1 column to evidence table for full integrity verification

ALTER TABLE public.evidence 
ADD COLUMN IF NOT EXISTS hash_sha1 TEXT;

-- Ensure service_role has necessary permissions to update evidence rows
GRANT UPDATE ON public.evidence TO service_role;
-- Create network_analysis_results table

CREATE TABLE IF NOT EXISTS public.network_analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evidence_id UUID NOT NULL REFERENCES public.evidence(id) ON DELETE CASCADE,
    analysis_status TEXT NOT NULL DEFAULT 'pending', -- pending, analyzing, completed, failed
    protocol_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
    conversations JSONB NOT NULL DEFAULT '[]'::jsonb,
    dns_queries JSONB NOT NULL DEFAULT '[]'::jsonb,
    suspicious_indicators JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.network_analysis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access to network_analysis_results"
    ON public.network_analysis_results
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.network_analysis_results
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
-- Create memory_analysis_results table
CREATE TABLE IF NOT EXISTS public.memory_analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evidence_id UUID NOT NULL REFERENCES public.evidence(id) ON DELETE CASCADE,
    analysis_status TEXT NOT NULL DEFAULT 'pending', 
    memory_profile TEXT,
    process_list JSONB NOT NULL DEFAULT '[]'::jsonb,
    process_tree JSONB NOT NULL DEFAULT '[]'::jsonb,
    suspicious_processes JSONB NOT NULL DEFAULT '[]'::jsonb,
    analysis_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.memory_analysis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access to memory_analysis_results"
    ON public.memory_analysis_results
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.memory_analysis_results
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
-- Migration 006: Add error_message to memory_analysis_results

ALTER TABLE public.memory_analysis_results ADD COLUMN IF NOT EXISTS error_message TEXT;
-- Migration 010: Extend Timeline and Findings schemas non-destructively

-- 1. Extend timeline_events.event_type constraint
ALTER TABLE public.timeline_events DROP CONSTRAINT IF EXISTS timeline_events_event_type_check;
ALTER TABLE public.timeline_events ADD CONSTRAINT timeline_events_event_type_check 
    CHECK (event_type IN (
        -- Old values
        'system', 'network', 'user_action', 'file', 'registry',
        'process', 'authentication', 'email', 'web', 'other',
        -- New values
        'evidence', 'integrity', 'memory_analysis', 'network_analysis', 
        'finding', 'risk_assessment'
    ));

-- 2. Extend timeline_events.importance constraint
ALTER TABLE public.timeline_events DROP CONSTRAINT IF EXISTS timeline_events_importance_check;
ALTER TABLE public.timeline_events ADD CONSTRAINT timeline_events_importance_check 
    CHECK (importance IN (
        -- Old values
        'low', 'normal', 'high', 'critical',
        -- New values
        'informational', 'medium'
    ));

-- 3. Extend findings.category constraint
ALTER TABLE public.findings DROP CONSTRAINT IF EXISTS findings_category_check;
ALTER TABLE public.findings ADD CONSTRAINT findings_category_check 
    CHECK (category IN (
        -- Old values
        'malware', 'intrusion', 'data_exfiltration', 'privilege_escalation',
        'lateral_movement', 'persistence', 'defense_evasion', 'credential_access',
        'discovery', 'collection', 'command_control', 'exfiltration', 'impact',
        'fraud', 'policy_violation', 'other',
        -- New values
        'network', 'memory', 'browser', 'usb', 'suspicious_activity'
    ));

-- Note: findings.severity already perfectly encompasses ('informational', 'low', 'medium', 'high', 'critical').
-- No need to alter it to preserve existing data securely.

-- 4. Add analysis_source to findings table
ALTER TABLE public.findings ADD COLUMN IF NOT EXISTS analysis_source TEXT;
-- Create browser_analysis_results table

CREATE TABLE IF NOT EXISTS public.browser_analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evidence_id UUID NOT NULL REFERENCES public.evidence(id) ON DELETE CASCADE,
    analysis_status TEXT NOT NULL DEFAULT 'pending', -- pending, analyzing, completed, failed
    browser_type TEXT,
    history_entries JSONB NOT NULL DEFAULT '[]'::jsonb,
    downloads JSONB NOT NULL DEFAULT '[]'::jsonb,
    cookies JSONB NOT NULL DEFAULT '[]'::jsonb,
    bookmarks JSONB NOT NULL DEFAULT '[]'::jsonb,
    suspicious_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    search_terms JSONB NOT NULL DEFAULT '[]'::jsonb,
    analysis_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.browser_analysis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access to browser_analysis_results"
    ON public.browser_analysis_results
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.browser_analysis_results
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
-- Create usb_analysis_results table

CREATE TABLE IF NOT EXISTS public.usb_analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evidence_id UUID NOT NULL REFERENCES public.evidence(id) ON DELETE CASCADE,
    analysis_status TEXT NOT NULL DEFAULT 'pending', -- pending, analyzing, completed, failed
    connected_devices JSONB NOT NULL DEFAULT '[]'::jsonb,
    suspicious_devices JSONB NOT NULL DEFAULT '[]'::jsonb,
    analysis_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.usb_analysis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access to usb_analysis_results"
    ON public.usb_analysis_results
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.usb_analysis_results
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
-- 013_create_correlations_and_attack_chains.sql
-- Safe version: uses IF NOT EXISTS and ALTER TABLE to patch missing columns

-- Function (safe to re-run)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create correlations table if it doesn't exist
CREATE TABLE IF NOT EXISTS correlations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    correlation_type VARCHAR NOT NULL,
    ioc VARCHAR NOT NULL,
    ioc_type VARCHAR NOT NULL,
    confidence_score INTEGER DEFAULT 50,
    correlation_severity VARCHAR DEFAULT 'medium',
    related_sources JSONB DEFAULT '[]',
    related_evidence JSONB DEFAULT '[]',
    related_findings JSONB DEFAULT '[]',
    enrichment_data JSONB DEFAULT '{}',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patch: add missing columns if they don't exist
ALTER TABLE correlations ADD COLUMN IF NOT EXISTS correlation_severity VARCHAR DEFAULT 'medium';
ALTER TABLE correlations ADD COLUMN IF NOT EXISTS enrichment_data JSONB DEFAULT '{}';
ALTER TABLE correlations ADD COLUMN IF NOT EXISTS related_sources JSONB DEFAULT '[]';
ALTER TABLE correlations ADD COLUMN IF NOT EXISTS related_evidence JSONB DEFAULT '[]';
ALTER TABLE correlations ADD COLUMN IF NOT EXISTS related_findings JSONB DEFAULT '[]';
ALTER TABLE correlations ADD COLUMN IF NOT EXISTS description TEXT;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_correlations_case_id ON correlations(case_id);
CREATE INDEX IF NOT EXISTS idx_correlations_ioc ON correlations(ioc);

-- Create attack_chains table if it doesn't exist
CREATE TABLE IF NOT EXISTS attack_chains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    description TEXT,
    severity VARCHAR DEFAULT 'high',
    nodes JSONB DEFAULT '[]',
    edges JSONB DEFAULT '[]',
    correlations JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_attack_chains_case_id ON attack_chains(case_id);

-- Add triggers (drop first to avoid duplicate trigger errors)
DROP TRIGGER IF EXISTS set_updated_at_correlations ON correlations;
CREATE TRIGGER set_updated_at_correlations
    BEFORE UPDATE ON correlations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_attack_chains ON attack_chains;
CREATE TRIGGER set_updated_at_attack_chains
    BEFORE UPDATE ON attack_chains
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
-- Create event_log_analysis_results table
CREATE TABLE IF NOT EXISTS public.event_log_analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    evidence_id UUID NOT NULL REFERENCES public.evidence(id) ON DELETE CASCADE,
    analysis_status TEXT NOT NULL DEFAULT 'pending',
    suspicious_events JSONB NOT NULL DEFAULT '[]'::jsonb,
    timeline_events JSONB NOT NULL DEFAULT '[]'::jsonb,
    analysis_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.event_log_analysis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access to event_log_analysis_results"
    ON public.event_log_analysis_results
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.event_log_analysis_results
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_log_analysis_case_id ON public.event_log_analysis_results(case_id);
CREATE INDEX IF NOT EXISTS idx_event_log_analysis_evidence_id ON public.event_log_analysis_results(evidence_id);
-- Migration 015: Create suspects table and link to evidence

CREATE TABLE IF NOT EXISTS public.suspects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    aliases TEXT[] DEFAULT '{}',
    mobile_numbers TEXT[] DEFAULT '{}',
    email_ids TEXT[] DEFAULT '{}',
    ip_addresses TEXT[] DEFAULT '{}',
    criminal_history TEXT,
    social_media_accounts JSONB DEFAULT '[]',
    notes TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_suspects_case_id ON public.suspects(case_id);
CREATE INDEX IF NOT EXISTS idx_suspects_created_at ON public.suspects(created_at DESC);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS suspects_updated_at ON public.suspects;
CREATE TRIGGER suspects_updated_at
    BEFORE UPDATE ON public.suspects
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add suspect_id to evidence
ALTER TABLE public.evidence 
ADD COLUMN IF NOT EXISTS suspect_id UUID REFERENCES public.suspects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_suspect_id ON public.evidence(suspect_id);

-- RLS Policies
ALTER TABLE public.suspects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.suspects;
CREATE POLICY "Enable read access for all authenticated users" 
ON public.suspects FOR SELECT 
TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.suspects;
CREATE POLICY "Enable insert for authenticated users" 
ON public.suspects FOR INSERT 
TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.suspects;
CREATE POLICY "Enable update for authenticated users" 
ON public.suspects FOR UPDATE
TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.suspects;
CREATE POLICY "Enable delete for authenticated users" 
ON public.suspects FOR DELETE
TO authenticated USING (true);
-- Add error_message column to network_analysis_results if not exists
ALTER TABLE public.network_analysis_results 
ADD COLUMN IF NOT EXISTS error_message TEXT;
-- Migration: Create ai_audit_log table for append-only compliance tracking
CREATE TABLE IF NOT EXISTS public.ai_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
    user_id UUID,
    timestamp TIMESTAMPTZ DEFAULT now() NOT NULL,
    provider_used TEXT NOT NULL,
    data_classification TEXT NOT NULL CHECK (data_classification IN ('synthetic', 'real_case_data')),
    prompt_summary TEXT NOT NULL,
    response_status TEXT NOT NULL CHECK (response_status IN ('success', 'blocked', 'failed', 'rate_limited')),
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.ai_audit_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read audit logs
CREATE POLICY "Allow authenticated read ai_audit_log" 
ON public.ai_audit_log FOR SELECT 
TO authenticated 
USING (true);

-- Allow service role / authenticated users to INSERT into ai_audit_log
CREATE POLICY "Allow authenticated insert ai_audit_log" 
ON public.ai_audit_log FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Notice: NO UPDATE or DELETE policies are created to enforce append-only immutability.
