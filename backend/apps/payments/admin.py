from django.contrib import admin
from .models import PaymentRecord, InstallmentSchedule


@admin.register(PaymentRecord)
class PaymentRecordAdmin(admin.ModelAdmin):
    list_display = ['id', 'sale', 'agent', 'amount', 'payment_method', 'status', 'created_at']
    list_filter = ['status', 'payment_method', 'created_at']
    search_fields = ['sale__customer__full_name', 'monnify_reference']


@admin.register(InstallmentSchedule)
class InstallmentScheduleAdmin(admin.ModelAdmin):
    list_display = ['sale', 'amount_due', 'due_date', 'paid_amount', 'status']
    list_filter = ['status', 'due_date']
    search_fields = ['sale__customer__full_name']
