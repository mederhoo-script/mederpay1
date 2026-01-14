from django.db import models
from apps.platform.models import Agent
from apps.agents.models import Sale, Customer


class PaymentRecord(models.Model):
    """Immutable payment audit trail"""
    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('transfer', 'Bank Transfer'),
        ('monnify', 'Monnify'),
        ('card', 'Card'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('reversed', 'Reversed'),
    ]
    
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='payments')
    sale = models.ForeignKey(Sale, on_delete=models.PROTECT, related_name='payments')
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='payments')
    
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    
    # Balance tracking
    balance_before = models.DecimalField(max_digits=10, decimal_places=2)
    balance_after = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Monnify specific
    monnify_transaction_reference = models.CharField(max_length=255, null=True, blank=True, unique=True)
    monnify_payment_reference = models.CharField(max_length=255, null=True, blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    payment_date = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    
    notes = models.TextField(null=True, blank=True)
    recorded_by = models.ForeignKey('platform.User', on_delete=models.PROTECT, related_name='recorded_payments')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'payment_records'
        indexes = [
            models.Index(fields=['sale']),
            models.Index(fields=['agent', 'status']),
            models.Index(fields=['monnify_transaction_reference']),
            models.Index(fields=['payment_date']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(amount__gt=0),
                name='positive_payment_amount'
            ),
        ]
    
    def __str__(self):
        return f"Payment #{self.id} - {self.amount} - {self.payment_method}"


class InstallmentSchedule(models.Model):
    """Payment schedules"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
        ('waived', 'Waived'),
    ]
    
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='installments')
    installment_number = models.IntegerField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    due_date = models.DateField()
    paid_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'installment_schedules'
        ordering = ['installment_number']
        indexes = [
            models.Index(fields=['sale', 'status']),
            models.Index(fields=['due_date']),
            models.Index(fields=['status', 'due_date']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['sale', 'installment_number'],
                name='unique_installment_per_sale'
            ),
        ]
    
    def __str__(self):
        return f"Installment #{self.installment_number} - Sale #{self.sale.id}"
