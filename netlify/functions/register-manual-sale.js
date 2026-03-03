// Netlify Function: Register Manual Sale
// This function runs with Service Role privileges to bypass RLS policies
// since admins may need to create orders for other users.

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
        const { order, items } = JSON.parse(event.body);
        const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error("Missing Supabase configuration environment variables.");
        }

        // 1. Insert Order
        const orderRes = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(order)
        });

        if (!orderRes.ok) {
            const errText = await orderRes.text();
            throw new Error(`Error creating order: ${errText}`);
        }

        const createdOrders = await orderRes.json();
        const newOrder = createdOrders[0];

        // 2. Insert Order Items
        const itemsWithOrderId = items.map(item => ({
            ...item,
            order_id: newOrder.id
        }));

        const itemsRes = await fetch(`${SUPABASE_URL}/rest/v1/order_items`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(itemsWithOrderId)
        });

        if (!itemsRes.ok) {
            const errText = await itemsRes.text();
            // Optional: We could attempt to delete the order here if items fail, 
            // but Supabase doesn't have native multi-table transactions via REST easily.
            throw new Error(`Error creating order items: ${errText}`);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, order_id: newOrder.id })
        };

    } catch (error) {
        console.error('Manual Sale Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
