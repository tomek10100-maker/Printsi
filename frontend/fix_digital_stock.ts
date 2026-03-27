import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ucclcvfiwyxejeuufhbp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjY2xjdmZpd3l4ZWpldXVmaGJwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDkwMzU4NywiZXhwIjoyMDg2NDc5NTg3fQ.cCAsh72y1Nlsg0Rm9LxlTxbeGKLtE3JuY0bAb_iGne8'
)

async function fixStock() {
  console.log('Fixing stocks for digital files...')
  const { data, error } = await supabase
    .from('offers')
    .update({ stock: 999999 })
    .eq('category', 'digital')
    .select()

  if (error) {
    console.error('Error updating stock:', error)
  } else {
    console.log(`Success! Updated ${data?.length || 0} digital offers to 999,999 stock.`)
  }
}

fixStock()
