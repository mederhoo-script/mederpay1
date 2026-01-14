from django.urls import path
from ..views import AgentProfileView, AgentDashboardView

app_name = 'agents'

urlpatterns = [
    path('me/', AgentProfileView.as_view(), name='profile'),
    path('dashboard/', AgentDashboardView.as_view(), name='dashboard'),
]
