import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { healthCheckSchema } from '@/lib/validations'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const result = healthCheckSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: result.error.issues },
        { status: 400 }
      )
    }

    const healthCheck = result.data
    const supabase = createServiceClient()

    // Look up agent by IMEI
    const { data: phone } = await supabase
      .from('phones')
      .select('agent_id')
      .eq('imei', healthCheck.imei)
      .single()

    // Store as audit log entry
    const { error: insertError } = await supabase
      .from('audit_logs')
      .insert({
        imei: healthCheck.imei,
        agent_id: phone?.agent_id || null,
        event_type: 'HEALTH_CHECK',
        event_data: {
          is_device_admin_enabled: healthCheck.is_device_admin_enabled,
          is_companion_app_installed: healthCheck.is_companion_app_installed,
          companion_app_version: healthCheck.companion_app_version,
          android_version: healthCheck.android_version,
          battery_level: healthCheck.battery_level,
          is_locked: healthCheck.is_locked,
          lock_reason: healthCheck.lock_reason
        },
        app_version: healthCheck.app_version,
        timestamp: new Date().toISOString()
      })

    if (insertError) {
      console.error('Error inserting health check:', insertError)
      return NextResponse.json(
        { error: 'Failed to store health check' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error in health check:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
