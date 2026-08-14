-- Migration 018: Operational fields for a cyber crime cell
-- FIR identifiers, suspect arrest status, freeze amounts, officer audit log.

ALTER TABLE public.cases
    ADD COLUMN IF NOT EXISTS fir_number TEXT,
    ADD COLUMN IF NOT EXISTS police_station TEXT,
    ADD COLUMN IF NOT EXISTS ncrp_complaint_id TEXT,
    ADD COLUMN IF NOT EXISTS complainant_name TEXT,
    ADD COLUMN IF NOT EXISTS sections_of_law TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS funds_frozen_inr NUMERIC NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_cases_fir_number ON public.cases(fir_number);
CREATE INDEX IF NOT EXISTS idx_cases_ncrp ON public.cases(ncrp_complaint_id);

ALTER TABLE public.suspects
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'under_investigation',
    ADD COLUMN IF NOT EXISTS funds_linked_inr NUMERIC NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'suspects_status_check'
    ) THEN
        ALTER TABLE public.suspects
            ADD CONSTRAINT suspects_status_check
            CHECK (status IN ('under_investigation', 'arrested', 'absconding', 'discharged'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.officer_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    target TEXT,
    officer_id UUID,
    officer_email TEXT,
    status TEXT NOT NULL DEFAULT 'logged',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_officer_audit_created_at
    ON public.officer_audit_log(created_at DESC);

ALTER TABLE public.officer_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read officer audit" ON public.officer_audit_log;
CREATE POLICY "Authenticated can read officer audit"
    ON public.officer_audit_log FOR SELECT
    TO authenticated USING (true);

COMMENT ON TABLE public.officer_audit_log IS 'Officer actions recorded from CCID (uploads, FIR create, arrest status, reports).';
