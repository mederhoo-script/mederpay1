import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { customerSchema } from '@/lib/validations'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    
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
        { error: 'Forbidden: Only agents can access customers' },
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
    
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('agent_id', agent.id)
      .single()
    
    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ customer }, { status: 200 })
    
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    
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
        { error: 'Forbidden: Only agents can update customers' },
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
    
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('agent_id', agent.id)
      .single()
    
    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }
    
    const body = await request.json()
    const validation = customerSchema.partial().safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }
    
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .update(validation.data)
      .eq('id', id)
      .eq('agent_id', agent.id)
      .select()
      .single()
    
    if (customerError) {
      return NextResponse.json(
        { error: 'Failed to update customer', details: customerError.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ customer }, { status: 200 })
    
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    
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
        { error: 'Forbidden: Only agents can delete customers' },
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
    
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('agent_id', agent.id)
      .single()
    
    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }
    
    // Soft delete by setting is_active to false
    const { data: customer, error: deleteError } = await supabase
      .from('customers')
      .update({ is_active: false })
      .eq('id', id)
      .eq('agent_id', agent.id)
      .select()
      .single()
    
    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete customer', details: deleteError.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ message: 'Customer deleted successfully', customer }, { status: 200 })
    
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
