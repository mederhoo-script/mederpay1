from django.db import models
from django.core.exceptions import ValidationError
from apps.platform.models import Agent, User, PlatformPhoneRegistry


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
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='staff_members')
    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=50)
    status = models.CharField(max_length=20, default="active")
    
    # Additional useful fields (KEEP THESE)
    user = models.OneToOneField(
        User, 
        on_delete=models.CASCADE, 
        related_name='staff_profile',
        null=True,
        blank=True
    )  # Make optional
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0, null=True, blank=True)
    
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
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='customers')
    full_name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=20)
    email = models.EmailField(null=True, blank=True)
    address = models.TextField()
    
    # KYC/Identity fields (optional) for virtual account generation
    nin = models.CharField(max_length=11, null=True, blank=True, help_text="National Identification Number (11 digits) - Optional")
    bvn = models.CharField(max_length=11, null=True, blank=True, help_text="Bank Verification Number (11 digits) - Optional")
    
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
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='phones')
    platform_registry = models.ForeignKey(
        'platform.PlatformPhoneRegistry', 
        on_delete=models.CASCADE,
        related_name='phones'
    )
    
    imei = models.CharField(max_length=20, unique=True, db_index=True)
    model = models.CharField(max_length=100)
    
    locking_app_installed = models.BooleanField(default=False)
    lifecycle_status = models.CharField(max_length=30)
    
    # Additional useful fields (KEEP THESE)
    brand = models.CharField(max_length=100, blank=True)
    serial_number = models.CharField(max_length=100, null=True, blank=True)
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    selling_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_locked = models.BooleanField(default=False)
    last_enforcement_check = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'phones'
        indexes = [
            models.Index(fields=['agent', 'lifecycle_status']),
            models.Index(fields=['imei']),
            models.Index(fields=['platform_registry']),
        ]
    
    def __str__(self):
        return f"{self.brand} {self.model} - {self.imei}"
    
    def save(self, *args, **kwargs):
        # Auto-create/link PlatformPhoneRegistry
        if not self.platform_registry_id:
            registry, created = PlatformPhoneRegistry.objects.get_or_create(
                imei=self.imei,
                defaults={
                    'first_registered_agent': self.agent,
                    'current_agent': self.agent
                }
            )
            self.platform_registry = registry
            if not created and registry.current_agent != self.agent:
                registry.current_agent = self.agent
                registry.save()
        super().save(*args, **kwargs)


class Sale(models.Model):
    """Sales with constraint: ONE ACTIVE SALE PER PHONE (MANDATORY)"""
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='sales')
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='sales')
    phone = models.ForeignKey(Phone, on_delete=models.CASCADE, related_name='sales')
    sold_by = models.ForeignKey(
        AgentStaff, 
        null=True, 
        on_delete=models.SET_NULL,
        related_name='sales'
    )
    
    sale_price = models.DecimalField(max_digits=12, decimal_places=2)
    down_payment = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_payable = models.DecimalField(max_digits=12, decimal_places=2)
    balance_remaining = models.DecimalField(max_digits=12, decimal_places=2)
    
    status = models.CharField(max_length=20, choices=SaleStatus.choices)
    
    # Additional useful fields (KEEP THESE)
    installment_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    installment_frequency = models.CharField(max_length=20, default='weekly', blank=True)
    number_of_installments = models.IntegerField(null=True, blank=True)
    sale_date = models.DateTimeField(null=True, blank=True)
    completion_date = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'sales'
        constraints = [
            models.UniqueConstraint(
                fields=['phone'],
                condition=models.Q(status='active'),
                name='one_active_sale_per_phone'
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(sale_price__gt=0) & 
                    models.Q(down_payment__gte=0) & 
                    models.Q(total_payable__gt=0)
                ),
                name='positive_sale_amounts'
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(balance_remaining__gte=0) & 
                    models.Q(balance_remaining__lte=models.F('total_payable'))
                ),
                name='valid_balance'
            ),
        ]
        indexes = [
            models.Index(fields=['agent', 'status']),
            models.Index(fields=['customer']),
            models.Index(fields=['phone']),
        ]
    
    def __str__(self):
        return f"Sale #{self.id} - {self.customer.full_name} - {self.phone.brand} {self.phone.model}"
    
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
