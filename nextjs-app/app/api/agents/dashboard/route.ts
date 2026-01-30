import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DashboardStats } from '@/lib/types/database'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get current user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get agent data
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, credit_limit, credit_used, credit_available')
      .eq('user_id', user.id)
      .single()
    
    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }
    
    // Get total phones count
    const { count: totalPhones, error: phonesError } = await supabase
      .from('phones')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agent.id)
    
    if (phonesError) {
      throw new Error('Failed to fetch phones count')
    }
    
    // Get active sales count
    const { count: activeSales, error: salesError } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agent.id)
      .eq('status', 'active')
    
    if (salesError) {
      throw new Error('Failed to fetch active sales count')
    }
    
    // Get outstanding balance (sum of balance_remaining from active sales)
    const { data: salesData, error: balanceError } = await supabase
      .from('sales')
      .select('balance_remaining')
      .eq('agent_id', agent.id)
      .eq('status', 'active')
    
    if (balanceError) {
      throw new Error('Failed to fetch outstanding balance')
    }
    
    const outstandingBalance = salesData?.reduce(
      (sum, sale) => sum + (sale.balance_remaining || 0),
      0
    ) || 0
    
    // Get overdue payments count
    const today = new Date().toISOString().split('T')[0]
    
    // First get all sale IDs for this agent
    const { data: agentSales, error: agentSalesError } = await supabase
      .from('sales')
      .select('id')
      .eq('agent_id', agent.id)
    
    if (agentSalesError) {
      throw new Error('Failed to fetch agent sales')
    }
    
    const saleIds = agentSales?.map(sale => sale.id) || []
    
    let overduePayments = 0
    if (saleIds.length > 0) {
      const { count, error: overdueError } = await supabase
        .from('installment_schedules')
        .select('*', { count: 'exact', head: true })
        .in('sale_id', saleIds)
        .eq('is_paid', false)
        .lt('due_date', today)
      
      if (overdueError) {
        throw new Error('Failed to fetch overdue payments count')
      }
      
      overduePayments = count || 0
    }
    
    // Build dashboard stats response
    const dashboardStats: DashboardStats = {
      total_phones: totalPhones || 0,
      active_sales: activeSales || 0,
      outstanding_balance: outstandingBalance,
      overdue_payments: overduePayments,
      credit_limit: agent.credit_limit,
      credit_used: agent.credit_used,
      credit_available: agent.credit_available,
    }
    
    return NextResponse.json(dashboardStats, { status: 200 })
    
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
