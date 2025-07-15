// netlify/functions/auto-update.js - VERSÃO CORRIGIDA PARA NETLIFY
// Função que baixa e processa automaticamente os relatórios ICLUB

const https = require('https');
const XLSX = require('xlsx');

// ============================================
// CONFIGURAÇÃO DO FIREBASE ADMIN - CORRIGIDA
// ============================================
let admin;
let db;

try {
    admin = require('firebase-admin');
    
    // Verificar se já foi inicializado
    if (!admin.apps.length) {
        // Configuração usando variáveis de ambiente do Netlify
        const serviceAccount = {
            type: "service_account",
            project_id: "painel-iclub-unificado",
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
            private_key: process.env.FIREBASE_PRIVATE_KEY ? 
                process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : 
                undefined,
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_CLIENT_ID,
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
            client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
        };

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://painel-iclub-unificado-default-rtdb.firebaseio.com/"
        });
        
        console.log('✅ Firebase Admin inicializado com sucesso');
    }
    
    db = admin.firestore();
    
} catch (error) {
    console.error('❌ Erro ao configurar Firebase:', error.message);
    console.warn('⚠️ Continuando sem Firebase - modo de teste');
}

// ============================================
// CLASSE DE LOGGING SIMPLIFICADA
// ============================================
class Logger {
    constructor() {
        this.logs = [];
        this.inicio = Date.now();
    }
    
    log(nivel, mensagem, dados = null) {
        const entry = {
            timestamp: new Date().toISOString(),
            nivel,
            mensagem,
            dados,
            tempo: Date.now() - this.inicio
        };
        
        this.logs.push(entry);
        console.log(`[${nivel.toUpperCase()}] ${mensagem}`, dados || '');
    }
    
    info(msg, dados) { this.log('info', msg, dados); }
    warn(msg, dados) { this.log('warn', msg, dados); }
    error(msg, dados) { this.log('error', msg, dados); }
    debug(msg, dados) { this.log('debug', msg, dados); }
}

// ============================================
// HANDLER PRINCIPAL - SIMPLIFICADO
// ============================================
exports.handler = async (event, context) => {
    const logger = new Logger();
    
    // Headers CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Responder OPTIONS para CORS
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        logger.info('🚀 Iniciando automação ICLUB');
        
        // Verificar se Firebase está disponível
        if (!db) {
            throw new Error('Firebase não configurado. Verifique as variáveis de ambiente.');
        }
        
        // Calcular período (sempre do dia 1 do mês até hoje)
        const hoje = new Date();
        const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        
        const fim = hoje.toISOString().split('T')[0];
        const inicio = primeiroDia.toISOString().split('T')[0];
        
        logger.info('📅 Período definido', { 
            inicio: `${inicio} (dia 1 do mês)`, 
            fim: `${fim} (hoje)`
        });
        
        // Construir URLs dos relatórios
        const baseUrl = 'https://iclubstore.iphonebiz.com.br/relatorios/vendas';
        const params = `fim=${fim}&inicio=${inicio}&locals=14&locals=15&locals=21&seminovo=&brinde=true`;
        
        const urlAparelhos = `${baseUrl}?${params}&categoria=93&categoria=134`;
        const urlAcessorios = `${baseUrl}?${params}&categoria=91`;
        
        logger.debug('URLs construídas', { urlAparelhos, urlAcessorios });
        
        // Baixar relatórios
        logger.info('📱 Baixando relatório de aparelhos...');
        const dadosAparelhos = await baixarRelatorio(urlAparelhos, logger);
        
        logger.info('🎧 Baixando relatório de acessórios...');
        const dadosAcessorios = await baixarRelatorio(urlAcessorios, logger);
        
        // Combinar dados
        const dadosCombinados = [...dadosAparelhos, ...dadosAcessorios];
        logger.info('📊 Dados combinados', { 
            total: dadosCombinados.length,
            aparelhos: dadosAparelhos.length,
            acessorios: dadosAcessorios.length 
        });
        
        // Processar dados
        logger.info('🔄 Processando dados...');
        const resultado = processarDadosVendas(dadosCombinados, logger);
        
        // Salvar no Firebase
        logger.info('💾 Salvando no Firebase...');
        await salvarDadosFirebase(resultado.resumos, dadosCombinados, logger);
        
        // Resposta de sucesso
        const resposta = {
            success: true,
            message: 'Relatórios processados com sucesso',
            periodo: { inicio, fim },
            processamento: {
                totalRegistros: dadosCombinados.length,
                aparelhos: dadosAparelhos.length,
                acessorios: dadosAcessorios.length,
                tempoExecucao: Date.now() - logger.inicio
            },
            timestamp: new Date().toISOString()
        };
        
        logger.info('✅ Automação concluída com sucesso!');
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(resposta)
        };
        
    } catch (error) {
        logger.error('❌ Erro na automação', { error: error.message });
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Erro ao processar relatórios',
                error: error.message,
                tempoExecucao: Date.now() - logger.inicio,
                timestamp: new Date().toISOString()
            })
        };
    }
};

