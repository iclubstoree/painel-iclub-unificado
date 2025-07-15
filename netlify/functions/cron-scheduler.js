// netlify/functions/cron-scheduler.js
// Função que agenda e executa a automação diariamente às 23h

exports.handler = async (event, context) => {
    // Verificar se é uma chamada do cron job
    const isCronJob = event.headers['x-netlify-cron'] === 'true';
    
    if (!isCronJob) {
        // Chamada manual para testar
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
            
            // Opcional: Enviar notificação por email ou webhook
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
        
        return {
            statusCode: 500,
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
            const fetch = require('node-fetch');
            
            const payload = {
                content: `🤖 **Automação ICLUB**\n\n**Status:** ${dados.tipo}\n**Mensagem:** ${dados.mensagem}\n**Horário:** ${new Date().toLocaleString('pt-BR')}`
            };
            
            await fetch(process.env.WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            console.log('✅ Notificação enviada com sucesso');
        }
        
    } catch (error) {
        console.error('❌ Erro ao enviar notificação:', error);
    }
}