// Netlify Function: Mercado Pago Checkout

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'OPTIONS, POST'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed', headers };
    }

    try {
        const { items } = JSON.parse(event.body);
        const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

        if (!MP_ACCESS_TOKEN) {
            throw new Error('MP_ACCESS_TOKEN not configured');
        }

        const mpItems = items.map(item => ({
            id: item.id,
            title: item.name,
            unit_price: Number(item.price),
            quantity: Number(item.quantity),
            currency_id: 'BRL',
        }));

        // Determine base URL for back_urls
        const protocol = event.headers['x-forwarded-proto'] || 'http';
        const host = event.headers['host'];
        const baseUrl = `${protocol}://${host}`;

        const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                items: mpItems,
                back_urls: {
                    success: `${baseUrl}/loja.html?status=success`,
                    failure: `${baseUrl}/loja.html?status=failure`,
                    pending: `${baseUrl}/loja.html?status=pending`,
                },
                auto_return: "approved"
            }),
        });

        const preference = await mpRes.json();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ checkoutUrl: preference.init_point })
        };
    } catch (err) {
        console.error('Error creating MP preference:', err);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: err.message })
        };
    }
};
