from django.contrib import admin
from .models import AgentStaff, Customer, Phone, Sale


@admin.register(AgentStaff)
class AgentStaffAdmin(admin.ModelAdmin):
    list_display = ['user', 'agent', 'role', 'commission_rate', 'is_active']
    list_filter = ['role', 'is_active']
    search_fields = ['user__username', 'agent__business_name']


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'phone_number', 'agent', 'created_at']
    search_fields = ['full_name', 'phone_number', 'id_number']
    list_filter = ['created_at']


@admin.register(Phone)
class PhoneAdmin(admin.ModelAdmin):
    list_display = ['imei', 'brand', 'model', 'agent', 'status', 'is_locked']
    list_filter = ['status', 'is_locked', 'brand']
    search_fields = ['imei', 'serial_number']


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ['id', 'customer', 'phone', 'agent', 'sale_price', 'balance_remaining', 'status', 'sale_date']
    list_filter = ['status', 'installment_frequency', 'sale_date']
    search_fields = ['customer__full_name', 'phone__imei']
