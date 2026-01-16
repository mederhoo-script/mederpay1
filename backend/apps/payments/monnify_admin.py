"""
Django Admin configuration for Monnify integration models
"""
from django.contrib import admin
from .monnify_models import (
    MonnifyReservedAccount,
    MonnifyWebhookLog,
    WeeklySettlement,
    SettlementPayment
)


@admin.register(MonnifyReservedAccount)
class MonnifyReservedAccountAdmin(admin.ModelAdmin):
    list_display = ('agent', 'account_number', 'bank_name', 'status', 'created_at')
    list_filter = ('status', 'bank_name', 'created_at')
    search_fields = ('agent__business_name', 'account_number', 'account_reference')
    readonly_fields = ('created_at', 'updated_at', 'monnify_created_at')
    
    fieldsets = (
        ('Agent Information', {
            'fields': ('agent',)
        }),
        ('Account Details', {
            'fields': ('account_reference', 'account_number', 'account_name', 'bank_name', 'bank_code')
        }),
        ('Monnify Metadata', {
            'fields': ('reservation_reference', 'collection_channel', 'status')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'monnify_created_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(MonnifyWebhookLog)
class MonnifyWebhookLogAdmin(admin.ModelAdmin):
    list_display = ('event_type', 'transaction_reference', 'amount_paid', 'processed', 'received_at')
    list_filter = ('event_type', 'processed', 'received_at')
    search_fields = ('transaction_reference', 'account_number', 'payment_reference')
    readonly_fields = ('received_at', 'processed_at', 'raw_payload')
    
    fieldsets = (
        ('Webhook Information', {
            'fields': ('event_type', 'transaction_reference', 'received_at')
        }),
        ('Payment Details', {
            'fields': ('account_number', 'amount_paid', 'payment_reference', 'customer_name', 'paid_on')
        }),
        ('Processing Status', {
            'fields': ('processed', 'processed_at', 'processing_error', 'payment_record')
        }),
        ('Raw Data', {
            'fields': ('raw_payload', 'signature'),
            'classes': ('collapse',)
        }),
    )
    
    def has_add_permission(self, request):
        # Webhooks are created automatically, not manually
        return False


@admin.register(WeeklySettlement)
class WeeklySettlementAdmin(admin.ModelAdmin):
    list_display = ('agent', 'week_ending', 'total_amount', 'amount_paid', 'status', 'due_date')
    list_filter = ('status', 'due_date', 'week_ending')
    search_fields = ('agent__business_name', 'invoice_number', 'payment_reference')
    readonly_fields = ('created_at', 'updated_at')
    date_hierarchy = 'week_ending'
    
    fieldsets = (
        ('Agent & Period', {
            'fields': ('agent', 'week_starting', 'week_ending')
        }),
        ('Financial Details', {
            'fields': ('total_amount', 'amount_paid', 'status')
        }),
        ('Payment Information', {
            'fields': ('due_date', 'payment_reference', 'paid_date')
        }),
        ('Additional Details', {
            'fields': ('invoice_number',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_readonly_fields(self, request, obj=None):
        # Make amount_paid readonly after creation
        if obj:
            return self.readonly_fields + ('amount_paid',)
        return self.readonly_fields


@admin.register(SettlementPayment)
class SettlementPaymentAdmin(admin.ModelAdmin):
    list_display = ('settlement', 'amount', 'payment_reference', 'status', 'payment_date')
    list_filter = ('status', 'payment_method', 'payment_date')
    search_fields = ('payment_reference', 'settlement__agent__business_name')
    readonly_fields = ('created_at', 'confirmed_at')
    date_hierarchy = 'payment_date'
    
    fieldsets = (
        ('Settlement Link', {
            'fields': ('settlement',)
        }),
        ('Payment Details', {
            'fields': ('amount', 'payment_reference', 'payment_method', 'status')
        }),
        ('Timestamps', {
            'fields': ('payment_date', 'confirmed_at', 'created_at')
        }),
    )
    
    def has_add_permission(self, request):
        # Payments are created via webhook, not manually
        return False
