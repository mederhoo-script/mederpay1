import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { batchAuditLogsSchema } from '@/lib/validations'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const result = batchAuditLogsSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: result.error.issues },
        { status: 400 }
      )
    }

    const { logs } = result.data
    const supabase = createServiceClient()

    // Get unique IMEIs from logs
    const uniqueImeis = [...new Set(logs.map(log => log.imei))]

    // Fetch agent_ids for all IMEIs in one query
    const { data: phones } = await supabase
      .from('phones')
      .select('imei, agent_id')
      .in('imei', uniqueImeis)

    // Create a map of IMEI to agent_id
    const imeiToAgentMap = new Map(
      phones?.map(phone => [phone.imei, phone.agent_id]) || []
    )

    // Prepare log entries for bulk insert
    const logEntries = logs.map(log => ({
      imei: log.imei,
      agent_id: imeiToAgentMap.get(log.imei) || null,
      event_type: log.event_type,
      event_data: log.event_data,
      app_version: log.app_version,
      timestamp: log.timestamp
    }))

    // Bulk insert all logs
    const { error: insertError } = await supabase
      .from('audit_logs')
      .insert(logEntries)

    if (insertError) {
      console.error('Error inserting audit logs:', insertError)
      return NextResponse.json(
        { error: 'Failed to store audit logs' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      count: logs.length
    })
  } catch (error) {
    console.error('Unexpected error in batch audit logs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
