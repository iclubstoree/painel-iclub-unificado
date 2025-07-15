// netlify/functions/auto-update.js
// Função Netlify que baixa e processa automaticamente os relatórios
// ALTERAÇÃO: Sempre pega do dia 1 do mês atual até hoje

const https = require('https');
const XLSX = require('xlsx');

// Configuração do Firebase Admin
const admin = require('firebase-admin');

// Inicializar Firebase Admin (apenas uma vez)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: "painel-iclub-unificado",
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        }),
        databaseURL: "https://painel-iclub-unificado.firebaseio.com"
    });
}

const db = admin.firestore();

exports.handler = async (event, context) => {
    // Definir headers CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Responder OPTIONS para CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        console.log('🚀 Iniciando automação de relatórios...');
        
        // ALTERAÇÃO: Calcular datas - SEMPRE DO DIA 1 ATÉ HOJE
        const hoje = new Date();
        const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1); // Dia 1 do mês atual
        
        const fim = hoje.toISOString().split('T')[0]; // YYYY-MM-DD (hoje)
        const inicio = primeiroDia.toISOString().split('T')[0]; // YYYY-MM-DD (dia 1 do mês)
        
        console.log(`📅 Período CORRIGIDO: ${inicio} (dia 1) a ${fim} (hoje)`);
        
        // URLs dos relatórios com datas dinâmicas - SEMPRE DIA 1 ATÉ HOJE
        const urlAparelhos = `https://iclubstore.iphonebiz.com.br/relatorios/vendas?fim=${fim}&inicio=${inicio}&locals=14&locals=15&locals=21&seminovo=&brinde=true&categoria=93&categoria=134`;
        const urlAcessorios = `https://iclubstore.iphonebiz.com.br/relatorios/vendas?fim=${fim}&inicio=${inicio}&locals=14&locals=15&locals=21&seminovo=&brinde=true&categoria=91`;
        
        console.log('📱 Baixando relatório de aparelhos...');
        console.log(`🔗 URL Aparelhos: ${urlAparelhos}`);
        const dadosAparelhos = await baixarRelatorio(urlAparelhos);
        
        console.log('🎧 Baixando relatório de acessórios...');
        console.log(`🔗 URL Acessórios: ${urlAcessorios}`);
        const dadosAcessorios = await baixarRelatorio(urlAcessorios);
        
        console.log('📊 Processando dados...');
        const dadosCombinados = [...dadosAparelhos, ...dadosAcessorios];
        const resultado = processarDadosVendas(dadosCombinados);
        
        console.log('💾 Salvando no Firebase...');
        await salvarDadosFirebase(resultado.resumos, dadosCombinados);
        
        console.log('✅ Automação concluída com sucesso!');
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Relatórios processados com sucesso',
                periodo: { 
                    inicio: inicio + ' (dia 1 do mês)', 
                    fim: fim + ' (hoje)' 
                },
                totalRegistros: dadosCombinados.length,
                aparelhos: dadosAparelhos.length,
                acessorios: dadosAcessorios.length,
                filtroAplicado: 'Do dia 1 do mês atual até hoje'
            })
        };
        
    } catch (error) {
        console.error('❌ Erro na automação:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Erro ao processar relatórios',
                error: error.message
            })
        };
    }
};

