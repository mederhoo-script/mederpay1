from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, Agent


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone_number']
        read_only_fields = ['id']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)
    business_name = serializers.CharField(write_only=True, required=True)
    business_address = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'first_name', 'last_name', 
                  'phone_number', 'business_name', 'business_address']
    
    def create(self, validated_data):
        business_name = validated_data.pop('business_name')
        business_address = validated_data.pop('business_address')
        
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email'),
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            phone_number=validated_data.get('phone_number'),
            role='agent_owner'
        )
        
        # Create agent profile
        Agent.objects.create(
            user=user,
            business_name=business_name,
            business_address=business_address,
            monnify_api_key='',
            monnify_secret_key='',
            monnify_contract_code=''
        )
        
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
    
    def validate(self, data):
        user = authenticate(username=data['username'], password=data['password'])
        if not user:
            raise serializers.ValidationError('Invalid credentials')
        data['user'] = user
        return data


class AgentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Agent
        fields = ['id', 'user', 'business_name', 'business_address', 'registration_number',
                  'credit_limit', 'credit_used', 'status', 'created_at']
        read_only_fields = ['id', 'credit_used', 'created_at']
