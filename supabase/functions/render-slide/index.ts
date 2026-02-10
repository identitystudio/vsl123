import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { slideUrl, width = 1920, height = 1080 } = await req.json()

    if (!slideUrl) {
      throw new Error('slideUrl is required')
    }

    const replicateToken = Deno.env.get('REPLICATE_API_TOKEN')
    if (!replicateToken) {
      throw new Error('REPLICATE_API_TOKEN not configured')
    }

    // Call Replicate API to screenshot the URL
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${replicateToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: '4ab17beaf8a709ede2dd3d9054c4b2c8727e70f564e3a38e14cb44de6b56f6b4',
        input: {
          url: slideUrl,
          w: width,
          h: height,
          wait_until: 2, // Wait 2 seconds for page to load
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Replicate API error: ${error}`)
    }

    const prediction = await response.json()

    // Poll for completion
    let result = prediction
    while (result.status === 'starting' || result.status === 'processing') {
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const statusResponse = await fetch(result.urls.get, {
        headers: {
          'Authorization': `Token ${replicateToken}`,
        },
      })
      
      result = await statusResponse.json()
    }

    if (result.status === 'failed') {
      throw new Error(`Screenshot failed: ${result.error}`)
    }

    return new Response(
      JSON.stringify({ imageUrl: result.output }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
