from django.contrib import admin
from .models import DeviceCommand, DeviceHealthCheck


@admin.register(DeviceCommand)
class DeviceCommandAdmin(admin.ModelAdmin):
    list_display = ['id', 'phone', 'command_type', 'status', 'issued_at', 'expires_at']
    list_filter = ['command_type', 'status', 'issued_at']
    search_fields = ['phone__imei', 'reason']


@admin.register(DeviceHealthCheck)
class DeviceHealthCheckAdmin(admin.ModelAdmin):
    list_display = ['phone', 'is_device_admin_enabled', 'is_companion_app_installed', 'is_locked', 'checked_at']
    list_filter = ['is_device_admin_enabled', 'is_companion_app_installed', 'is_locked', 'checked_at']
    search_fields = ['phone__imei']
