from django.urls import path
from ..views import EnforcementStatusView, HealthCheckView

app_name = 'enforcement'

urlpatterns = [
    path('status/<str:imei>/', EnforcementStatusView.as_view(), name='status'),
    path('health-check/', HealthCheckView.as_view(), name='health-check'),
]
