from django.db import models
from django.utils import timezone
from datetime import timedelta
from apps.agents.models import Phone
from apps.platform.models import Agent


class DeviceCommand(models.Model):
    """Tamper-proof device lock/unlock commands"""
    COMMAND_CHOICES = [
        ('lock', 'Lock'),
        ('unlock', 'Unlock'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('acknowledged', 'Acknowledged'),
        ('executed', 'Executed'),
        ('failed', 'Failed'),
        ('expired', 'Expired'),
    ]
    
    phone = models.ForeignKey(Phone, on_delete=models.CASCADE, related_name='commands')
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='device_commands')
    
    command_type = models.CharField(max_length=10, choices=COMMAND_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Command metadata
    reason = models.TextField()
    issued_by = models.ForeignKey('platform.User', on_delete=models.PROTECT, related_name='issued_commands')
    
    # Execution tracking
    issued_at = models.DateTimeField(auto_now_add=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    executed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()
    
    # Device response
    device_response = models.TextField(null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'device_commands'
        indexes = [
            models.Index(fields=['phone', 'status']),
            models.Index(fields=['status']),
            models.Index(fields=['expires_at']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.command_type.upper()} - {self.phone.imei} - {self.status}"
    
    def save(self, *args, **kwargs):
        """Set expiration time if not set"""
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=24)
        super().save(*args, **kwargs)
    
    def is_expired(self):
        """Check if command has expired"""
        return timezone.now() > self.expires_at and self.status in ['pending', 'sent']


class DeviceHealthCheck(models.Model):
    """Device health check records"""
    phone = models.ForeignKey(Phone, on_delete=models.CASCADE, related_name='health_checks')
    
    # Device status
    is_device_admin_enabled = models.BooleanField(default=False)
    is_companion_app_installed = models.BooleanField(default=False)
    companion_app_version = models.CharField(max_length=20, null=True, blank=True)
    
    # System info
    android_version = models.CharField(max_length=10)
    app_version = models.CharField(max_length=20)
    battery_level = models.IntegerField(null=True, blank=True)
    
    # Enforcement status
    is_locked = models.BooleanField(default=False)
    lock_reason = models.TextField(null=True, blank=True)
    
    checked_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'device_health_checks'
        indexes = [
            models.Index(fields=['phone', 'checked_at']),
            models.Index(fields=['checked_at']),
        ]
        ordering = ['-checked_at']
    
    def __str__(self):
        return f"Health Check - {self.phone.imei} - {self.checked_at}"
