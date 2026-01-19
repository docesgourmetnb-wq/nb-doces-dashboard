-- Fix: Restrict storage SELECT policy to owner-only access
-- Drop the overly permissive policy that allows any authenticated user to view all photos
DROP POLICY IF EXISTS "Users can view massas-fotos" ON storage.objects;

-- Create restricted policy that only allows users to view photos in their own user_id folder
CREATE POLICY "Users can view own massas-fotos"
ON storage.objects FOR SELECT
USING (bucket_id = 'massas-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);