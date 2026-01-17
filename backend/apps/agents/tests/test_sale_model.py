"""
Comprehensive tests for Sale model and constraints
"""
import pytest
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from apps.agents.models import Sale, SaleStatus


@pytest.mark.django_db
class TestSaleModel:
    """Test Sale model creation and validation"""
    
    def test_create_sale_success(self, agent, customer, phone):
        """Test successful sale creation"""
        sale = Sale.objects.create(
            agent=agent,
            customer=customer,
            phone=phone,
            sale_price=Decimal("200000.00"),
            down_payment=Decimal("50000.00"),
            total_payable=Decimal("220000.00"),  # Price + interest
            balance_remaining=Decimal("170000.00"),
            status=SaleStatus.ACTIVE
        )
        
        assert sale.sale_price == Decimal("200000.00")
        assert sale.down_payment == Decimal("50000.00")
        assert sale.balance_remaining == Decimal("170000.00")
        assert sale.status == SaleStatus.ACTIVE
    
    def test_one_active_sale_per_phone_constraint(self, agent, customer, customer2, phone):
        """Test that only one active sale is allowed per phone"""
        # Create first active sale
        Sale.objects.create(
            agent=agent,
            customer=customer,
            phone=phone,
            sale_price=Decimal("200000.00"),
            down_payment=Decimal("50000.00"),
            total_payable=Decimal("220000.00"),
            balance_remaining=Decimal("170000.00"),
            status=SaleStatus.ACTIVE
        )
        
        # Try to create second active sale on same phone - should fail
        with pytest.raises(IntegrityError):
            Sale.objects.create(
                agent=agent,
                customer=customer2,
                phone=phone,  # Same phone
                sale_price=Decimal("180000.00"),
                down_payment=Decimal("40000.00"),
                total_payable=Decimal("200000.00"),
                balance_remaining=Decimal("160000.00"),
                status=SaleStatus.ACTIVE
            )
    
    def test_completed_sale_allows_new_active_sale(self, agent, customer, customer2, phone):
        """Test that completed sale allows new active sale on same phone"""
        # Create and complete first sale
        sale1 = Sale.objects.create(
            agent=agent,
            customer=customer,
            phone=phone,
            sale_price=Decimal("200000.00"),
            down_payment=Decimal("50000.00"),
            total_payable=Decimal("220000.00"),
            balance_remaining=Decimal("0.00"),
            status=SaleStatus.COMPLETED  # Completed, not active
        )
        
        # Should allow creating new active sale
        sale2 = Sale.objects.create(
            agent=agent,
            customer=customer2,
            phone=phone,
            sale_price=Decimal("180000.00"),
            down_payment=Decimal("40000.00"),
            total_payable=Decimal("200000.00"),
            balance_remaining=Decimal("160000.00"),
            status=SaleStatus.ACTIVE
        )
        
        assert sale1.status == SaleStatus.COMPLETED
        assert sale2.status == SaleStatus.ACTIVE
    
    def test_sale_with_installment_details(self, agent, customer, phone):
        """Test sale with installment payment plan"""
        sale = Sale.objects.create(
            agent=agent,
            customer=customer,
            phone=phone,
            sale_price=Decimal("200000.00"),
            down_payment=Decimal("50000.00"),
            total_payable=Decimal("220000.00"),
            balance_remaining=Decimal("170000.00"),
            status=SaleStatus.ACTIVE,
            installment_amount=Decimal("10000.00"),
            installment_frequency="weekly",
            number_of_installments=17
        )
        
        assert sale.installment_amount == Decimal("10000.00")
        assert sale.installment_frequency == "weekly"
        assert sale.number_of_installments == 17
    
    def test_sale_balance_calculation(self, agent, customer, phone):
        """Test sale balance calculation"""
        sale = Sale.objects.create(
            agent=agent,
            customer=customer,
            phone=phone,
            sale_price=Decimal("200000.00"),
            down_payment=Decimal("50000.00"),
            total_payable=Decimal("220000.00"),
            balance_remaining=Decimal("170000.00"),
            status=SaleStatus.ACTIVE
        )
        
        # Balance should equal total_payable minus down_payment
        expected_balance = sale.total_payable - sale.down_payment
        assert sale.balance_remaining == expected_balance
    
    def test_sale_relationships(self, agent, customer, phone):
        """Test sale relationships to agent, customer, and phone"""
        sale = Sale.objects.create(
            agent=agent,
            customer=customer,
            phone=phone,
            sale_price=Decimal("200000.00"),
            down_payment=Decimal("50000.00"),
            total_payable=Decimal("220000.00"),
            balance_remaining=Decimal("170000.00"),
            status=SaleStatus.ACTIVE
        )
        
        assert sale.agent == agent
        assert sale.customer == customer
        assert sale.phone == phone
        assert sale in agent.sales.all()
        assert sale in customer.sales.all()
        assert sale in phone.sales.all()


