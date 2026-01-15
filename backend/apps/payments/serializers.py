from rest_framework import serializers
from .models import PaymentRecord, InstallmentSchedule


class PaymentRecordSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='sale.customer.full_name', read_only=True)
    
    class Meta:
        model = PaymentRecord
        fields = ['id', 'sale', 'installment', 'customer_name', 'amount', 
                  'payment_method', 'balance_before', 'balance_after',
                  'monnify_reference', 'status', 'created_at']
        read_only_fields = ['id', 'balance_before', 'balance_after', 'created_at']


class InstallmentScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstallmentSchedule
        fields = ['id', 'sale', 'amount_due', 'due_date', 
                  'paid_amount', 'status']
        read_only_fields = ['id']
