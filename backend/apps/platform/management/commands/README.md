# Automated Settlement Computation

This directory contains Django management commands for automated weekly and monthly settlement computation.

## Commands

### 1. Weekly Settlement Computation

Computes weekly billing records for all active agents based on their phone inventory.

**Usage:**
```bash
# Dry run (preview without creating records)
python manage.py compute_weekly_settlements --dry-run

# Actually create billing records
python manage.py compute_weekly_settlements
```

**Details:**
- Runs for the current week (Monday to Sunday)
- Default fee: $5 per phone per week
- Skips agents with existing billing for the period
- Skips agents with no phone inventory
- Creates billing records with status="pending"

**Automation:**
Set up a weekly cron job to run every Monday:
```bash
# Run at 1:00 AM every Monday
0 1 * * 1 cd /path/to/backend && python manage.py compute_weekly_settlements
```

Or use Celery Beat:
```python
# In celerybeat-schedule.py
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    'compute-weekly-settlements': {
        'task': 'apps.platform.tasks.compute_weekly_settlements',
        'schedule': crontab(hour=1, minute=0, day_of_week=1),  # Monday 1:00 AM
    },
}
```

### 2. Monthly Settlement Computation

Computes monthly billing records for all active agents based on their phone inventory.

**Usage:**
```bash
# Dry run for previous month
python manage.py compute_monthly_settlements --dry-run

# Compute for specific month
python manage.py compute_monthly_settlements --month 12 --year 2025

# Actually create billing records
python manage.py compute_monthly_settlements
```

**Details:**
- Defaults to previous month if no arguments provided
- Default fee: $20 per phone per month
- Skips agents with existing billing for the period
- Skips agents with no phone inventory
- Creates billing records with status="pending"

**Automation:**
Set up a monthly cron job to run on the 1st of each month:
```bash
# Run at 2:00 AM on the 1st of every month
0 2 1 * * cd /path/to/backend && python manage.py compute_monthly_settlements
```

Or use Celery Beat:
```python
# In celerybeat-schedule.py
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    'compute-monthly-settlements': {
        'task': 'apps.platform.tasks.compute_monthly_settlements',
        'schedule': crontab(hour=2, minute=0, day_of_month=1),  # 1st of month, 2:00 AM
    },
}
```

## Configuration

### Customizing Fees

The default fees are hardcoded in the commands:
- Weekly: $5 per phone
- Monthly: $20 per phone

To customize fees per agent, you can:

1. Add a field to the Agent model:
```python
class Agent(models.Model):
    # ...
    weekly_fee_per_phone = models.DecimalField(max_digits=10, decimal_places=2, default=5.00)
    monthly_fee_per_phone = models.DecimalField(max_digits=10, decimal_places=2, default=20.00)
```

2. Update the commands to use agent-specific fees:
```python
# In compute_weekly_settlements.py
fee_per_phone = agent.weekly_fee_per_phone
```

## Billing Workflow

1. **Computation**: Management command runs automatically (weekly/monthly)
2. **Creation**: Billing records created with status="pending"
3. **Notification**: Android apps check `/api/settlements/weekly/{imei}/` endpoint
4. **Enforcement**: Android apps show overlay if payment due
5. **Payment**: Agent initiates payment via Monnify
6. **Confirmation**: Backend confirms payment via webhook
7. **Update**: Billing record status changes to "paid"
8. **Release**: Android apps remove overlay after payment confirmation

## Testing

Test the commands in dry-run mode before enabling automation:

```bash
# Test weekly computation
python manage.py compute_weekly_settlements --dry-run

# Test monthly computation
python manage.py compute_monthly_settlements --dry-run --month 1 --year 2026
```

## Monitoring

Monitor settlement computation by:

1. Checking command output in cron logs
2. Reviewing AgentBilling records in Django admin
3. Monitoring agent payment status via dashboard
4. Checking audit logs for billing creation events

## Troubleshooting

### No Billing Records Created

**Issue**: Command runs but no billing records are created.

**Solutions**:
- Check if agents have status="active"
- Verify agents have phones in inventory
- Check if billing already exists for the period (run with `--dry-run` to see)

### Duplicate Billing Records

**Issue**: Multiple billing records for same period.

**Prevention**: The command checks for existing billing before creating new records.

**Fix**: Delete duplicates via Django admin and ensure only one cron job is running.

### Incorrect Fees

**Issue**: Billing amounts don't match expected fees.

**Solutions**:
- Verify phone count is correct
- Check fee_per_phone calculation in command
- Update default fees in command code if needed

## Related Files

- Models: `apps/platform/models.py` (AgentBilling)
- APIs: `apps/platform/urls/settlements.py`
- Views: `apps/platform/views.py` (SettlementViewSet)
- Android Integration: Android apps call `/api/settlements/weekly/{imei}/`

## Support

For issues or questions:
1. Check command output for error messages
2. Review Django logs for exceptions
3. Contact platform administrator