// Função para baixar relatório via HTTPS
async function baixarRelatorio(url) {
    return new Promise((resolve, reject) => {
        console.log(`🔄 Baixando: ${url}`);
        
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,*/*'
            }
        };
        
        https.get(url, options, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                return;
            }
            
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            
            response.on('end', () => {
                try {
                    const buffer = Buffer.concat(chunks);
                    console.log(`📦 Arquivo baixado: ${buffer.length} bytes`);
                    
                    // Processar Excel
                    const workbook = XLSX.read(buffer, { type: 'buffer' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const dados = XLSX.utils.sheet_to_json(worksheet);
                    
                    console.log(`📋 Dados processados: ${dados.length} registros`);
                    resolve(dados);
                    
                } catch (error) {
                    reject(new Error(`Erro ao processar arquivo: ${error.message}`));
                }
            });
            
        }).on('error', (error) => {
            reject(new Error(`Erro na requisição: ${error.message}`));
        });
    });
}

// Processar dados de vendas (mesma lógica do frontend)
function processarDadosVendas(dados) {
    const resumos = {
        castanhal: { 
            aparelhos: 0, acessorios: 0, 
            faturamento: 0, lucro: 0, 
            faturamentoAparelhos: 0, lucroAparelhos: 0,
            faturamentoAcessorios: 0, lucroAcessorios: 0, 
            vendedores: {} 
        },
        belem: { 
            aparelhos: 0, acessorios: 0, 
            faturamento: 0, lucro: 0, 
            faturamentoAparelhos: 0, lucroAparelhos: 0,
            faturamentoAcessorios: 0, lucroAcessorios: 0, 
            vendedores: {} 
        },
        mix: { 
            aparelhos: 0, acessorios: 0, 
            faturamento: 0, lucro: 0, 
            faturamentoAparelhos: 0, lucroAparelhos: 0,
            faturamentoAcessorios: 0, lucroAcessorios: 0, 
            vendedores: {} 
        }
    };

    dados.forEach((venda) => {
        const loja = venda.Loja || '';
        const produto = venda.Produto || '';
        const vendedor = venda.Vendedor || '';
        const qtd = parseInt(venda.Qtd || 0);
        const precoTotalStr = venda['Preço Total'] || '0';
        const lucroTotalStr = venda['Lucro Total'] || '0';
        
        if (!loja || !produto || loja === 'TOTAL') return;
        
        // Normalizar nome da loja
        let lojaKey = '';
        if (loja.toUpperCase().includes('CASTANHAL')) {
            lojaKey = 'castanhal';
        } else if (loja.toUpperCase().includes('BELÉM') || loja.toUpperCase().includes('BELEM')) {
            lojaKey = 'belem';
        } else if (loja.toUpperCase().includes('MIX')) {
            lojaKey = 'mix';
        } else {
            return;
        }
        
        // Conversão dos valores
        const preco = parseFloat(precoTotalStr.replace(/"/g, '').replace(/\./g, '').replace(',', '.')) || 0;
        const lucro = parseFloat(lucroTotalStr.replace(/"/g, '').replace(/\./g, '').replace(',', '.')) || 0;
        
        const isAparelho = isDispositivo(produto);
        const isBrinde = !isAparelho && preco === 0;
        
        if (isAparelho) {
            // APARELHOS
            resumos[lojaKey].aparelhos += qtd;
            resumos[lojaKey].faturamentoAparelhos += preco;
            resumos[lojaKey].lucroAparelhos += lucro;
        } else if (!isBrinde) {
            // ACESSÓRIOS (sem brindes)
            resumos[lojaKey].acessorios += preco;
            resumos[lojaKey].faturamentoAcessorios += preco;
            resumos[lojaKey].lucroAcessorios += lucro;
        }
        
        // TOTAL GERAL
        if (!isBrinde) {
            resumos[lojaKey].faturamento += preco;
            resumos[lojaKey].lucro += lucro;
        }
        
        // Vendedores
        if (vendedor && !isBrinde) {
            if (!resumos[lojaKey].vendedores[vendedor]) {
                resumos[lojaKey].vendedores[vendedor] = { 
                    aparelhos: 0, 
                    acessorios: 0, 
                    faturamento: 0, 
                    lucro: 0, 
                    quantidadeAcessorios: 0, 
                    lucroAcessorios: 0,
                    faturamentoAparelhos: 0,
                    lucroAparelhos: 0
                };
            }
            
            if (isAparelho) {
                resumos[lojaKey].vendedores[vendedor].aparelhos += qtd;
                resumos[lojaKey].vendedores[vendedor].faturamentoAparelhos += preco;
                resumos[lojaKey].vendedores[vendedor].lucroAparelhos += lucro;
            } else {
                resumos[lojaKey].vendedores[vendedor].acessorios += preco;
                resumos[lojaKey].vendedores[vendedor].quantidadeAcessorios += qtd;
                resumos[lojaKey].vendedores[vendedor].lucroAcessorios += lucro;
            }
            
            resumos[lojaKey].vendedores[vendedor].faturamento += preco;
            resumos[lojaKey].vendedores[vendedor].lucro += lucro;
        }
    });

    return { resumos };
}

// Verificar se é aparelho (mesma lógica do frontend)
function isDispositivo(produto) {
    const produtoLower = produto.toLowerCase();
    
    // EXCLUIR acessórios
    if (produtoLower.includes('capa') || 
        produtoLower.includes('pelicula') || 
        produtoLower.includes('película') ||
        produtoLower.includes('carregador') ||
        produtoLower.includes('cabo') ||
        produtoLower.includes('fone') ||
        produtoLower.includes('suporte') ||
        produtoLower.includes('fonte') ||
        produtoLower.includes('brinde') ||
        produtoLower.includes('pulseira') ||
        produtoLower.includes('microfone') ||
        produtoLower.includes('caixa jbl') ||
        produtoLower.includes('console')) {
        return false;
    }
    
    // APARELHOS
    return produtoLower.includes('iphone') || 
           produtoLower.includes('ipad') || 
           produtoLower.includes('macbook') || 
           produtoLower.includes('airpods') || 
           produtoLower.includes('apple watch') ||
           produtoLower.includes('redmi pad') ||
           produtoLower.includes('xiaomi') || 
           produtoLower.includes('realme') || 
           produtoLower.includes('samsung') || 
           produtoLower.includes('motorola') || 
           produtoLower.includes('infinix');
}

// Salvar dados no Firebase
async function salvarDadosFirebase(resumos, dadosOriginais) {
    try {
        const periodoVendas = calcularPeriodoVendas(dadosOriginais);
        
        const dadosParaSalvar = {
            dados: resumos,
            vendasOriginais: dadosOriginais,
            ultimaAtualizacao: new Date().toISOString(),
            periodoVendas: periodoVendas
        };
        
        await db.collection('vendas').doc('dados_atuais').set(dadosParaSalvar);
        
        console.log('✅ Dados salvos no Firebase com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao salvar no Firebase:', error);
        throw error;
    }
}

// Calcular período das vendas
function calcularPeriodoVendas(dados) {
    if (!dados || dados.length === 0) return null;

    const datas = dados
        .map(venda => {
            const dataHoraField = venda['Data / Hora'] || '';
            if (!dataHoraField) return null;
            
            const dataStr = dataHoraField.split(' - ')[0];
            if (!dataStr) return null;
            
            const [dia, mes, ano] = dataStr.split('/');
            const anoCompleto = ano.length === 2 ? `20${ano}` : ano;
            const data = new Date(anoCompleto, mes - 1, dia);
            
            return data && !isNaN(data.getTime()) ? data : null;
        })
        .filter(data => data !== null)
        .sort((a, b) => a - b);

    if (datas.length === 0) return null;

    const dataInicio = datas[0];
    const dataFim = datas[datas.length - 1];

    // CALCULAR DIAS ÚTEIS RESTANTES (SEG-SÁB)
    const hoje = new Date();
    const ultimoDiaDoMes = new Date(dataFim.getFullYear(), dataFim.getMonth() + 1, 0);
    
    let diasUteis = 0;
    let dataAtual = new Date(hoje);
    
    // Se hoje for depois do último dia das vendas, usar dataFim
    if (hoje > dataFim) {
        dataAtual = new Date(dataFim);
    }
    
    // Contar dias úteis restantes até o fim do mês (SEG-SÁB)
    while (dataAtual <= ultimoDiaDoMes) {
        const diaSemana = dataAtual.getDay();
        // 1 = Segunda, 2 = Terça, 3 = Quarta, 4 = Quinta, 5 = Sexta, 6 = Sábado
        // 0 = Domingo (EXCLUÍDO)
        if (diaSemana >= 1 && diaSemana <= 6) {
            diasUteis++;
        }
        dataAtual.setDate(dataAtual.getDate() + 1);
    }

    const formatarData = (data) => {
        return `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    };

    return {
        inicio: formatarData(dataInicio),
        fim: formatarData(dataFim),
        diaInicio: dataInicio.getDate(),
        diaFim: dataFim.getDate(),
        mes: dataInicio.toLocaleString('pt-BR', { month: 'long' }),
        diasUteisRestantes: Math.max(diasUteis, 1) // Mínimo 1 dia
    };
}