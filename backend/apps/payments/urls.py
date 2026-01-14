from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PaymentRecordViewSet

router = DefaultRouter()
router.register(r'', PaymentRecordViewSet, basename='payments')

app_name = 'payments'

urlpatterns = [
    path('', include(router.urls)),
]
