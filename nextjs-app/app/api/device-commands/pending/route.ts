import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const imei = searchParams.get('imei')

    if (!imei) {
      return NextResponse.json(
        { error: 'IMEI query parameter is required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Get pending commands for this IMEI where token is not expired
    const { data: commands, error: fetchError } = await supabase
      .from('device_commands')
      .select('*')
      .eq('imei', imei)
      .eq('status', 'pending')
      .gt('token_expires_at', new Date().toISOString())
      .order('created_at', { ascending: true })

    if (fetchError) {
      console.error('Error fetching commands:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch commands' },
        { status: 500 }
      )
    }

    if (!commands || commands.length === 0) {
      return NextResponse.json({ commands: [] })
    }

    // Update commands to 'sent' status
    const commandIds = commands.map(cmd => cmd.id)
    const { error: updateError } = await supabase
      .from('device_commands')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .in('id', commandIds)

    if (updateError) {
      console.error('Error updating command status:', updateError)
      // Continue anyway - commands were fetched successfully
    }

    // Return commands with auth_token (not hash)
    const commandsToReturn = commands.map(cmd => ({
      id: cmd.id,
      command_type: cmd.command_type,
      reason: cmd.reason,
      auth_token: cmd.auth_token,
      token_expires_at: cmd.token_expires_at,
      issued_at: cmd.issued_at
    }))

    return NextResponse.json({ commands: commandsToReturn })
  } catch (error) {
    console.error('Unexpected error in pending commands:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
