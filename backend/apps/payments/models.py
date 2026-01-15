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
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE)
    due_date = models.DateField()
    amount_due = models.DecimalField(max_digits=12, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=20, default='pending')
    
    class Meta:
        db_table = 'installment_schedules'
        indexes = [
            models.Index(fields=['sale', 'status']),
            models.Index(fields=['due_date']),
            models.Index(fields=['status', 'due_date']),
        ]
    
    def __str__(self):
        return f"Installment - Sale #{self.sale.id}"


class PaymentRecord(models.Model):
    """Immutable payment audit trail (MANDATORY)"""
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE)
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE)
    installment = models.ForeignKey(
        InstallmentSchedule, null=True, blank=True, on_delete=models.SET_NULL
    )
    
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(
        max_length=20, choices=PaymentMethod.choices
    )
    monnify_reference = models.CharField(max_length=255, null=True)
    status = models.CharField(max_length=20, choices=PaymentStatus.choices)
    
    balance_before = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'payment_records'
        indexes = [
            models.Index(fields=['sale']),
            models.Index(fields=['agent', 'status']),
            models.Index(fields=['monnify_reference']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"Payment #{self.id} - {self.amount} - {self.payment_method}"
