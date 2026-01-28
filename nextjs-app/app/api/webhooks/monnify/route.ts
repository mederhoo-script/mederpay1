import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyWebhookSignature } from '@/lib/api/monnify'
import { randomBytes } from 'crypto'

interface MonnifyWebhookPayload {
  eventType: string
  eventData: {
    transactionReference: string
    paymentReference: string
    amountPaid: string
    totalPayable: string
    settlementAmount: string
    paidOn: string
    paymentStatus: string
    paymentMethod: string
    product: {
      reference: string
    }
    customer: {
      name: string
      email: string
    }
    accountDetails: {
      accountName: string
      accountNumber: string
      bankCode: string
      amountPaid: string
    }
  }
}

export async function POST(request: Request) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get('monnify-signature') || ''

    // Verify webhook signature
    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      )
    }

    const payload: MonnifyWebhookPayload = JSON.parse(rawBody)

    // Only process successful payments
    if (payload.eventType !== 'SUCCESSFUL_TRANSACTION') {
      return NextResponse.json({ message: 'Event acknowledged' }, { status: 200 })
    }

    const { eventData } = payload
    const amountPaid = parseFloat(eventData.amountPaid || '0')

    if (amountPaid <= 0) {
      return NextResponse.json({ message: 'Invalid amount' }, { status: 200 })
    }

    // Create Supabase service client (bypasses RLS)
    const supabase = createServiceClient()

    // Find sale by customer phone number or payment reference
    // Customer phone might be in the reference or email
    const customerPhone = eventData.customer.email?.split('@')[0] || 
                         eventData.product.reference

    let sale = null

    // Try to find customer by phone number
    if (customerPhone) {
      const { data: customers } = await supabase
        .from('customers')
        .select('*, sales!inner(*)')
        .ilike('phone_number', `%${customerPhone}%`)
        .eq('sales.status', 'active')
        .order('sales.created_at', { ascending: false })
        .limit(1)

      if (customers && customers.length > 0) {
        const customerData = customers[0]
        // With joins, sales could be an array, get first item
        sale = Array.isArray(customerData.sales) ? customerData.sales[0] : customerData.sales
      }
    }

    // If not found, try to find by monnify reference in existing payments
    if (!sale) {
      const { data: existingPayment } = await supabase
        .from('payment_records')
        .select('sale:sales(*), agent:agents(*)')
        .eq('monnify_reference', eventData.transactionReference)
        .single()

      if (existingPayment?.sale) {
        // Handle both single object and array responses
        const saleData = Array.isArray(existingPayment.sale) 
          ? existingPayment.sale[0] 
          : existingPayment.sale
        
        if (saleData) {
          sale = saleData
        }
      }
    }

    if (!sale) {
      // Log the webhook for manual processing
      await supabase.from('audit_logs').insert({
        event_type: 'MONNIFY_WEBHOOK_NO_SALE',
        event_data: payload,
        timestamp: new Date().toISOString(),
      })

      return NextResponse.json(
        { message: 'Sale not found, logged for manual processing' },
        { status: 200 }
      )
    }

    // Check if payment already processed
    const { data: existingPayment } = await supabase
      .from('payment_records')
      .select('*')
      .eq('monnify_transaction_id', eventData.paymentReference)
      .single()

    if (existingPayment) {
      return NextResponse.json(
        { message: 'Payment already processed' },
        { status: 200 }
      )
    }

    // Calculate balances
    const balanceBefore = sale.balance_remaining
    const balanceAfter = Math.max(0, balanceBefore - amountPaid)

    // Find next unpaid installment if applicable
    let installmentId = null
    if (sale.installment_frequency) {
      const { data: nextInstallment } = await supabase
        .from('installment_schedules')
        .select('*')
        .eq('sale_id', sale.id)
        .eq('is_paid', false)
        .order('installment_number', { ascending: true })
        .limit(1)
        .single()

      if (nextInstallment) {
        installmentId = nextInstallment.id
      }
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payment_records')
      .insert({
        agent_id: sale.agent_id,
        sale_id: sale.id,
        installment_id: installmentId,
        amount: amountPaid,
        payment_method: 'MONNIFY',
        payment_status: 'confirmed',
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        monnify_reference: eventData.transactionReference,
        monnify_transaction_id: eventData.paymentReference,
        payment_date: eventData.paidOn,
      })
      .select()
      .single()

    if (paymentError) {
      console.error('Failed to create payment record:', paymentError)
      return NextResponse.json(
        { error: 'Failed to create payment record' },
        { status: 500 }
      )
    }

    // Update installment if found
    if (installmentId) {
      const { data: installment } = await supabase
        .from('installment_schedules')
        .select('*')
        .eq('id', installmentId)
        .single()

      if (installment) {
        const newAmountPaid = installment.amount_paid + amountPaid
        const isPaid = newAmountPaid >= installment.amount_due

        await supabase
          .from('installment_schedules')
          .update({
            amount_paid: newAmountPaid,
            is_paid: isPaid,
            ...(isPaid && { paid_date: new Date().toISOString() })
          })
          .eq('id', installmentId)
      }
    }

    // Update sale balance
    const saleUpdate: Record<string, unknown> = {
      balance_remaining: balanceAfter,
    }

    if (balanceAfter === 0) {
      saleUpdate.status = 'completed'
      saleUpdate.completion_date = new Date().toISOString()
    }

    await supabase
      .from('sales')
      .update(saleUpdate)
      .eq('id', sale.id)

    // If paid in full, unlock device
    if (balanceAfter === 0) {
      const authToken = randomBytes(32).toString('hex')
      const tokenExpiresAt = new Date()
      tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 24)

      const { data: phone } = await supabase
        .from('phones')
        .select('*')
        .eq('id', sale.phone_id)
        .single()

      if (phone) {
        await supabase.from('device_commands').insert({
          phone_id: sale.phone_id,
          imei: phone.imei,
          command_type: 'UNLOCK',
          status: 'pending',
          reason: 'Payment completed via Monnify',
          auth_token: authToken,
          auth_token_hash: authToken,
          token_expires_at: tokenExpiresAt.toISOString(),
          issued_at: new Date().toISOString(),
        })

        await supabase
          .from('phones')
          .update({ is_locked: false })
          .eq('id', sale.phone_id)
      }
    }

    // Log the successful webhook processing
    await supabase.from('audit_logs').insert({
      event_type: 'MONNIFY_WEBHOOK_PROCESSED',
      event_data: {
        transactionReference: eventData.transactionReference,
        paymentReference: eventData.paymentReference,
        saleId: sale.id,
        paymentId: payment.id,
        amountPaid,
        balanceAfter,
      },
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json(
      {
        message: 'Webhook processed successfully',
        paymentId: payment.id,
        balanceAfter,
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Webhook processing error:', error)
    
    // Still return 200 to avoid Monnify retrying
    return NextResponse.json(
      { message: 'Webhook received, processing failed' },
      { status: 200 }
    )
  }
}
