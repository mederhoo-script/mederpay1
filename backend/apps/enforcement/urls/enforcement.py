from django.urls import path
from ..views import EnforcementStatusView

app_name = 'enforcement'

urlpatterns = [
    path('status/<str:imei>/', EnforcementStatusView.as_view(), name='status'),
]
