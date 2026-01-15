from django.contrib import admin
from .models import AgentStaff, Customer, Phone, Sale


@admin.register(AgentStaff)
class AgentStaffAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'agent', 'role', 'status']
    list_filter = ['role', 'status']
    search_fields = ['full_name', 'agent__business_name']


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'phone_number', 'agent', 'created_at']
    search_fields = ['full_name', 'phone_number']
    list_filter = ['created_at']


@admin.register(Phone)
class PhoneAdmin(admin.ModelAdmin):
    list_display = ['imei', 'model', 'agent', 'lifecycle_status', 'locking_app_installed']
    list_filter = ['lifecycle_status', 'locking_app_installed']
    search_fields = ['imei']


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ['id', 'customer', 'phone', 'agent', 'sale_price', 'balance_remaining', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['customer__full_name', 'phone__imei']
