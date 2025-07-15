// netlify/functions/manual-trigger.js
// Função para acionar manualmente a automação

const autoUpdate = require('./auto-update.js');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        console.log('🔧 Trigger manual da automação ICLUB');
        
        // Chamar a função de automação
        const resultado = await autoUpdate.handler(event, context);
        
        // Log do resultado
        const body = JSON.parse(resultado.body);
        
        if (body.success) {
            console.log('✅ Automação manual executada com sucesso');
        } else {
            console.error('❌ Erro na automação manual:', body.error);
        }
        
        return {
            statusCode: resultado.statusCode,
            headers,
            body: JSON.stringify({
                ...body,
                triggerType: 'manual',
                triggeredAt: new Date().toISOString()
            })
        };
        
    } catch (error) {
        console.error('❌ Erro no trigger manual:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Erro no trigger manual',
                error: error.message,
                triggerType: 'manual',
                triggeredAt: new Date().toISOString()
            })
        };
    }
};