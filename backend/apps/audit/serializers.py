from rest_framework import serializers
from .models import PlatformAuditLog, AgentAuditLog


class PlatformAuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True, allow_null=True)
    
    class Meta:
        model = PlatformAuditLog
        fields = ['id', 'user', 'user_email', 'action', 'entity_type', 
                  'entity_id', 'metadata', 'created_at']
        read_only_fields = ['id', 'created_at']


class AgentAuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.full_name', read_only=True, allow_null=True)
    agent_name = serializers.CharField(source='agent.business_name', read_only=True)
    
    class Meta:
        model = AgentAuditLog
        fields = ['id', 'agent', 'agent_name', 'actor', 'actor_name', 
                  'action', 'entity_type', 'entity_id', 'metadata', 'created_at']
        read_only_fields = ['id', 'created_at']
