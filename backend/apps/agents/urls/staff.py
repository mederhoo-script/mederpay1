from django.urls import path, include
from rest_framework.routers import DefaultRouter
from ..views import AgentStaffViewSet

router = DefaultRouter()
router.register(r'', AgentStaffViewSet, basename='staff')

app_name = 'staff'

urlpatterns = [
    path('', include(router.urls)),
]
