import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { paymentSchema } from '@/lib/validations'
import { randomBytes } from 'crypto'

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    if (!profile || profile.role !== 'agent_owner') {
      return NextResponse.json(
        { error: 'Forbidden: Only agents can access payments' },
        { status: 403 }
      )
    }
    
    const { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('user_id', user.id)
      .single()
    
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }
    
    const { data: payments, error: paymentsError } = await supabase
      .from('payment_records')
      .select(`
        *,
        sale:sales(
          *,
          phone:phones(*),
          customer:customers(*)
        )
      `)
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false })
    
    if (paymentsError) {
      return NextResponse.json(
        { error: paymentsError.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ payments }, { status: 200 })
    
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    if (!profile || profile.role !== 'agent_owner') {
      return NextResponse.json(
        { error: 'Forbidden: Only agents can create payments' },
        { status: 403 }
      )
    }
    
    const { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('user_id', user.id)
      .single()
    
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }
    
    const body = await request.json()
    const validation = paymentSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }
    
    const paymentData = validation.data
    
    // Validate sale exists and belongs to agent
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', paymentData.sale_id)
      .eq('agent_id', agent.id)
      .single()
    
    if (saleError || !sale) {
      return NextResponse.json(
        { error: 'Sale not found or does not belong to agent' },
        { status: 404 }
      )
    }
    
    // Validate sale is active
    if (sale.status !== 'active') {
      return NextResponse.json(
        { error: `Cannot record payment for ${sale.status} sale` },
        { status: 400 }
      )
    }
    
    // Validate payment amount
    if (paymentData.amount <= 0) {
      return NextResponse.json(
        { error: 'Payment amount must be greater than zero' },
        { status: 400 }
      )
    }
    
    if (paymentData.amount > sale.balance_remaining) {
      return NextResponse.json(
        { error: 'Payment amount exceeds remaining balance' },
        { status: 400 }
      )
    }
    
    // Calculate new balance
    const balanceBefore = sale.balance_remaining
    const balanceAfter = balanceBefore - paymentData.amount
    
    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payment_records')
      .insert({
        agent_id: agent.id,
        sale_id: paymentData.sale_id,
        installment_id: paymentData.installment_id,
        amount: paymentData.amount,
        payment_method: paymentData.payment_method,
        payment_status: 'confirmed',
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        monnify_reference: paymentData.monnify_reference,
        payment_date: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (paymentError) {
      return NextResponse.json(
        { error: 'Failed to create payment record', details: paymentError.message },
        { status: 500 }
      )
    }
    
    // Update installment if provided
    if (paymentData.installment_id) {
      const { data: installment, error: installmentFetchError } = await supabase
        .from('installment_schedules')
        .select('*')
        .eq('id', paymentData.installment_id)
        .eq('sale_id', paymentData.sale_id)
        .single()
      
      if (installmentFetchError || !installment) {
        console.error('Installment not found:', installmentFetchError)
      } else {
        const newAmountPaid = installment.amount_paid + paymentData.amount
        const isPaid = newAmountPaid >= installment.amount_due
        
        const { error: installmentUpdateError } = await supabase
          .from('installment_schedules')
          .update({
            amount_paid: newAmountPaid,
            is_paid: isPaid,
            ...(isPaid && { paid_date: new Date().toISOString() })
          })
          .eq('id', paymentData.installment_id)
        
        if (installmentUpdateError) {
          console.error('Failed to update installment:', installmentUpdateError)
        }
      }
    }
    
    // Update sale balance
    const { error: saleUpdateError } = await supabase
      .from('sales')
      .update({ 
        balance_remaining: balanceAfter,
        ...(balanceAfter === 0 && { 
          status: 'completed',
          completion_date: new Date().toISOString()
        })
      })
      .eq('id', paymentData.sale_id)
    
    if (saleUpdateError) {
      return NextResponse.json(
        { error: 'Failed to update sale balance', details: saleUpdateError.message },
        { status: 500 }
      )
    }
    
    // If sale is now complete, issue UNLOCK command
    if (balanceAfter === 0) {
      const authToken = randomBytes(32).toString('hex')
      const tokenExpiresAt = new Date()
      tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 24)
      
      const { error: commandError } = await supabase
        .from('device_commands')
        .insert({
          phone_id: sale.phone_id,
          imei: (await supabase.from('phones').select('imei').eq('id', sale.phone_id).single()).data?.imei,
          command_type: 'UNLOCK',
          status: 'pending',
          reason: 'Payment completed',
          auth_token: authToken,
          auth_token_hash: authToken, // In production, this should be hashed
          token_expires_at: tokenExpiresAt.toISOString(),
          issued_at: new Date().toISOString(),
        })
      
      if (commandError) {
        console.error('Failed to create unlock command:', commandError)
      }
    }
    
    // Fetch complete payment with relations
    const { data: completePayment } = await supabase
      .from('payment_records')
      .select(`
        *,
        sale:sales(
          *,
          phone:phones(*),
          customer:customers(*)
        )
      `)
      .eq('id', payment.id)
      .single()
    
    return NextResponse.json({ payment: completePayment }, { status: 201 })
    
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
