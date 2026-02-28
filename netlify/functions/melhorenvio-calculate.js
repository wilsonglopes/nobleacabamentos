// Netlify Function: Melhor Envio Calculate

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'OPTIONS, POST'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }

    try {
        const { zip, items } = JSON.parse(event.body);
        const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ME_TOKEN, STORE_ORIGIN_CEP, USE_SANDBOX } = process.env;

        const ME_URL = USE_SANDBOX === 'true' ? "https://sandbox.melhorenvio.com.br" : "https://www.melhorenvio.com.br";

        const productIds = items.map(i => i.id);
        const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/products?id=in.(${productIds.join(',')})`, {
            headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            }
        });
        const dbProducts = await supabaseRes.json();

        // Intelligent Volume Splitting (30kg buckets)
        const splitIntoVolumes = (items, dbProducts) => {
            const volumes = [];
            const MAX_WEIGHT_G = 30000;
            const MAX_DIM = 100;

            items.forEach(item => {
                const dbP = dbProducts.find(p => String(p.id) === String(item.id)) || {};
                const qty = Number(item.quantity) || 1;

                const unitW = dbP.weight_g || 1000;
                const unitL = dbP.length_cm || 50;
                const unitWi = dbP.width_cm || 20;
                const unitH = dbP.height_cm || 15;

                // Max items based on weight and dimensions (limiting to MAX_DIM)
                const maxAcross = Math.floor(MAX_DIM / unitWi) || 1;
                const maxHigh = Math.floor(MAX_DIM / unitH) || 1;
                const maxItemsByDim = maxAcross * maxHigh;
                const maxItemsByWeight = Math.floor(MAX_WEIGHT_G / unitW) || 1;

                const unitsPerBucket = Math.min(maxItemsByDim, maxItemsByWeight);

                let remainingQty = qty;
                while (remainingQty > 0) {
                    const currentQty = Math.min(remainingQty, unitsPerBucket);

                    // Try to make the stack as "square" as possible within the constraints
                    const widthCount = Math.min(maxAcross, Math.ceil(Math.sqrt(currentQty)));
                    const heightCount = Math.ceil(currentQty / widthCount);

                    volumes.push({
                        id: `${item.id}_vol_${volumes.length}`,
                        width: unitWi * widthCount,
                        height: unitH * heightCount,
                        length: unitL,
                        weight: (unitW * currentQty) / 1000,
                        insurance_value: Number(item.price) * currentQty,
                        quantity: 1
                    });
                    remainingQty -= currentQty;
                }
            });
            return volumes;
        };

        const mappedProducts = splitIntoVolumes(items, dbProducts);

        const meRes = await fetch(`${ME_URL}/api/v2/me/shipment/calculate`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ME_TOKEN}`,
                'User-Agent': 'NobleAcabamentos'
            },
            body: JSON.stringify({
                from: { postal_code: STORE_ORIGIN_CEP },
                to: { postal_code: zip },
                products: mappedProducts
            })
        });

        const meData = await meRes.json();
        const options = (meData || [])
            .filter(opt => !opt.error && !opt.name.toLowerCase().includes('centralizado'))
            .map(opt => ({
                id: opt.id,
                name: opt.name,
                price: opt.price,
                delivery_time: opt.delivery_time,
                company: { name: opt.company.name, picture: opt.company.picture }
            }))
            .sort((a, b) => Number(a.price) - Number(b.price));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ options, debug: mappedProducts })
        };
    } catch (error) {
        console.error('Error calculating shipping:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
