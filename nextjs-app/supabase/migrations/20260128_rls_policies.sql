-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_phone_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Agents policies
CREATE POLICY "Agents can view their own agent record" ON public.agents
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Agents can update their own agent record" ON public.agents
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Platform admins can view all agents" ON public.agents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

-- Customers policies
CREATE POLICY "Agents can view their own customers" ON public.customers
  FOR ALL USING (
    agent_id IN (
      SELECT id FROM public.agents WHERE user_id = auth.uid()
    )
  );

-- Staff policies  
CREATE POLICY "Agents can manage their own staff" ON public.staff
  FOR ALL USING (
    agent_id IN (
      SELECT id FROM public.agents WHERE user_id = auth.uid()
    )
  );

-- Platform phone registry policies (read-only for agents)
CREATE POLICY "Agents can view phone registry" ON public.platform_phone_registry
  FOR SELECT USING (true);

-- Phones policies
CREATE POLICY "Agents can manage their own phones" ON public.phones
  FOR ALL USING (
    agent_id IN (
      SELECT id FROM public.agents WHERE user_id = auth.uid()
    )
  );

-- Allow public read access for device enforcement (Android APK needs this)
CREATE POLICY "Public can view phones by IMEI for enforcement" ON public.phones
  FOR SELECT USING (true);

-- Sales policies
CREATE POLICY "Agents can manage their own sales" ON public.sales
  FOR ALL USING (
    agent_id IN (
      SELECT id FROM public.agents WHERE user_id = auth.uid()
    )
  );

-- Installment schedules policies
CREATE POLICY "Agents can view installments for their sales" ON public.installment_schedules
  FOR SELECT USING (
    sale_id IN (
      SELECT id FROM public.sales 
      WHERE agent_id IN (
        SELECT id FROM public.agents WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Agents can update installments for their sales" ON public.installment_schedules
  FOR UPDATE USING (
    sale_id IN (
      SELECT id FROM public.sales 
      WHERE agent_id IN (
        SELECT id FROM public.agents WHERE user_id = auth.uid()
      )
    )
  );

-- Payment records policies (immutable - no UPDATE or DELETE)
CREATE POLICY "Agents can view their own payment records" ON public.payment_records
  FOR SELECT USING (
    agent_id IN (
      SELECT id FROM public.agents WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Agents can insert payment records" ON public.payment_records
  FOR INSERT WITH CHECK (
    agent_id IN (
      SELECT id FROM public.agents WHERE user_id = auth.uid()
    )
  );

-- Device commands policies
CREATE POLICY "Agents can manage commands for their phones" ON public.device_commands
  FOR ALL USING (
    phone_id IN (
      SELECT id FROM public.phones 
      WHERE agent_id IN (
        SELECT id FROM public.agents WHERE user_id = auth.uid()
      )
    )
  );

-- Allow public read access for device polling (Android APK)
CREATE POLICY "Public can view device commands by IMEI" ON public.device_commands
  FOR SELECT USING (true);

-- Allow public update for command acknowledgment (Android APK)
CREATE POLICY "Public can update device commands" ON public.device_commands
  FOR UPDATE USING (true);

-- Agent billing policies
CREATE POLICY "Agents can view their own billing records" ON public.agent_billing
  FOR SELECT USING (
    agent_id IN (
      SELECT id FROM public.agents WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Platform admins can manage all billing" ON public.agent_billing
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

-- Audit logs policies
CREATE POLICY "Agents can view audit logs for their devices" ON public.audit_logs
  FOR SELECT USING (
    agent_id IN (
      SELECT id FROM public.agents WHERE user_id = auth.uid()
    )
  );

-- Allow public insert for audit logs (Android APK)
CREATE POLICY "Public can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- Platform admins can view all audit logs
CREATE POLICY "Platform admins can view all audit logs" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );
