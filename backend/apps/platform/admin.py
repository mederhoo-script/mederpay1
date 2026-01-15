from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Agent, PlatformPhoneRegistry, AgentBilling


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'role', 'is_active', 'created_at']
    list_filter = ['role', 'is_active']
    search_fields = ['email']
    ordering = ['email']
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Permissions', {'fields': ('role', 'is_active', 'is_staff', 'is_superuser')}),
        ('Dates', {'fields': ('created_at', 'updated_at')}),
    )
    readonly_fields = ['created_at', 'updated_at']
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'role'),
        }),
    )


@admin.register(Agent)
class AgentAdmin(admin.ModelAdmin):
    list_display = ['business_name', 'user', 'status', 'credit_limit', 'risk_score', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['business_name', 'user__email']


@admin.register(PlatformPhoneRegistry)
class PlatformPhoneRegistryAdmin(admin.ModelAdmin):
    list_display = ['imei', 'is_blacklisted', 'created_at', 'first_registered_agent', 'current_agent']
    list_filter = ['is_blacklisted']
    search_fields = ['imei']


@admin.register(AgentBilling)
class AgentBillingAdmin(admin.ModelAdmin):
    list_display = ['agent', 'invoice_number', 'total_amount_due', 'billing_period_start', 'status']
    list_filter = ['status', 'billing_period_start']
    search_fields = ['agent__business_name', 'invoice_number']
