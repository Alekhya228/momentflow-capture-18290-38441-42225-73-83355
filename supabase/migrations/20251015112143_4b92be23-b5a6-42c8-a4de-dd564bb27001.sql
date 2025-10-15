-- Fix storage policies for stories
-- Allow users to upload their own stories to the posts bucket
CREATE POLICY "Users can upload their own stories"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'posts' 
  AND (storage.foldername(name))[1] = 'stories'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Allow users to view all stories (they're public)
CREATE POLICY "Anyone can view stories"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'posts' 
  AND (storage.foldername(name))[1] = 'stories'
);

-- Allow users to delete their own stories
CREATE POLICY "Users can delete their own stories"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'posts' 
  AND (storage.foldername(name))[1] = 'stories'
  AND auth.uid()::text = (storage.foldername(name))[2]
);