from django.db import models
from apps.platform.models import User, Agent


class PlatformAuditLog(models.Model):
    """Platform-level audit trail"""
    ACTION_CHOICES = [
        ('create', 'Create'),
        ('update', 'Update'),
        ('delete', 'Delete'),
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('access', 'Access'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='platform_audit_logs')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    resource_type = models.CharField(max_length=100)  # e.g., "Agent", "User"
    resource_id = models.CharField(max_length=100, null=True, blank=True)
    
    # Audit details
    changes = models.JSONField(null=True, blank=True)  # Before/after values
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'platform_audit_logs'
        indexes = [
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['resource_type', 'resource_id']),
            models.Index(fields=['action']),
            models.Index(fields=['timestamp']),
        ]
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"{self.action} - {self.resource_type} - {self.timestamp}"


class AgentAuditLog(models.Model):
    """Agent-level audit trail"""
    ACTION_CHOICES = [
        ('create', 'Create'),
        ('update', 'Update'),
        ('delete', 'Delete'),
        ('sale', 'Sale'),
        ('payment', 'Payment'),
        ('command', 'Device Command'),
    ]
    
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='audit_logs')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='agent_audit_logs')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    resource_type = models.CharField(max_length=100)  # e.g., "Phone", "Sale", "Payment"
    resource_id = models.CharField(max_length=100, null=True, blank=True)
    
    # Audit details
    description = models.TextField()
    changes = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'agent_audit_logs'
        indexes = [
            models.Index(fields=['agent', 'timestamp']),
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['resource_type', 'resource_id']),
            models.Index(fields=['action']),
            models.Index(fields=['timestamp']),
        ]
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"{self.agent.business_name} - {self.action} - {self.resource_type}"
