from django.db import models
from django.contrib.auth.models import AbstractUser
from cryptography.fernet import Fernet


class User(AbstractUser):
    """Custom user model with role-based access"""
    ROLE_CHOICES = [
        ('platform_admin', 'Platform Admin'),
        ('agent_owner', 'Agent Owner'),
        ('sub_agent', 'Sub Agent'),
    ]
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='agent_owner')
    phone_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['phone_number']),
            models.Index(fields=['role']),
        ]
    
    def __str__(self):
        return f"{self.username} ({self.role})"


class Agent(models.Model):
    """Agent business profile"""
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('suspended', 'Suspended'),
        ('inactive', 'Inactive'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='agent_profile')
    business_name = models.CharField(max_length=255)
    business_address = models.TextField()
    registration_number = models.CharField(max_length=100, unique=True, null=True, blank=True)
    
    # Monnify credentials (encrypted)
    monnify_api_key = models.TextField()
    monnify_secret_key = models.TextField()
    monnify_contract_code = models.CharField(max_length=100)
    
    # Business limits
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    credit_used = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'agents'
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return self.business_name
    
    def encrypt_field(self, value, encryption_key):
        """Encrypt sensitive data"""
        if not encryption_key:
            return value
        f = Fernet(encryption_key.encode())
        return f.encrypt(value.encode()).decode()
    
    def decrypt_field(self, value, encryption_key):
        """Decrypt sensitive data"""
        if not encryption_key:
            return value
        f = Fernet(encryption_key.encode())
        return f.decrypt(value.encode()).decode()


class PlatformPhoneRegistry(models.Model):
    """Global IMEI tracking and blacklist"""
    STATUS_CHOICES = [
        ('available', 'Available'),
        ('assigned', 'Assigned'),
        ('blacklisted', 'Blacklisted'),
    ]
    
    imei = models.CharField(max_length=15, unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available')
    blacklist_reason = models.TextField(null=True, blank=True)
    registered_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'platform_phone_registry'
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['imei', 'status']),
        ]
    
    def __str__(self):
        return f"{self.imei} - {self.status}"


class AgentBilling(models.Model):
    """Weekly/monthly agent billing records"""
    BILLING_TYPE_CHOICES = [
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
    ]
    
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='billing_records')
    billing_type = models.CharField(max_length=10, choices=BILLING_TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    due_date = models.DateField()
    paid_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'agent_billing'
        indexes = [
            models.Index(fields=['agent', 'status']),
            models.Index(fields=['due_date']),
        ]
    
    def __str__(self):
        return f"{self.agent.business_name} - {self.billing_type} - {self.amount}"
