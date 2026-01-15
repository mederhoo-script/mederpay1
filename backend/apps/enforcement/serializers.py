from rest_framework import serializers
from .models import DeviceCommand


class DeviceCommandSerializer(serializers.ModelSerializer):
    phone_imei = serializers.CharField(source='phone.imei', read_only=True)
    
    class Meta:
        model = DeviceCommand
        fields = ['id', 'phone', 'phone_imei', 'sale', 'command', 'status', 
                  'reason', 'auth_token_hash', 'expires_at', 'issued_by',
                  'created_at', 'executed_at']
        read_only_fields = ['id', 'created_at', 'executed_at']
