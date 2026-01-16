# NIN and BVN Fields for Virtual Account Generation

## Overview

Agents and customers now have NIN (National Identification Number) and BVN (Bank Verification Number) fields that can be used to generate virtual dedicated bank accounts for clients using Monnify or other payment providers.

## Implementation

### Database Changes

#### Agent Model
Added to `apps/platform/models.py`:
```python
class Agent(models.Model):
    # ...existing fields...
    
    # KYC/Identity fields for virtual account generation
    nin = models.CharField(max_length=11, null=True, blank=True, 
                          help_text="National Identification Number (11 digits)")
    bvn = models.CharField(max_length=11, null=True, blank=True, 
                          help_text="Bank Verification Number (11 digits)")
```

#### Customer Model
Added to `apps/agents/models.py`:
```python
class Customer(models.Model):
    # ...existing fields...
    
    # KYC/Identity fields (optional) for virtual account generation
    nin = models.CharField(max_length=11, null=True, blank=True, 
                          help_text="National Identification Number (11 digits) - Optional")
    bvn = models.CharField(max_length=11, null=True, blank=True, 
                          help_text="Bank Verification Number (11 digits) - Optional")
```

### API Changes

#### Agent API
**GET /api/agents/me/**
```json
{
  "id": 1,
  "business_name": "My Business",
  "business_address": "123 Main St",
  "nin": "12345678901",
  "bvn": "98765432109",
  "monnify_public_key": "MK_PROD_XXXXXXXXXX",
  ...
}
```

**PATCH /api/agents/me/**
```json
{
  "nin": "12345678901",
  "bvn": "98765432109"
}
```

#### Customer API
**GET /api/customers/**
```json
{
  "results": [
    {
      "id": 1,
      "full_name": "John Doe",
      "phone_number": "+2341234567890",
      "email": "john@example.com",
      "address": "123 Lagos St",
      "nin": "12345678901",
      "bvn": "98765432109",
      "created_at": "2026-01-16T08:00:00Z"
    }
  ]
}
```

**POST /api/customers/**
```json
{
  "full_name": "John Doe",
  "phone_number": "+2341234567890",
  "email": "john@example.com",
  "address": "123 Lagos St",
  "nin": "12345678901",
  "bvn": "98765432109"
}
```

### Frontend Changes

#### Agent Settings Page
Added KYC Information section in `/dashboard/settings`:
- NIN field (11-digit input with validation)
- BVN field (11-digit input with validation)
- Explanatory text: "Required for generating virtual dedicated bank accounts for your clients"
- Both fields are optional

#### Customer Management Page
Added to customer form in `/dashboard/customers`:
- NIN field (11-digit input, optional)
- BVN field (11-digit input, optional)
- Help text explaining the fields
- Both fields accept only numeric input

## Use Cases

### 1. Virtual Account Generation for Agents
When an agent has NIN and BVN configured, the platform can:
- Generate dedicated virtual bank accounts via Monnify
- Use for settlement payments
- Enable direct bank transfers to agent
- Required for KYC compliance

### 2. Virtual Account Generation for Customers
When a customer provides NIN and BVN (optional), the platform can:
- Generate dedicated virtual bank accounts for installment payments
- Enable automated payment reconciliation
- Link customer payments directly to their profile
- Provide better payment tracking

### 3. Payment Collection Flow
1. Customer doesn't have NIN/BVN initially (optional)
2. Customer selects a phone for purchase
3. If customer has NIN/BVN:
   - Generate dedicated virtual account via Monnify
   - Customer pays to their unique account number
   - Payments auto-reconcile to their profile
4. If customer doesn't have NIN/BVN:
   - Use agent's virtual account
   - Manual payment reconciliation by agent

## Field Specifications

### NIN (National Identification Number)
- **Length:** 11 digits
- **Type:** Numeric only
- **Required:** Optional for both agents and customers
- **Usage:** Primary KYC identifier for virtual account generation
- **Validation:** Exactly 11 digits, no letters or special characters

### BVN (Bank Verification Number)
- **Length:** 11 digits
- **Type:** Numeric only
- **Required:** Optional for both agents and customers
- **Usage:** Bank account verification and virtual account generation
- **Validation:** Exactly 11 digits, no letters or special characters

## Security Considerations

1. **Data Privacy:**
   - NIN and BVN are sensitive personal information
   - Should be encrypted at rest (consider adding encryption)
   - Only accessible by the owning agent
   - Not shared with other agents

2. **Access Control:**
   - Agents can only view/update their own NIN/BVN
   - Agents can only view/update their customers' NIN/BVN
   - Platform admins have full access for support

3. **Compliance:**
   - Store in compliance with Nigerian data protection laws
   - Ensure proper consent is obtained
   - Use only for stated purpose (virtual account generation)

## Integration with Monnify

### Agent Virtual Account
```python
# Example: Generate virtual account for agent
def generate_agent_virtual_account(agent):
    if agent.nin and agent.bvn:
        response = monnify_client.create_reserved_account(
            account_reference=f"AGENT_{agent.id}",
            account_name=agent.business_name,
            customer_email=agent.user.email,
            bvn=agent.bvn,
            nin=agent.nin,
            customer_name=agent.business_name
        )
        return response['account_number']
    return None
```

### Customer Virtual Account
```python
# Example: Generate virtual account for customer
def generate_customer_virtual_account(customer):
    if customer.nin and customer.bvn:
        response = monnify_client.create_reserved_account(
            account_reference=f"CUST_{customer.id}",
            account_name=customer.full_name,
            customer_email=customer.email or f"customer{customer.id}@agent.com",
            bvn=customer.bvn,
            nin=customer.nin,
            customer_name=customer.full_name
        )
        return response['account_number']
    return None
```

## Migration

To apply the database changes:

```bash
cd backend
python manage.py makemigrations
python manage.py migrate
```

Migration will:
- Add `nin` column to `agents` table (nullable)
- Add `bvn` column to `agents` table (nullable)
- Add `nin` column to `customers` table (nullable)
- Add `bvn` column to `customers` table (nullable)

All existing records will have `NULL` values for these fields.

## Future Enhancements

1. **NIN/BVN Verification:**
   - Integrate with NIMC API to verify NIN
   - Integrate with bank APIs to verify BVN
   - Add verification status field

2. **Automatic Virtual Account Generation:**
   - Auto-generate virtual account when NIN/BVN provided
   - Store account number in database
   - Display in dashboard

3. **Encryption:**
   - Encrypt NIN/BVN at rest using Fernet (like Monnify secret key)
   - Add decryption for display/API usage

4. **Validation:**
   - Add backend validation for 11-digit format
   - Add checksum validation if available
   - Prevent duplicate NIN/BVN across customers

## Testing

### Manual Testing Steps

**Agent Settings:**
1. Log in as agent
2. Navigate to Settings
3. Scroll to KYC Information section
4. Enter 11-digit NIN
5. Enter 11-digit BVN
6. Click Save Settings
7. Verify fields are saved

**Customer Management:**
1. Navigate to Customers
2. Click Add Customer
3. Fill required fields
4. Optionally enter NIN and BVN
5. Click Add Customer
6. Verify customer shows NIN/BVN in table
7. Edit customer and update NIN/BVN
8. Verify changes are saved

### API Testing

```bash
# Test Agent NIN/BVN update
curl -X PATCH https://api.example.com/api/agents/me/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nin": "12345678901",
    "bvn": "98765432109"
  }'

# Test Customer NIN/BVN
curl -X POST https://api.example.com/api/customers/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "John Doe",
    "phone_number": "+2341234567890",
    "address": "123 Lagos St",
    "nin": "12345678901",
    "bvn": "98765432109"
  }'
```

## Support

For questions or issues:
1. Check that NIN/BVN are exactly 11 digits
2. Verify fields are visible in Settings and Customer forms
3. Check API responses include nin and bvn fields
4. Review backend logs for validation errors
