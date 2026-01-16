# Agent Monnify Configuration Guide

## Overview

Agents can now configure their own Monnify payment credentials directly through the web dashboard. This allows each agent to manage their own payment integration independently without relying on platform-wide credentials in the `.env` file.

## How It Works

### Agent Self-Service Configuration

1. **Each agent is their own admin** for their business
2. Agents can input their own Monnify credentials in the Settings page
3. Credentials are encrypted before storage for security
4. The platform uses agent-specific credentials for payment processing

### Backend Implementation

**Model: Agent (apps/platform/models.py)**
```python
class Agent(models.Model):
    # Monnify credentials (agent-owned)
    monnify_public_key = models.TextField()
    monnify_secret_key_encrypted = models.TextField()  # Encrypted at rest
    monnify_contract_code = models.CharField(max_length=100)
    monnify_webhook_secret = models.TextField()
```

**Serializer: AgentSerializer (apps/platform/serializers.py)**
- Exposes Monnify fields for agents to update
- Automatically encrypts the secret key using `ENCRYPTION_KEY` from settings
- Includes `has_monnify_configured` flag to show configuration status
- Secret key is write-only (never returned in API responses)

**API Endpoint:**
- `PATCH /api/agents/me/` - Update agent profile including Monnify credentials

### Frontend Implementation

**Settings Page: frontend/app/dashboard/settings/page.tsx**

Features:
- Business information form (name, address)
- Monnify configuration section with 4 fields:
  - Public Key (API Key)
  - Secret Key (password field, encrypted)
  - Contract Code
  - Webhook Secret
- Configuration status indicator (✓ Configured)
- Help text with instructions on how to get credentials
- Security notice about encryption
- Success/error messages

### Security Features

1. **Encryption at Rest:**
   - Secret key is encrypted using Fernet encryption
   - Requires `ENCRYPTION_KEY` in environment variables
   - Falls back to storing as-is if no encryption key (not recommended)

2. **Write-Only Secret Field:**
   - Secret key is never returned in API responses
   - Shown as `••••••••••••••••` in UI after configuration
   - Can be updated but never retrieved

3. **HTTPS Recommended:**
   - Always use HTTPS in production to protect credentials in transit

## Configuration Steps for Agents

### Step 1: Get Monnify Credentials

1. Log in to your Monnify dashboard at [app.monnify.com](https://app.monnify.com)
2. Navigate to **Settings → API Settings**
3. Copy your **API Key** (Public Key) and **Secret Key**
4. Find your **Contract Code** in **Settings → Business Settings**
5. Note your **Webhook Secret** (or generate one)

### Step 2: Configure in Dashboard

1. Log in to the MederPay dashboard
2. Navigate to **Settings** in the sidebar
3. Fill in the **Monnify Payment Integration** section:
   - **Monnify Public Key:** MK_TEST_XXXXXXXXXX or MK_PROD_XXXXXXXXXX
   - **Monnify Secret Key:** Your secret key (will be encrypted)
   - **Contract Code:** Your contract code
   - **Webhook Secret:** Your webhook secret
4. Click **Save Settings**

### Step 3: Configure Webhook URL

Set up your webhook URL in Monnify dashboard:
```
https://your-domain.com/api/webhooks/monnify/
```

The platform will automatically use your agent-specific webhook secret to verify incoming webhooks.

## Environment Variable Configuration

### Option 1: Agent-Specific Credentials (Recommended)

Each agent configures their own credentials through the Settings page. No `.env` configuration needed for Monnify.

**Required `.env` variable:**
```env
ENCRYPTION_KEY=your-fernet-encryption-key
```

Generate encryption key:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Option 2: Platform-Wide Credentials (Legacy)

If you want to use platform-wide credentials instead, you can configure them in `.env`:

```env
MONNIFY_PUBLIC_KEY=MK_PROD_XXXXXXXXXX
MONNIFY_SECRET_KEY=your-secret-key
MONNIFY_CONTRACT_CODE=1234567890
MONNIFY_WEBHOOK_SECRET=your-webhook-secret
```

However, **agent-specific credentials take precedence** if configured.

## Technical Details

### Encryption Process

**Saving credentials:**
```python
# In AgentSerializer.update()
if 'monnify_secret_key' in validated_data:
    secret_key = validated_data.pop('monnify_secret_key')
    if secret_key:
        encryption_key = settings.ENCRYPTION_KEY
        if encryption_key:
            instance.monnify_secret_key_encrypted = instance.encrypt_field(
                secret_key, encryption_key
            )
```

**Decrypting for use:**
```python
# In Agent model
def decrypt_field(self, value, encryption_key):
    """Decrypt sensitive data"""
    if not encryption_key:
        return value
    f = Fernet(encryption_key.encode())
    return f.decrypt(value.encode()).decode()
```

### API Response Example

**GET /api/agents/me/**
```json
{
  "id": 1,
  "business_name": "My Business",
  "business_address": "123 Main St",
  "monnify_public_key": "MK_PROD_XXXXXXXXXX",
  "monnify_contract_code": "1234567890",
  "monnify_webhook_secret": "webhook-secret",
  "has_monnify_configured": true
}
```

Note: `monnify_secret_key_encrypted` is never returned.

**PATCH /api/agents/me/**
```json
{
  "monnify_public_key": "MK_PROD_XXXXXXXXXX",
  "monnify_secret_key": "SK_SECRET_XXXXXXXXXX",
  "monnify_contract_code": "1234567890",
  "monnify_webhook_secret": "webhook-secret"
}
```

## Benefits

1. **Agent Independence:**
   - Each agent manages their own payment integration
   - No dependency on platform administrators

2. **Security:**
   - Credentials encrypted at rest
   - Write-only secret key field
   - Agent-specific isolation

3. **Flexibility:**
   - Different agents can use different Monnify accounts
   - Each agent receives payments directly to their account

4. **Scalability:**
   - No bottleneck from shared credentials
   - Agents can switch between test/production independently

## Migration from .env Configuration

If you're migrating from platform-wide `.env` credentials:

1. Each agent should obtain their own Monnify credentials
2. Agents configure credentials via Settings page
3. Platform automatically uses agent-specific credentials once configured
4. Can keep `.env` credentials as fallback for agents who haven't configured yet

## Troubleshooting

### "Failed to save settings"

**Cause:** API error or validation failure

**Solution:**
- Check that all required fields are filled
- Verify Monnify credentials are correct
- Check browser console for detailed error

### Secret key not being encrypted

**Cause:** `ENCRYPTION_KEY` not set in environment

**Solution:**
```bash
# Generate key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Add to .env
ENCRYPTION_KEY=generated-key-here

# Restart backend
```

### Webhook verification failing

**Cause:** Webhook secret doesn't match

**Solution:**
- Ensure webhook secret in Settings matches Monnify configuration
- Check webhook URL is correctly configured in Monnify dashboard
- Verify webhook requests are reaching the backend

## Support

For issues or questions:
1. Check agent credentials in Settings page
2. Verify `ENCRYPTION_KEY` is configured in backend
3. Review backend logs for encryption/decryption errors
4. Contact platform administrator if issues persist
