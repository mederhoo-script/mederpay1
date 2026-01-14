from django.db import models
from django.core.exceptions import ValidationError
from apps.platform.models import Agent, User


class AgentStaff(models.Model):
    """Sub-agents and sales staff"""
    ROLE_CHOICES = [
        ('sub_agent', 'Sub Agent'),
        ('sales_staff', 'Sales Staff'),
    ]
    
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='staff_members')
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='staff_profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # Percentage
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'agent_staff'
        indexes = [
            models.Index(fields=['agent', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.role}"


class Customer(models.Model):
    """Customer profiles"""
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='customers')
    full_name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=20)
    email = models.EmailField(null=True, blank=True)
    address = models.TextField()
    id_type = models.CharField(max_length=50)  # e.g., National ID, Driver's License
    id_number = models.CharField(max_length=100)
    photo_url = models.URLField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
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
    STATUS_CHOICES = [
        ('in_stock', 'In Stock'),
        ('sold', 'Sold'),
        ('locked', 'Locked'),
        ('unlocked', 'Unlocked'),
        ('returned', 'Returned'),
    ]
    
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='phones')
    imei = models.CharField(max_length=15, unique=True, db_index=True)
    brand = models.CharField(max_length=100)
    model = models.CharField(max_length=100)
    serial_number = models.CharField(max_length=100, null=True, blank=True)
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2)
    selling_price = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='in_stock')
    
    # Enforcement tracking
    is_locked = models.BooleanField(default=False)
    last_enforcement_check = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'phones'
        indexes = [
            models.Index(fields=['agent', 'status']),
            models.Index(fields=['imei']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"{self.brand} {self.model} - {self.imei}"


class Sale(models.Model):
    """Sales with constraint: ONE ACTIVE SALE PER PHONE"""
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('defaulted', 'Defaulted'),
        ('cancelled', 'Cancelled'),
    ]
    
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='sales')
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='sales')
    phone = models.ForeignKey(Phone, on_delete=models.PROTECT, related_name='sales')
    staff = models.ForeignKey(AgentStaff, on_delete=models.SET_NULL, null=True, blank=True, related_name='sales')
    
    # Sale terms
    sale_price = models.DecimalField(max_digits=10, decimal_places=2)
    down_payment = models.DecimalField(max_digits=10, decimal_places=2)
    total_payable = models.DecimalField(max_digits=10, decimal_places=2)  # Including interest
    balance_remaining = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Payment schedule
    installment_amount = models.DecimalField(max_digits=10, decimal_places=2)
    installment_frequency = models.CharField(max_length=20, default='weekly')  # weekly, monthly
    number_of_installments = models.IntegerField()
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    sale_date = models.DateTimeField(auto_now_add=True)
    completion_date = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
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
            models.CheckConstraint(
                check=models.Q(sale_price__gt=0) & 
                      models.Q(down_payment__gte=0) & 
                      models.Q(total_payable__gt=0),
                name='positive_sale_amounts'
            ),
            models.CheckConstraint(
                check=models.Q(balance_remaining__gte=0) & 
                      models.Q(balance_remaining__lte=models.F('total_payable')),
                name='valid_balance'
            ),
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
