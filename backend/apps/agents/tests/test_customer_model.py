"""
Comprehensive tests for Customer model
"""
import pytest
from django.db import IntegrityError
from apps.agents.models import Customer


@pytest.mark.django_db
class TestCustomerModel:
    """Test Customer model creation and validation"""
    
    def test_create_customer_success(self, agent):
        """Test successful customer creation"""
        customer = Customer.objects.create(
            agent=agent,
            full_name="John Doe",
            phone_number="+2348012345678",
            email="john.doe@example.com",
            address="123 Main St, Lagos"
        )
        
        assert customer.full_name == "John Doe"
        assert customer.phone_number == "+2348012345678"
        assert customer.email == "john.doe@example.com"
        assert customer.address == "123 Main St, Lagos"
    
    def test_create_customer_with_nin_bvn(self, agent):
        """Test customer creation with NIN/BVN for virtual account"""
        customer = Customer.objects.create(
            agent=agent,
            full_name="Jane Smith",
            phone_number="+2348098765432",
            address="456 Oak Ave, Abuja",
            nin="12345678901",  # 11 digits
            bvn="98765432109"   # 11 digits
        )
        
        assert customer.nin == "12345678901"
        assert customer.bvn == "98765432109"
        assert len(customer.nin) == 11
        assert len(customer.bvn) == 11
    
    def test_customer_belongs_to_agent(self, agent):
        """Test customer-agent relationship"""
        customer = Customer.objects.create(
            agent=agent,
            full_name="Bob Johnson",
            phone_number="+2347012345678",
            address="789 Pine Rd, Port Harcourt"
        )
        
        assert customer.agent == agent
        assert customer in agent.customers.all()
    
    def test_multiple_customers_same_agent(self, agent):
        """Test agent can have multiple customers"""
        customer1 = Customer.objects.create(
            agent=agent,
            full_name="Customer 1",
            phone_number="+2348011111111",
            address="Address 1"
        )
        customer2 = Customer.objects.create(
            agent=agent,
            full_name="Customer 2",
            phone_number="+2348022222222",
            address="Address 2"
        )
        
        assert agent.customers.count() == 2
        assert customer1 in agent.customers.all()
        assert customer2 in agent.customers.all()
    
    def test_customer_email_optional(self, agent):
        """Test email is optional"""
        customer = Customer.objects.create(
            agent=agent,
            full_name="No Email Customer",
            phone_number="+2348033333333",
            address="No Email Address"
        )
        
        assert customer.email is None
    
    def test_customer_nin_bvn_optional(self, agent):
        """Test NIN/BVN are optional"""
        customer = Customer.objects.create(
            agent=agent,
            full_name="No KYC Customer",
            phone_number="+2348044444444",
            address="No KYC Address"
        )
        
        assert customer.nin is None
        assert customer.bvn is None


@pytest.mark.django_db
class TestCustomerQuerysets:
    """Test Customer model queries"""
    
    def test_filter_customers_by_agent(self, agent, agent2):
        """Test filtering customers by agent"""
        Customer.objects.create(
            agent=agent,
            full_name="Agent 1 Customer",
            phone_number="+2348055555555",
            address="Address 1"
        )
        Customer.objects.create(
            agent=agent2,
            full_name="Agent 2 Customer",
            phone_number="+2348066666666",
            address="Address 2"
        )
        
        agent1_customers = Customer.objects.filter(agent=agent)
        agent2_customers = Customer.objects.filter(agent=agent2)
        
        assert agent1_customers.count() == 1
        assert agent2_customers.count() == 1
    
    def test_search_customer_by_phone(self, agent):
        """Test searching customers by phone number"""
        customer = Customer.objects.create(
            agent=agent,
            full_name="Search Test",
            phone_number="+2348077777777",
            address="Search Address"
        )
        
        found = Customer.objects.filter(phone_number="+2348077777777")
        assert found.count() == 1
        assert found.first() == customer
    
    def test_customers_with_kyc(self, agent):
        """Test filtering customers with KYC (NIN/BVN)"""
        Customer.objects.create(
            agent=agent,
            full_name="With KYC",
            phone_number="+2348088888888",
            address="KYC Address",
            nin="11111111111",
            bvn="22222222222"
        )
        Customer.objects.create(
            agent=agent,
            full_name="Without KYC",
            phone_number="+2348099999999",
            address="No KYC Address"
        )
        
        with_nin = Customer.objects.exclude(nin__isnull=True)
        with_bvn = Customer.objects.exclude(bvn__isnull=True)
        
        assert with_nin.count() == 1
        assert with_bvn.count() == 1
