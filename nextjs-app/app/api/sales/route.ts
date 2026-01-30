import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { saleSchema } from '@/lib/validations'

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
        { error: 'Forbidden: Only agents can access sales' },
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
    
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select(`
        *,
        phone:phones(*),
        customer:customers(*),
        installments:installment_schedules(*)
      `)
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false })
    
    if (salesError) {
      return NextResponse.json(
        { error: salesError.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ sales }, { status: 200 })
    
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
        { error: 'Forbidden: Only agents can create sales' },
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
    const validation = saleSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }
    
    const saleData = validation.data
    
    // Validate phone exists and belongs to agent
    const { data: phone, error: phoneError } = await supabase
      .from('phones')
      .select('*, phone_registry:platform_phone_registry!inner(is_blacklisted)')
      .eq('id', saleData.phone_id)
      .eq('agent_id', agent.id)
      .single()
    
    if (phoneError || !phone) {
      return NextResponse.json(
        { error: 'Phone not found or does not belong to agent' },
        { status: 404 }
      )
    }
    
    // Validate phone is in_stock
    if (phone.status !== 'in_stock') {
      return NextResponse.json(
        { error: `Phone is not available for sale. Current status: ${phone.status}` },
        { status: 400 }
      )
    }
    
    // Check if phone is blacklisted
    if (phone.phone_registry && phone.phone_registry.is_blacklisted) {
      return NextResponse.json(
        { error: 'Phone is blacklisted and cannot be sold' },
        { status: 400 }
      )
    }
    
    // Check for existing active sale for this phone
    const { data: existingSale } = await supabase
      .from('sales')
      .select('id')
      .eq('phone_id', saleData.phone_id)
      .in('status', ['active', 'defaulted'])
      .single()
    
    if (existingSale) {
      return NextResponse.json(
        { error: 'Phone already has an active sale' },
        { status: 400 }
      )
    }
    
    // Validate customer exists and belongs to agent
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', saleData.customer_id)
      .eq('agent_id', agent.id)
      .single()
    
    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'Customer not found or does not belong to agent' },
        { status: 404 }
      )
    }
    
    // Calculate balance
    const downPayment = saleData.down_payment || 0
    const balanceRemaining = saleData.selling_price - downPayment
    
    // Validate down payment
    if (downPayment > saleData.selling_price) {
      return NextResponse.json(
        { error: 'Down payment cannot exceed selling price' },
        { status: 400 }
      )
    }
    
    // Create sale
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        agent_id: agent.id,
        phone_id: saleData.phone_id,
        customer_id: saleData.customer_id,
        selling_price: saleData.selling_price,
        down_payment: downPayment,
        balance_remaining: balanceRemaining,
        installment_amount: saleData.installment_amount,
        installment_frequency: saleData.installment_frequency,
        number_of_installments: saleData.number_of_installments,
        status: 'active',
        sale_date: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (saleError) {
      return NextResponse.json(
        { error: 'Failed to create sale', details: saleError.message },
        { status: 500 }
      )
    }
    
    // Generate installment schedules if needed
    if (saleData.installment_frequency && saleData.number_of_installments && saleData.installment_amount) {
      const installments = []
      const now = new Date()
      
      for (let i = 1; i <= saleData.number_of_installments; i++) {
        const dueDate = new Date(now)
        
        switch (saleData.installment_frequency) {
          case 'daily':
            dueDate.setDate(now.getDate() + i)
            break
          case 'weekly':
            dueDate.setDate(now.getDate() + (i * 7))
            break
          case 'monthly':
            dueDate.setDate(now.getDate() + (i * 30))
            break
        }
        
        installments.push({
          sale_id: sale.id,
          installment_number: i,
          amount_due: saleData.installment_amount,
          due_date: dueDate.toISOString(),
          amount_paid: 0,
          is_paid: false,
        })
      }
      
      const { error: installmentsError } = await supabase
        .from('installment_schedules')
        .insert(installments)
      
      if (installmentsError) {
        // Rollback sale if installments creation fails
        await supabase.from('sales').delete().eq('id', sale.id)
        
        return NextResponse.json(
          { error: 'Failed to create installment schedules', details: installmentsError.message },
          { status: 500 }
        )
      }
    }
    
    // Update phone status to sold
    const { error: phoneUpdateError } = await supabase
      .from('phones')
      .update({ status: 'sold' })
      .eq('id', saleData.phone_id)
    
    if (phoneUpdateError) {
      return NextResponse.json(
        { error: 'Failed to update phone status', details: phoneUpdateError.message },
        { status: 500 }
      )
    }
    
    // Fetch complete sale with relations
    const { data: completeSale } = await supabase
      .from('sales')
      .select(`
        *,
        phone:phones(*),
        customer:customers(*),
        installments:installment_schedules(*)
      `)
      .eq('id', sale.id)
      .single()
    
    return NextResponse.json({ sale: completeSale }, { status: 201 })
    
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
