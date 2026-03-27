type ApiRequest = {
  method?: string
}

type ApiResponse = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => { json: (body: unknown) => void }
}

export default function handler (req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

  return res.status(200).json({
    ok: Boolean(supabaseUrl && hasServiceRole),
    has_supabase_url: Boolean(supabaseUrl),
    has_service_role_key: hasServiceRole,
  })
}
