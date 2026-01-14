from django.contrib import admin
from .models import PlatformAuditLog, AgentAuditLog


@admin.register(PlatformAuditLog)
class PlatformAuditLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'action', 'resource_type', 'resource_id', 'timestamp']
    list_filter = ['action', 'resource_type', 'timestamp']
    search_fields = ['user__username', 'resource_id']
    readonly_fields = ['user', 'action', 'resource_type', 'resource_id', 'changes', 'timestamp']


@admin.register(AgentAuditLog)
class AgentAuditLogAdmin(admin.ModelAdmin):
    list_display = ['agent', 'user', 'action', 'resource_type', 'timestamp']
    list_filter = ['action', 'resource_type', 'timestamp']
    search_fields = ['agent__business_name', 'user__username', 'resource_id']
    readonly_fields = ['agent', 'user', 'action', 'resource_type', 'resource_id', 'description', 'changes', 'timestamp']
