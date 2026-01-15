from django.db import models
from apps.platform.models import User, Agent
from apps.agents.models import AgentStaff


# ========================================
# AUDIT DOMAIN MODELS
# ========================================

class PlatformAuditLog(models.Model):
    """Platform-level audit trail"""
    user = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name='platform_audit_logs')
    action = models.TextField()
    entity_type = models.CharField(max_length=100, null=True, blank=True)
    entity_id = models.BigIntegerField(null=True, blank=True)
    metadata = models.JSONField(default=dict)
    
    # Additional useful fields (KEEP THESE)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'platform_audit_logs'
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['entity_type', 'entity_id']),
            models.Index(fields=['created_at']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.action} - {self.entity_type} - {self.created_at}"


class AgentAuditLog(models.Model):
    """Agent-level audit trail"""
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='audit_logs')
    actor = models.ForeignKey(
        AgentStaff, 
        null=True, 
        on_delete=models.SET_NULL,
        related_name='audit_actions'
    )
    action = models.TextField()
    entity_type = models.CharField(max_length=100)
    entity_id = models.BigIntegerField()
    metadata = models.JSONField(default=dict)
    
    # Additional useful fields (KEEP THESE)
    description = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'agent_audit_logs'
        indexes = [
            models.Index(fields=['agent', 'created_at']),
            models.Index(fields=['actor', 'created_at']),
            models.Index(fields=['entity_type', 'entity_id']),
            models.Index(fields=['created_at']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.agent.business_name} - {self.action}"
