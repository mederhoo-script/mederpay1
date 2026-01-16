"""
Webhook URL patterns for Monnify
Separate file for webhook endpoints
"""
from django.urls import path
from . import monnify_views

urlpatterns = [
    # Monnify webhook endpoint
    path('monnify/', monnify_views.monnify_webhook, name='monnify_webhook'),
]
