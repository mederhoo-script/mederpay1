import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { auditLogEntrySchema } from '@/lib/validations'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const result = auditLogEntrySchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: result.error.issues },
        { status: 400 }
      )
    }

    const logEntry = result.data
    const supabase = createServiceClient()

    // Look up agent by IMEI
    const { data: phone } = await supabase
      .from('phones')
      .select('agent_id')
      .eq('imei', logEntry.imei)
      .single()

    // Store audit log entry
    const { error: insertError } = await supabase
      .from('audit_logs')
      .insert({
        imei: logEntry.imei,
        agent_id: phone?.agent_id || null,
        event_type: logEntry.event_type,
        event_data: logEntry.event_data,
        app_version: logEntry.app_version,
        timestamp: logEntry.timestamp
      })

    if (insertError) {
      console.error('Error inserting audit log:', insertError)
      return NextResponse.json(
        { error: 'Failed to store audit log' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error in audit log:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
