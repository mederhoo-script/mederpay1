from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, Agent


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'role', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)
    business_name = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = User
        fields = ['email', 'password', 'business_name']
    
    def create(self, validated_data):
        business_name = validated_data.pop('business_name')
        
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            role='agent_owner'
        )
        
        # Create agent profile
        Agent.objects.create(
            user=user,
            business_name=business_name,
            monnify_public_key='',
            monnify_secret_key_encrypted='',
            monnify_contract_code='',
            monnify_webhook_secret=''
        )
        
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    
    def validate(self, data):
        # Django's authenticate expects 'username' parameter even if USERNAME_FIELD is 'email'
        user = authenticate(username=data['email'], password=data['password'])
        if not user:
            raise serializers.ValidationError('Invalid credentials')
        data['user'] = user
        return data


class AgentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    monnify_secret_key = serializers.CharField(write_only=True, required=False, allow_blank=True)
    has_monnify_configured = serializers.SerializerMethodField()
    
    class Meta:
        model = Agent
        fields = ['id', 'user', 'business_name', 'risk_score',
                  'credit_limit', 'status', 'created_at',
                  'monnify_public_key', 'monnify_secret_key', 
                  'monnify_contract_code', 'monnify_webhook_secret',
                  'has_monnify_configured', 'business_address',
                  'nin', 'bvn']
        read_only_fields = ['id', 'created_at', 'risk_score', 'credit_limit', 'status']
        extra_kwargs = {
            'monnify_public_key': {'required': False, 'allow_blank': True},
            'monnify_contract_code': {'required': False, 'allow_blank': True},
            'monnify_webhook_secret': {'required': False, 'allow_blank': True},
            'nin': {'required': False, 'allow_blank': True},
            'bvn': {'required': False, 'allow_blank': True},
        }
    
    def get_has_monnify_configured(self, obj):
        """Check if agent has configured Monnify credentials"""
        return bool(obj.monnify_public_key and obj.monnify_secret_key_encrypted)
    
    def update(self, instance, validated_data):
        from django.conf import settings
        
        # Handle Monnify secret key encryption
        if 'monnify_secret_key' in validated_data:
            secret_key = validated_data.pop('monnify_secret_key')
            if secret_key:
                encryption_key = settings.ENCRYPTION_KEY
                if encryption_key:
                    instance.monnify_secret_key_encrypted = instance.encrypt_field(
                        secret_key, encryption_key
                    )
                else:
                    # Store as-is if no encryption key configured
                    instance.monnify_secret_key_encrypted = secret_key
        
        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance
