// Database enums
export type UserRole = 'platform_admin' | 'agent_owner'
export type PhoneStatus = 'in_stock' | 'sold' | 'locked' | 'stolen' | 'returned'
export type SaleStatus = 'active' | 'completed' | 'defaulted' | 'cancelled'
export type PaymentStatus = 'pending' | 'confirmed' | 'disputed'
export type PaymentMethod = 'CASH' | 'TRANSFER' | 'MONNIFY'
export type CommandType = 'LOCK' | 'UNLOCK'
export type CommandStatus = 'pending' | 'sent' | 'acknowledged' | 'executed' | 'failed' | 'expired'
export type BillingStatus = 'pending' | 'overdue' | 'paid' | 'waived'

// Database table types
export interface Profile {
  id: string
  username: string
  first_name: string
  last_name: string
  phone_number: string | null
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Agent {
  id: string
  user_id: string
  business_name: string
  business_address: string | null
  nin: string | null
  bvn: string | null
  credit_limit: number
  credit_used: number
  credit_available: number
  monnify_api_key: string | null
  monnify_secret_key: string | null
  monnify_contract_code: string | null
  monnify_account_reference: string | null
  monnify_account_number: string | null
  monnify_bank_name: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  agent_id: string
  full_name: string
  phone_number: string
  email: string | null
  address: string | null
  nin: string | null
  bvn: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Staff {
  id: string
  agent_id: string
  full_name: string
  role: string | null
  commission_rate: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PlatformPhoneRegistry {
  id: string
  imei: string
  first_registered_by: string | null
  current_agent_id: string | null
  is_blacklisted: boolean
  blacklist_reason: string | null
  created_at: string
  updated_at: string
}

export interface Phone {
  id: string
  agent_id: string
  imei: string
  brand: string | null
  model: string | null
  serial_number: string | null
  purchase_price: number | null
  selling_price: number | null
  status: PhoneStatus
  is_locked: boolean
  created_at: string
  updated_at: string
}

export interface Sale {
  id: string
  agent_id: string
  phone_id: string
  customer_id: string
  selling_price: number
  down_payment: number
  balance_remaining: number
  installment_amount: number | null
  installment_frequency: string | null
  number_of_installments: number | null
  status: SaleStatus
  sale_date: string
  completion_date: string | null
  created_at: string
  updated_at: string
}

export interface InstallmentSchedule {
  id: string
  sale_id: string
  installment_number: number
  amount_due: number
  due_date: string
  amount_paid: number
  is_paid: boolean
  paid_date: string | null
  created_at: string
  updated_at: string
}

export interface PaymentRecord {
  id: string
  agent_id: string
  sale_id: string
  installment_id: string | null
  amount: number
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  balance_before: number
  balance_after: number
  monnify_reference: string | null
  monnify_transaction_id: string | null
  payment_date: string
  created_at: string
}

export interface DeviceCommand {
  id: string
  phone_id: string
  imei: string
  command_type: CommandType
  status: CommandStatus
  reason: string | null
  auth_token: string
  auth_token_hash: string
  token_expires_at: string
  issued_at: string
  sent_at: string | null
  acknowledged_at: string | null
  executed_at: string | null
  created_at: string
  updated_at: string
}

export interface AgentBilling {
  id: string
  agent_id: string
  billing_period_start: string
  billing_period_end: string
  amount_due: number
  amount_paid: number
  status: BillingStatus
  due_date: string
  paid_date: string | null
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  imei: string | null
  agent_id: string | null
  event_type: string
  event_data: Record<string, any> | null
  app_version: string | null
  timestamp: string
  created_at: string
}

// Extended types with relations
export interface PhoneWithDetails extends Phone {
  phone_registry?: PlatformPhoneRegistry
}

export interface SaleWithDetails extends Sale {
  phone?: Phone
  customer?: Customer
  installments?: InstallmentSchedule[]
}

export interface PaymentRecordWithDetails extends PaymentRecord {
  sale?: Sale
}

// Dashboard stats type
export interface DashboardStats {
  total_phones: number
  active_sales: number
  outstanding_balance: number
  overdue_payments: number
  credit_limit: number
  credit_used: number
  credit_available: number
}

// Android APK types
export interface HealthCheckRequest {
  imei: string
  is_device_admin_enabled: boolean
  is_companion_app_installed: boolean
  companion_app_version: string | null
  android_version: string
  app_version: string
  battery_level: number | null
  is_locked: boolean
  lock_reason: string | null
}

export interface AuditLogEntry {
  imei: string
  event_type: string
  event_data: Record<string, any>
  timestamp: string
  app_version: string
}

export interface EnforcementStatusResponse {
  should_lock: boolean
  reason: string | null
  balance: number
  overdue_count: number
}
