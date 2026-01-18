"""
Sentry monitoring configuration for production error tracking

Install: pip install sentry-sdk

Usage in settings.py:
    from config.sentry_config import configure_sentry
    configure_sentry()
"""

import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
import logging
import os


def configure_sentry():
    """
    Configure Sentry for production monitoring
    
    Environment variables required:
    - SENTRY_DSN: Your Sentry project DSN
    - SENTRY_ENVIRONMENT: Environment name (production, staging, development)
    - SENTRY_RELEASE: Release version (optional, uses git commit if available)
    """
    sentry_dsn = os.environ.get('SENTRY_DSN')
    
    if not sentry_dsn:
        print("⚠️  SENTRY_DSN not configured. Sentry monitoring disabled.")
        return
    
    environment = os.environ.get('SENTRY_ENVIRONMENT', 'production')
    release = os.environ.get('SENTRY_RELEASE', get_git_release())
    
    # Configure Sentry
    sentry_sdk.init(
        dsn=sentry_dsn,
        environment=environment,
        release=release,
        
        # Integrations
        integrations=[
            DjangoIntegration(
                transaction_style='url',  # Track by URL pattern
                middleware_spans=True,    # Track middleware performance
                signals_spans=True,       # Track Django signals
            ),
            LoggingIntegration(
                level=logging.INFO,       # Capture info and above
                event_level=logging.ERROR # Send errors as events
            ),
        ],
        
        # Performance monitoring
        traces_sample_rate=0.1,  # Sample 10% of transactions for performance
        
        # Error filtering
        before_send=before_send_filter,
        
        # Additional options
        send_default_pii=False,  # Don't send personally identifiable information
        attach_stacktrace=True,  # Always attach stack traces
        max_breadcrumbs=50,      # Keep last 50 breadcrumbs
        
        # Release health tracking
        enable_tracing=True,
    )
    
    print(f"✅ Sentry monitoring initialized (env: {environment}, release: {release})")


def before_send_filter(event, hint):
    """
    Filter events before sending to Sentry
    
    Use this to:
    - Exclude certain exceptions
    - Scrub sensitive data
    - Add custom tags
    """
    # Exclude common exceptions that are not actionable
    if 'exc_info' in hint:
        exc_type, exc_value, tb = hint['exc_info']
        
        # Don't report Django's DisallowedHost errors
        if exc_type.__name__ == 'DisallowedHost':
            return None
        
        # Don't report HTTP 404 errors
        if exc_type.__name__ == 'Http404':
            return None
    
    # Add custom tags
    if 'request' in event:
        request = event['request']
        
        # Tag agent vs admin requests
        if 'user' in event.get('extra', {}):
            user = event['extra']['user']
            if hasattr(user, 'agent_profile'):
                event.setdefault('tags', {})['user_type'] = 'agent'
            elif user.is_staff:
                event.setdefault('tags', {})['user_type'] = 'admin'
    
    return event


def get_git_release():
    """
    Get current git commit hash for release tracking
    """
    try:
        import subprocess
        result = subprocess.run(
            ['git', 'rev-parse', '--short', 'HEAD'],
            capture_output=True,
            text=True,
            timeout=1
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    
    return 'unknown'


def capture_exception_with_context(exception, context=None):
    """
    Capture exception with additional context
    
    Usage:
        try:
            process_payment()
        except Exception as e:
            capture_exception_with_context(e, {
                'agent_id': agent.id,
                'settlement_id': settlement.id
            })
    """
    if context:
        with sentry_sdk.push_scope() as scope:
            for key, value in context.items():
                scope.set_extra(key, value)
            sentry_sdk.capture_exception(exception)
    else:
        sentry_sdk.capture_exception(exception)


def capture_message_with_context(message, level='info', context=None):
    """
    Capture custom message with context
    
    Usage:
        capture_message_with_context(
            'Settlement payment overdue',
            level='warning',
            context={'agent_id': agent.id, 'days_overdue': 5}
        )
    """
    if context:
        with sentry_sdk.push_scope() as scope:
            for key, value in context.items():
                scope.set_extra(key, value)
            sentry_sdk.capture_message(message, level=level)
    else:
        sentry_sdk.capture_message(message, level=level)
