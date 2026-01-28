import axios from 'axios'
import { createHmac } from 'crypto'

interface MonnifyConfig {
  apiKey: string
  secretKey: string
  contractCode: string
  baseUrl: string
}

interface AgentData {
  accountReference: string
  accountName: string
  email?: string
  bvn?: string
}

interface ReservedAccountResponse {
  accountReference: string
  accountNumber: string
  bankName: string
  bankCode: string
  accountName: string
}

interface TransactionStatusResponse {
  transactionReference: string
  paymentReference: string
  amountPaid: number
  totalPayable: number
  settlementAmount: number
  paidOn: string
  paymentStatus: string
  paymentMethod: string
  customerName: string
  customerEmail: string
}

class MonnifyError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message)
    this.name = 'MonnifyError'
  }
}

function getConfig(): MonnifyConfig {
  const apiKey = process.env.MONNIFY_API_KEY
  const secretKey = process.env.MONNIFY_SECRET_KEY
  const contractCode = process.env.MONNIFY_CONTRACT_CODE
  const baseUrl = process.env.MONNIFY_BASE_URL || 'https://api.monnify.com'

  if (!apiKey || !secretKey || !contractCode) {
    throw new MonnifyError('Monnify credentials not configured')
  }

  return { apiKey, secretKey, contractCode, baseUrl }
}

async function getAuthToken(): Promise<string> {
  const config = getConfig()
  const credentials = Buffer.from(`${config.apiKey}:${config.secretKey}`).toString('base64')

  try {
    const response = await axios.post(
      `${config.baseUrl}/api/v1/auth/login`,
      {},
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (response.data?.responseBody?.accessToken) {
      return response.data.responseBody.accessToken
    }

    throw new MonnifyError('Invalid authentication response')
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new MonnifyError(
        'Monnify authentication failed',
        error.response?.status,
        error.response?.data
      )
    }
    throw error
  }
}

export async function createReservedAccount(
  agentData: AgentData
): Promise<ReservedAccountResponse> {
  const config = getConfig()
  const token = await getAuthToken()

  try {
    const response = await axios.post(
      `${config.baseUrl}/api/v2/bank-transfer/reserved-accounts`,
      {
        accountReference: agentData.accountReference,
        accountName: agentData.accountName,
        currencyCode: 'NGN',
        contractCode: config.contractCode,
        customerEmail: agentData.email || `${agentData.accountReference}@mederpay.com`,
        bvn: agentData.bvn,
        customerName: agentData.accountName,
        getAllAvailableBanks: false,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (response.data?.responseBody) {
      const body = response.data.responseBody
      return {
        accountReference: body.accountReference,
        accountNumber: body.accounts?.[0]?.accountNumber || body.accountNumber,
        bankName: body.accounts?.[0]?.bankName || body.bankName,
        bankCode: body.accounts?.[0]?.bankCode || body.bankCode,
        accountName: body.accountName,
      }
    }

    throw new MonnifyError('Invalid reserved account response')
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new MonnifyError(
        'Failed to create reserved account',
        error.response?.status,
        error.response?.data
      )
    }
    throw error
  }
}

export async function getTransactionStatus(
  transactionReference: string
): Promise<TransactionStatusResponse> {
  const config = getConfig()
  const token = await getAuthToken()

  try {
    const response = await axios.get(
      `${config.baseUrl}/api/v2/transactions/${encodeURIComponent(transactionReference)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (response.data?.responseBody) {
      const body = response.data.responseBody
      return {
        transactionReference: body.transactionReference,
        paymentReference: body.paymentReference,
        amountPaid: parseFloat(body.amountPaid || '0'),
        totalPayable: parseFloat(body.totalPayable || '0'),
        settlementAmount: parseFloat(body.settlementAmount || '0'),
        paidOn: body.paidOn,
        paymentStatus: body.paymentStatus,
        paymentMethod: body.paymentMethod,
        customerName: body.customer?.name || '',
        customerEmail: body.customer?.email || '',
      }
    }

    throw new MonnifyError('Invalid transaction status response')
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new MonnifyError(
        'Failed to get transaction status',
        error.response?.status,
        error.response?.data
      )
    }
    throw error
  }
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const webhookSecret = process.env.MONNIFY_WEBHOOK_SECRET

  if (!webhookSecret) {
    throw new MonnifyError('Monnify webhook secret not configured')
  }

  const computedSignature = createHmac('sha512', webhookSecret)
    .update(payload)
    .digest('hex')

  return computedSignature === signature
}
