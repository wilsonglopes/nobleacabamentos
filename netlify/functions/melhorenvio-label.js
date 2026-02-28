// Netlify Function: Melhor Envio Label

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
        const { order_id } = JSON.parse(event.body);
        const {
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY,
            ME_TOKEN,
            STORE_ORIGIN_CEP,
            USE_SANDBOX,
            STORE_NAME,
            STORE_DOCUMENT,
            STORE_PHONE,
            STORE_EMAIL,
            STORE_ADDRESS,
            STORE_NUMBER,
            STORE_DISTRICT,
            STORE_CITY,
            STORE_STATE
        } = process.env;

        const ME_URL = USE_SANDBOX === 'true' ? "https://sandbox.melhorenvio.com.br" : "https://www.melhorenvio.com.br";

        // 1. Fetch Order Data
        const orderRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order_id}&select=*,order_items(*),profiles(*)`, {
            headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
        });
        const orders = await orderRes.json();
        if (!orders || orders.length === 0) throw new Error("Pedido não encontrado.");

        const order = orders[0];
        const receiver = order.profiles;

        // 2. Fetch Unit Dims for items
        const dbProductsRes = await fetch(`${SUPABASE_URL}/rest/v1/products?id=in.(${order.order_items.map(i => i.product_id).join(',')})`, {
            headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
        });
        const dbProducts = await dbProductsRes.json();

        // 3. Split into Volumes
        const splitIntoVolumes = (orderItems, dbProducts) => {
            const volumes = [];
            const MAX_WEIGHT_G = 30000;
            const MAX_DIM = 100;

            orderItems.forEach(item => {
                const dbP = dbProducts.find(p => String(p.id) === String(item.product_id)) || {};
                const qty = Number(item.quantity) || 1;
                const unitW = dbP.weight_g || 1000;
                const unitL = dbP.length_cm || 50;
                const unitWi = dbP.width_cm || 20;
                const unitH = dbP.height_cm || 15;

                const maxAcross = Math.floor(MAX_DIM / unitWi) || 1;
                const maxHigh = Math.floor(MAX_DIM / unitH) || 1;
                const maxItemsByDim = maxAcross * maxHigh;
                const maxItemsByWeight = Math.floor(MAX_WEIGHT_G / unitW) || 1;

                const unitsPerBucket = Math.min(maxItemsByDim, maxItemsByWeight);

                let remainingQty = qty;
                while (remainingQty > 0) {
                    const currentQty = Math.min(remainingQty, unitsPerBucket);
                    const widthCount = Math.min(maxAcross, Math.ceil(Math.sqrt(currentQty)));
                    const heightCount = Math.ceil(currentQty / widthCount);

                    volumes.push({
                        width: Math.max(15, unitWi * widthCount),
                        height: Math.max(2, unitH * heightCount),
                        length: Math.max(15, unitL),
                        weight: Math.max(0.1, (unitW * currentQty) / 1000)
                    });
                    remainingQty -= currentQty;
                }
            });
            return volumes;
        };

        const finalVolumes = splitIntoVolumes(order.order_items, dbProducts);
        const calculatedInsurance = Number(order.total_amount) - Number(order.shipping_cost);
        const cappedInsurance = Math.min(calculatedInsurance, 1000);

        const cartPayload = {
            service: order.shipping_method_id,
            from: {
                name: STORE_NAME || "Noble Acabamentos",
                phone: (STORE_PHONE || "48988799001").replace(/\D/g, ''),
                email: STORE_EMAIL || "contato@nobleacabamentos.com.br",
                document: (STORE_DOCUMENT || "32514476000137").replace(/\D/g, ''),
                address: STORE_ADDRESS || "Rua Zelcy Burigo",
                number: STORE_NUMBER || "658",
                district: STORE_DISTRICT || "Jardim Itália",
                city: STORE_CITY || "Cocal do Sul",
                state_abbr: STORE_STATE || "SC",
                postal_code: (STORE_ORIGIN_CEP || "").replace(/\D/g, '')
            },
            to: { name: receiver.full_name || "Cliente", phone: (receiver.phone || "").replace(/\D/g, ''), email: receiver.email || "email@naoinformado.com", document: (receiver.cpf_cnpj || "").replace(/\D/g, ''), address: receiver.logradouro, number: receiver.numero, complement: receiver.complemento || "", district: receiver.bairro, city: receiver.cidade, state_abbr: receiver.uf, postal_code: (receiver.cep || "").replace(/\D/g, '') },
            products: order.order_items.map(i => ({ name: i.name, quantity: i.quantity, unitary_value: Number(i.price) })),
            volumes: finalVolumes,
            options: { insurance_value: cappedInsurance, receipt: false, own_hand: false }
        };

        // 4. ME API Interactions
        // A: Cart
        const cartRes = await fetch(`${ME_URL}/api/v2/me/cart`, {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': `Bearer ${ME_TOKEN}`, 'User-Agent': 'NobleAcabamentos' },
            body: JSON.stringify(cartPayload)
        });
        const cartData = await cartRes.json();
        if (!cartRes.ok) throw new Error(cartData.message || "Erro no Carrinho ME");
        const shipId = cartData.id;

        // B: Checkout
        const checkoutRes = await fetch(`${ME_URL}/api/v2/me/shipment/checkout`, {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': `Bearer ${ME_TOKEN}` },
            body: JSON.stringify({ orders: [shipId] })
        });
        if (!checkoutRes.ok) throw new Error("Erro no Checkout ME");

        // C: Generate
        await fetch(`${ME_URL}/api/v2/me/shipment/generate`, {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': `Bearer ${ME_TOKEN}` },
            body: JSON.stringify({ orders: [shipId] })
        });

        // D: Print (Wait a bit potentially, but for local tests we just call it)
        const printRes = await fetch(`${ME_URL}/api/v2/me/shipment/print`, {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': `Bearer ${ME_TOKEN}` },
            body: JSON.stringify({ mode: 'pdf', orders: [shipId] })
        });
        const printData = await printRes.json();

        // 5. Update Supabase
        await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order_id}`, {
            method: 'PATCH',
            headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'enviado', label_url: printData.url || null })
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, labelUrl: printData.url || null })
        };
    } catch (error) {
        console.error('Error generating label:', error);

        // Check if it's an authentication error from ME to provide better guidance
        let errorMessage = error.message;
        if (errorMessage === 'Unauthenticated' || errorMessage.includes('401')) {
            const isSandbox = process.env.USE_SANDBOX === 'true';
            errorMessage = `Falha de Autenticação no Melhor Envio (${isSandbox ? 'Modo Sandbox' : 'Modo Produção'}). Verifique se o ME_TOKEN corresponde ao ambiente correto e se USE_SANDBOX está configurado corretamente no Netlify.`;
        }

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: errorMessage })
        };
    }
};