@pytest.mark.django_db
class TestSaleConstraints:
    """Test Sale model database constraints"""
    
    def test_positive_sale_amounts_constraint(self, agent, customer, phone):
        """Test that sale amounts must be positive"""
        # Negative sale price should fail
        with pytest.raises(IntegrityError):
            Sale.objects.create(
                agent=agent,
                customer=customer,
                phone=phone,
                sale_price=Decimal("-100000.00"),  # Negative
                down_payment=Decimal("0.00"),
                total_payable=Decimal("100000.00"),
                balance_remaining=Decimal("100000.00"),
                status=SaleStatus.ACTIVE
            )
    
    def test_valid_balance_constraint(self, agent, customer, phone):
        """Test that balance cannot exceed total payable"""
        # Balance greater than total_payable should fail
        with pytest.raises(IntegrityError):
            Sale.objects.create(
                agent=agent,
                customer=customer,
                phone=phone,
                sale_price=Decimal("200000.00"),
                down_payment=Decimal("50000.00"),
                total_payable=Decimal("220000.00"),
                balance_remaining=Decimal("250000.00"),  # Exceeds total
                status=SaleStatus.ACTIVE
            )


@pytest.mark.django_db
class TestSaleQuerysets:
    """Test Sale model queries"""
    
    def test_filter_sales_by_status(self, agent, customer, customer2, phone, phone2):
        """Test filtering sales by status"""
        Sale.objects.create(
            agent=agent,
            customer=customer,
            phone=phone,
            sale_price=Decimal("200000.00"),
            down_payment=Decimal("50000.00"),
            total_payable=Decimal("220000.00"),
            balance_remaining=Decimal("170000.00"),
            status=SaleStatus.ACTIVE
        )
        Sale.objects.create(
            agent=agent,
            customer=customer2,
            phone=phone2,
            sale_price=Decimal("180000.00"),
            down_payment=Decimal("180000.00"),
            total_payable=Decimal("180000.00"),
            balance_remaining=Decimal("0.00"),
            status=SaleStatus.COMPLETED
        )
        
        active_sales = Sale.objects.filter(status=SaleStatus.ACTIVE)
        completed_sales = Sale.objects.filter(status=SaleStatus.COMPLETED)
        
        assert active_sales.count() == 1
        assert completed_sales.count() == 1
    
    def test_filter_sales_by_agent(self, agent, agent2, customer, phone):
        """Test filtering sales by agent"""
        Sale.objects.create(
            agent=agent,
            customer=customer,
            phone=phone,
            sale_price=Decimal("200000.00"),
            down_payment=Decimal("50000.00"),
            total_payable=Decimal("220000.00"),
            balance_remaining=Decimal("170000.00"),
            status=SaleStatus.ACTIVE
        )
        
        agent1_sales = Sale.objects.filter(agent=agent)
        agent2_sales = Sale.objects.filter(agent=agent2)
        
        assert agent1_sales.count() == 1
        assert agent2_sales.count() == 0
    
    def test_filter_sales_by_customer(self, agent, customer, customer2, phone, phone2):
        """Test filtering sales by customer"""
        Sale.objects.create(
            agent=agent,
            customer=customer,
            phone=phone,
            sale_price=Decimal("200000.00"),
            down_payment=Decimal("50000.00"),
            total_payable=Decimal("220000.00"),
            balance_remaining=Decimal("170000.00"),
            status=SaleStatus.ACTIVE
        )
        
        customer1_sales = Sale.objects.filter(customer=customer)
        customer2_sales = Sale.objects.filter(customer=customer2)
        
        assert customer1_sales.count() == 1
        assert customer2_sales.count() == 0
