from django.urls import path
from ..views import WeeklySettlementView, ConfirmSettlementPaymentView

app_name = 'settlements'

urlpatterns = [
    # GET /api/settlements/weekly/<imei>/
    path('weekly/<str:imei>/', WeeklySettlementView.as_view(), name='weekly-settlement'),
    
    # POST /api/settlements/<settlement_id>/confirm/
    path('<int:settlement_id>/confirm/', ConfirmSettlementPaymentView.as_view(), name='confirm-payment'),
]
