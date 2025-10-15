-- Add reacted column to messages table
ALTER TABLE public.messages
ADD COLUMN reacted boolean DEFAULT false;

-- Add delivered_at and seen_at columns to messages table
ALTER TABLE public.messages
ADD COLUMN delivered_at timestamp with time zone,
ADD COLUMN seen_at timestamp with time zone;

-- Add last_seen column to conversations table
ALTER TABLE public.conversations
ADD COLUMN last_seen_1 timestamp with time zone,
ADD COLUMN last_seen_2 timestamp with time zone;

-- Add active_status table
CREATE TABLE public.user_status (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    is_active boolean DEFAULT false,
    last_active timestamp with time zone DEFAULT now()
);

-- Enable RLS for user_status
ALTER TABLE public.user_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_status
CREATE POLICY "Users can view any user's status"
ON public.user_status
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update their own status"
ON public.user_status
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own status"
ON public.user_status
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Function to update user status
CREATE OR REPLACE FUNCTION update_user_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_status (user_id, is_active, last_active)
  VALUES (NEW.id, true, now())
  ON CONFLICT (user_id)
  DO UPDATE SET is_active = true, last_active = now();
  RETURN NEW;
END;
$$;

-- Trigger for updating user status on login
CREATE TRIGGER on_auth_user_login
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION update_user_status();

-- Enable realtime for user_status
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_status;