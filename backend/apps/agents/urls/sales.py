from django.urls import path, include
from rest_framework.routers import DefaultRouter
from ..views import SaleViewSet

router = DefaultRouter()
router.register(r'', SaleViewSet, basename='sales')

app_name = 'sales'

urlpatterns = [
    path('', include(router.urls)),
]
