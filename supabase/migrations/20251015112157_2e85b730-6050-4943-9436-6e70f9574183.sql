-- Create a helper function to check if two users are mutual followers
CREATE OR REPLACE FUNCTION public.are_mutual_followers(user1_id uuid, user2_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.follows 
    WHERE follower_id = user1_id AND following_id = user2_id
  ) AND EXISTS (
    SELECT 1 FROM public.follows 
    WHERE follower_id = user2_id AND following_id = user1_id
  );
$$;

-- Update conversations policy to only allow mutual followers to create conversations
DROP POLICY IF EXISTS "Users can create conversations where they are a participant" ON public.conversations;

CREATE POLICY "Mutual followers can create conversations"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = participant_1_id
  AND public.are_mutual_followers(participant_1_id, participant_2_id)
);