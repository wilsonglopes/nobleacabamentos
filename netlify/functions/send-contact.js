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

        // Get Base URL for assets
        const protocol = event.headers['x-forwarded-proto'] || 'http';
        const host = event.headers['host'];
        const baseUrl = `${protocol}://${host}`;

        // Professional HTML Template
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap');
                body { font-family: 'Outfit', sans-serif; line-height: 1.6; color: #2d3436; margin: 0; padding: 0; background-color: #f0f2f1; }
                .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); border: 1px solid #e1e8e6; }
                .header { background: #ffffff; padding: 40px 20px; text-align: center; border-bottom: 4px solid #d35400; }
                .header img { height: 90px; width: auto; }
                .content { padding: 45px 40px; }
                .field { margin-bottom: 30px; }
                .label { font-size: 11px; text-transform: uppercase; color: #a0a0a0; font-weight: 700; letter-spacing: 2px; margin-bottom: 8px; border-left: 3px solid #d35400; padding-left: 10px; }
                .value { font-size: 16px; color: #2d3436; font-weight: 400; background: #f9f9f9; padding: 15px 20px; border-radius: 8px; border: 1px solid #eee; }
                .message-box { background: #fff; padding: 25px; border-radius: 12px; border: 1px solid #fad390; color: #2d3436; line-height: 1.8; font-size: 15px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); }
                .footer { background: #fcfcfc; padding: 25px; text-align: center; font-size: 12px; color: #b2bec3; border-top: 1px solid #f0f0f0; }
                .btn { display: inline-block; padding: 15px 30px; background: #d35400; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; font-size: 15px; box-shadow: 0 4px 15px rgba(211, 84, 0, 0.3); }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <img src="${baseUrl}/assets/logo_na.png" alt="Noble Acabamentos">
                </div>
                <div class="content">
                    <div style="text-align: center; margin-bottom: 40px;">
                        <h2 style="margin: 0; color: #1a1a1a; font-size: 24px; font-weight: 800;">Solicitação de Contato</h2>
                        <div style="width: 40px; hieght: 4px; background: #d35400; margin: 15px auto;"></div>
                    </div>
                    
                    <div class="field">
                        <div class="label">Quem enviou</div>
                        <div class="value">${full_name}</div>
                    </div>
                    
                    <div class="field">
                        <div class="label">E-mail de Contato</div>
                        <div class="value">${email}</div>
                    </div>
                    
                    <div class="field">
                        <div class="label">Assunto</div>
                        <div class="value"><strong>${subject}</strong></div>
                    </div>
                    
                    <div class="field">
                        <div class="label">Mensagem</div>
                        <div class="message-box">${message.replace(/\n/g, '<br>')}</div>
                    </div>

                    <div style="text-align: center; margin-top: 20px;">
                        <a href="mailto:${email}" class="btn">Responder ao Cliente</a>
                    </div>
                </div>
                <div class="footer">
                    <p>Esta é uma mensagem automática enviada via nobleacabamentos.com.br</p>
                    <p>&copy; 2026 Noble Acabamentos - Excelência em cada detalhe.</p>
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
