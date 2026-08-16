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
