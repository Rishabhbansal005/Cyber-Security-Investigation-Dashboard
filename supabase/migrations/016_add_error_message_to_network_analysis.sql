-- Add error_message column to network_analysis_results if not exists
ALTER TABLE public.network_analysis_results 
ADD COLUMN IF NOT EXISTS error_message TEXT;
