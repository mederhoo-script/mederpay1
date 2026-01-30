import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ imei: string }> }
) {
  try {
    const { imei } = await params

    if (!imei) {
      return NextResponse.json(
        { error: 'IMEI is required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Look up phone by IMEI
    const { data: phone, error: phoneError } = await supabase
      .from('phones')
      .select('id, agent_id')
      .eq('imei', imei)
      .single()

    if (phoneError || !phone) {
      return NextResponse.json({
        should_lock: false,
        message: 'Phone not found'
      })
    }

    // Find active sale for the phone
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('id, balance_remaining')
      .eq('phone_id', phone.id)
      .eq('status', 'active')
      .single()

    if (saleError || !sale) {
      return NextResponse.json({
        should_lock: false,
        message: 'No active sale found'
      })
    }

    // Check for overdue installments
    const { data: overdueInstallments, error: installmentError } = await supabase
      .from('installment_schedules')
      .select('*')
      .eq('sale_id', sale.id)
      .eq('is_paid', false)
      .lt('due_date', new Date().toISOString().split('T')[0])

    if (installmentError) {
      console.error('Error fetching installments:', installmentError)
      return NextResponse.json(
        { error: 'Failed to check installment status' },
        { status: 500 }
      )
    }

    const hasOverdue = overdueInstallments && overdueInstallments.length > 0

    return NextResponse.json({
      should_lock: hasOverdue,
      balance: sale.balance_remaining,
      overdue_count: hasOverdue ? overdueInstallments.length : 0,
      message: hasOverdue ? 'Payment overdue' : 'Payment up to date'
    })
  } catch (error) {
    console.error('Unexpected error in enforcement status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
