import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select(`
        *,
        phone:phones(*),
        customer:customers(*),
        installments:installment_schedules(*)
      `)
      .eq('id', id)
      .eq('agent_id', agent.id)
      .single()
    
    if (saleError || !sale) {
      return NextResponse.json(
        { error: 'Sale not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ sale }, { status: 200 })
    
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
