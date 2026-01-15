from django.db import models
from apps.platform.models import Agent
from apps.agents.models import Sale


# ========================================
# ENUM CHOICES
# ========================================

class PaymentMethod(models.TextChoices):
    MONNIFY = "monnify", "Monnify"
    CASH = "cash", "Cash"
    TRANSFER = "transfer", "Transfer"


class PaymentStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    CONFIRMED = "confirmed", "Confirmed"
    DISPUTED = "disputed", "Disputed"


# ========================================
# PAYMENTS DOMAIN MODELS
# ========================================

class InstallmentSchedule(models.Model):
    """Payment schedules"""
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='installments')
    due_date = models.DateField()
    amount_due = models.DecimalField(max_digits=12, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=20, default='pending')
    
    # Additional useful fields (KEEP THESE)
    installment_number = models.IntegerField(null=True, blank=True)
    paid_date = models.DateField(null=True, blank=True)
    
    class Meta:
        db_table = 'installment_schedules'
        ordering = ['due_date']
        indexes = [
            models.Index(fields=['sale', 'status']),
            models.Index(fields=['due_date']),
        ]
    
    def __str__(self):
        return f"Installment - Sale #{self.sale.id} - Due: {self.due_date}"


class PaymentRecord(models.Model):
    """Immutable payment audit trail (MANDATORY)"""
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='payments')
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='payments')
    installment = models.ForeignKey(
        InstallmentSchedule, 
        null=True, 
        blank=True, 
        on_delete=models.SET_NULL,
        related_name='payments'
    )
    
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices)
    monnify_reference = models.CharField(max_length=255, null=True, blank=True)
    status = models.CharField(max_length=20, choices=PaymentStatus.choices)
    
    balance_before = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    
    # Additional useful fields (KEEP THESE)
    customer = models.ForeignKey('agents.Customer', on_delete=models.PROTECT, related_name='payments', null=True, blank=True)
    payment_date = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    recorded_by = models.ForeignKey('platform.User', on_delete=models.PROTECT, related_name='recorded_payments', null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'payment_records'
        indexes = [
            models.Index(fields=['sale']),
            models.Index(fields=['agent', 'status']),
            models.Index(fields=['installment']),
            models.Index(fields=['monnify_reference']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(amount__gt=0),
                name='positive_payment_amount'
            ),
        ]
    
    def __str__(self):
        return f"Payment #{self.id} - {self.amount} - {self.payment_method}"
