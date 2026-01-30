-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
CREATE TYPE user_role AS ENUM ('platform_admin', 'agent_owner');
CREATE TYPE phone_status AS ENUM ('in_stock', 'sold', 'locked', 'stolen', 'returned');
CREATE TYPE sale_status AS ENUM ('active', 'completed', 'defaulted', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'confirmed', 'disputed');
CREATE TYPE payment_method AS ENUM ('CASH', 'TRANSFER', 'MONNIFY');
CREATE TYPE command_type AS ENUM ('LOCK', 'UNLOCK');
CREATE TYPE command_status AS ENUM ('pending', 'sent', 'acknowledged', 'executed', 'failed', 'expired');
CREATE TYPE billing_status AS ENUM ('pending', 'overdue', 'paid', 'waived');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username VARCHAR(150) UNIQUE NOT NULL,
  first_name VARCHAR(150) NOT NULL,
  last_name VARCHAR(150) NOT NULL,
  phone_number VARCHAR(20),
  role user_role DEFAULT 'agent_owner',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agents table
CREATE TABLE public.agents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  business_name VARCHAR(255) NOT NULL,
  business_address TEXT,
  nin VARCHAR(11),
  bvn VARCHAR(11),
  
  -- Credit management
  credit_limit DECIMAL(15, 2) DEFAULT 0,
  credit_used DECIMAL(15, 2) DEFAULT 0,
  credit_available DECIMAL(15, 2) GENERATED ALWAYS AS (credit_limit - credit_used) STORED,
  
  -- Monnify integration (encrypted in production)
  monnify_api_key TEXT,
  monnify_secret_key TEXT,
  monnify_contract_code VARCHAR(50),
  monnify_account_reference VARCHAR(100),
  monnify_account_number VARCHAR(20),
  monnify_bank_name VARCHAR(100),
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers table
CREATE TABLE public.customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  email VARCHAR(254),
  address TEXT,
  nin VARCHAR(11),
  bvn VARCHAR(11),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff table
CREATE TABLE public.staff (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(100),
  commission_rate DECIMAL(5, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform phone registry (global IMEI tracking)
CREATE TABLE public.platform_phone_registry (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  imei VARCHAR(15) UNIQUE NOT NULL,
  first_registered_by UUID REFERENCES public.agents(id),
  current_agent_id UUID REFERENCES public.agents(id),
  is_blacklisted BOOLEAN DEFAULT FALSE,
  blacklist_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Phones table
CREATE TABLE public.phones (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  imei VARCHAR(15) UNIQUE NOT NULL,
  brand VARCHAR(100),
  model VARCHAR(100),
  serial_number VARCHAR(100),
  
  purchase_price DECIMAL(15, 2),
  selling_price DECIMAL(15, 2),
  
  status phone_status DEFAULT 'in_stock',
  is_locked BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_phone_registry FOREIGN KEY (imei) REFERENCES public.platform_phone_registry(imei)
);

-- Sales table
CREATE TABLE public.sales (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  phone_id UUID REFERENCES public.phones(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  
  selling_price DECIMAL(15, 2) NOT NULL,
  down_payment DECIMAL(15, 2) DEFAULT 0,
  balance_remaining DECIMAL(15, 2) NOT NULL,
  
  installment_amount DECIMAL(15, 2),
  installment_frequency VARCHAR(20), -- daily, weekly, monthly
  number_of_installments INTEGER,
  
  status sale_status DEFAULT 'active',
  
  sale_date TIMESTAMPTZ DEFAULT NOW(),
  completion_date TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint: One active sale per phone
  CONSTRAINT unique_active_sale_per_phone UNIQUE (phone_id) WHERE (status = 'active')
);

-- Installment schedules table
CREATE TABLE public.installment_schedules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
  
  installment_number INTEGER NOT NULL,
  amount_due DECIMAL(15, 2) NOT NULL,
  due_date DATE NOT NULL,
  amount_paid DECIMAL(15, 2) DEFAULT 0,
  is_paid BOOLEAN DEFAULT FALSE,
  paid_date TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_installment_per_sale UNIQUE (sale_id, installment_number)
);

-- Payment records table (immutable audit trail)
CREATE TABLE public.payment_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
  installment_id UUID REFERENCES public.installment_schedules(id),
  
  amount DECIMAL(15, 2) NOT NULL,
  payment_method payment_method NOT NULL,
  payment_status payment_status DEFAULT 'pending',
  
  -- Balance tracking (immutable snapshot)
  balance_before DECIMAL(15, 2) NOT NULL,
  balance_after DECIMAL(15, 2) NOT NULL,
  
  -- Monnify reference
  monnify_reference VARCHAR(100),
  monnify_transaction_id VARCHAR(100),
  
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device commands table
CREATE TABLE public.device_commands (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  phone_id UUID REFERENCES public.phones(id) ON DELETE CASCADE NOT NULL,
  imei VARCHAR(15) NOT NULL,
  
  command_type command_type NOT NULL,
  status command_status DEFAULT 'pending',
  
  reason TEXT,
  auth_token VARCHAR(255) NOT NULL,
  auth_token_hash VARCHAR(255) NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent billing table
CREATE TABLE public.agent_billing (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  
  amount_due DECIMAL(15, 2) NOT NULL,
  amount_paid DECIMAL(15, 2) DEFAULT 0,
  status billing_status DEFAULT 'pending',
  
  due_date DATE NOT NULL,
  paid_date TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE public.audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  imei VARCHAR(15),
  agent_id UUID REFERENCES public.agents(id),
  
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB,
  
  app_version VARCHAR(20),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_agents_user_id ON public.agents(user_id);
CREATE INDEX idx_customers_agent_id ON public.customers(agent_id);
CREATE INDEX idx_staff_agent_id ON public.staff(agent_id);
CREATE INDEX idx_phones_agent_id ON public.phones(agent_id);
CREATE INDEX idx_phones_imei ON public.phones(imei);
CREATE INDEX idx_phones_status ON public.phones(status);
CREATE INDEX idx_sales_agent_id ON public.sales(agent_id);
CREATE INDEX idx_sales_phone_id ON public.sales(phone_id);
CREATE INDEX idx_sales_customer_id ON public.sales(customer_id);
CREATE INDEX idx_sales_status ON public.sales(status);
CREATE INDEX idx_installments_sale_id ON public.installment_schedules(sale_id);
CREATE INDEX idx_installments_due_date ON public.installment_schedules(due_date);
CREATE INDEX idx_installments_is_paid ON public.installment_schedules(is_paid);
CREATE INDEX idx_payments_agent_id ON public.payment_records(agent_id);
CREATE INDEX idx_payments_sale_id ON public.payment_records(sale_id);
CREATE INDEX idx_payments_date ON public.payment_records(payment_date);
CREATE INDEX idx_device_commands_imei ON public.device_commands(imei);
CREATE INDEX idx_device_commands_status ON public.device_commands(status);
CREATE INDEX idx_audit_logs_imei ON public.audit_logs(imei);
CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs(timestamp);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phones_updated_at BEFORE UPDATE ON public.phones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_installments_updated_at BEFORE UPDATE ON public.installment_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_device_commands_updated_at BEFORE UPDATE ON public.device_commands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_billing_updated_at BEFORE UPDATE ON public.agent_billing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_phone_registry_updated_at BEFORE UPDATE ON public.platform_phone_registry
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
