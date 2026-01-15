from django.contrib import admin
from .models import PlatformAuditLog, AgentAuditLog


@admin.register(PlatformAuditLog)
class PlatformAuditLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'action', 'entity_type', 'entity_id', 'created_at']
    list_filter = ['entity_type', 'created_at']
    search_fields = ['user__email', 'action']
    readonly_fields = ['user', 'action', 'entity_type', 'entity_id', 'metadata', 'created_at']


@admin.register(AgentAuditLog)
class AgentAuditLogAdmin(admin.ModelAdmin):
    list_display = ['agent', 'actor', 'action', 'entity_type', 'created_at']
    list_filter = ['entity_type', 'created_at']
    search_fields = ['agent__business_name', 'actor__full_name', 'action']
    readonly_fields = ['agent', 'actor', 'action', 'entity_type', 'entity_id', 'metadata', 'created_at']
