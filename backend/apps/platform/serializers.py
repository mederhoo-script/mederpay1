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
        user = authenticate(username=data['email'], password=data['password'])
        if not user:
            raise serializers.ValidationError('Invalid credentials')
        data['user'] = user
        return data


class AgentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Agent
        fields = ['id', 'user', 'business_name', 'risk_score',
                  'credit_limit', 'status', 'created_at']
        read_only_fields = ['id', 'created_at']