// ============================================
// FUNÇÃO PARA BAIXAR RELATÓRIO
// ============================================
async function baixarRelatorio(url, logger) {
    return new Promise((resolve, reject) => {
        logger.debug('Iniciando download', { url: url.split('?')[0] });
        
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*'
            },
            timeout: 30000
        };
        
        const req = https.get(url, options, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                return;
            }
            
            const chunks = [];
            
            response.on('data', chunk => chunks.push(chunk));
            
            response.on('end', () => {
                try {
                    const buffer = Buffer.concat(chunks);
                    logger.info('Download concluído', { tamanho: buffer.length });
                    
                    // Processar Excel
                    const workbook = XLSX.read(buffer, { type: 'buffer' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const dados = XLSX.utils.sheet_to_json(worksheet);
                    
                    logger.info('Arquivo processado', { registros: dados.length });
                    resolve(dados);
                    
                } catch (error) {
                    logger.error('Erro ao processar arquivo', { error: error.message });
                    reject(new Error(`Erro ao processar: ${error.message}`));
                }
            });
        });
        
        req.on('error', (error) => {
            logger.error('Erro na requisição', { error: error.message });
            reject(error);
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout na requisição'));
        });
        
        req.setTimeout(30000);
    });
}

// ============================================
// PROCESSAR DADOS DE VENDAS
// ============================================
function processarDadosVendas(dados, logger) {
    logger.info('Processando vendas');
    
    const resumos = {
        castanhal: { aparelhos: 0, acessorios: 0, faturamento: 0, vendedores: {} },
        belem: { aparelhos: 0, acessorios: 0, faturamento: 0, vendedores: {} },
        mix: { aparelhos: 0, acessorios: 0, faturamento: 0, vendedores: {} }
    };

    let processados = 0;

    dados.forEach((venda) => {
        const loja = venda.Loja || '';
        const produto = venda.Produto || '';
        const vendedor = venda.Vendedor || '';
        const qtd = parseInt(venda.Qtd || 0);
        const precoStr = venda['Preço Total'] || '0';
        
        if (!loja || loja === 'TOTAL') return;
        
        // Identificar loja
        let lojaKey = '';
        if (loja.toUpperCase().includes('CASTANHAL')) lojaKey = 'castanhal';
        else if (loja.toUpperCase().includes('BELÉM') || loja.toUpperCase().includes('BELEM')) lojaKey = 'belem';
        else if (loja.toUpperCase().includes('MIX')) lojaKey = 'mix';
        else return;
        
        // Converter preço
        const preco = parseFloat(precoStr.replace(/"/g, '').replace(/\./g, '').replace(',', '.')) || 0;
        
        // Verificar se é aparelho
        const isAparelho = isDispositivo(produto);
        const isBrinde = !isAparelho && preco === 0;
        
        if (isBrinde) return;
        
        // Somar valores
        if (isAparelho) {
            resumos[lojaKey].aparelhos += qtd;
        } else {
            resumos[lojaKey].acessorios += preco;
        }
        
        resumos[lojaKey].faturamento += preco;
        
        // Vendedores
        if (vendedor) {
            if (!resumos[lojaKey].vendedores[vendedor]) {
                resumos[lojaKey].vendedores[vendedor] = { aparelhos: 0, acessorios: 0, faturamento: 0 };
            }
            
            if (isAparelho) {
                resumos[lojaKey].vendedores[vendedor].aparelhos += qtd;
            } else {
                resumos[lojaKey].vendedores[vendedor].acessorios += preco;
            }
            
            resumos[lojaKey].vendedores[vendedor].faturamento += preco;
        }
        
        processados++;
    });

    logger.info('Processamento concluído', { processados });
    return { resumos };
}

// ============================================
// VERIFICAR SE É DISPOSITIVO
// ============================================
function isDispositivo(produto) {
    const produtoLower = produto.toLowerCase();
    
    // Acessórios
    if (produtoLower.includes('capa') || 
        produtoLower.includes('pelicula') || 
        produtoLower.includes('película') ||
        produtoLower.includes('carregador') ||
        produtoLower.includes('cabo') ||
        produtoLower.includes('fone') ||
        produtoLower.includes('suporte')) {
        return false;
    }
    
    // Dispositivos
    return produtoLower.includes('iphone') || 
           produtoLower.includes('ipad') || 
           produtoLower.includes('macbook') || 
           produtoLower.includes('airpods') || 
           produtoLower.includes('apple watch') ||
           produtoLower.includes('xiaomi') || 
           produtoLower.includes('samsung') || 
           produtoLower.includes('motorola');
}

// ============================================
// SALVAR NO FIREBASE
// ============================================
async function salvarDadosFirebase(resumos, dadosOriginais, logger) {
    try {
        if (!db) {
            throw new Error('Firebase não disponível');
        }
        
        const periodoVendas = calcularPeriodo(dadosOriginais);
        
        const dadosParaSalvar = {
            dados: resumos,
            vendasOriginais: dadosOriginais,
            ultimaAtualizacao: new Date().toISOString(),
            periodoVendas: periodoVendas
        };
        
        await db.collection('vendas').doc('dados_atuais').set(dadosParaSalvar);
        logger.info('Dados salvos no Firebase');
        
    } catch (error) {
        logger.error('Erro ao salvar no Firebase', { error: error.message });
        throw error;
    }
}

// ============================================
// CALCULAR PERÍODO
// ============================================
function calcularPeriodo(dados) {
    if (!dados || dados.length === 0) return null;

    const datas = dados
        .map(venda => {
            const dataField = venda['Data / Hora'] || '';
            if (!dataField) return null;
            
            const dataStr = dataField.split(' - ')[0];
            if (!dataStr) return null;
            
            const [dia, mes, ano] = dataStr.split('/');
            return new Date(ano.length === 2 ? `20${ano}` : ano, mes - 1, dia);
        })
        .filter(data => data && !isNaN(data.getTime()))
        .sort((a, b) => a - b);

    if (datas.length === 0) return null;

    const formatarData = (data) => {
        return `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    };

    return {
        inicio: formatarData(datas[0]),
        fim: formatarData(datas[datas.length - 1]),
        mes: datas[0].toLocaleString('pt-BR', { month: 'long' })
    };
}