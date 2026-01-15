"""MederPay Backend URL Configuration"""
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/auth/', include('apps.platform.urls.auth')),
    path('api/agents/', include('apps.platform.urls.agents')),
    path('api/settlements/', include('apps.platform.urls.settlements')),
    path('api/staff/', include('apps.agents.urls.staff')),
    path('api/phones/', include('apps.agents.urls.phones')),
    path('api/sales/', include('apps.agents.urls.sales')),
    path('api/customers/', include('apps.agents.urls.customers')),
    path('api/payments/', include('apps.payments.urls')),
    path('api/device-commands/', include('apps.enforcement.urls.commands')),
    path('api/enforcement/', include('apps.enforcement.urls.enforcement')),
    path('api/audit/', include('apps.audit.urls')),
    path('api/webhooks/', include('apps.payments.urls_webhooks')),
]
