from rest_framework import serializers
from .models import PlatformAuditLog, AgentAuditLog


class PlatformAuditLogSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = PlatformAuditLog
        fields = ['id', 'user', 'user_username', 'action', 'resource_type', 
                  'resource_id', 'changes', 'ip_address', 'timestamp']
        read_only_fields = ['id', 'timestamp']


class AgentAuditLogSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source='user.username', read_only=True)
    agent_name = serializers.CharField(source='agent.business_name', read_only=True)
    
    class Meta:
        model = AgentAuditLog
        fields = ['id', 'agent', 'agent_name', 'user', 'user_username', 
                  'action', 'resource_type', 'resource_id', 'description', 
                  'changes', 'timestamp']
        read_only_fields = ['id', 'timestamp']
