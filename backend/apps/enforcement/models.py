from django.db import models
from django.utils import timezone
from datetime import timedelta
from apps.agents.models import Phone, AgentStaff, Sale
from apps.platform.models import Agent


# ========================================
# ENUM CHOICES
# ========================================

class DeviceCommandType(models.TextChoices):
    LOCK = "lock", "Lock"
    UNLOCK = "unlock", "Unlock"


class DeviceCommandStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    SENT = "sent", "Sent"
    ACKNOWLEDGED = "acknowledged", "Acknowledged"
    EXECUTED = "executed", "Executed"
    FAILED = "failed", "Failed"


# ========================================
# ENFORCEMENT DOMAIN MODELS
# ========================================

class DeviceCommand(models.Model):
    """Tamper-proof device lock/unlock commands (MANDATORY)"""
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='device_commands')
    phone = models.ForeignKey(Phone, on_delete=models.CASCADE, related_name='commands')
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='commands')
    
    command = models.CharField(max_length=10, choices=DeviceCommandType.choices)
    reason = models.CharField(max_length=50)
    
    auth_token_hash = models.TextField()
    expires_at = models.DateTimeField()
    
    status = models.CharField(
        max_length=20, 
        choices=DeviceCommandStatus.choices, 
        default=DeviceCommandStatus.PENDING
    )
    
    issued_by = models.ForeignKey(
        AgentStaff, 
        null=True, 
        on_delete=models.SET_NULL,
        related_name='issued_commands'
    )
    
    # Additional useful fields (KEEP THESE)
    issued_at = models.DateTimeField(auto_now_add=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    device_response = models.TextField(null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    executed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'device_commands'
        indexes = [
            models.Index(fields=['phone', 'status']),
            models.Index(fields=['sale']),
            models.Index(fields=['expires_at']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.command.upper()} - {self.phone.imei} - {self.status}"
    
    def save(self, *args, **kwargs):
        # Auto-generate auth_token_hash if not set
        if not self.auth_token_hash:
            import secrets
            import hashlib
            token = secrets.token_urlsafe(32)
            self.auth_token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        # Set expiration if not set
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=24)
        
        super().save(*args, **kwargs)
    
    def is_expired(self):
        """Check if command has expired"""
        return timezone.now() > self.expires_at and self.status in ['pending', 'sent']
