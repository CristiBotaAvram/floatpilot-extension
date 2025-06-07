// api/_utils/db.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // allows update/delete access to FF and tier

export const supabase = createClient(supabaseUrl, supabaseServiceKey)
