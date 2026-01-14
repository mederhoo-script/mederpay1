from rest_framework import serializers
from .models import DeviceCommand, DeviceHealthCheck


class DeviceCommandSerializer(serializers.ModelSerializer):
    phone_imei = serializers.CharField(source='phone.imei', read_only=True)
    
    class Meta:
        model = DeviceCommand
        fields = ['id', 'phone', 'phone_imei', 'command_type', 'status', 
                  'reason', 'issued_at', 'acknowledged_at', 'executed_at', 
                  'expires_at', 'device_response', 'error_message']
        read_only_fields = ['id', 'issued_at', 'acknowledged_at', 'executed_at', 
                           'device_response', 'error_message']


class DeviceHealthCheckSerializer(serializers.ModelSerializer):
    phone_imei = serializers.CharField(source='phone.imei', read_only=True)
    
    class Meta:
        model = DeviceHealthCheck
        fields = ['id', 'phone', 'phone_imei', 'is_device_admin_enabled', 
                  'is_companion_app_installed', 'companion_app_version',
                  'android_version', 'app_version', 'battery_level',
                  'is_locked', 'lock_reason', 'checked_at']
        read_only_fields = ['id', 'checked_at']
