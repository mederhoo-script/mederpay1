from django.db import models
from django.core.exceptions import ValidationError
from apps.platform.models import Agent, User


# ========================================
# ENUM CHOICES
# ========================================

class SaleStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    COMPLETED = "completed", "Completed"
    DEFAULTED = "defaulted", "Defaulted"


# ========================================
# AGENT DOMAIN MODELS
# ========================================

class AgentStaff(models.Model):
    """Sub-agents and sales staff"""
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE)
    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=50)  # Flexible field as per spec
    status = models.CharField(max_length=20, default="active")  # Flexible field as per spec
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'agent_staff'
        indexes = [
            models.Index(fields=['agent', 'status']),
        ]
    
    def __str__(self):
        return self.full_name


class Customer(models.Model):
    """Customer profiles"""
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE)
    full_name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=20)
    email = models.EmailField(null=True, blank=True)
    address = models.TextField()
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'customers'
        indexes = [
            models.Index(fields=['agent', 'phone_number']),
            models.Index(fields=['phone_number']),
        ]
    
    def __str__(self):
        return f"{self.full_name} - {self.phone_number}"


class Phone(models.Model):
    """Device inventory with lifecycle tracking"""
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE)
    platform_registry = models.ForeignKey(
        'platform.PlatformPhoneRegistry', on_delete=models.CASCADE
    )
    
    imei = models.CharField(max_length=20, unique=True)
    model = models.CharField(max_length=100)
    
    locking_app_installed = models.BooleanField(default=False)
    lifecycle_status = models.CharField(max_length=30)  # Flexible field as per spec
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'phones'
        indexes = [
            models.Index(fields=['agent']),
            models.Index(fields=['imei']),
            models.Index(fields=['lifecycle_status']),
        ]
    
    def __str__(self):
        return f"{self.model} - {self.imei}"


class Sale(models.Model):
    """Sales with constraint: ONE ACTIVE SALE PER PHONE (MANDATORY)"""
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)
    phone = models.ForeignKey(Phone, on_delete=models.CASCADE)
    sold_by = models.ForeignKey(
        AgentStaff, null=True, on_delete=models.SET_NULL
    )
    
    sale_price = models.DecimalField(max_digits=12, decimal_places=2)
    down_payment = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_payable = models.DecimalField(max_digits=12, decimal_places=2)
    balance_remaining = models.DecimalField(max_digits=12, decimal_places=2)
    
    status = models.CharField(max_length=20, choices=SaleStatus.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'sales'
        indexes = [
            models.Index(fields=['agent', 'status']),
            models.Index(fields=['customer']),
            models.Index(fields=['phone']),
            models.Index(fields=['status']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['phone'],
                condition=models.Q(status='active'),
                name='one_active_sale_per_phone'
            ),
        ]
    
    def __str__(self):
        return f"Sale #{self.id} - {self.customer.full_name}"
    
    def clean(self):
        """Validate sale business rules"""
        if self.status == 'active':
            # Check for other active sales on this phone
            existing = Sale.objects.filter(
                phone=self.phone,
                status='active'
            ).exclude(pk=self.pk)
            if existing.exists():
                raise ValidationError('This phone already has an active sale')
