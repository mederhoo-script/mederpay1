import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createReservedAccount } from '@/lib/api/monnify'

export async function POST() {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    if (!profile || profile.role !== 'agent_owner') {
      return NextResponse.json(
        { error: 'Forbidden: Only agents can create Monnify accounts' },
        { status: 403 }
      )
    }
    
    // Get agent record
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Check if agent already has a Monnify account
    if (agent.monnify_account_reference && agent.monnify_account_number) {
      return NextResponse.json({
        message: 'Monnify account already exists',
        account: {
          accountReference: agent.monnify_account_reference,
          accountNumber: agent.monnify_account_number,
          bankName: agent.monnify_bank_name,
          accountName: agent.business_name,
        }
      }, { status: 200 })
    }

    // Generate unique account reference
    const accountReference = `AGENT_${agent.id.replace(/-/g, '').substring(0, 20).toUpperCase()}`

    // Create reserved account with Monnify
    try {
      const accountData = await createReservedAccount({
        accountReference,
        accountName: agent.business_name,
        email: user.email,
        bvn: agent.bvn || undefined,
      })

      // Update agent record with Monnify account details
      const { error: updateError } = await supabase
        .from('agents')
        .update({
          monnify_account_reference: accountData.accountReference,
          monnify_account_number: accountData.accountNumber,
          monnify_bank_name: accountData.bankName,
        })
        .eq('id', agent.id)

      if (updateError) {
        console.error('Failed to update agent record:', updateError)
        return NextResponse.json(
          { error: 'Failed to save account details' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        message: 'Monnify account created successfully',
        account: {
          accountReference: accountData.accountReference,
          accountNumber: accountData.accountNumber,
          bankName: accountData.bankName,
          accountName: accountData.accountName,
        }
      }, { status: 201 })

    } catch (monnifyError) {
      console.error('Monnify API error:', monnifyError)
      
      if (monnifyError instanceof Error) {
        return NextResponse.json(
          { error: `Monnify error: ${monnifyError.message}` },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to create Monnify account' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Create account error:', error)
    
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
