-- Add INSERT policies for user registration
-- This allows newly authenticated users to create their profile and agent records

-- Allow users to insert their own profile during registration
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow users to insert their own agent record during registration
CREATE POLICY "Users can insert their own agent record" ON public.agents
  FOR INSERT WITH CHECK (user_id = auth.uid());
