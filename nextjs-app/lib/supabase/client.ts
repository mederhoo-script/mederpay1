import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a mock client that logs errors instead of throwing
    // This prevents the entire page from crashing when env vars are missing
    console.warn(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.'
    )
    
    // Create a chainable mock query builder
    const createMockQuery = () => {
      const mockQuery: any = {
        select: () => mockQuery,
        insert: () => mockQuery,
        update: () => mockQuery,
        delete: () => mockQuery,
        eq: () => mockQuery,
        neq: () => mockQuery,
        gt: () => mockQuery,
        gte: () => mockQuery,
        lt: () => mockQuery,
        lte: () => mockQuery,
        like: () => mockQuery,
        ilike: () => mockQuery,
        is: () => mockQuery,
        in: () => mockQuery,
        contains: () => mockQuery,
        containedBy: () => mockQuery,
        rangeGt: () => mockQuery,
        rangeGte: () => mockQuery,
        rangeLt: () => mockQuery,
        rangeLte: () => mockQuery,
        rangeAdjacent: () => mockQuery,
        overlaps: () => mockQuery,
        textSearch: () => mockQuery,
        match: () => mockQuery,
        not: () => mockQuery,
        or: () => mockQuery,
        filter: () => mockQuery,
        order: () => mockQuery,
        limit: () => mockQuery,
        range: () => mockQuery,
        single: () => mockQuery,
        maybeSingle: () => mockQuery,
        then: (resolve: any) => resolve({ data: null, error: new Error('Supabase not configured') }),
      }
      return mockQuery
    }
    
    // Return a minimal mock client that doesn't crash
    return {
      auth: {
        getSession: async () => ({ data: { session: null }, error: new Error('Supabase not configured') }),
        getUser: async () => ({ data: { user: null }, error: new Error('Supabase not configured') }),
        signOut: async () => ({ error: new Error('Supabase not configured') }),
      },
      from: () => createMockQuery(),
    } as any
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
