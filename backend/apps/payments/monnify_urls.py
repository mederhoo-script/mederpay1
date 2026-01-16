"""
URL patterns for Monnify integration
"""
from django.urls import path
from . import monnify_views

urlpatterns = [
    # Mobile app endpoint to get reserved account details
    path('monnify/reserved-account/<str:imei>/', monnify_views.get_reserved_account, name='get_reserved_account'),
    
    # Mobile app endpoint to check settlement status
    path('settlements/weekly/<str:imei>/', monnify_views.get_weekly_settlement, name='get_weekly_settlement'),
]
