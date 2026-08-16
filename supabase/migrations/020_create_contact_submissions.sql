-- Contact / support form submissions
CREATE TABLE IF NOT EXISTS public.contact_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_submissions_created_at_idx
    ON public.contact_submissions (created_at DESC);

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Public form uses the service role on the API. Officers can read their own queue.
DROP POLICY IF EXISTS "contact_submissions_select_authenticated" ON public.contact_submissions;
CREATE POLICY "contact_submissions_select_authenticated"
    ON public.contact_submissions FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "contact_submissions_insert_service" ON public.contact_submissions;
CREATE POLICY "contact_submissions_insert_service"
    ON public.contact_submissions FOR INSERT
    TO authenticated
    WITH CHECK (true);
