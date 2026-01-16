"""
Monnify API Service
Handles all communication with Monnify payment gateway
"""
import base64
import logging
import requests
from django.conf import settings
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class MonnifyAPIError(Exception):
    """Custom exception for Monnify API errors"""
    pass


class MonnifyService:
    """
    Service class for Monnify API integration
    All Monnify operations must go through this service
    """
    
    def __init__(self):
        self.api_key = settings.MONNIFY_API_KEY
        self.secret_key = settings.MONNIFY_SECRET_KEY
        self.contract_code = settings.MONNIFY_CONTRACT_CODE
        self.base_url = settings.MONNIFY_BASE_URL
        self._access_token = None
        self._token_expires_at = None
    
    def _get_access_token(self) -> str:
        """
        Authenticate with Monnify and get access token
        Implements token caching
        """
        # Check if we have a valid cached token
        if self._access_token and self._token_expires_at:
            from datetime import datetime, timedelta
            if datetime.now() < self._token_expires_at - timedelta(minutes=5):
                return self._access_token
        
        # Authenticate
        try:
            credentials = f"{self.api_key}:{self.secret_key}"
            base64_credentials = base64.b64encode(credentials.encode()).decode()
            
            response = requests.post(
                f"{self.base_url}/api/v1/auth/login",
                headers={"Authorization": f"Basic {base64_credentials}"},
                timeout=30
            )
            
            response.raise_for_status()
            data = response.json()
            
            if not data.get('requestSuccessful'):
                raise MonnifyAPIError(f"Authentication failed: {data.get('responseMessage')}")
            
            response_body = data.get('responseBody', {})
            self._access_token = response_body.get('accessToken')
            expires_in = response_body.get('expiresIn', 3600)
            
            # Set expiration time
            from datetime import datetime, timedelta
            self._token_expires_at = datetime.now() + timedelta(seconds=expires_in)
            
            logger.info("Successfully authenticated with Monnify")
            return self._access_token
            
        except requests.RequestException as e:
            logger.error(f"Monnify authentication error: {str(e)}")
            raise MonnifyAPIError(f"Failed to authenticate with Monnify: {str(e)}")
    
    def create_reserved_account(
        self,
        account_reference: str,
        account_name: str,
        customer_email: str,
        customer_name: str,
        bvn: Optional[str] = None,
        nin: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a reserved account for an agent
        
        Args:
            account_reference: Unique reference for the account (e.g., 'agent-{id}')
            account_name: Display name for the account
            customer_email: Agent's email
            customer_name: Agent's business name
            bvn: Optional Bank Verification Number
            nin: Optional National ID Number
        
        Returns:
            Dict with account details
        """
        try:
            access_token = self._get_access_token()
            
            payload = {
                "accountReference": account_reference,
                "accountName": account_name[:40],  # Max 40 characters
                "currencyCode": "NGN",
                "contractCode": self.contract_code,
                "customerEmail": customer_email,
                "customerName": customer_name,
                "getAllAvailableBanks": True
            }
            
            if bvn:
                payload["bvn"] = bvn
            if nin:
                payload["nin"] = nin
            
            response = requests.post(
                f"{self.base_url}/api/v2/bank-transfer/reserved-accounts",
                headers={
                    "Authorization": f"******",
                    "Content-Type": "application/json"
                },
                json=payload,
                timeout=30
            )
            
            response.raise_for_status()
            data = response.json()
            
            if not data.get('requestSuccessful'):
                raise MonnifyAPIError(f"Account creation failed: {data.get('responseMessage')}")
            
            response_body = data.get('responseBody', {})
            accounts = response_body.get('accounts', [])
            
            if not accounts:
                raise MonnifyAPIError("No accounts returned from Monnify")
            
            # Return first account (usually Moniepoint)
            first_account = accounts[0]
            
            result = {
                'account_reference': response_body.get('accountReference'),
                'account_number': first_account.get('accountNumber'),
                'account_name': first_account.get('accountName'),
                'bank_name': first_account.get('bankName'),
                'bank_code': first_account.get('bankCode'),
                'reservation_reference': response_body.get('reservationReference'),
                'status': response_body.get('status'),
                'created_on': response_body.get('createdOn'),
                'all_accounts': accounts  # Include all bank accounts if needed
            }
            
            logger.info(f"Created reserved account: {result['account_number']} for {account_reference}")
            return result
            
        except requests.RequestException as e:
            logger.error(f"Monnify API error creating account: {str(e)}")
            raise MonnifyAPIError(f"Failed to create reserved account: {str(e)}")
    
    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """
        Verify Monnify webhook signature
        
        Args:
            payload: Raw request body
            signature: Signature from Monnify-Signature header
        
        Returns:
            True if signature is valid
        """
        try:
            # Monnify uses HMAC-SHA512 for webhook signatures
            import hmac
            import hashlib
            
            # Use webhook secret from settings
            webhook_secret = settings.MONNIFY_WEBHOOK_SECRET
            
            # Calculate expected signature
            expected_signature = hmac.new(
                webhook_secret.encode(),
                payload,
                hashlib.sha512
            ).hexdigest()
            
            # Compare signatures (constant-time comparison)
            return hmac.compare_digest(expected_signature, signature)
            
        except Exception as e:
            logger.error(f"Webhook signature verification error: {str(e)}")
            return False
    
    def get_transaction_status(self, transaction_reference: str) -> Dict[str, Any]:
        """
        Query transaction status from Monnify
        
        Args:
            transaction_reference: Monnify transaction reference
        
        Returns:
            Dict with transaction details
        """
        try:
            access_token = self._get_access_token()
            
            response = requests.get(
                f"{self.base_url}/api/v2/transactions/{transaction_reference}",
                headers={"Authorization": f"******"},
                timeout=30
            )
            
            response.raise_for_status()
            data = response.json()
            
            if not data.get('requestSuccessful'):
                raise MonnifyAPIError(f"Transaction query failed: {data.get('responseMessage')}")
            
            return data.get('responseBody', {})
            
        except requests.RequestException as e:
            logger.error(f"Monnify API error querying transaction: {str(e)}")
            raise MonnifyAPIError(f"Failed to query transaction: {str(e)}")


# Singleton instance
monnify_service = MonnifyService()
