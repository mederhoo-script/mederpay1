"""
Comprehensive tests for Phone model and lifecycle
"""
import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from apps.agents.models import Phone
from apps.platform.models import Agent, PlatformPhoneRegistry


@pytest.mark.django_db
class TestPhoneModel:
    """Test Phone model creation and validation"""
    
    def test_create_phone_success(self, agent, platform_phone_registry):
        """Test successful phone creation"""
        phone = Phone.objects.create(
            agent=agent,
            platform_registry=platform_phone_registry,
            imei="123456789012345",
            model="Samsung Galaxy A54",
            brand="Samsung",
            locking_app_installed=False,
            lifecycle_status="in_inventory"
        )
        
        assert phone.imei == "123456789012345"
        assert phone.model == "Samsung Galaxy A54"
        assert phone.lifecycle_status == "in_inventory"
        assert phone.locking_app_installed is False
        
    def test_phone_imei_must_be_unique(self, agent, platform_phone_registry):
        """Test that IMEI must be unique across all phones"""
        Phone.objects.create(
            agent=agent,
            platform_registry=platform_phone_registry,
            imei="111111111111111",
            model="Phone 1",
            lifecycle_status="in_inventory"
        )
        
        # Try to create another phone with same IMEI - should fail
        with pytest.raises(IntegrityError):
            Phone.objects.create(
                agent=agent,
                platform_registry=platform_phone_registry,
                imei="111111111111111",  # Duplicate IMEI
                model="Phone 2",
                lifecycle_status="in_inventory"
            )
    
    def test_phone_lifecycle_transitions(self, agent, platform_phone_registry):
        """Test phone lifecycle status transitions"""
        phone = Phone.objects.create(
            agent=agent,
            platform_registry=platform_phone_registry,
            imei="222222222222222",
            model="Xiaomi Redmi Note 12",
            lifecycle_status="in_inventory"
        )
        
        # Transition to sold
        phone.lifecycle_status = "sold_active"
        phone.locking_app_installed = True
        phone.save()
        
        phone.refresh_from_db()
        assert phone.lifecycle_status == "sold_active"
        assert phone.locking_app_installed is True
    
    def test_phone_agent_relationship(self, agent, platform_phone_registry):
        """Test phone belongs to agent"""
        phone = Phone.objects.create(
            agent=agent,
            platform_registry=platform_phone_registry,
            imei="333333333333333",
            model="Tecno Spark 10",
            lifecycle_status="in_inventory"
        )
        
        assert phone.agent == agent
        assert phone in agent.phones.all()
    
    def test_phone_platform_registry_relationship(self, agent, platform_phone_registry):
        """Test phone links to platform registry"""
        phone = Phone.objects.create(
            agent=agent,
            platform_registry=platform_phone_registry,
            imei="444444444444444",
            model="iPhone 13",
            lifecycle_status="in_inventory"
        )
        
        assert phone.platform_registry == platform_phone_registry
        assert phone in platform_phone_registry.phones.all()
    
    def test_phone_purchase_and_selling_price(self, agent, platform_phone_registry):
        """Test phone price fields"""
        phone = Phone.objects.create(
            agent=agent,
            platform_registry=platform_phone_registry,
            imei="555555555555555",
            model="OnePlus Nord 3",
            lifecycle_status="in_inventory",
            purchase_price=150000.00,
            selling_price=200000.00
        )
        
        assert phone.purchase_price == 150000.00
        assert phone.selling_price == 200000.00
        assert phone.selling_price > phone.purchase_price
    
    def test_phone_locking_status(self, agent, platform_phone_registry):
        """Test phone locking mechanism"""
        phone = Phone.objects.create(
            agent=agent,
            platform_registry=platform_phone_registry,
            imei="666666666666666",
            model="Google Pixel 7",
            lifecycle_status="sold_active",
            is_locked=False
        )
        
        # Lock the phone
        phone.is_locked = True
        phone.save()
        
        phone.refresh_from_db()
        assert phone.is_locked is True


@pytest.mark.django_db
class TestPhoneQuerysets:
    """Test Phone model queries and filters"""
    
    def test_filter_phones_by_agent(self, agent, agent2, platform_phone_registry):
        """Test filtering phones by agent"""
        Phone.objects.create(
            agent=agent,
            platform_registry=platform_phone_registry,
            imei="777777777777777",
            model="Phone 1",
            lifecycle_status="in_inventory"
        )
        Phone.objects.create(
            agent=agent2,
            platform_registry=platform_phone_registry,
            imei="888888888888888",
            model="Phone 2",
            lifecycle_status="in_inventory"
        )
        
        agent1_phones = Phone.objects.filter(agent=agent)
        assert agent1_phones.count() == 1
        assert agent1_phones.first().imei == "777777777777777"
    
    def test_filter_phones_by_lifecycle_status(self, agent, platform_phone_registry):
        """Test filtering phones by lifecycle status"""
        Phone.objects.create(
            agent=agent,
            platform_registry=platform_phone_registry,
            imei="999999999999991",
            model="Phone In Inventory",
            lifecycle_status="in_inventory"
        )
        Phone.objects.create(
            agent=agent,
            platform_registry=platform_phone_registry,
            imei="999999999999992",
            model="Phone Sold",
            lifecycle_status="sold_active"
        )
        
        inventory_phones = Phone.objects.filter(lifecycle_status="in_inventory")
        sold_phones = Phone.objects.filter(lifecycle_status="sold_active")
        
        assert inventory_phones.count() == 1
        assert sold_phones.count() == 1
    
    def test_filter_locked_phones(self, agent, platform_phone_registry):
        """Test filtering locked vs unlocked phones"""
        Phone.objects.create(
            agent=agent,
            platform_registry=platform_phone_registry,
            imei="999999999999993",
            model="Locked Phone",
            lifecycle_status="sold_active",
            is_locked=True
        )
        Phone.objects.create(
            agent=agent,
            platform_registry=platform_phone_registry,
            imei="999999999999994",
            model="Unlocked Phone",
            lifecycle_status="sold_active",
            is_locked=False
        )
        
        locked_phones = Phone.objects.filter(is_locked=True)
        unlocked_phones = Phone.objects.filter(is_locked=False)
        
        assert locked_phones.count() == 1
        assert unlocked_phones.count() == 1
