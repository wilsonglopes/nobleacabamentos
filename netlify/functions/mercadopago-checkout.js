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
        const { items, shipping, order_id, user_info } = JSON.parse(event.body);
        const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

        if (!MP_ACCESS_TOKEN) {
            throw new Error('MP_ACCESS_TOKEN not configured');
        }

        // Map product items
        const mpItems = items.map(item => ({
            id: item.id || item.product_id, // Handles both cart items and order items
            title: item.name,
            unit_price: Number(item.price),
            quantity: Number(item.quantity),
            currency_id: 'BRL',
        }));

        // Add shipping as an item if present
        if (shipping && Number(shipping.price) > 0) {
            mpItems.push({
                id: 'shipping-' + (shipping.id || 'default'),
                title: 'Frete: ' + (shipping.name || 'Entrega'),
                unit_price: Number(shipping.price),
                quantity: 1,
                currency_id: 'BRL'
            });
        }

        // Prepare Payer data if available
        let payerData = {};
        if (user_info) {
            const nameParts = (user_info.full_name || '').split(' ');
            const firstName = nameParts[0] || 'Cliente';
            const lastName = nameParts.slice(1).join(' ') || 'Noble';
            const doc = (user_info.cpf_cnpj || '').replace(/\D/g, '');

            payerData = {
                name: firstName,
                surname: lastName,
                email: user_info.email || '',
                identification: {
                    type: doc.length > 11 ? 'CNPJ' : 'CPF',
                    number: doc
                },
                address: {
                    zip_code: (user_info.cep || '').replace(/\D/g, ''),
                    street_name: user_info.logradouro || '',
                    street_number: parseInt(user_info.numero) || 0,
                    neighborhood: user_info.bairro || '',
                    city: user_info.cidade || '',
                    federal_unit: user_info.uf || ''
                }
            };
        }

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
                payer: user_info ? payerData : undefined,
                external_reference: order_id || '', // Linked to the order ID in Supabase
                back_urls: {
                    success: `${baseUrl}/loja.html?status=success&order_id=${order_id || ''}`,
                    failure: `${baseUrl}/loja.html?status=failure&order_id=${order_id || ''}`,
                    pending: `${baseUrl}/loja.html?status=pending&order_id=${order_id || ''}`,
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
