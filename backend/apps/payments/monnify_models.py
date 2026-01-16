"""
Monnify Integration Models
Handles reserved accounts and payment processing via Monnify
"""
from django.db import models
from apps.platform.models import Agent


class MonnifyReservedAccount(models.Model):
    """
    Stores Monnify reserved account details for each agent
    Created during agent onboarding via Monnify API
    """
    agent = models.OneToOneField(
        Agent,
        on_delete=models.CASCADE,
        related_name='monnify_reserved_account'
    )
    
    # Account details from Monnify
    account_reference = models.CharField(max_length=100, unique=True, db_index=True)
    account_number = models.CharField(max_length=20, db_index=True)
    account_name = models.CharField(max_length=255)
    bank_name = models.CharField(max_length=100)
    bank_code = models.CharField(max_length=10)
    
    # Monnify metadata
    reservation_reference = models.CharField(max_length=100, unique=True)
    collection_channel = models.CharField(max_length=50, default='RESERVED_ACCOUNT')
    status = models.CharField(max_length=20, default='ACTIVE')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Track when account was created in Monnify
    monnify_created_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'monnify_reserved_accounts'
        indexes = [
            models.Index(fields=['agent']),
            models.Index(fields=['account_number']),
            models.Index(fields=['account_reference']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"{self.agent.business_name} - {self.account_number}"


class MonnifyWebhookLog(models.Model):
    """
    Logs all webhook events from Monnify for audit and debugging
    """
    # Webhook identification
    event_type = models.CharField(max_length=100, db_index=True)
    transaction_reference = models.CharField(max_length=255, db_index=True)
    
    # Payment details
    account_number = models.CharField(max_length=20, db_index=True, null=True, blank=True)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    payment_reference = models.CharField(max_length=255, null=True, blank=True)
    customer_name = models.CharField(max_length=255, null=True, blank=True)
    
    # Webhook metadata
    paid_on = models.DateTimeField(null=True, blank=True)
    raw_payload = models.JSONField()  # Store complete webhook data
    signature = models.TextField(null=True, blank=True)
    
    # Processing status
    processed = models.BooleanField(default=False)
    processed_at = models.DateTimeField(null=True, blank=True)
    processing_error = models.TextField(null=True, blank=True)
    
    # Link to payment record if created
    payment_record = models.ForeignKey(
        'PaymentRecord',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='monnify_webhooks'
    )
    
    # Timestamps
    received_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'monnify_webhook_logs'
        ordering = ['-received_at']
        indexes = [
            models.Index(fields=['event_type', 'received_at']),
            models.Index(fields=['transaction_reference']),
            models.Index(fields=['account_number']),
            models.Index(fields=['processed']),
        ]
    
    def __str__(self):
        return f"{self.event_type} - {self.transaction_reference}"


class WeeklySettlement(models.Model):
    """
    Weekly settlement tracking for agents
    Enforced via mobile app payment overlay
    """
    agent = models.ForeignKey(
        Agent,
        on_delete=models.CASCADE,
        related_name='weekly_settlements'
    )
    
    # Settlement period
    week_starting = models.DateField(db_index=True)
    week_ending = models.DateField(db_index=True)
    
    # Financial details
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=[
            ('PENDING', 'Pending'),
            ('PARTIAL', 'Partially Paid'),
            ('PAID', 'Paid'),
            ('OVERDUE', 'Overdue'),
        ],
        default='PENDING',
        db_index=True
    )
    
    # Due date for payment
    due_date = models.DateField()
    
    # Payment tracking
    payment_reference = models.CharField(max_length=255, null=True, blank=True)
    paid_date = models.DateTimeField(null=True, blank=True)
    
    # Invoice details
    invoice_number = models.CharField(max_length=100, unique=True, null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'weekly_settlements'
        ordering = ['-week_ending']
        indexes = [
            models.Index(fields=['agent', 'status']),
            models.Index(fields=['week_ending']),
            models.Index(fields=['due_date']),
            models.Index(fields=['status']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['agent', 'week_ending'],
                name='unique_agent_week'
            ),
        ]
    
    def __str__(self):
        return f"{self.agent.business_name} - Week ending {self.week_ending}"
    
    @property
    def is_overdue(self):
        """Check if settlement is overdue"""
        from django.utils import timezone
        return self.status == 'PENDING' and self.due_date < timezone.now().date()


class SettlementPayment(models.Model):
    """
    Individual payments made towards a weekly settlement
    Links to PaymentRecord for audit trail
    """
    settlement = models.ForeignKey(
        WeeklySettlement,
        on_delete=models.CASCADE,
        related_name='payments'
    )
    
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_reference = models.CharField(max_length=255, unique=True, db_index=True)
    payment_method = models.CharField(max_length=50, default='BANK_TRANSFER')
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=[
            ('PENDING', 'Pending'),
            ('CONFIRMED', 'Confirmed'),
            ('FAILED', 'Failed'),
        ],
        default='PENDING'
    )
    
    # Timestamps
    payment_date = models.DateTimeField()
    confirmed_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'settlement_payments'
        ordering = ['-payment_date']
        indexes = [
            models.Index(fields=['settlement']),
            models.Index(fields=['payment_reference']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"Payment {self.payment_reference} - {self.amount}"
