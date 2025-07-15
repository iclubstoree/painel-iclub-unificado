// netlify/functions/auto-update.js - VERSÃO CORRIGIDA
// Função Netlify que baixa e processa automaticamente os relatórios
// SEMPRE pega do dia 1 do mês atual até hoje + Sistema de Backup + Validação + Alertas

const https = require('https');
const XLSX = require('xlsx');

// Configuração do Firebase Admin
const admin = require('firebase-admin');

// Inicializar Firebase Admin (apenas uma vez)
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: "painel-iclub-unificado",
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : ''
            }),
            databaseURL: "https://painel-iclub-unificado.firebaseio.com"
        });
    } catch (error) {
        console.error('❌ Erro ao inicializar Firebase:', error);
    }
}

const db = admin.firestore();

// ============================================
// CLASSE DE LOGGING AVANÇADO
// ============================================

class LoggerAutomacao {
    constructor() {
        this.logs = [];
        this.inicioExecucao = Date.now();
        this.execucaoId = `exec_${Date.now()}`;
    }
    
    log(nivel, mensagem, dados = null) {
        const entry = {
            timestamp: new Date().toISOString(),
            nivel: nivel,
            mensagem: mensagem,
            dados: dados,
            tempoExecucao: Date.now() - this.inicioExecucao
        };
        
        this.logs.push(entry);
        console.log(`[${nivel.toUpperCase()}] ${mensagem}`, dados || '');
    }
    
    info(mensagem, dados) { this.log('info', mensagem, dados); }
    warn(mensagem, dados) { this.log('warn', mensagem, dados); }
    error(mensagem, dados) { this.log('error', mensagem, dados); }
    debug(mensagem, dados) { this.log('debug', mensagem, dados); }
    
    async salvarLogs() {
        try {
            const logData = {
                logs: this.logs,
                execucaoId: this.execucaoId,
                inicioExecucao: new Date(this.inicioExecucao).toISOString(),
                fimExecucao: new Date().toISOString(),
                duracaoTotal: Date.now() - this.inicioExecucao,
                totalLogs: this.logs.length,
                niveis: {
                    info: this.logs.filter(l => l.nivel === 'info').length,
                    warn: this.logs.filter(l => l.nivel === 'warn').length,
                    error: this.logs.filter(l => l.nivel === 'error').length,
                    debug: this.logs.filter(l => l.nivel === 'debug').length
                }
            };
            
            await db.collection('logs_execucao').add(logData);
            this.debug('Logs salvos com sucesso', { totalLogs: this.logs.length });
            
        } catch (error) {
            console.error('❌ Erro ao salvar logs:', error);
        }
    }
}

// ============================================
// SISTEMA DE BACKUP AUTOMÁTICO
// ============================================

async function criarBackupAntes(dados, metadata, logger) {
    try {
        logger.info('Iniciando criação de backup automático');
        
        const backup = {
            dados: dados,
            metadata: {
                ...metadata,
                tipoBackup: 'automatico',
                criadoPor: 'automacao'
            },
            timestamp: new Date().toISOString(),
            versao: '1.0',
            checksum: gerarChecksum(dados)
        };
        
        const backupId = `backup_auto_${new Date().toISOString().split('T')[0]}_${Date.now()}`;
        await db.collection('backups').doc(backupId).set(backup);
        
        logger.info('Backup criado com sucesso', { backupId, checksum: backup.checksum });
        
        await limparBackupsAntigos(logger);
        
        return backupId;
        
    } catch (error) {
        logger.error('Erro ao criar backup', { error: error.message });
        throw error;
    }
}

function gerarChecksum(dados) {
    const str = JSON.stringify(dados);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString();
}

async function limparBackupsAntigos(logger) {
    try {
        const snapshot = await db.collection('backups')
            .orderBy('timestamp', 'desc')
            .offset(30)
            .get();
        
        if (!snapshot.empty) {
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            logger.info('Backups antigos removidos', { quantidade: snapshot.size });
        } else {
            logger.debug('Nenhum backup antigo para remover');
        }
        
    } catch (error) {
        logger.warn('Erro ao limpar backups antigos', { error: error.message });
    }
}

