# Generated migration for Monnify integration models

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0003_alter_installmentschedule_options_and_more'),
        ('platform', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='MonnifyReservedAccount',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('account_reference', models.CharField(db_index=True, max_length=100, unique=True)),
                ('account_number', models.CharField(db_index=True, max_length=20)),
                ('account_name', models.CharField(max_length=255)),
                ('bank_name', models.CharField(max_length=100)),
                ('bank_code', models.CharField(max_length=10)),
                ('reservation_reference', models.CharField(max_length=100, unique=True)),
                ('collection_channel', models.CharField(default='RESERVED_ACCOUNT', max_length=50)),
                ('status', models.CharField(default='ACTIVE', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('monnify_created_at', models.DateTimeField(blank=True, null=True)),
                ('agent', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='monnify_reserved_account', to='platform.agent')),
            ],
            options={
                'db_table': 'monnify_reserved_accounts',
            },
        ),
        migrations.CreateModel(
            name='WeeklySettlement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('week_starting', models.DateField(db_index=True)),
                ('week_ending', models.DateField(db_index=True)),
                ('total_amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('amount_paid', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('status', models.CharField(choices=[('PENDING', 'Pending'), ('PARTIAL', 'Partially Paid'), ('PAID', 'Paid'), ('OVERDUE', 'Overdue')], db_index=True, default='PENDING', max_length=20)),
                ('due_date', models.DateField()),
                ('payment_reference', models.CharField(blank=True, max_length=255, null=True)),
                ('paid_date', models.DateTimeField(blank=True, null=True)),
                ('invoice_number', models.CharField(blank=True, max_length=100, null=True, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('agent', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='weekly_settlements', to='platform.agent')),
            ],
            options={
                'db_table': 'weekly_settlements',
                'ordering': ['-week_ending'],
            },
        ),
        migrations.CreateModel(
            name='SettlementPayment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('payment_reference', models.CharField(db_index=True, max_length=255, unique=True)),
                ('payment_method', models.CharField(default='BANK_TRANSFER', max_length=50)),
                ('status', models.CharField(choices=[('PENDING', 'Pending'), ('CONFIRMED', 'Confirmed'), ('FAILED', 'Failed')], default='PENDING', max_length=20)),
                ('payment_date', models.DateTimeField()),
                ('confirmed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('settlement', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payments', to='payments.weeklysettlement')),
            ],
            options={
                'db_table': 'settlement_payments',
                'ordering': ['-payment_date'],
            },
        ),
        migrations.CreateModel(
            name='MonnifyWebhookLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(db_index=True, max_length=100)),
                ('transaction_reference', models.CharField(db_index=True, max_length=255)),
                ('account_number', models.CharField(blank=True, db_index=True, max_length=20, null=True)),
                ('amount_paid', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ('payment_reference', models.CharField(blank=True, max_length=255, null=True)),
                ('customer_name', models.CharField(blank=True, max_length=255, null=True)),
                ('paid_on', models.DateTimeField(blank=True, null=True)),
                ('raw_payload', models.JSONField()),
                ('signature', models.TextField(blank=True, null=True)),
                ('processed', models.BooleanField(default=False)),
                ('processed_at', models.DateTimeField(blank=True, null=True)),
                ('processing_error', models.TextField(blank=True, null=True)),
                ('received_at', models.DateTimeField(auto_now_add=True)),
                ('payment_record', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='monnify_webhooks', to='payments.paymentrecord')),
            ],
            options={
                'db_table': 'monnify_webhook_logs',
                'ordering': ['-received_at'],
            },
        ),
        migrations.AddIndex(
            model_name='monnifyreservedaccount',
            index=models.Index(fields=['agent'], name='monnify_res_agent_i_5c2e23_idx'),
        ),
        migrations.AddIndex(
            model_name='monnifyreservedaccount',
            index=models.Index(fields=['account_number'], name='monnify_res_account_1c4f92_idx'),
        ),
        migrations.AddIndex(
            model_name='monnifyreservedaccount',
            index=models.Index(fields=['account_reference'], name='monnify_res_account_c8a1f4_idx'),
        ),
        migrations.AddIndex(
            model_name='monnifyreservedaccount',
            index=models.Index(fields=['status'], name='monnify_res_status_a7b3e2_idx'),
        ),
        migrations.AddIndex(
            model_name='weeklysettlement',
            index=models.Index(fields=['agent', 'status'], name='weekly_sett_agent_i_9d5a1c_idx'),
        ),
        migrations.AddIndex(
            model_name='weeklysettlement',
            index=models.Index(fields=['week_ending'], name='weekly_sett_week_en_7f4e2b_idx'),
        ),
        migrations.AddIndex(
            model_name='weeklysettlement',
            index=models.Index(fields=['due_date'], name='weekly_sett_due_dat_3a9c4d_idx'),
        ),
        migrations.AddIndex(
            model_name='weeklysettlement',
            index=models.Index(fields=['status'], name='weekly_sett_status_8b2f5e_idx'),
        ),
        migrations.AddConstraint(
            model_name='weeklysettlement',
            constraint=models.UniqueConstraint(fields=('agent', 'week_ending'), name='unique_agent_week'),
        ),
        migrations.AddIndex(
            model_name='settlementpayment',
            index=models.Index(fields=['settlement'], name='settlement_settlem_4d7c3a_idx'),
        ),
        migrations.AddIndex(
            model_name='settlementpayment',
            index=models.Index(fields=['payment_reference'], name='settlement_payment_6e8f2b_idx'),
        ),
        migrations.AddIndex(
            model_name='settlementpayment',
            index=models.Index(fields=['status'], name='settlement_status_9a5d1c_idx'),
        ),
        migrations.AddIndex(
            model_name='monnifywebhooklog',
            index=models.Index(fields=['event_type', 'received_at'], name='monnify_web_event_t_2b8f4d_idx'),
        ),
        migrations.AddIndex(
            model_name='monnifywebhooklog',
            index=models.Index(fields=['transaction_reference'], name='monnify_web_transac_5c7a3e_idx'),
        ),
        migrations.AddIndex(
            model_name='monnifywebhooklog',
            index=models.Index(fields=['account_number'], name='monnify_web_account_4d9b2f_idx'),
        ),
        migrations.AddIndex(
            model_name='monnifywebhooklog',
            index=models.Index(fields=['processed'], name='monnify_web_process_3a7c5d_idx'),
        ),
    ]
