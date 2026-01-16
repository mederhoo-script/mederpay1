"""
Audit logging middleware for automatic tracking of all model changes.

This middleware captures all POST, PUT, PATCH, and DELETE requests
and logs them to the appropriate audit log table.
"""

import json
from django.utils.deprecation import MiddlewareMixin
from django.contrib.contenttypes.models import ContentType
from apps.audit.models import PlatformAuditLog, AgentAuditLog


class AuditLoggingMiddleware(MiddlewareMixin):
    """
    Middleware to automatically log all API changes to audit tables.
    """
    
    # Methods that should trigger audit logging
    AUDIT_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']
    
    # Paths to exclude from audit logging
    EXCLUDE_PATHS = [
        '/admin/',
        '/api/schema/',
        '/api/docs/',
        '/api/auth/login/',
        '/api/auth/refresh/',
        '/api/audit/',  # Don't log audit log access
        '/api/webhooks/',  # Webhooks logged separately
    ]
    
    def process_response(self, request, response):
        """
        Log the request after it has been processed.
        """
        # Only log specific HTTP methods
        if request.method not in self.AUDIT_METHODS:
            return response
        
        # Skip excluded paths
        if any(request.path.startswith(path) for path in self.EXCLUDE_PATHS):
            return response
        
        # Only log successful requests (2xx status codes)
        if not (200 <= response.status_code < 300):
            return response
        
        # Get user (if authenticated)
        user = request.user if request.user.is_authenticated else None
        
        # Determine action type
        action_map = {
            'POST': 'create',
            'PUT': 'update',
            'PATCH': 'update',
            'DELETE': 'delete',
        }
        action = action_map.get(request.method, 'unknown')
        
        # Extract entity information from request path
        entity_type, entity_id = self._extract_entity_info(request.path)
        
        # Build metadata
        metadata = {
            'method': request.method,
            'path': request.path,
            'status_code': response.status_code,
        }
        
        # Add request body for POST/PUT/PATCH
        if request.method in ['POST', 'PUT', 'PATCH'] and hasattr(request, 'body'):
            try:
                metadata['request_data'] = json.loads(request.body)
            except (json.JSONDecodeError, UnicodeDecodeError):
                metadata['request_data'] = '[Binary or invalid JSON]'
        
        # Get IP address
        ip_address = self._get_client_ip(request)
        
        # Get user agent
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        
        # Determine if this is an agent-level or platform-level action
        is_agent_action = self._is_agent_action(request.path)
        
        try:
            if is_agent_action and hasattr(user, 'agent'):
                # Log to agent audit log
                AgentAuditLog.objects.create(
                    agent=user.agent,
                    actor=None,  # TODO: Link to AgentStaff if sub-agent
                    action=f'{action}_{entity_type}',
                    entity_type=entity_type,
                    entity_id=entity_id or 0,
                    metadata=metadata,
                    ip_address=ip_address,
                    description=f'{action.title()} {entity_type} via API'
                )
            elif user:
                # Log to platform audit log
                PlatformAuditLog.objects.create(
                    user=user,
                    action=f'{action}_{entity_type}',
                    entity_type=entity_type,
                    entity_id=entity_id,
                    metadata=metadata,
                    ip_address=ip_address,
                    user_agent=user_agent
                )
        except Exception as e:
            # Don't let audit logging failures break the request
            # Log the error for debugging
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f'Failed to create audit log: {str(e)}')
        
        return response
    
    def _extract_entity_info(self, path):
        """
        Extract entity type and ID from request path.
        
        Examples:
            /api/phones/123/ -> ('phone', 123)
            /api/sales/ -> ('sale', None)
            /api/staff/456/ -> ('staff', 456)
        """
        # Remove /api/ prefix and trailing slash
        path = path.replace('/api/', '').rstrip('/')
        
        # Split into parts
        parts = path.split('/')
        
        if len(parts) == 0:
            return ('unknown', None)
        
        # Entity type is the first part (pluralized)
        entity_type = parts[0].rstrip('s')  # Remove trailing 's' for singular
        
        # Entity ID is the second part if it's numeric
        entity_id = None
        if len(parts) > 1 and parts[1].isdigit():
            entity_id = int(parts[1])
        
        return (entity_type, entity_id)
    
    def _is_agent_action(self, path):
        """
        Determine if this is an agent-level action (vs platform-level).
        
        Agent-level actions: phones, sales, customers, staff, payments
        Platform-level actions: agents, settlements, platform management
        """
        agent_paths = [
            '/api/phones/',
            '/api/sales/',
            '/api/customers/',
            '/api/staff/',
            '/api/payments/',
        ]
        
        return any(path.startswith(agent_path) for agent_path in agent_paths)
    
    def _get_client_ip(self, request):
        """
        Get the client's IP address from the request.
        """
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
