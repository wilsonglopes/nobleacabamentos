// Netlify Function: Send Contact Email (Noble Style)
// Uses Resend API to send professional, branded HTML emails.

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
        const { full_name, email, subject, message } = JSON.parse(event.body);
        const RESEND_API_KEY = process.env.RESEND_API_KEY;

        if (!RESEND_API_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Configuração do servidor incompleta (RESEND_API_KEY)." })
            };
        }

        // Professional HTML Template
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Outfit', 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9f9f9; }
                .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05); border: 1px solid #eee; }
                .header { background-color: #1a1a1a; color: #fff; padding: 30px; text-align: center; }
                .header h1 { margin: 0; font-size: 24px; letter-spacing: 2px; font-weight: 800; }
                .header .noble { color: #fff; }
                .header .acabamentos { color: #d35400; }
                .content { padding: 40px; }
                .field { margin-bottom: 25px; border-bottom: 1px solid #f0f0f0; padding-bottom: 15px; }
                .label { font-size: 12px; text-transform: uppercase; color: #999; font-weight: 600; letter-spacing: 1px; margin-bottom: 5px; }
                .value { font-size: 16px; color: #2c3e50; font-weight: 500; }
                .message-box { background: #fcfcfc; padding: 20px; border-radius: 6px; border-left: 4px solid #d35400; font-style: italic; color: #555; }
                .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1><span class="noble">NOBLE</span> <span class="acabamentos">ACABAMENTOS</span></h1>
                </div>
                <div class="content">
                    <h2 style="margin-top: 0; color: #1a1a1a; font-size: 20px; text-align: center; margin-bottom: 30px;">Nova Mensagem de Contato</h2>
                    
                    <div class="field">
                        <div class="label">Nome do Cliente</div>
                        <div class="value">${full_name}</div>
                    </div>
                    
                    <div class="field">
                        <div class="label">E-mail para Resposta</div>
                        <div class="value"><a href="mailto:${email}" style="color: #d35400; text-decoration: none;">${email}</a></div>
                    </div>
                    
                    <div class="field">
                        <div class="label">Assunto</div>
                        <div class="value">${subject}</div>
                    </div>
                    
                    <div class="field" style="border: none;">
                        <div class="label">Mensagem</div>
                        <div class="message-box">${message.replace(/\n/g, '<br>')}</div>
                    </div>
                </div>
                <div class="footer">
                    <p>Este e-mail foi gerado pelo formulário de contato do site nobleacabamentos.com.br</p>
                    <p>&copy; 2026 Noble Acabamentos - Todos os direitos reservados.</p>
                </div>
            </div>
        </body>
        </html>
        `;

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Noble Site <onboarding@resend.dev>', // Default for unverified domains
                to: 'nobleacabamentos@gmail.com',
                subject: `Novo Contato Noble: ${subject}`,
                html: htmlContent,
                reply_to: email
            })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || "Erro ao enviar e-mail via Resend.");
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, id: data.id })
        };

    } catch (error) {
        console.error('Email Send Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
