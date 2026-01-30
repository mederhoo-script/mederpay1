import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ imei: string }> }
) {
  try {
    const { imei } = await params

    if (!imei || imei.length !== 15) {
      return NextResponse.json(
        { error: 'Valid IMEI is required (15 digits)' },
        { status: 400 }
      )
    }

    // Create Supabase service client (public API, no auth required)
    const supabase = createServiceClient()

    // Find phone by IMEI
    const { data: phone, error: phoneError } = await supabase
      .from('phones')
      .select('*, agent:agents(*)')
      .eq('imei', imei)
      .single()

    if (phoneError || !phone) {
      return NextResponse.json(
        { error: 'Phone not found' },
        { status: 404 }
      )
    }

    // Get current week's start and end dates (Monday to Sunday)
    const now = new Date()
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() + mondayOffset)
    weekStart.setHours(0, 0, 0, 0)
    
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    // Get billing records for current week
    const { data: billingRecords, error: billingError } = await supabase
      .from('agent_billing')
      .select('*')
      .eq('agent_id', phone.agent_id)
      .gte('billing_period_start', weekStart.toISOString().split('T')[0])
      .lte('billing_period_end', weekEnd.toISOString().split('T')[0])
      .order('created_at', { ascending: false })

    if (billingError) {
      console.error('Error fetching billing records:', billingError)
    }

    const totalDue = billingRecords?.reduce((sum, record) => {
      return sum + (parseFloat(record.amount_due.toString()) - parseFloat(record.amount_paid.toString()))
    }, 0) || 0

    const hasPendingBills = billingRecords?.some(
      record => record.status === 'pending' || record.status === 'overdue'
    ) || false

    const overdueAmount = billingRecords?.reduce((sum, record) => {
      if (record.status === 'overdue') {
        return sum + (parseFloat(record.amount_due.toString()) - parseFloat(record.amount_paid.toString()))
      }
      return sum
    }, 0) || 0

    return NextResponse.json({
      imei,
      agentId: phone.agent_id,
      businessName: phone.agent.business_name,
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      totalDue,
      overdueAmount,
      hasPendingBills,
      billingRecords: billingRecords?.map(record => ({
        id: record.id,
        billingPeriodStart: record.billing_period_start,
        billingPeriodEnd: record.billing_period_end,
        amountDue: record.amount_due,
        amountPaid: record.amount_paid,
        status: record.status,
        dueDate: record.due_date,
        paidDate: record.paid_date,
      })) || [],
    }, { status: 200 })

  } catch (error) {
    console.error('Settlement API error:', error)
    
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
