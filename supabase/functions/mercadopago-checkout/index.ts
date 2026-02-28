// Supabase Edge Function: mercadopago-checkout
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { productId } = await req.json()
    
    // Configurações vindas do ambiente local (.env)
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1. Buscar detalhes do produto no banco (por segurança)
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('name, price, brand')
      .eq('id', productId)
      .single()

    if (productError || !product) throw new Error('Produto não encontrado')

    // 2. Criar Preferência no Mercado Pago
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            title: `${product.name} - ${product.brand}`,
            unit_price: product.price,
            quantity: 1,
            currency_id: 'BRL',
          }
        ],
        back_urls: {
          success: `http://127.0.0.1:5500/loja.html?status=success`,
          failure: `http://127.0.0.1:5500/loja.html?status=failure`,
          pending: `http://127.0.0.1:5500/loja.html?status=pending`,
        },
        auto_return: 'approved',
      }),
    })

    const preference = await response.json()

    return new Response(
      JSON.stringify({ checkoutUrl: preference.init_point }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})
