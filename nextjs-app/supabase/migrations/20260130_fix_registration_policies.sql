-- SQL Script to Fix Registration and Login Issues in Supabase
-- Run this script in your Supabase SQL editor to enable user registration

-- Add INSERT policies for user registration
-- This allows newly authenticated users to create their profile and agent records

-- Drop existing policies if they exist (to avoid errors if running multiple times)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own agent record" ON public.agents;

-- Allow users to insert their own profile during registration
-- This is required when a new user signs up via auth.signUp()
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Allow users to insert their own agent record during registration
-- This is required to complete the registration flow
CREATE POLICY "Users can insert their own agent record" ON public.agents
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());
