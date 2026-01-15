from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils import timezone
from cryptography.fernet import Fernet


# ========================================
# ENUM CHOICES
# ========================================

class UserRole(models.TextChoices):
    PLATFORM_ADMIN = "platform_admin", "Platform Admin"
    AGENT_OWNER = "agent_owner", "Agent Owner"


class AgentStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    RESTRICTED = "restricted", "Restricted"
    DISABLED = "disabled", "Disabled"


# ========================================
# CUSTOM USER MANAGER
# ========================================

class UserManager(BaseUserManager):
    """Manager for User model"""
    
    def create_user(self, email, password=None, **extra_fields):
        """Create and save a regular user"""
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        """Create and save a superuser"""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', UserRole.PLATFORM_ADMIN)
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        return self.create_user(email, password, **extra_fields)


# ========================================
# PLATFORM DOMAIN MODELS
# ========================================

class User(AbstractBaseUser, PermissionsMixin):
    """Custom user model with email as username"""
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=30, choices=UserRole.choices)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    objects = UserManager()
    
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    
    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['role']),
        ]
    
    def __str__(self):
        return self.email


class Agent(models.Model):
    """Agent business profile"""
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    business_name = models.CharField(max_length=255)
    
    risk_score = models.IntegerField(default=0)
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Monnify (agent-owned)
    monnify_public_key = models.TextField()
    monnify_secret_key_encrypted = models.TextField()
    monnify_contract_code = models.CharField(max_length=100)
    monnify_webhook_secret = models.TextField()
    
    status = models.CharField(
        max_length=20, choices=AgentStatus.choices, default=AgentStatus.ACTIVE
    )
    
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
    """Global IMEI tracking and blacklist (MANDATORY)"""
    imei = models.CharField(max_length=20, unique=True)
    
    first_registered_agent = models.ForeignKey(
        Agent, related_name="first_registrations",
        on_delete=models.SET_NULL, null=True
    )
    current_agent = models.ForeignKey(
        Agent, related_name="current_phones",
        on_delete=models.SET_NULL, null=True
    )
    
    is_blacklisted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'platform_phone_registry'
        indexes = [
            models.Index(fields=['imei']),
            models.Index(fields=['is_blacklisted']),
        ]
    
    def __str__(self):
        return self.imei


class AgentBilling(models.Model):
    """Weekly/monthly agent billing records"""
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE)
    billing_period_start = models.DateField()
    billing_period_end = models.DateField()
    
    phones_sold_count = models.PositiveIntegerField()
    fee_per_phone = models.DecimalField(max_digits=10, decimal_places=2)
    
    total_amount_due = models.DecimalField(max_digits=12, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    status = models.CharField(max_length=20)
    invoice_number = models.CharField(max_length=50, unique=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'agent_billing'
        indexes = [
            models.Index(fields=['agent', 'status']),
            models.Index(fields=['billing_period_start']),
        ]
    
    def __str__(self):
        return f"{self.agent.business_name} - {self.invoice_number}"