// ============================================
// VALIDAÇÃO AVANÇADA DE DADOS
// ============================================

function validarDadosDetalhado(dados, logger) {
    logger.info('Iniciando validação detalhada dos dados');
    
    const relatorio = {
        valido: true,
        avisos: [],
        erros: [],
        estatisticas: {
            totalRegistros: dados.length,
            registrosValidos: 0,
            registrosIgnorados: 0,
            vendedoresUnicos: new Set(),
            produtosUnicos: new Set(),
            faturamentoTotal: 0,
            aparelhosTotal: 0,
            acessoriosTotal: 0
        }
    };
    
    dados.forEach((venda, index) => {
        const loja = venda.Loja || '';
        const produto = venda.Produto || '';
        const vendedor = venda.Vendedor || '';
        const qtd = parseInt(venda.Qtd || 0);
        const precoTotalStr = venda['Preço Total'] || '0';
        
        const preco = parseFloat(precoTotalStr
            .replace(/"/g, '')
            .replace(/\./g, '')
            .replace(',', '.')
        ) || 0;
        
        if (!loja || loja === 'TOTAL') {
            relatorio.estatisticas.registrosIgnorados++;
            return;
        }
        
        if (!produto) {
            relatorio.avisos.push(`Linha ${index + 1}: Produto vazio`);
        }
        
        if (!vendedor) {
            relatorio.avisos.push(`Linha ${index + 1}: Vendedor vazio`);
        }
        
        if (qtd <= 0) {
            relatorio.avisos.push(`Linha ${index + 1}: Quantidade inválida (${qtd})`);
        }
        
        if (preco < 0) {
            relatorio.erros.push(`Linha ${index + 1}: Preço negativo (${preco})`);
            relatorio.valido = false;
        }
        
        if (preco > 50000) {
            relatorio.avisos.push(`Linha ${index + 1}: Preço muito alto (${preco}) - ${produto} - verificar`);
        }
        
        if (qtd > 100) {
            relatorio.avisos.push(`Linha ${index + 1}: Quantidade muito alta (${qtd}) - ${produto} - verificar`);
        }
        
        const isAparelho = isDispositivo(produto);
        if (isAparelho && preco < 500) {
            relatorio.avisos.push(`Linha ${index + 1}: Aparelho com preço baixo (${preco}) - ${produto} - verificar`);
        }
        
        if (!isAparelho && preco > 5000) {
            relatorio.avisos.push(`Linha ${index + 1}: Acessório com preço alto (${preco}) - ${produto} - verificar`);
        }
        
        relatorio.estatisticas.registrosValidos++;
        relatorio.estatisticas.vendedoresUnicos.add(vendedor);
        relatorio.estatisticas.produtosUnicos.add(produto);
        relatorio.estatisticas.faturamentoTotal += preco;
        
        if (isAparelho) {
            relatorio.estatisticas.aparelhosTotal += qtd;
        } else if (preco > 0) {
            relatorio.estatisticas.acessoriosTotal += preco;
        }
    });
    
    relatorio.estatisticas.vendedoresUnicos = relatorio.estatisticas.vendedoresUnicos.size;
    relatorio.estatisticas.produtosUnicos = relatorio.estatisticas.produtosUnicos.size;
    
    logger.info('Validação concluída', {
        valido: relatorio.valido,
        erros: relatorio.erros.length,
        avisos: relatorio.avisos.length,
        registrosValidos: relatorio.estatisticas.registrosValidos,
        vendedores: relatorio.estatisticas.vendedoresUnicos,
        produtos: relatorio.estatisticas.produtosUnicos
    });
    
    if (relatorio.erros.length > 0) {
        logger.error('Erros de validação encontrados', { erros: relatorio.erros });
    }
    
    if (relatorio.avisos.length > 0) {
        logger.warn('Avisos de validação encontrados', { 
            avisos: relatorio.avisos.slice(0, 5),
            totalAvisos: relatorio.avisos.length 
        });
    }
    
    return relatorio;
}

// ============================================
// SISTEMA DE ALERTAS INTELIGENTES
// ============================================

async function verificarAlertas(dadosProcessados, logger) {
    logger.info('Verificando alertas inteligentes');
    
    const alertas = [];
    
    try {
        const metasSnapshot = await db.collection('metas').get();
        const metas = {};
        
        metasSnapshot.forEach(doc => {
            metas[doc.id] = doc.data();
        });
        
        for (const [loja, dados] of Object.entries(dadosProcessados)) {
            const metasLoja = metas[loja];
            if (!metasLoja) {
                logger.warn(`Metas não encontradas para loja: ${loja}`);
                continue;
            }
            
            const percentAparelhos = metasLoja.aparelhos > 0 ? (dados.aparelhos / metasLoja.aparelhos) * 100 : 0;
            const percentAcessorios = metasLoja.acessorios > 0 ? (dados.acessorios / metasLoja.acessorios) * 100 : 0;
            
            const hoje = new Date();
            const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
            
            const diasDecorridos = Math.floor((hoje - primeiroDia) / (1000 * 60 * 60 * 24)) + 1;
            const diasTotais = ultimoDia.getDate();
            const percentTempoDecorrido = (diasDecorridos / diasTotais) * 100;
            
            logger.debug(`Análise de ${loja}`, {
                percentAparelhos: Math.round(percentAparelhos),
                percentAcessorios: Math.round(percentAcessorios),
                percentTempoDecorrido: Math.round(percentTempoDecorrido),
                diasDecorridos,
                diasTotais
            });
            
            if (percentAparelhos < percentTempoDecorrido - 15) {
                alertas.push({
                    tipo: 'meta_risco',
                    prioridade: 'alta',
                    loja: loja,
                    categoria: 'aparelhos',
                    mensagem: `${loja.toUpperCase()}: Aparelhos ${Math.round(percentAparelhos)}% vs ${Math.round(percentTempoDecorrido)}% do mês`,
                    acao: 'Revisar estratégia de vendas de aparelhos urgentemente',
                    dados: {
                        vendidos: dados.aparelhos,
                        meta: metasLoja.aparelhos,
                        percentual: Math.round(percentAparelhos),
                        tempoDecorrido: Math.round(percentTempoDecorrido)
                    }
                });
            }
            
            if (percentAcessorios < percentTempoDecorrido - 20) {
                alertas.push({
                    tipo: 'meta_risco',
                    prioridade: 'média',
                    loja: loja,
                    categoria: 'acessorios',
                    mensagem: `${loja.toUpperCase()}: Acessórios ${Math.round(percentAcessorios)}% vs ${Math.round(percentTempoDecorrido)}% do mês`,
                    acao: 'Focar em vendas de acessórios e capacitação da equipe',
                    dados: {
                        vendidos: dados.acessorios,
                        meta: metasLoja.acessorios,
                        percentual: Math.round(percentAcessorios),
                        tempoDecorrido: Math.round(percentTempoDecorrido)
                    }
                });
            }
            
            Object.entries(dados.vendedores || {}).forEach(([vendedor, vendas]) => {
                const aparelhosVendedor = vendas.aparelhos || 0;
                const acessoriosVendedor = vendas.acessorios || 0;
                
                if (aparelhosVendedor === 0 && diasDecorridos > 5) {
                    alertas.push({
                        tipo: 'vendedor_inativo',
                        prioridade: 'média',
                        loja: loja,
                        vendedor: vendedor,
                        categoria: 'aparelhos',
                        mensagem: `${vendedor} (${loja.toUpperCase()}): Sem vendas de aparelhos em ${diasDecorridos} dias`,
                        acao: 'Conversar com vendedor sobre metas e estratégias'
                    });
                }
                
                if (acessoriosVendedor < 500 && diasDecorridos > 7) {
                    alertas.push({
                        tipo: 'vendedor_baixa_performance',
                        prioridade: 'baixa',
                        loja: loja,
                        vendedor: vendedor,
                        categoria: 'acessorios',
                        mensagem: `${vendedor} (${loja.toUpperCase()}): Apenas R$ ${Math.round(acessoriosVendedor)} em acessórios`,
                        acao: 'Treinar vendedor em técnicas de venda de acessórios'
                    });
                }
                
                if (metasLoja.vendedorAparelhos > 0) {
                    const percentVendedorAparelhos = (aparelhosVendedor / metasLoja.vendedorAparelhos) * 100;
                    if (percentVendedorAparelhos < percentTempoDecorrido - 20) {
                        alertas.push({
                            tipo: 'meta_individual_risco',
                            prioridade: 'média',
                            loja: loja,
                            vendedor: vendedor,
                            categoria: 'aparelhos',
                            mensagem: `${vendedor}: ${Math.round(percentVendedorAparelhos)}% da meta de aparelhos vs ${Math.round(percentTempoDecorrido)}% do mês`,
                            acao: 'Acompanhar de perto e oferecer suporte'
                        });
                    }
                }
            });
        }
        
        if (alertas.length > 0) {
            await salvarAlertas(alertas, logger);
            logger.warn('Alertas gerados', { 
                total: alertas.length,
                alta: alertas.filter(a => a.prioridade === 'alta').length,
                media: alertas.filter(a => a.prioridade === 'média').length,
                baixa: alertas.filter(a => a.prioridade === 'baixa').length
            });
        } else {
            logger.info('Nenhum alerta gerado - sistema funcionando bem');
            await db.collection('alertas').doc('atual').delete();
        }
        
        return alertas;
        
    } catch (error) {
        logger.error('Erro ao verificar alertas', { error: error.message });
        return [];
    }
}

async function salvarAlertas(alertas, logger) {
    try {
        const alertasData = {
            alertas: alertas,
            timestamp: new Date().toISOString(),
            total: alertas.length,
            prioridades: {
                alta: alertas.filter(a => a.prioridade === 'alta').length,
                media: alertas.filter(a => a.prioridade === 'média').length,
                baixa: alertas.filter(a => a.prioridade === 'baixa').length
            }
        };
        
        await db.collection('alertas').doc('atual').set(alertasData);
        await db.collection('alertas').add(alertasData);
        
        logger.info('Alertas salvos com sucesso', { total: alertas.length });
        
    } catch (error) {
        logger.error('Erro ao salvar alertas', { error: error.message });
    }
}

// ============================================
// SALVAR LOG DE EXECUÇÃO
// ============================================

async function salvarLogExecucao(status, mensagem, detalhes = null, logger) {
    try {
        const logData = {
            timestamp: new Date().toISOString(),
            status: status,
            mensagem: mensagem,
            detalhes: detalhes
        };
        
        await db.collection('automacao').add(logData);
        
        await db.collection('automacao').doc('historico').set({
            ultimaExecucao: logData.timestamp,
            status: status,
            mensagem: mensagem
        });
        
        logger.info('Log de execução salvo', { status, mensagem });
        
    } catch (error) {
        logger.error('Erro ao salvar log de execução', { error: error.message });
    }
}

// ============================================
// HANDLER PRINCIPAL MELHORADO
// ============================================

exports.handler = async (event, context) => {
    const logger = new LoggerAutomacao();
    
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        logger.info('🚀 Iniciando automação de relatórios MELHORADA');
        
        const hoje = new Date();
        const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        
        const fim = hoje.toISOString().split('T')[0];
        const inicio = primeiroDia.toISOString().split('T')[0];
        
        logger.info('📅 Período definido', { 
            inicio: `${inicio} (dia 1 do mês)`, 
            fim: `${fim} (hoje)`,
            diasDecorridos: Math.floor((hoje - primeiroDia) / (1000 * 60 * 60 * 24)) + 1
        });
        
        const urlAparelhos = `https://iclubstore.iphonebiz.com.br/relatorios/vendas?fim=${fim}&inicio=${inicio}&locals=14&locals=15&locals=21&seminovo=&brinde=true&categoria=93&categoria=134`;
        const urlAcessorios = `https://iclubstore.iphonebiz.com.br/relatorios/vendas?fim=${fim}&inicio=${inicio}&locals=14&locals=15&locals=21&seminovo=&brinde=true&categoria=91`;
        
        logger.debug('URLs construídas', { urlAparelhos, urlAcessorios });
        
        logger.info('📱 Baixando relatório de aparelhos...');
        const dadosAparelhos = await baixarRelatorio(urlAparelhos, logger);
        logger.info('📱 Aparelhos baixados', { registros: dadosAparelhos.length });
        
        logger.info('🎧 Baixando relatório de acessórios...');
        const dadosAcessorios = await baixarRelatorio(urlAcessorios, logger);
        logger.info('🎧 Acessórios baixados', { registros: dadosAcessorios.length });
        
        const dadosCombinados = [...dadosAparelhos, ...dadosAcessorios];
        logger.info('📊 Dados combinados', { 
            total: dadosCombinados.length,
            aparelhos: dadosAparelhos.length,
            acessorios: dadosAcessorios.length 
        });
        
        logger.info('✅ Iniciando validação detalhada...');
        const relatorioValidacao = validarDadosDetalhado(dadosCombinados, logger);
        
        if (!relatorioValidacao.valido) {
            const errosStr = relatorioValidacao.erros.join(', ');
            logger.error('Validação falhou', { erros: relatorioValidacao.erros });
            throw new Error(`Validação falhou: ${errosStr}`);
        }
        
        logger.info('🔄 Processando dados de vendas...');
        const resultado = processarDadosVendas(dadosCombinados, logger);
        
        logger.info('💾 Criando backup automático...');
        const backupId = await criarBackupAntes(resultado.resumos, {
            periodo: { inicio, fim },
            totalRegistros: dadosCombinados.length,
            validacao: relatorioValidacao.estatisticas,
            aparelhos: dadosAparelhos.length,
            acessorios: dadosAcessorios.length
        }, logger);
        
        logger.info('💾 Salvando dados no Firebase...');
        await salvarDadosFirebase(resultado.resumos, dadosCombinados, logger);
        
        logger.info('🚨 Verificando alertas inteligentes...');
        const alertas = await verificarAlertas(resultado.resumos, logger);
        
        await logger.salvarLogs();
        
        const respostaSucesso = {
            success: true,
            message: 'Relatórios processados com sucesso',
            periodo: { 
                inicio: inicio + ' (dia 1 do mês)', 
                fim: fim + ' (hoje)',
                filtroAplicado: 'Do dia 1 do mês atual até hoje'
            },
            processamento: {
                totalRegistros: dadosCombinados.length,
                aparelhos: dadosAparelhos.length,
                acessorios: dadosAcessorios.length,
                tempo_execucao: Date.now() - logger.inicioExecucao
            },
            validacao: relatorioValidacao.estatisticas,
            backup: {
                id: backupId,
                criado: true
            },
            alertas: {
                total: alertas.length,
                alta: alertas.filter(a => a.prioridade === 'alta').length,
                media: alertas.filter(a => a.prioridade === 'média').length,
                baixa: alertas.filter(a => a.prioridade === 'baixa').length
            },
            execucaoId: logger.execucaoId
        };
        
        await salvarLogExecucao('sucesso', 
            `Processados ${dadosCombinados.length} registros com ${alertas.length} alertas`, 
            respostaSucesso, 
            logger
        );
        
        logger.info('✅ Automação concluída com sucesso!', {
            registros: dadosCombinados.length,
            alertas: alertas.length,
            backup: backupId,
            tempo: Date.now() - logger.inicioExecucao
        });
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(respostaSucesso)
        };
        
    } catch (error) {
        logger.error('❌ Erro na automação', { 
            error: error.message, 
            stack: error.stack,
            tempo: Date.now() - logger.inicioExecucao
        });
        
        await logger.salvarLogs();
        
        await salvarLogExecucao('erro', error.message, {
            error: error.message,
            stack: error.stack,
            tempo_execucao: Date.now() - logger.inicioExecucao
        }, logger);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Erro ao processar relatórios',
                error: error.message,
                tempo_execucao: Date.now() - logger.inicioExecucao,
                execucaoId: logger.execucaoId
            })
        };
    }
};

