from rest_framework import serializers
from .models import PaymentRecord, InstallmentSchedule


class PaymentRecordSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    
    class Meta:
        model = PaymentRecord
        fields = ['id', 'sale', 'customer', 'customer_name', 'amount', 
                  'payment_method', 'balance_before', 'balance_after',
                  'monnify_transaction_reference', 'status', 'payment_date',
                  'notes', 'created_at']
        read_only_fields = ['id', 'balance_before', 'balance_after', 'created_at', 'payment_date']


class InstallmentScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstallmentSchedule
        fields = ['id', 'sale', 'installment_number', 'amount', 'due_date', 
                  'paid_date', 'status', 'created_at']
        read_only_fields = ['id', 'created_at']
