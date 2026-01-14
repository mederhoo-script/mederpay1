from .base import *

DEBUG = True

# Development-specific settings
DATABASES['default']['ATOMIC_REQUESTS'] = True

# Email backend for development
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
