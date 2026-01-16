from rest_framework import serializers
from .models import AgentStaff, Customer, Phone, Sale


class AgentStaffSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentStaff
        fields = ['id', 'full_name', 'role', 'status', 'created_at']
        read_only_fields = ['id', 'created_at']


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id', 'full_name', 'phone_number', 'email', 'address', 
                  'nin', 'bvn', 'created_at']
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {
            'nin': {'required': False, 'allow_blank': True},
            'bvn': {'required': False, 'allow_blank': True},
        }


class PhoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Phone
        fields = ['id', 'imei', 'model', 'platform_registry', 
                  'locking_app_installed', 'lifecycle_status',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class SaleSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    phone_model = serializers.CharField(source='phone.model', read_only=True)
    staff_name = serializers.CharField(source='sold_by.full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = Sale
        fields = ['id', 'customer', 'customer_name', 'phone', 'phone_model',
                  'sold_by', 'staff_name', 'sale_price', 'down_payment',
                  'total_payable', 'balance_remaining', 'status', 'created_at']
        read_only_fields = ['id', 'created_at']
    
    def validate(self, data):
        # Check for active sale on this phone
        phone = data.get('phone')
        if phone:
            existing_sale = Sale.objects.filter(phone=phone, status='active').exists()
            if existing_sale:
                raise serializers.ValidationError({'phone': 'This phone already has an active sale'})
        
        return data
