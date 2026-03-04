// Netlify Function: Manage Order
// This function handles updating order status or deleting orders with Service Role privileges.

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
        const { action, order_id } = JSON.parse(event.body);
        const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error("Missing Supabase configuration environment variables.");
        }

        if (!order_id) throw new Error("ID do pedido é obrigatório.");

        if (action === 'pay') {
            // Update order status to 'pago'
            const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order_id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_SERVICE_ROLE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'pago' })
            });

            if (!updateRes.ok) {
                const errText = await updateRes.text();
                throw new Error(`Erro ao atualizar pedido: ${errText}`);
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, message: "Pedido marcado como pago." })
            };

        } else if (action === 'delete') {
            // First, delete order items (due to foreign key constraints if not on cascade)
            // Note: In Supabase/Postgrest, we usually delete by order_id in order_items
            const deleteItemsRes = await fetch(`${SUPABASE_URL}/rest/v1/order_items?order_id=eq.${order_id}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_SERVICE_ROLE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                }
            });

            if (!deleteItemsRes.ok) {
                const errText = await deleteItemsRes.text();
                throw new Error(`Erro ao excluir itens do pedido: ${errText}`);
            }

            // Then, delete the order itself
            const deleteOrderRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order_id}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_SERVICE_ROLE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                }
            });

            if (!deleteOrderRes.ok) {
                const errText = await deleteOrderRes.text();
                throw new Error(`Erro ao excluir pedido: ${errText}`);
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, message: "Pedido excluído com sucesso." })
            };

        } else {
            throw new Error("Ação inválida.");
        }

    } catch (error) {
        console.error('Manage Order Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
