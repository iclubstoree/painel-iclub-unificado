// netlify/functions/cron-scheduler.js - VERSÃO CORRIGIDA
// Função que agenda e executa a automação diariamente

exports.handler = async (event, context) => {
    console.log('⏰ Cron scheduler executado');
    
    // Verificar se é uma chamada do cron job
    const isCronJob = event.headers['x-netlify-cron'] === 'true';
    
    if (!isCronJob) {
        console.log('🔧 Teste manual da automação');
    } else {
        console.log('⏰ Execução automática via cron job');
    }
    
    try {
        // Chamar a função de automação
        const autoUpdateHandler = require('./auto-update.js').handler;
        const resultado = await autoUpdateHandler(event, context);
        
        // Log do resultado
        const body = JSON.parse(resultado.body);
        
        if (body.success) {
            console.log('✅ Automação executada com sucesso:', body);
            
            // Opcional: Enviar notificação
            await enviarNotificacao({
                tipo: 'sucesso',
                mensagem: `Relatórios processados automaticamente`,
                detalhes: body
            });
            
        } else {
            console.error('❌ Erro na automação:', body);
            
            // Opcional: Enviar notificação de erro
            await enviarNotificacao({
                tipo: 'erro',
                mensagem: `Erro ao processar relatórios: ${body.error}`,
                detalhes: body
            });
        }
        
        return resultado;
        
    } catch (error) {
        console.error('❌ Erro crítico no agendador:', error);
        
        // Enviar notificação de erro crítico
        await enviarNotificacao({
            tipo: 'erro_critico',
            mensagem: `Erro crítico no agendador: ${error.message}`,
            detalhes: { error: error.message, stack: error.stack }
        });
        
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: false,
                message: 'Erro crítico no agendador',
                error: error.message
            })
        };
    }
};

// Função para enviar notificações (opcional)
async function enviarNotificacao(dados) {
    try {
        console.log(`📧 Enviando notificação: ${dados.tipo}`);
        
        // Exemplo com webhook do Discord/Slack
        if (process.env.WEBHOOK_URL) {
            const https = require('https');
            const url = require('url');
            
            const emoji = {
                'sucesso': '✅',
                'erro': '❌', 
                'erro_critico': '🚨'
            }[dados.tipo] || '📋';
            
            const payload = JSON.stringify({
                content: `${emoji} **Automação ICLUB**\n\n**Status:** ${dados.tipo}\n**Mensagem:** ${dados.mensagem}\n**Horário:** ${new Date().toLocaleString('pt-BR')}`
            });
            
            const webhookUrl = url.parse(process.env.WEBHOOK_URL);
            
            const options = {
                hostname: webhookUrl.hostname,
                port: 443,
                path: webhookUrl.path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': payload.length
                }
            };
            
            return new Promise((resolve, reject) => {
                const req = https.request(options, (res) => {
                    console.log(`✅ Notificação enviada: ${res.statusCode}`);
                    resolve();
                });
                
                req.on('error', (error) => {
                    console.error('❌ Erro ao enviar notificação:', error);
                    resolve(); // Não falhar por causa da notificação
                });
                
                req.write(payload);
                req.end();
            });
        }
        
    } catch (error) {
        console.error('❌ Erro ao enviar notificação:', error);
        // Não falhar por causa da notificação
    }
}