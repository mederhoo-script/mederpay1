from rest_framework import serializers
from .models import AgentStaff, Customer, Phone, Sale
from apps.platform.models import User


class AgentStaffSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    
    class Meta:
        model = AgentStaff
        fields = ['id', 'user', 'user_username', 'user_email', 'role', 
                  'commission_rate', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id', 'full_name', 'phone_number', 'email', 'address', 
                  'id_type', 'id_number', 'photo_url', 'created_at']
        read_only_fields = ['id', 'created_at']


class PhoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Phone
        fields = ['id', 'imei', 'brand', 'model', 'serial_number', 
                  'purchase_price', 'selling_price', 'status', 'is_locked',
                  'last_enforcement_check', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_locked', 
                           'last_enforcement_check']


class SaleSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    phone_model = serializers.CharField(source='phone.model', read_only=True)
    phone_brand = serializers.CharField(source='phone.brand', read_only=True)
    staff_name = serializers.CharField(source='staff.user.username', read_only=True, allow_null=True)
    
    class Meta:
        model = Sale
        fields = ['id', 'customer', 'customer_name', 'phone', 'phone_brand', 
                  'phone_model', 'staff', 'staff_name', 'sale_price', 'down_payment',
                  'total_payable', 'balance_remaining', 'installment_amount',
                  'installment_frequency', 'number_of_installments', 'status',
                  'sale_date', 'completion_date', 'created_at']
        read_only_fields = ['id', 'sale_date', 'completion_date', 'created_at']
    
    def validate(self, data):
        # Ensure phone is available for sale
        phone = data.get('phone')
        if phone and phone.status != 'in_stock':
            raise serializers.ValidationError({'phone': 'Phone is not available for sale'})
        
        # Check for active sale on this phone
        if phone:
            existing_sale = Sale.objects.filter(phone=phone, status='active').exists()
            if existing_sale:
                raise serializers.ValidationError({'phone': 'This phone already has an active sale'})
        
        return data
