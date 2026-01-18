"""
Test fixtures for MederPay backend tests
"""
import pytest
from datetime import datetime, timedelta
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.platform.models import Agent, PlatformPhoneRegistry
from apps.agents.models import Phone, Customer, Sale, AgentStaff
from apps.payments.monnify_models import WeeklySettlement

User = get_user_model()


@pytest.fixture
def user(db):
    """Create a test user"""
    return User.objects.create_user(
        username='testagent',
        email='agent@test.com',
        password='testpass123'
    )


@pytest.fixture
def user2(db):
    """Create a second test user"""
    return User.objects.create_user(
        username='testagent2',
        email='agent2@test.com',
        password='testpass123'
    )


@pytest.fixture
def agent(db, user):
    """Create a test agent"""
    return Agent.objects.create(
        user=user,
        business_name='Test Agent Business',
        phone_number='+2348012345678',
        nin='12345678901',
        is_active=True
    )


@pytest.fixture
def agent2(db, user2):
    """Create a second test agent"""
    return Agent.objects.create(
        user=user2,
        business_name='Test Agent Business 2',
        phone_number='+2348087654321',
        nin='98765432109',
        is_active=True
    )


@pytest.fixture
def platform_phone_registry(db, agent):
    """Create a platform phone registry entry"""
    return PlatformPhoneRegistry.objects.create(
        imei='999888777666555',
        first_registered_agent=agent,
        current_agent=agent,
        status='active'
    )


@pytest.fixture
def phone(db, agent):
    """Create a test phone"""
    return Phone.objects.create(
        agent=agent,
        imei='123456789012345',
        model='iPhone 13',
        brand='Apple',
        color='Black',
        storage='128GB',
        purchase_price=500000.00,
        lifecycle_status='in_stock'
    )


@pytest.fixture
def phone2(db, agent):
    """Create a second test phone"""
    return Phone.objects.create(
        agent=agent,
        imei='555666777888999',
        model='Samsung Galaxy A54',
        brand='Samsung',
        color='Blue',
        storage='256GB',
        purchase_price=400000.00,
        lifecycle_status='in_stock'
    )


@pytest.fixture
def customer(db, agent):
    """Create a test customer"""
    return Customer.objects.create(
        agent=agent,
        full_name='Test Customer',
        phone_number='+2348098765432',
        email='customer@test.com'
    )


@pytest.fixture
def customer2(db, agent):
    """Create a second test customer"""
    return Customer.objects.create(
        agent=agent,
        full_name='Test Customer 2',
        phone_number='+2348011112222',
        email='customer2@test.com'
    )


@pytest.fixture
def sale(db, agent, phone, customer):
    """Create a test sale"""
    return Sale.objects.create(
        agent=agent,
        phone=phone,
        customer=customer,
        sale_price=600000.00,
        down_payment=200000.00,
        total_payable=600000.00,
        balance_remaining=400000.00,
        number_of_installments=4,
        installment_amount=100000.00,
        installment_frequency='weekly',
        status='active'
    )


@pytest.fixture
def overdue_settlement(db, agent):
    """Create an overdue settlement"""
    yesterday = timezone.now() - timedelta(days=1)
    return WeeklySettlement.objects.create(
        agent=agent,
        week_ending=yesterday.date(),
        total_amount=5000.00,
        amount_paid=0.00,
        status='PENDING',
        due_date=yesterday,
        invoice_number='INV-2026-TEST-001'
    )


@pytest.fixture
def paid_settlement(db, agent):
    """Create a paid settlement"""
    yesterday = timezone.now() - timedelta(days=1)
    return WeeklySettlement.objects.create(
        agent=agent,
        week_ending=yesterday.date(),
        total_amount=5000.00,
        amount_paid=5000.00,
        status='PAID',
        due_date=yesterday,
        paid_date=timezone.now(),
        invoice_number='INV-2026-TEST-002',
        payment_reference='MEDERPAY-TEST-12345'
    )
