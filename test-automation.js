// test-automation.js
// Script para testar a automação localmente

const https = require('https');

// Simular evento do Netlify
const event = {
    httpMethod: 'POST',
    headers: {
        'x-netlify-cron': 'false' // Teste manual
    }
};

const context = {};

// Testar URLs
async function testarUrls() {
    console.log('🧪 Testando URLs do ERP...');
    
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    
    const fim = hoje.toISOString().split('T')[0];
    const inicio = primeiroDia.toISOString().split('T')[0];
    
    const urlAparelhos = `https://iclubstore.iphonebiz.com.br/relatorios/vendas?fim=${fim}&inicio=${inicio}&locals=14&locals=15&locals=21&seminovo=&brinde=true&categoria=93&categoria=134`;
    const urlAcessorios = `https://iclubstore.iphonebiz.com.br/relatorios/vendas?fim=${fim}&inicio=${inicio}&locals=14&locals=15&locals=21&seminovo=&brinde=true&categoria=91`;
    
    console.log(`📱 URL Aparelhos: ${urlAparelhos}`);
    console.log(`🎧 URL Acessórios: ${urlAcessorios}`);
    
    // Testar se as URLs respondem
    try {
        await testarUrl(urlAparelhos, 'Aparelhos');
        await testarUrl(urlAcessorios, 'Acessórios');
        console.log('✅ URLs testadas com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao testar URLs:', error);
    }
}

function testarUrl(url, tipo) {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'HEAD', // Apenas testar se existe
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };
        
        const req = https.request(url, options, (res) => {
            console.log(`${tipo}: Status ${res.statusCode}`);
            if (res.statusCode === 200) {
                resolve();
            } else {
                reject(new Error(`${tipo}: HTTP ${res.statusCode}`));
            }
        });
        
        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error(`${tipo}: Timeout`));
        });
        
        req.end();
    });
}

// Testar função completa (comentar se não tiver Firebase configurado)
async function testarFuncaoCompleta() {
    console.log('🧪 Testando função completa...');
    
    try {
        // Importar e testar a função
        const { handler } = require('./netlify/functions/auto-update.js');
        const resultado = await handler(event, context);
        
        console.log('📊 Resultado:', JSON.parse(resultado.body));
        
    } catch (error) {
        console.error('❌ Erro no teste completo:', error);
    }
}

// Executar testes
async function executarTestes() {
    console.log('🚀 Iniciando testes da automação...\n');
    
    await testarUrls();
    
    console.log('\n' + '='.repeat(50));
    console.log('📋 PRÓXIMOS PASSOS:');
    console.log('1. Configure as variáveis de ambiente no Netlify');
    console.log('2. Faça deploy do código');
    console.log('3. Teste manualmente: /.netlify/functions/auto-update');
    console.log('4. Verifique os logs do cron job');
    console.log('='.repeat(50));
}

// Executar
executarTestes().catch(console.error);