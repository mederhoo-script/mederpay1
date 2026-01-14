from django.contrib import admin
from .models import User, Agent, PlatformPhoneRegistry, AgentBilling


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['username', 'email', 'role', 'is_active', 'date_joined']
    list_filter = ['role', 'is_active']
    search_fields = ['username', 'email', 'phone_number']


@admin.register(Agent)
class AgentAdmin(admin.ModelAdmin):
    list_display = ['business_name', 'user', 'status', 'credit_limit', 'credit_used', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['business_name', 'user__username']


@admin.register(PlatformPhoneRegistry)
class PlatformPhoneRegistryAdmin(admin.ModelAdmin):
    list_display = ['imei', 'status', 'registered_at']
    list_filter = ['status']
    search_fields = ['imei']


@admin.register(AgentBilling)
class AgentBillingAdmin(admin.ModelAdmin):
    list_display = ['agent', 'billing_type', 'amount', 'due_date', 'status']
    list_filter = ['billing_type', 'status', 'due_date']
    search_fields = ['agent__business_name']
