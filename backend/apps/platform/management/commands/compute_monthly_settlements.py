"""
Django management command to compute monthly settlements for all agents.

This command should be run monthly (e.g., via cron or Celery Beat) to automatically
generate billing records for agents based on their active phone inventory.

Usage:
    python manage.py compute_monthly_settlements
    python manage.py compute_monthly_settlements --dry-run
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from calendar import monthrange
from decimal import Decimal
from apps.platform.models import Agent, AgentBilling, AgentStatus
from apps.agents.models import Phone


class Command(BaseCommand):
    help = 'Compute monthly settlements for all agents based on active inventory'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created without actually creating billing records',
        )
        parser.add_argument(
            '--month',
            type=int,
            help='Month to compute (1-12). Defaults to previous month.',
        )
        parser.add_argument(
            '--year',
            type=int,
            help='Year to compute. Defaults to current year.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No records will be created'))
        
        # Determine the billing month
        today = timezone.now().date()
        year = options['year'] or today.year
        month = options['month'] or (today.month - 1 if today.month > 1 else 12)
        
        # Adjust year if computing December of previous year
        if month == 12 and not options['month']:
            year -= 1
        
        # Get the first and last day of the month
        _, last_day = monthrange(year, month)
        month_start = timezone.datetime(year, month, 1).date()
        month_end = timezone.datetime(year, month, last_day).date()
        
        period = f"{month_start.strftime('%B %Y')}"
        
        self.stdout.write(f'\nComputing monthly settlements for: {period}\n')
        
        # Get all active agents
        active_agents = Agent.objects.filter(status=AgentStatus.ACTIVE)
        
        total_agents = 0
        total_billing_amount = Decimal('0.00')
        skipped_agents = 0
        
        for agent in active_agents:
            # Check if billing already exists for this period
            existing_billing = AgentBilling.objects.filter(
                agent=agent,
                period=period
            ).first()
            
            if existing_billing:
                self.stdout.write(
                    self.style.WARNING(
                        f'  ⚠️  {agent.business_name}: Billing already exists for this period (ID: {existing_billing.id})'
                    )
                )
                skipped_agents += 1
                continue
            
            # Count total phones (active inventory) for this agent
            total_phones = Phone.objects.filter(agent=agent).count()
            
            if total_phones == 0:
                self.stdout.write(
                    self.style.WARNING(f'  ⚠️  {agent.business_name}: No phones in inventory, skipping')
                )
                skipped_agents += 1
                continue
            
            # Calculate billing amount
            # Default fee: $20 per phone per month (configurable)
            fee_per_phone = Decimal('20.00')  # TODO: Make this configurable per agent
            total_due = fee_per_phone * total_phones
            
            if not dry_run:
                # Create billing record
                with transaction.atomic():
                    # Generate unique invoice number
                    invoice_number = f"INV-{agent.id}-{month_start.strftime('%Y%m')}"
                    
                    billing = AgentBilling.objects.create(
                        agent=agent,
                        period=period,
                        fee_per_phone=fee_per_phone,
                        total_phones=total_phones,
                        total_due=total_due,
                        amount_paid=Decimal('0.00'),
                        status='pending',
                        invoice_number=invoice_number
                    )
                    
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'  ✅ {agent.business_name}: Created billing #{billing.id} - '
                            f'{total_phones} phones × ${fee_per_phone} = ${total_due}'
                        )
                    )
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'  [DRY RUN] {agent.business_name}: Would create billing - '
                        f'{total_phones} phones × ${fee_per_phone} = ${total_due}'
                    )
                )
            
            total_agents += 1
            total_billing_amount += total_due
        
        # Summary
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.SUCCESS('\nSummary:'))
        self.stdout.write(f'  Period: {period}')
        self.stdout.write(f'  Total Active Agents: {active_agents.count()}')
        self.stdout.write(f'  Billing Records Created: {total_agents}')
        self.stdout.write(f'  Skipped Agents: {skipped_agents}')
        self.stdout.write(f'  Total Billing Amount: ${total_billing_amount}')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('\n⚠️  DRY RUN COMPLETE - No records were created'))
        else:
            self.stdout.write(self.style.SUCCESS('\n✅ Monthly settlement computation complete!'))
