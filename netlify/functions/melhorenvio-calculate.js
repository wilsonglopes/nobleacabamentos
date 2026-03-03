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
        const body = JSON.parse(event.body);
        const { zip, items } = body;

        if (!zip || !items || !Array.isArray(items) || items.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "CEP de destino e itens são obrigatórios." })
            };
        }

        const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ME_TOKEN, STORE_ORIGIN_CEP, USE_SANDBOX } = process.env;

        if (!ME_TOKEN || !STORE_ORIGIN_CEP) {
            console.error("Missing environment variables: ME_TOKEN or STORE_ORIGIN_CEP");
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Configuração do servidor incompleta (ME_TOKEN/CEP)." })
            };
        }

        const ME_URL = USE_SANDBOX === 'true' ? "https://sandbox.melhorenvio.com.br" : "https://www.melhorenvio.com.br";

        const productIds = items.map(i => i.id);
        const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/products?id=in.(${productIds.join(',')})`, {
            headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            }
        });

        if (!supabaseRes.ok) {
            const errText = await supabaseRes.text();
            throw new Error(`Erro ao buscar produtos no Supabase: ${errText}`);
        }

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

                    // MELHOR ENVIO MIN DIMENSIONS: 15x2x15
                    volumes.push({
                        width: Math.max(15, unitWi * widthCount),
                        height: Math.max(2, unitH * heightCount),
                        length: Math.max(15, unitL),
                        weight: Math.max(0.1, (unitW * currentQty) / 1000),
                        insurance_value: Number(item.price) * currentQty
                    });
                    remainingQty -= currentQty;
                }
            });
            return volumes;
        };

        const finalVolumes = splitIntoVolumes(items, dbProducts);

        const meRes = await fetch(`${ME_URL}/api/v2/me/shipment/calculate`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ME_TOKEN}`,
                'User-Agent': 'NobleAcabamentos'
            },
            body: JSON.stringify({
                from: { postal_code: STORE_ORIGIN_CEP.replace(/\D/g, '') },
                to: { postal_code: zip.replace(/\D/g, '') },
                volumes: finalVolumes
            })
        });

        if (!meRes.ok) {
            const meErrorText = await meRes.text();
            console.error("Melhor Envio API Error:", meErrorText);
            throw new Error(`Erro na API do Melhor Envio: ${meRes.status} ${meErrorText}`);
        }

        const meData = await meRes.json();

        const options = (Array.isArray(meData) ? meData : [])
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
            body: JSON.stringify({ options, debug: finalVolumes })
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
