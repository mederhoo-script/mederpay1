from django.contrib import admin
from .models import DeviceCommand


@admin.register(DeviceCommand)
class DeviceCommandAdmin(admin.ModelAdmin):
    list_display = ['id', 'phone', 'command', 'status', 'created_at', 'expires_at']
    list_filter = ['command', 'status', 'created_at']
    search_fields = ['phone__imei', 'reason']
