import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import crypto from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { auth_token } = body

    if (!auth_token) {
      return NextResponse.json(
        { error: 'auth_token is required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Get the command
    const { data: command, error: fetchError } = await supabase
      .from('device_commands')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !command) {
      return NextResponse.json(
        { error: 'Command not found' },
        { status: 404 }
      )
    }

    // Verify auth_token matches hash
    const hash = crypto.createHash('sha256').update(auth_token).digest('hex')
    if (hash !== command.auth_token_hash) {
      return NextResponse.json(
        { error: 'Invalid auth_token' },
        { status: 401 }
      )
    }

    // Check if token expired
    if (new Date(command.token_expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Token expired' },
        { status: 401 }
      )
    }

    // Update status to acknowledged
    const { error: updateError } = await supabase
      .from('device_commands')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating command status:', updateError)
      return NextResponse.json(
        { error: 'Failed to update command status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Command acknowledged'
    })
  } catch (error) {
    console.error('Unexpected error in acknowledge command:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