// ============================================
// FUNÇÃO PARA BAIXAR RELATÓRIO (MELHORADA)
// ============================================

async function baixarRelatorio(url, logger) {
    return new Promise((resolve, reject) => {
        logger.debug('Iniciando download', { url });
        
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,*/*'
            },
            timeout: 30000
        };
        
        const req = https.get(url, options, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                return;
            }
            
            const chunks = [];
            let totalSize = 0;
            
            response.on('data', chunk => {
                chunks.push(chunk);
                totalSize += chunk.length;
                
                if (totalSize % (100 * 1024) < chunk.length) {
                    logger.debug('Download em progresso', { bytesRecebidos: totalSize });
                }
            });
            
            response.on('end', () => {
                try {
                    const buffer = Buffer.concat(chunks);
                    logger.info('Download concluído', { 
                        tamanhoFinal: buffer.length,
                        url: url.split('?')[0]
                    });
                    
                    logger.debug('Processando arquivo Excel...');
                    const workbook = XLSX.read(buffer, { type: 'buffer' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const dados = XLSX.utils.sheet_to_json(worksheet);
                    
                    logger.info('Arquivo processado com sucesso', { 
                        planilhas: workbook.SheetNames.length,
                        registros: dados.length 
                    });
                    
                    resolve(dados);
                    
                } catch (error) {
                    logger.error('Erro ao processar arquivo', { error: error.message });
                    reject(new Error(`Erro ao processar arquivo: ${error.message}`));
                }
            });
            
        });
        
        req.on('error', (error) => {
            logger.error('Erro na requisição HTTP', { error: error.message });
            reject(new Error(`Erro na requisição: ${error.message}`));
        });
        
        req.on('timeout', () => {
            req.destroy();
            logger.error('Timeout na requisição');
            reject(new Error('Timeout: requisição demorou mais de 30 segundos'));
        });
        
        req.setTimeout(30000);
    });
}

// ============================================
// PROCESSAR DADOS (MESMA LÓGICA + LOGS)
// ============================================

function processarDadosVendas(dados, logger) {
    logger.info('Iniciando processamento das vendas');
    
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

    let processados = 0;
    let ignorados = 0;

    dados.forEach((venda) => {
        const loja = venda.Loja || '';
        const produto = venda.Produto || '';
        const vendedor = venda.Vendedor || '';
        const qtd = parseInt(venda.Qtd || 0);
        const precoTotalStr = venda['Preço Total'] || '0';
        const lucroTotalStr = venda['Lucro Total'] || '0';
        
        if (!loja || !produto || loja === 'TOTAL') {
            ignorados++;
            return;
        }
        
        let lojaKey = '';
        if (loja.toUpperCase().includes('CASTANHAL')) {
            lojaKey = 'castanhal';
        } else if (loja.toUpperCase().includes('BELÉM') || loja.toUpperCase().includes('BELEM')) {
            lojaKey = 'belem';
        } else if (loja.toUpperCase().includes('MIX')) {
            lojaKey = 'mix';
        } else {
            ignorados++;
            return;
        }
        
        const preco = parseFloat(precoTotalStr.replace(/"/g, '').replace(/\./g, '').replace(',', '.')) || 0;
        const lucro = parseFloat(lucroTotalStr.replace(/"/g, '').replace(/\./g, '').replace(',', '.')) || 0;
        
        const isAparelho = isDispositivo(produto);
        const isBrinde = !isAparelho && preco === 0;
        
        if (isAparelho) {
            resumos[lojaKey].aparelhos += qtd;
            resumos[lojaKey].faturamentoAparelhos += preco;
            resumos[lojaKey].lucroAparelhos += lucro;
        } else if (!isBrinde) {
            resumos[lojaKey].acessorios += preco;
            resumos[lojaKey].faturamentoAcessorios += preco;
            resumos[lojaKey].lucroAcessorios += lucro;
        }
        
        if (!isBrinde) {
            resumos[lojaKey].faturamento += preco;
            resumos[lojaKey].lucro += lucro;
        }
        
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
        
        processados++;
    });

    logger.info('Processamento concluído', {
        processados,
        ignorados,
        castanhal: {
            aparelhos: resumos.castanhal.aparelhos,
            acessorios: Math.round(resumos.castanhal.acessorios),
            vendedores: Object.keys(resumos.castanhal.vendedores).length
        },
        belem: {
            aparelhos: resumos.belem.aparelhos,
            acessorios: Math.round(resumos.belem.acessorios),
            vendedores: Object.keys(resumos.belem.vendedores).length
        },
        mix: {
            aparelhos: resumos.mix.aparelhos,
            acessorios: Math.round(resumos.mix.acessorios),
            vendedores: Object.keys(resumos.mix.vendedores).length
        }
    });

    return { resumos };
}

function isDispositivo(produto) {
    const produtoLower = produto.toLowerCase();
    
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

async function salvarDadosFirebase(resumos, dadosOriginais, logger) {
    try {
        logger.info('Iniciando salvamento no Firebase');
        
        const periodoVendas = calcularPeriodoVendas(dadosOriginais, logger);
        
        const dadosParaSalvar = {
            dados: resumos,
            vendasOriginais: dadosOriginais,
            ultimaAtualizacao: new Date().toISOString(),
            periodoVendas: periodoVendas
        };
        
        await db.collection('vendas').doc('dados_atuais').set(dadosParaSalvar);
        
        logger.info('Dados salvos no Firebase com sucesso', {
            tamanhoResumos: JSON.stringify(resumos).length,
            tamanhoOriginais: JSON.stringify(dadosOriginais).length,
            periodoVendas: periodoVendas ? `${periodoVendas.inicio} - ${periodoVendas.fim}` : 'null'
        });
        
    } catch (error) {
        logger.error('Erro ao salvar no Firebase', { error: error.message });
        throw error;
    }
}

function calcularPeriodoVendas(dados, logger) {
    logger.debug('Calculando período das vendas');
    
    if (!dados || dados.length === 0) {
        logger.warn('Nenhum dado para calcular período');
        return null;
    }

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

    if (datas.length === 0) {
        logger.warn('Nenhuma data válida encontrada');
        return null;
    }

    const dataInicio = datas[0];
    const dataFim = datas[datas.length - 1];

    const hoje = new Date();
    const ultimoDiaDoMes = new Date(dataFim.getFullYear(), dataFim.getMonth() + 1, 0);
    
    let diasUteis = 0;
    let dataAtual = new Date(hoje);
    
    if (hoje > dataFim) {
        dataAtual = new Date(dataFim);
    }
    
    while (dataAtual <= ultimoDiaDoMes) {
        const diaSemana = dataAtual.getDay();
        if (diaSemana >= 1 && diaSemana <= 6) {
            diasUteis++;
        }
        dataAtual.setDate(dataAtual.getDate() + 1);
    }

    const formatarData = (data) => {
        return `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    };

    const resultado = {
        inicio: formatarData(dataInicio),
        fim: formatarData(dataFim),
        diaInicio: dataInicio.getDate(),
        diaFim: dataFim.getDate(),
        mes: dataInicio.toLocaleString('pt-BR', { month: 'long' }),
        diasUteisRestantes: Math.max(diasUteis, 1)
    };
    
    logger.info('Período calculado', resultado);
    
    return resultado;
}