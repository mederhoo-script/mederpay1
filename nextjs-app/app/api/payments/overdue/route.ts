import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
        { error: 'Forbidden: Only agents can access overdue payments' },
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
    
    const today = new Date().toISOString().split('T')[0]
    
    // Query overdue installments
    const { data: overdueInstallments, error: overdueError } = await supabase
      .from('installment_schedules')
      .select(`
        *,
        sale:sales!inner(
          *,
          phone:phones(*),
          customer:customers(*)
        )
      `)
      .eq('is_paid', false)
      .lt('due_date', today)
      .eq('sale.agent_id', agent.id)
      .eq('sale.status', 'active')
      .order('due_date', { ascending: true })
    
    if (overdueError) {
      return NextResponse.json(
        { error: overdueError.message },
        { status: 500 }
      )
    }
    
    // Calculate days overdue for each installment
    const overdueWithDays = overdueInstallments?.map(installment => {
      const dueDate = new Date(installment.due_date)
      const todayDate = new Date(today)
      const daysOverdue = Math.floor((todayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      
      return {
        ...installment,
        days_overdue: daysOverdue
      }
    }) || []
    
    return NextResponse.json({ 
      overdue_installments: overdueWithDays,
      count: overdueWithDays.length 
    }, { status: 200 })
    
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
