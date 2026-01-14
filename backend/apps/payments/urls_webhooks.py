from django.urls import path
from .views import MonnifyWebhookView

app_name = 'webhooks'

urlpatterns = [
    path('monnify/', MonnifyWebhookView.as_view(), name='monnify'),
]
