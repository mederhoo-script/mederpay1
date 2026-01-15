from django.db import models
from apps.platform.models import User, Agent
from apps.agents.models import AgentStaff


# ========================================
# AUDIT DOMAIN MODELS
# ========================================

class PlatformAuditLog(models.Model):
    """Platform-level audit trail"""
    user = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    action = models.TextField()
    entity_type = models.CharField(max_length=100, null=True)
    entity_id = models.BigIntegerField(null=True)
    metadata = models.JSONField(default=dict)
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
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE)
    actor = models.ForeignKey(
        AgentStaff, null=True, on_delete=models.SET_NULL
    )
    action = models.TextField()
    entity_type = models.CharField(max_length=100)
    entity_id = models.BigIntegerField()
    metadata = models.JSONField(default=dict)
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
