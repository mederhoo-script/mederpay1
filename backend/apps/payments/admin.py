from django.contrib import admin
from .models import PaymentRecord, InstallmentSchedule


@admin.register(PaymentRecord)
class PaymentRecordAdmin(admin.ModelAdmin):
    list_display = ['id', 'sale', 'customer', 'amount', 'payment_method', 'status', 'payment_date']
    list_filter = ['status', 'payment_method', 'payment_date']
    search_fields = ['customer__full_name', 'monnify_transaction_reference']


@admin.register(InstallmentSchedule)
class InstallmentScheduleAdmin(admin.ModelAdmin):
    list_display = ['sale', 'installment_number', 'amount', 'due_date', 'status']
    list_filter = ['status', 'due_date']
    search_fields = ['sale__customer__full_name']
