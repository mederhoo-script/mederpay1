"""
Serializers for device audit log API
"""
from rest_framework import serializers


class DeviceAuditLogSerializer(serializers.Serializer):
    """Serializer for single device audit log"""
    device_id = serializers.CharField(max_length=255, required=True)
    event = serializers.CharField(max_length=100, required=True)
    timestamp = serializers.DateTimeField(required=False)
    data = serializers.JSONField(required=False, default=dict)


class BatchDeviceAuditLogSerializer(serializers.Serializer):
    """Serializer for batch device audit log upload"""
    device_id = serializers.CharField(max_length=255, required=True)
    app_version = serializers.CharField(max_length=50, required=False)
    logs = serializers.ListField(
        child=DeviceAuditLogSerializer(),
        required=True,
        min_length=1
    )
