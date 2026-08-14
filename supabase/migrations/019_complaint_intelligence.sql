-- Migration 019: Complaint intelligence (ML investigation slice)
-- Predicted category, priority explanations, extracted entities, embeddings.
-- Nearest-neighbour in application code for v1 (pgvector later).

CREATE TABLE IF NOT EXISTS public.complaint_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL UNIQUE REFERENCES public.cases(id) ON DELETE CASCADE,
    predicted_category TEXT,
    category_scores JSONB NOT NULL DEFAULT '{}',
    category_confidence NUMERIC,
    priority_score INTEGER,
    priority_label TEXT,
    explanation JSONB NOT NULL DEFAULT '[]',
    features_used JSONB NOT NULL DEFAULT '[]',
    model_versions JSONB NOT NULL DEFAULT '{}',
    is_prototype BOOLEAN NOT NULL DEFAULT true,
    disclaimer TEXT,
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaint_analysis_priority
    ON public.complaint_analysis(priority_label);
CREATE INDEX IF NOT EXISTS idx_complaint_analysis_category
    ON public.complaint_analysis(predicted_category);

CREATE TABLE IF NOT EXISTS public.extracted_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    value_raw TEXT NOT NULL,
    value_masked TEXT,
    normalized TEXT,
    extra JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extracted_entities_case
    ON public.extracted_entities(case_id);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_type
    ON public.extracted_entities(entity_type);

CREATE TABLE IF NOT EXISTS public.case_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL UNIQUE REFERENCES public.cases(id) ON DELETE CASCADE,
    embedding JSONB NOT NULL DEFAULT '[]',
    embedding_version TEXT NOT NULL DEFAULT 'tfidf-cosine-v1',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_embeddings_version
    ON public.case_embeddings(embedding_version);

ALTER TABLE public.complaint_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read complaint analysis" ON public.complaint_analysis;
CREATE POLICY "Authenticated can read complaint analysis"
    ON public.complaint_analysis FOR SELECT
    TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can read extracted entities" ON public.extracted_entities;
CREATE POLICY "Authenticated can read extracted entities"
    ON public.extracted_entities FOR SELECT
    TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can read case embeddings" ON public.case_embeddings;
CREATE POLICY "Authenticated can read case embeddings"
    ON public.case_embeddings FOR SELECT
    TO authenticated USING (true);

COMMENT ON TABLE public.complaint_analysis IS
    'Prototype ML outputs for investigation support. Not legal certainty.';
COMMENT ON TABLE public.extracted_entities IS
    'Regex-extracted identifiers from complaint text. Masked values for lists.';
COMMENT ON TABLE public.case_embeddings IS
    'Stored vectors for Python cosine similarity (pgvector not required in v1).';
