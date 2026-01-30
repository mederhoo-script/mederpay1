import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { phoneSchema } from '@/lib/validations'

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
        { error: 'Forbidden: Only agents can access phones' },
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
    
    const { data: phones, error: phonesError } = await supabase
      .from('phones')
      .select('*')
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false })
    
    if (phonesError) {
      return NextResponse.json(
        { error: phonesError.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ phones }, { status: 200 })
    
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
        { error: 'Forbidden: Only agents can create phones' },
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
    const validation = phoneSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }
    
    const phoneData = validation.data
    
    // Check if IMEI already exists in platform registry
    const { data: existingRegistry } = await supabase
      .from('platform_phone_registry')
      .select('*')
      .eq('imei', phoneData.imei)
      .single()
    
    if (existingRegistry) {
      if (existingRegistry.is_blacklisted) {
        return NextResponse.json(
          { error: 'Phone is blacklisted', reason: existingRegistry.blacklist_reason },
          { status: 400 }
        )
      }
      
      if (existingRegistry.current_agent_id && existingRegistry.current_agent_id !== agent.id) {
        return NextResponse.json(
          { error: 'IMEI already registered to another agent' },
          { status: 400 }
        )
      }
    }
    
    // Insert into platform_phone_registry first
    if (!existingRegistry) {
      const { error: registryError } = await supabase
        .from('platform_phone_registry')
        .insert({
          imei: phoneData.imei,
          first_registered_by: agent.id,
          current_agent_id: agent.id,
        })
      
      if (registryError) {
        return NextResponse.json(
          { error: 'Failed to register phone in platform registry', details: registryError.message },
          { status: 500 }
        )
      }
    } else {
      // Update current_agent_id if needed
      await supabase
        .from('platform_phone_registry')
        .update({ current_agent_id: agent.id })
        .eq('imei', phoneData.imei)
    }
    
    // Insert into phones table
    const { data: phone, error: phoneError } = await supabase
      .from('phones')
      .insert({
        agent_id: agent.id,
        imei: phoneData.imei,
        brand: phoneData.brand,
        model: phoneData.model,
        serial_number: phoneData.serial_number,
        purchase_price: phoneData.purchase_price,
        selling_price: phoneData.selling_price,
      })
      .select()
      .single()
    
    if (phoneError) {
      return NextResponse.json(
        { error: 'Failed to create phone', details: phoneError.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ phone }, { status: 201 })
    
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
