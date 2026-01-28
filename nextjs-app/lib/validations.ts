import { z } from 'zod'

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  phone_number: z.string().optional(),
  business_name: z.string().min(1, 'Business name is required'),
  business_address: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

// Phone schema
export const phoneSchema = z.object({
  imei: z.string().length(15, 'IMEI must be 15 characters'),
  brand: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  purchase_price: z.number().min(0).optional(),
  selling_price: z.number().min(0).optional(),
})

// Customer schema
export const customerSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  phone_number: z.string().min(1, 'Phone number is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  nin: z.string().length(11, 'NIN must be 11 characters').optional().or(z.literal('')),
  bvn: z.string().length(11, 'BVN must be 11 characters').optional().or(z.literal('')),
})

// Staff schema
export const staffSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  role: z.string().optional(),
  commission_rate: z.number().min(0).max(100, 'Commission rate must be between 0 and 100').optional(),
})

// Sale schema
export const saleSchema = z.object({
  phone_id: z.string().uuid('Invalid phone ID'),
  customer_id: z.string().uuid('Invalid customer ID'),
  selling_price: z.number().min(0, 'Selling price must be positive'),
  down_payment: z.number().min(0, 'Down payment must be positive').optional(),
  installment_amount: z.number().min(0).optional(),
  installment_frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  number_of_installments: z.number().int().min(1).optional(),
})

// Payment schema
export const paymentSchema = z.object({
  sale_id: z.string().uuid('Invalid sale ID'),
  amount: z.number().min(0, 'Amount must be positive'),
  payment_method: z.enum(['CASH', 'TRANSFER', 'MONNIFY']),
  monnify_reference: z.string().optional(),
  installment_id: z.string().uuid('Invalid installment ID').optional(),
})

// Agent settings schema
export const agentSettingsSchema = z.object({
  business_name: z.string().min(1, 'Business name is required'),
  business_address: z.string().optional(),
  nin: z.string().length(11, 'NIN must be 11 characters').optional().or(z.literal('')),
  bvn: z.string().length(11, 'BVN must be 11 characters').optional().or(z.literal('')),
  monnify_api_key: z.string().optional(),
  monnify_secret_key: z.string().optional(),
  monnify_contract_code: z.string().optional(),
})

// Android APK schemas
export const healthCheckSchema = z.object({
  imei: z.string(),
  is_device_admin_enabled: z.boolean(),
  is_companion_app_installed: z.boolean(),
  companion_app_version: z.string().nullable(),
  android_version: z.string(),
  app_version: z.string(),
  battery_level: z.number().nullable(),
  is_locked: z.boolean(),
  lock_reason: z.string().nullable(),
})

export const auditLogEntrySchema = z.object({
  imei: z.string(),
  event_type: z.string(),
  event_data: z.record(z.any()),
  timestamp: z.string(),
  app_version: z.string(),
})

export const batchAuditLogsSchema = z.object({
  logs: z.array(auditLogEntrySchema).max(50, 'Maximum 50 logs per batch'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type PhoneInput = z.infer<typeof phoneSchema>
export type CustomerInput = z.infer<typeof customerSchema>
export type StaffInput = z.infer<typeof staffSchema>
export type SaleInput = z.infer<typeof saleSchema>
export type PaymentInput = z.infer<typeof paymentSchema>
export type AgentSettingsInput = z.infer<typeof agentSettingsSchema>
export type HealthCheckInput = z.infer<typeof healthCheckSchema>
export type AuditLogEntryInput = z.infer<typeof auditLogEntrySchema>
export type BatchAuditLogsInput = z.infer<typeof batchAuditLogsSchema>
