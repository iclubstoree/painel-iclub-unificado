// painel.js - Sistema Unificado ICLUB - VERSÃO COMPLETA COM MELHORIAS

// Variáveis globais
let dadosAparelhos = null;
let dadosAcessorios = null;
let lojaAtual = localStorage.getItem('lojaAtual') || null;
let metasLojas = {};
let dadosVendas = {};

// SISTEMA DE AUTENTICAÇÃO
const senhasLojas = {
    'configuracao': '@Jap2023',
    'castanhal': '@700',
    'belem': '@400', 
    'mix': '@120',
    'administrativo': '@Jap2023'
};

let lojaParaAcessar = null;

// Inicializar sistema
window.iniciarSistema = function() {
    console.log('🚀 Iniciando sistema unificado...');
    
    // Configurar seleção de lojas
    configurarSeletorLojas();
    
    // Configurar menu mobile
    configurarMenuMobile();
    
    // Configurar sistema de login
    configurarSistemaLogin();
    
    // Configurar botão logout
    configurarBotaoLogout();
    
    // Configurar upload (só no administrativo)
    configurarUploadArea('aparelhos');
    configurarUploadArea('acessorios');
    
    // Configurar botões de edição de metas
    configurarBotoesEdicao();
    
    // Configurar botão processar tudo
    configurarBotaoProcessarTudo();
    
    // SEMPRE carregar dados do Firebase primeiro
    if (window.db) {
        console.log('📊 Carregando dados salvos do Firebase...');
        iniciarListenerVendas();
        carregarMetas();
    }
    
    // Mostrar loja inicial (se houver)
    if (lojaAtual) {
        mostrarLoja(lojaAtual);
    } else {
        // Nenhuma loja selecionada - tela inicial vazia
        console.log('📋 Iniciando com tela vazia - aguardando seleção');
    }
    
    console.log('✅ Sistema unificado iniciado!');
};

// Iniciar listeners do Firebase para vendas
function iniciarListenerVendas() {
    if (!window.db) {
        console.warn('❌ Firebase não disponível para listeners');
        return;
    }
    
    console.log('👂 Configurando listener de vendas...');

    // CORREÇÃO: Usar sintaxe correta do Firebase v8
    const docRef = window.db.collection('vendas').doc('dados_atuais');
    
    docRef.onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            console.log('📊 Dados de vendas recebidos do Firebase');
            
            dadosVendas = data.dados || {};
            
            // SALVAR DADOS GLOBAIS PARA PERSISTÊNCIA
            window.ultimaAtualizacao = data.ultimaAtualizacao;
            window.periodoVendasAtual = data.periodoVendas;
            
            // Salvar vendas originais para uso no painel administrativo
            if (data.vendasOriginais) {
                window.ultimasVendasOriginais = data.vendasOriginais;
            }
            
            // ATUALIZAR TIMESTAMPS EM TODOS OS PAINÉIS
            atualizarTimestampsGlobal();
            
            // Se estiver visualizando uma loja, atualizar
            if (lojaAtual !== 'configuracao' && lojaAtual !== 'administrativo' && dadosVendas[lojaAtual] && metasLojas[lojaAtual]) {
                atualizarDashboardLoja(lojaAtual, dadosVendas[lojaAtual], metasLojas[lojaAtual]);
            } else if (lojaAtual === 'administrativo') {
                carregarDadosAdministrativo();
            }
        } else {
            console.log('📄 Documento de vendas não existe ainda');
        }
    }, (error) => {
        console.error('❌ Erro no listener de vendas:', error);
    });
}

// Calcular dias úteis restantes - USAR DADOS DO FIREBASE
function calcularDiasUteisRestantes() {
    // Verificar se temos dados de período das vendas salvos
    if (window.periodoVendasAtual && window.periodoVendasAtual.diasUteisRestantes) {
        return window.periodoVendasAtual.diasUteisRestantes;
    }
    
    // Fallback para valor padrão
    return 17;
}

// Calcular falta por dia
function calcularFaltaPorDiaAdmin(meta, vendido) {
    const faltam = Math.max(0, meta - vendido);
    const diasUteis = calcularDiasUteisRestantes();
    return faltam / diasUteis;
}

// Atualizar timestamps em todos os painéis
function atualizarTimestampsGlobal() {
    const ultimaAtualizacao = window.ultimaAtualizacao;
    const periodoVendas = window.periodoVendasAtual;
    
    if (ultimaAtualizacao) {
        const dataFormatada = new Date(ultimaAtualizacao).toLocaleString('pt-BR');
        
        // PAINEL ADMINISTRATIVO
        const adminUpdate = document.getElementById('admin_lastUpdate');
        if (adminUpdate) {
            adminUpdate.innerHTML = `🕒 Última atualização: ${dataFormatada}`;
        }
        
        // PAINÉIS DAS LOJAS
        const lojaUpdate = document.getElementById('loja_lastUpdate');
        if (lojaUpdate) {
            lojaUpdate.innerHTML = `🕒 Última atualização: ${dataFormatada}`;
        }
    }
    
    if (periodoVendas) {
        const diasUteis = periodoVendas.diasUteisRestantes || 17;
        const periodoTexto = `📅 Período ${periodoVendas.inicio} a ${periodoVendas.fim} de ${periodoVendas.mes} | 🗓️ Dias úteis restantes: ${diasUteis}`;
        
        // PAINEL ADMINISTRATIVO
        const adminPeriodo = document.getElementById('admin_periodoVendas');
        if (adminPeriodo) {
            adminPeriodo.innerHTML = periodoTexto;
        }
        
        // PAINÉIS DAS LOJAS
        const lojaPeriodo = document.getElementById('loja_periodoVendas');
        if (lojaPeriodo) {
            lojaPeriodo.innerHTML = periodoTexto;
        }
    }
}

// Configurar menu mobile
function configurarMenuMobile() {
    const mobileToggle = document.getElementById('mobileMenuToggle');
    const seletorLojas = document.getElementById('seletorLojas');
    
    if (mobileToggle && seletorLojas) {
        mobileToggle.addEventListener('click', () => {
            mobileToggle.classList.toggle('active');
            seletorLojas.classList.toggle('mobile-menu');
            seletorLojas.classList.toggle('active');
        });
        
        // Fechar menu ao clicar em uma opção
        document.querySelectorAll('.loja-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                mobileToggle.classList.remove('active');
                seletorLojas.classList.remove('mobile-menu');
                seletorLojas.classList.remove('active');
            });
        });
    }
}

// Configurar sistema de login
function configurarSistemaLogin() {
    const loginOverlay = document.getElementById('loginOverlay');
    const loginPassword = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');
    const loginCancel = document.getElementById('loginCancel');
    const loginError = document.getElementById('loginError');
    const loginTitle = document.getElementById('loginTitle');
    const loginSubtitle = document.getElementById('loginSubtitle');
    
    // Botão entrar
    loginBtn.addEventListener('click', verificarSenha);
    
    // Enter no campo de senha
    loginPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            verificarSenha();
        }
    });
    
    // Botão cancelar
    loginCancel.addEventListener('click', () => {
        fecharLogin();
        // Não selecionar nada, voltar para tela inicial vazia
        lojaAtual = null;
        localStorage.removeItem('lojaAtual');
        document.querySelectorAll('.loja-btn').forEach(b => b.classList.remove('active'));
        mostrarLoja(null);
    });
    
    function verificarSenha() {
        const senha = loginPassword.value.trim();
        
        if (!senha) {
            mostrarErroLogin('Digite uma senha!');
            return;
        }
        
        const senhaCorreta = senhasLojas[lojaParaAcessar];
        
        if (senha === senhaCorreta) {
            // Senha correta
            console.log(`✅ Acesso liberado para: ${lojaParaAcessar}`);
            
            // Salvar sessão (válida por 2 horas)
            const sessao = {
                loja: lojaParaAcessar,
                timestamp: Date.now(),
                expira: Date.now() + (2 * 60 * 60 * 1000) // 2 horas
            };
            localStorage.setItem(`sessao_${lojaParaAcessar}`, JSON.stringify(sessao));
            
            // Fechar login e mostrar loja
            fecharLogin();
            mostrarLoja(lojaParaAcessar);
            
            // Atualizar botão ativo
            document.querySelectorAll('.loja-btn').forEach(b => b.classList.remove('active'));
            document.querySelector(`[data-loja="${lojaParaAcessar}"]`)?.classList.add('active');
            
            lojaAtual = lojaParaAcessar;
            localStorage.setItem('lojaAtual', lojaAtual);
            
        } else {
            // Senha incorreta
            mostrarErroLogin('Senha incorreta! Tente novamente.');
            loginPassword.value = '';
            loginPassword.focus();
        }
    }
    
    function mostrarErroLogin(mensagem) {
        loginError.textContent = `❌ ${mensagem}`;
        loginError.style.display = 'block';
        
        setTimeout(() => {
            loginError.style.display = 'none';
        }, 3000);
    }
    
    function fecharLogin() {
        loginOverlay.classList.add('hidden');
        loginPassword.value = '';
        loginError.style.display = 'none';
    }
}

// Verificar se precisa de login para a loja
function precisaLogin(loja) {
    // Verificar se tem sessão válida
    const sessaoSalva = localStorage.getItem(`sessao_${loja}`);
    if (sessaoSalva) {
        try {
            const sessao = JSON.parse(sessaoSalva);
            const agora = Date.now();
            
            // Verificar se sessão ainda é válida
            if (agora < sessao.expira && sessao.loja === loja) {
                console.log(`✅ Sessão válida para ${loja}`);
                return false;
            } else {
                // Sessão expirada
                localStorage.removeItem(`sessao_${loja}`);
                console.log(`⏰ Sessão expirada para ${loja}`);
            }
        } catch (error) {
            // Sessão corrompida
            localStorage.removeItem(`sessao_${loja}`);
        }
    }
    
    return true;
}

// Mostrar tela de login
function mostrarLogin(loja) {
    lojaParaAcessar = loja;
    
    const loginOverlay = document.getElementById('loginOverlay');
    const loginPassword = document.getElementById('loginPassword');
    const loginTitle = document.getElementById('loginTitle');
    const loginSubtitle = document.getElementById('loginSubtitle');
    
    // Personalizar mensagem por loja
    const nomes = {
        'configuracao': '⚙️ CONFIGURAÇÃO',
        'castanhal': '🏢 CASTANHAL',
        'belem': '🏢 BELÉM',
        'mix': '🏢 MIX',
        'administrativo': '📊 ADMINISTRATIVO'
    };
    
    loginTitle.textContent = `🔐 Acesso ${nomes[loja]}`;
    loginSubtitle.textContent = `Digite a senha para acessar o painel ${nomes[loja]}`;
    
    // Mostrar overlay
    loginOverlay.classList.remove('hidden');
    
    // Focar no campo de senha
    setTimeout(() => {
        loginPassword.focus();
    }, 100);
}

// Configurar seletor de lojas
function configurarSeletorLojas() {
    const botoes = document.querySelectorAll('.loja-btn');
    
    botoes.forEach(btn => {
        btn.addEventListener('click', () => {
            const loja = btn.dataset.loja;
            console.log(`🏢 Tentando acessar: ${loja}`);
            
            // Verificar se precisa de login
            if (precisaLogin(loja)) {
                console.log(`🔐 Login necessário para: ${loja}`);
                mostrarLogin(loja);
                return;
            }
            
            // Acesso liberado
            console.log(`✅ Acesso direto para: ${loja}`);
            
            // Atualizar botões ativos
            botoes.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Salvar seleção
            lojaAtual = loja;
            localStorage.setItem('lojaAtual', loja);
            
            // Mostrar seção correspondente
            mostrarLoja(loja);
        });
    });
    
    // Ativar botão inicial apenas se tiver sessão válida
    if (lojaAtual && !precisaLogin(lojaAtual)) {
        const botaoInicial = document.querySelector(`[data-loja="${lojaAtual}"]`);
        if (botaoInicial) {
            botaoInicial.classList.add('active');
        }
    } else {
        // Limpar seleção se não tiver acesso
        lojaAtual = null;
        localStorage.removeItem('lojaAtual');
    }
}

// Configurar botão logout
function configurarBotaoLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            // Limpar todas as sessões
            const lojas = ['configuracao', 'castanhal', 'belem', 'mix', 'administrativo'];
            lojas.forEach(loja => {
                localStorage.removeItem(`sessao_${loja}`);
            });
            
            // Voltar para nenhuma seleção
            lojaAtual = null;
            localStorage.removeItem('lojaAtual');
            
            // Atualizar interface
            document.querySelectorAll('.loja-btn').forEach(b => b.classList.remove('active'));
            
            // Esconder todos os painéis e mostrar tela inicial
            document.querySelectorAll('.secao-loja').forEach(secao => {
                secao.classList.add('hidden');
            });
            
            const telaInicial = document.getElementById('tela-inicial');
            if (telaInicial) {
                telaInicial.style.display = 'block';
            }
            
            console.log('🚪 Todas as sessões foram limpas');
        });
    }
}

// Mostrar loja inicial - CORRIGIR CARREGAMENTO
function mostrarLoja(loja) {
    console.log(`📊 Mostrando dashboard: ${loja}`);
    
    // Esconder todas as seções primeiro
    document.querySelectorAll('.secao-loja').forEach(secao => {
        secao.classList.add('hidden');
    });
    
    // Esconder ou mostrar tela inicial
    const telaInicial = document.getElementById('tela-inicial');
    
    // Se não há loja selecionada, mostrar tela inicial
    if (!loja) {
        console.log('📋 Nenhuma loja selecionada - tela inicial');
        if (telaInicial) {
            telaInicial.style.display = 'block';
        }
        return;
    }
    
    // Esconder tela inicial quando uma loja for selecionada
    if (telaInicial) {
        telaInicial.style.display = 'none';
    }
    
    if (loja === 'configuracao') {
        // Mostrar seção configuração (upload)
        document.getElementById('secao-configuracao').classList.remove('hidden');
    } else if (loja === 'administrativo') {
        // Mostrar seção administrativo (visão geral)
        document.getElementById('secao-administrativo').classList.remove('hidden');
        carregarDadosAdministrativo();
    } else {
        // Mostrar template da loja e carregar dados
        const templateLoja = document.getElementById('template-loja');
        templateLoja.classList.remove('hidden');
        
        // Atualizar título COM ÍCONE
        const nomeLojaFormatado = {
            'castanhal': '🏢 METAS ICLUB CASTANHAL',
            'belem': '🏢 METAS ICLUB BELÉM', 
            'mix': '🏢 METAS ICLUB MIX'
        };
        
        document.getElementById('titulo-loja').textContent = nomeLojaFormatado[loja];
        
        // SEMPRE tentar carregar dados salvos primeiro
        carregarDadosLoja(loja);
        
        // Sempre iniciar listeners
        if (window.db) {
            iniciarListenerVendas();
        }
    }
}

// Carregar dados específicos da loja
function carregarDadosLoja(loja) {
    console.log(`📈 Carregando dados para: ${loja}`);
    
    if (dadosVendas[loja] && metasLojas[loja]) {
        atualizarDashboardLoja(loja, dadosVendas[loja], metasLojas[loja]);
    } else {
        // Mostrar loading
        mostrarLoadingLoja();
        
        // Tentar carregar dados do Firebase
        setTimeout(() => {
            if (window.firebaseConfig) {
                iniciarListenerVendas();
            }
        }, 1000);
    }
}

// Mostrar loading na loja
function mostrarLoadingLoja() {
    const elementos = [
        'metaAparelhosMes', 'faltamAparelhos', 'vendaDiariaAparelhos',
        'metaAcessoriosMes', 'faltamAcessorios', 'vendaDiariaAcessorios'
    ];
    
    elementos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '-';
    });
}

// Atualizar dashboard da loja - VERSÃO MELHORADA MOBILE
function atualizarDashboardLoja(loja, dadosLoja, metasLoja) {
    console.log(`🔄 Atualizando dashboard: ${loja}`, dadosLoja, metasLoja);
    
    if (!dadosLoja || !metasLoja) {
        console.log('⚠️ Dados ou metas não disponíveis');
        return;
    }
    
    // ATUALIZAR TIMESTAMPS NO PAINEL DA LOJA
    atualizarTimestampsGlobal();
    
    // Dados de vendas
    const aparelhosVendidos = dadosLoja.aparelhos || 0;
    const acessoriosVendidos = dadosLoja.acessorios || 0;
    
    // Calcular valores - USAR DIAS ÚTEIS CORRETOS
    const faltamAparelhos = Math.max(0, metasLoja.aparelhos - aparelhosVendidos);
    const faltamAcessorios = Math.max(0, metasLoja.acessorios - acessoriosVendidos);
    
    const diasUteis = calcularDiasUteisRestantes(); // Agora usa dados reais
    const faltaPorDiaAparelhos = faltamAparelhos / diasUteis;
    const faltaPorDiaAcessorios = faltamAcessorios / diasUteis;
    
    // ===== APARELHOS - NOVO LAYOUT =====
    document.getElementById('metaAparelhosMes').textContent = metasLoja.aparelhos;
    document.getElementById('vendidosAparelhos').textContent = aparelhosVendidos;
    document.getElementById('faltamAparelhos').textContent = faltamAparelhos;
    document.getElementById('vendaDiariaAparelhos').textContent = Math.ceil(faltaPorDiaAparelhos);
    
    // Barra de progresso aparelhos - NOVA ESTRUTURA
    const percentAparelhos = metasLoja.aparelhos > 0 ? (aparelhosVendidos / metasLoja.aparelhos * 100) : 0;
    document.getElementById('progressoAparelhos').textContent = `${aparelhosVendidos}/${metasLoja.aparelhos}`;
    document.getElementById('percentAparelhos').textContent = `${Math.round(percentAparelhos)}%`;
    
    const barraAparelhos = document.getElementById('barraAparelhosGeral');
    const faltamAparelhosEl = document.getElementById('faltamProgressoAparelhos');
    if (barraAparelhos) {
        barraAparelhos.style.width = Math.min(percentAparelhos, 100) + '%';
        barraAparelhos.parentElement.style.position = 'relative';
    }
    document.getElementById('vendidosProgressoAparelhos').textContent = aparelhosVendidos;
    if (faltamAparelhosEl) {
        faltamAparelhosEl.textContent = faltamAparelhos;
    }
    
    // ===== ACESSÓRIOS - NOVO LAYOUT =====
    document.getElementById('metaAcessoriosMes').textContent = formatarMoedaCompleta(metasLoja.acessorios);
    document.getElementById('vendidosAcessorios').textContent = formatarMoedaCompleta(acessoriosVendidos);
    document.getElementById('faltamAcessorios').textContent = formatarMoedaCompleta(faltamAcessorios);
    document.getElementById('vendaDiariaAcessorios').textContent = formatarMoedaCompleta(faltaPorDiaAcessorios);
    
    // Barra de progresso acessórios - NOVA ESTRUTURA
    const percentAcessorios = metasLoja.acessorios > 0 ? (acessoriosVendidos / metasLoja.acessorios * 100) : 0;
    document.getElementById('progressoAcessorios').textContent = `${formatarMoedaCompleta(acessoriosVendidos)}/${formatarMoedaCompleta(metasLoja.acessorios)}`;
    document.getElementById('percentAcessorios').textContent = `${Math.round(percentAcessorios)}%`;
    
    const barraAcessorios = document.getElementById('barraAcessoriosGeral');
    const faltamAcessoriosEl = document.getElementById('faltamProgressoAcessorios');
    if (barraAcessorios) {
        barraAcessorios.style.width = Math.min(percentAcessorios, 100) + '%';
        barraAcessorios.parentElement.style.position = 'relative';
    }
    document.getElementById('vendidosProgressoAcessorios').textContent = formatarMoedaCompleta(acessoriosVendidos);
    if (faltamAcessoriosEl) {
        faltamAcessoriosEl.textContent = formatarMoedaCompleta(faltamAcessorios);
    }
    
    // Atualizar vendedoras
    atualizarVendedoras(dadosLoja.vendedores || {}, metasLoja);
}

// Atualizar seção de vendedoras - NOVO VISUAL IGUAL À IMAGEM
function atualizarVendedoras(vendedores, metas) {
    // Ranking por aparelhos
    const vendedorasAparelhos = Object.keys(vendedores)
        .map(nome => ({
            nome,
            aparelhos: vendedores[nome].aparelhos || 0,
            metaVendedor: metas.vendedorAparelhos
        }))
        .sort((a, b) => b.aparelhos - a.aparelhos);

    // Ranking por acessórios
    const vendedorasAcessorios = Object.keys(vendedores)
        .map(nome => ({
            nome,
            acessorios: vendedores[nome].acessorios || 0,
            metaVendedor: metas.vendedorAcessorios
        }))
        .sort((a, b) => b.acessorios - a.acessorios);

    // Renderizar aparelhos - NOVO LAYOUT
    let htmlAparelhos = '';
    vendedorasAparelhos.forEach((vendedora, index) => {
        const posicao = `${index + 1}º lugar`;
        const faltam = Math.max(0, vendedora.metaVendedor - vendedora.aparelhos);
        const percent = vendedora.metaVendedor > 0 ? (vendedora.aparelhos / vendedora.metaVendedor * 100) : 0;
        
        htmlAparelhos += `
            <div class="vendedora-ranking">
                <div class="vendedora-linha-superior">
                    <div class="vendedora-posicao-nome">${posicao} ${vendedora.nome.toUpperCase()}</div>
                    <div class="vendedora-vendidos">${vendedora.aparelhos} vendidos</div>
                </div>
                <div class="vendedora-linha-inferior">
                    <div class="vendedora-meta-texto">Meta: ${vendedora.metaVendedor} aparelhos</div>
                    <div class="vendedora-falta-texto">Faltam: ${faltam}</div>
                </div>
                <div class="vendedora-progress-bar">
                    <div class="vendedora-progress-fill" style="width: ${Math.min(percent, 100)}%;">
                        <span class="vendedora-progress-vendidos">${vendedora.aparelhos}</span>
                    </div>
                    <div class="vendedora-progress-faltam">${faltam}</div>
                </div>
            </div>
        `;
    });

    if (htmlAparelhos === '') {
        htmlAparelhos = '<div class="loading">Nenhum dado disponível</div>';
    }

    // Renderizar acessórios - NOVO LAYOUT
    let htmlAcessorios = '';
    vendedorasAcessorios.forEach((vendedora, index) => {
        const posicao = `${index + 1}º lugar`;
        const faltam = Math.max(0, vendedora.metaVendedor - vendedora.acessorios);
        const percent = vendedora.metaVendedor > 0 ? (vendedora.acessorios / vendedora.metaVendedor * 100) : 0;
        
        htmlAcessorios += `
            <div class="vendedora-ranking">
                <div class="vendedora-linha-superior">
                    <div class="vendedora-posicao-nome">${posicao} ${vendedora.nome.toUpperCase()}</div>
                    <div class="vendedora-vendidos">${formatarMoeda(vendedora.acessorios)} vendidos</div>
                </div>
                <div class="vendedora-linha-inferior">
                    <div class="vendedora-meta-texto">Meta: ${formatarMoeda(vendedora.metaVendedor)} acessórios</div>
                    <div class="vendedora-falta-texto">Faltam: ${formatarMoeda(faltam)}</div>
                </div>
                <div class="vendedora-progress-bar">
                    <div class="vendedora-progress-fill" style="width: ${Math.min(percent, 100)}%;">
                        <span class="vendedora-progress-vendidos">${formatarMoeda(vendedora.acessorios)}</span>
                    </div>
                    <div class="vendedora-progress-faltam">${formatarMoeda(faltam)}</div>
                </div>
            </div>
        `;
    });

    if (htmlAcessorios === '') {
        htmlAcessorios = '<div class="loading">Nenhum dado disponível</div>';
    }

    // Atualizar DOM
    document.getElementById('vendedorasAparelhos').innerHTML = htmlAparelhos;
    document.getElementById('vendedorasAcessorios').innerHTML = htmlAcessorios;
}

// ============================================
// SEÇÃO DE UPLOAD (MELHORADA)
// ============================================

// Configurar área de upload
function configurarUploadArea(tipo) {
    const uploadArea = document.getElementById(`uploadArea${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
    const fileInput = document.getElementById(`uploadFile${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
    const btnUpload = document.getElementById(`btnUpload${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
    const fileName = document.getElementById(`fileName${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);

    if (!uploadArea || !fileInput || !btnUpload) {
        console.error(`❌ Elementos não encontrados para ${tipo}`);
        return;
    }

    console.log(`🔧 Configurando área de upload para: ${tipo}`);

    // ADICIONAR: Clique na área de upload para abrir seleção de arquivo
    uploadArea.addEventListener('click', function(e) {
        if (e.target === fileInput) return; // Evitar loop
        fileInput.click();
    });

    // Drag and drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => highlight(uploadArea), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => unhighlight(uploadArea), false);
    });

    function highlight(area) {
        area.style.borderColor = '#28a745';
        area.style.background = '#f8fff8';
    }

    function unhighlight(area) {
        area.style.borderColor = '#28a745';
        area.style.background = '#ffffff';
    }

    // Handle dropped files
    uploadArea.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFiles(files, tipo);
        }
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFiles(e.target.files, tipo);
        }
    });

    // CONFIGURAR BOTÃO DE UPLOAD - CORRIGIDO
    btnUpload.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(`🔘 Botão ${tipo} clicado!`);
        processarArquivo(tipo);
    });

    console.log(`✅ Upload configurado para ${tipo}`);
}

// Lidar com arquivos selecionados
function handleFiles(files, tipo) {
    const file = files[0];
    console.log(`📁 Processando arquivo ${tipo}:`, file.name);
    
    // Verificar tipo de arquivo
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
        mostrarErro('Tipo de arquivo não suportado! Use apenas .xlsx, .xls ou .csv');
        return;
    }
    
    // Atualizar interface - MELHORADA
    const uploadArea = document.getElementById(`uploadArea${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
    const fileNameDiv = document.getElementById(`fileName${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
    const uploadText = uploadArea.querySelector('.upload-text');
    const fileInput = document.getElementById(`uploadFile${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
    
    if (uploadArea && fileNameDiv && uploadText) {
        // Adicionar classe de arquivo selecionado
        uploadArea.classList.add('file-selected');
        
        // Mostrar nome do arquivo
        fileNameDiv.textContent = `✅ ${file.name}`;
        fileNameDiv.style.display = 'block';
        
        // Atualizar texto
        uploadText.innerHTML = `Arquivo selecionado: <strong>${file.name}</strong>`;
        
        console.log(`✅ Interface atualizada para ${tipo}`);
    }
    
    // SALVAR ARQUIVO NO OBJETO GLOBAL E NO INPUT
    if (tipo === 'aparelhos') {
        window.arquivoAparelhos = file;
        // Também salvar referência no input para garantir
        if (fileInput) {
            fileInput.arquivoSelecionado = file;
        }
        habilitarBotao('btnUploadAparelhos');
        console.log('📱 Arquivo aparelhos salvo:', file.name);
    } else if (tipo === 'acessorios') {
        window.arquivoAcessorios = file;
        // Também salvar referência no input para garantir
        if (fileInput) {
            fileInput.arquivoSelecionado = file;
        }
        habilitarBotao('btnUploadAcessorios');
        console.log('🎧 Arquivo acessórios salvo:', file.name);
    }

    verificarBotaoProcessarTudo();
    console.log(`✅ Processamento de ${tipo} concluído`);
}

// Habilitar botão
function habilitarBotao(btnId) {
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.disabled = false;
        btn.removeAttribute('disabled');
        btn.style.pointerEvents = 'auto';
        btn.style.cursor = 'pointer';
        btn.style.opacity = '1';
        console.log(`✅ Botão ${btnId} habilitado`);
    } else {
        console.error(`❌ Botão não encontrado: ${btnId}`);
    }
}

// Verificar botão processar tudo
function verificarBotaoProcessarTudo() {
    const temAparelhos = window.arquivoAparelhos || dadosAparelhos;
    const temAcessorios = window.arquivoAcessorios || dadosAcessorios;
    
    console.log('🔍 Verificando arquivos para PROCESSAR TUDO:', {
        aparelhos: !!temAparelhos,
        acessorios: !!temAcessorios,
        nomeAparelhos: window.arquivoAparelhos?.name || 'dados em memória',
        nomeAcessorios: window.arquivoAcessorios?.name || 'dados em memória',
        dadosAparelhosMemoria: !!dadosAparelhos,
        dadosAcessoriosMemoria: !!dadosAcessorios
    });
    
    if (temAparelhos && temAcessorios) {
        habilitarBotao('btnProcessarTudo');
        console.log('🚀 Ambos arquivos carregados - Botão PROCESSAR TUDO habilitado');
        
        // Atualizar visual do botão
        const btn = document.getElementById('btnProcessarTudo');
        if (btn) {
            btn.style.background = 'linear-gradient(45deg, #dc3545, #e74c3c)';
            btn.innerHTML = '🚀 PROCESSAR E ATUALIZAR TODOS OS PAINÉIS';
        }
    } else {
        console.log('⏳ Aguardando ambos os arquivos...');
        const btn = document.getElementById('btnProcessarTudo');
        if (btn) {
            btn.disabled = true;
            btn.style.background = '#6c757d';
        }
    }
}

// Processar arquivo individual
async function processarArquivo(tipo) {
    console.log(`🚀 Iniciando processamento de ${tipo}`);
    
    const btnUpload = document.getElementById(`btnUpload${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
    const fileInput = document.getElementById(`uploadFile${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
    
    // BUSCAR ARQUIVO DE VÁRIAS FORMAS
    let arquivo = null;
    
    if (tipo === 'aparelhos') {
        arquivo = window.arquivoAparelhos || 
                 (fileInput && fileInput.arquivoSelecionado) || 
                 (fileInput && fileInput.files && fileInput.files[0]);
    } else if (tipo === 'acessorios') {
        arquivo = window.arquivoAcessorios || 
                 (fileInput && fileInput.arquivoSelecionado) || 
                 (fileInput && fileInput.files && fileInput.files[0]);
    }
    
    console.log(`🔍 Arquivo encontrado para ${tipo}:`, {
        nomeArquivo: arquivo?.name,
        tamanho: arquivo?.size,
        global: tipo === 'aparelhos' ? !!window.arquivoAparelhos : !!window.arquivoAcessorios,
        input: !!(fileInput && fileInput.files && fileInput.files[0])
    });
    
    if (!arquivo) {
        console.error(`❌ Nenhum arquivo encontrado para ${tipo}`);
        mostrarErro(`Por favor, selecione o arquivo de ${tipo} primeiro!`);
        return;
    }

    try {
        btnUpload.disabled = true;
        btnUpload.innerHTML = `🔄 Processando ${tipo}...`;
        
        console.log(`📖 Lendo arquivo: ${arquivo.name}`);
        const dados = await lerArquivo(arquivo);
        
        if (!dados || dados.length === 0) {
            throw new Error(`Nenhum dado válido encontrado no arquivo de ${tipo}`);
        }
        
        console.log(`📊 Dados de ${tipo} processados:`, dados.length, 'registros');
        
        // Salvar dados na memória
        if (tipo === 'aparelhos') {
            dadosAparelhos = dados;
            console.log('💾 dadosAparelhos salvos na memória');
        } else {
            dadosAcessorios = dados;
            console.log('💾 dadosAcessorios salvos na memória');
        }
        
        btnUpload.innerHTML = `✅ ${tipo.toUpperCase()} CARREGADO!`;
        verificarBotaoProcessarTudo();
        
        // Mostrar sucesso temporário
        setTimeout(() => {
            btnUpload.innerHTML = tipo === 'aparelhos' ? '📱 APARELHOS PRONTOS' : '🎧 ACESSÓRIOS PRONTOS';
            btnUpload.style.background = 'linear-gradient(45deg, #28a745, #20c997)';
        }, 2000);
        
    } catch (error) {
        console.error(`❌ Erro no processamento de ${tipo}:`, error);
        mostrarErro(`Erro ao processar ${tipo}: ` + error.message);
        btnUpload.innerHTML = tipo === 'aparelhos' ? '📱 ENVIAR APARELHOS' : '🎧 ENVIAR ACESSÓRIOS';
        btnUpload.disabled = false;
    }
}

// Configurar botão processar tudo
function configurarBotaoProcessarTudo() {
    setTimeout(() => {
        const btnProcessarTudo = document.getElementById('btnProcessarTudo');
        if (btnProcessarTudo) {
            console.log('🔧 Configurando botão PROCESSAR TUDO');
            btnProcessarTudo.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔘 Botão PROCESSAR TUDO clicado!');
                processarAmbosArquivos();
            });
        } else {
            console.error('❌ Botão PROCESSAR TUDO não encontrado');
        }
    }, 500);
}

// Processar ambos os arquivos
async function processarAmbosArquivos() {
    const btnProcessar = document.getElementById('btnProcessarTudo');
    const successMsg = document.getElementById('successMessage');
    const errorMsg = document.getElementById('errorMessage');
    
    if (!dadosAparelhos || !dadosAcessorios) {
        mostrarErro('Por favor, carregue ambos os arquivos primeiro!');
        return;
    }

    try {
        btnProcessar.disabled = true;
        btnProcessar.innerHTML = '🔄 PROCESSANDO TUDO...';
        
        // Verificar conexão com Firebase
        if (!window.db || !window.firebaseConfig) {
            throw new Error('Firebase não está conectado. Verifique a configuração.');
        }
        
        // Combinar dados
        const dadosCombinados = [...dadosAparelhos, ...dadosAcessorios];
        
        console.log(`📊 Total: ${dadosCombinados.length} registros`);
        
        btnProcessar.innerHTML = '🔄 CALCULANDO RESUMOS...';
        
        // Processar dados
        const resultado = processarDadosVendas(dadosCombinados);
        
        btnProcessar.innerHTML = '🔄 ENVIANDO PARA FIREBASE...';
        
        // Salvar no Firebase com melhor tratamento de erro
        await salvarDadosFirebase(resultado.resumos, dadosCombinados);
        
        // Atualizar dados locais
        dadosVendas = resultado.resumos;
        
        // Mostrar sucesso
        document.getElementById('successDetails').innerHTML = `
            Dados processados e enviados com sucesso!<br>
            📱 ${dadosAparelhos.length} registros de aparelhos<br>
            🎧 ${dadosAcessorios.length} registros de acessórios<br>
            📊 Total: ${dadosCombinados.length} registros
        `;
        
        successMsg.style.display = 'block';
        errorMsg.style.display = 'none';
        
        btnProcessar.innerHTML = '✅ ENVIADO COM SUCESSO!';
        
        setTimeout(() => {
            btnProcessar.innerHTML = '🚀 PROCESSAR E ATUALIZAR TODOS OS PAINÉIS';
            habilitarBotao('btnProcessarTudo');
        }, 5000);
        
    } catch (error) {
        console.error('❌ Erro no processamento:', error);
        
        let mensagemErro = 'Erro ao processar dados: ' + error.message;
        
        // Melhorar mensagens de erro do Firebase
        if (error.message.includes('permission') || error.message.includes('insufficient')) {
            mensagemErro = 'Erro de permissão no Firebase. Verifique as regras do Firestore.';
        } else if (error.message.includes('network') || error.message.includes('offline')) {
            mensagemErro = 'Erro de conexão. Verifique sua internet e tente novamente.';
        } else if (error.message.includes('Firebase não está conectado')) {
            mensagemErro = 'Firebase não conectado. Atualize a página e tente novamente.';
        }
        
        mostrarErro(mensagemErro);
        btnProcessar.innerHTML = '🚀 PROCESSAR E ATUALIZAR TODOS OS PAINÉIS';
        habilitarBotao('btnProcessarTudo');
    }
}

// ============================================
// SEÇÃO DE PROCESSAMENTO DE DADOS
// ============================================

// Ler arquivo
async function lerArquivo(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = e.target.result;
                const fileName = file.name.toLowerCase();
                
                if (fileName.endsWith('.csv')) {
                    const rows = data.split('\n').filter(row => row.trim());
                    const jsonData = [];
                    
                    for (let i = 1; i < rows.length; i++) {
                        const values = rows[i].split(';');
                        if (values.length >= 14 && values[0] && values[0] !== 'TOTAL') {
                            const obj = {
                                Loja: values[0]?.trim(),
                                'Data / Hora': values[1]?.trim(),
                                Venda: values[2]?.trim(),
                                Produto: values[3]?.trim(),
                                IMEI: values[4]?.trim(),
                                Cliente: values[5]?.trim(),
                                Vendedor: values[6]?.trim(),
                                Qtd: values[7]?.trim(),
                                'Custo un': values[8]?.trim(),
                                'Preço un': values[9]?.trim(),
                                'Preço Total': values[10]?.trim(),
                                Taxas: values[11]?.trim(),
                                'Lucro Un': values[12]?.trim(),
                                'Lucro Total': values[13]?.trim()
                            };
                            jsonData.push(obj);
                        }
                    }
                    
                    resolve(jsonData);
                } else {
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    resolve(jsonData);
                }
            } catch (error) {
                reject(error);
            }
        };

        if (file.name.toLowerCase().endsWith('.csv')) {
            reader.readAsText(file, 'utf-8');
        } else {
            reader.readAsBinaryString(file);
        }
    });
}

// Processar dados de vendas
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

// Verificar se é aparelho
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

// ============================================
// SEÇÃO DE METAS - FUNCIONALIDADE CORRIGIDA
// ============================================

// Configurar botões de edição - FUNCIONALIDADE DO ARQUIVO DE REFERÊNCIA
function configurarBotoesEdicao() {
    console.log('🔧 Configurando botões de edição...');
    
    const lojas = ['castanhal', 'belem', 'mix'];
    
    lojas.forEach(loja => {
        const btnId = `edit${loja.charAt(0).toUpperCase() + loja.slice(1)}`;
        const btn = document.getElementById(btnId);
        
        if (btn) {
            console.log(`✅ Configurando botão: ${btnId}`);
            
            // Configurar evento do botão
            btn.addEventListener('click', function() {
                console.log(`🔘 Clicou em editar ${loja}`);
                toggleEditarMetas(loja);
            });
        } else {
            console.error(`❌ Botão não encontrado: ${btnId}`);
        }
        
        // CONFIGURAR FORMATAÇÃO AUTOMÁTICA DOS CAMPOS DE ACESSÓRIOS
        const inputAcessorios = document.getElementById(`${loja}_meta_acessorios`);
        const inputVendedorAcessorios = document.getElementById(`${loja}_meta_vendedor_acessorios`);
        
        if (inputAcessorios) {
            inputAcessorios.addEventListener('input', function() {
                formatarInputMonetario(this);
            });
            inputAcessorios.addEventListener('blur', function() {
                formatarInputMonetarioCompleto(this);
            });
        }
        
        if (inputVendedorAcessorios) {
            inputVendedorAcessorios.addEventListener('input', function() {
                formatarInputMonetario(this);
            });
            inputVendedorAcessorios.addEventListener('blur', function() {
                formatarInputMonetarioCompleto(this);
            });
        }
    });
    
    console.log('✅ Botões de edição configurados!');
}

// Função para alternar entre editar e salvar - BASEADA NO ARQUIVO FUNCIONAL
function toggleEditarMetas(loja) {
    const btnId = `edit${loja.charAt(0).toUpperCase() + loja.slice(1)}`;
    const btn = document.getElementById(btnId);
    const config = document.getElementById(`config-${loja}`);
    
    if (!btn || !config) {
        console.error(`❌ Elementos não encontrados para ${loja}`);
        return;
    }
    
    // Buscar todos os inputs da loja
    const inputs = config.querySelectorAll('input[type="number"], input[type="text"]');
    console.log(`📝 Encontrados ${inputs.length} campos para ${loja}`);
    
    // Verificar estado atual do botão
    const isEditando = btn.textContent.includes('Salvar');
    
    if (isEditando) {
        // MODO SALVAR → VISUALIZAR
        console.log(`💾 Salvando metas de ${loja}...`);
        
        // Salvar as metas
        salvarMetas(loja);
        
        // Desabilitar campos
        inputs.forEach(input => {
            input.disabled = true;
            input.style.backgroundColor = '#e9ecef';
            input.style.color = '#6c757d';
        });
        
        // Mudar botão - VERDE
        btn.textContent = 'Editar Metas';
        btn.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
        
        console.log(`✅ ${loja} voltou para modo visualização`);
        
    } else {
        // MODO VISUALIZAR → EDITAR
        console.log(`✏️ Entrando em modo edição para ${loja}`);
        
        // Habilitar campos
        inputs.forEach(input => {
            input.disabled = false;
            input.style.backgroundColor = '#ffffff';
            input.style.color = '#495057';
            input.style.borderColor = '#ced4da';
        });
        
        // Mudar botão - VERDE ESCURO (para salvar)
        btn.textContent = 'Salvar Metas';
        btn.style.background = 'linear-gradient(135deg, #198754, #20c997)';
        
        console.log(`✅ ${loja} em modo edição`);
    }
}

// Salvar metas no Firebase - MANTENDO A LÓGICA ORIGINAL
async function salvarMetas(loja) {
    try {
        if (!window.db) {
            throw new Error('Firebase não está conectado');
        }
        
        // Pegar valores dos campos
        const aparelhos = parseInt(document.getElementById(`${loja}_meta_aparelhos`).value) || 0;
        const vendedorAparelhos = parseInt(document.getElementById(`${loja}_meta_vendedor_aparelhos`).value) || 0;
        
        // Para acessórios, remover formatação e converter
        const acessoriosStr = document.getElementById(`${loja}_meta_acessorios`).value
            .replace(/R\$\s?/g, '')
            .replace(/\./g, '')
            .replace(',', '.');
        const vendedorAcessoriosStr = document.getElementById(`${loja}_meta_vendedor_acessorios`).value
            .replace(/R\$\s?/g, '')
            .replace(/\./g, '')
            .replace(',', '.');
        
        const acessorios = parseFloat(acessoriosStr) || 0;
        const vendedorAcessorios = parseFloat(vendedorAcessoriosStr) || 0;
        
        const metas = {
            aparelhos: aparelhos,
            acessorios: acessorios,
            vendedorAparelhos: vendedorAparelhos,
            vendedorAcessorios: vendedorAcessorios,
            ultimaAtualizacao: new Date().toISOString()
        };
        
        console.log(`💾 Salvando metas de ${loja}:`, metas);
        
        // Salvar no Firebase
        await window.db.collection('metas').doc(loja).set(metas);
        
        // Atualizar localmente
        metasLojas[loja] = metas;
        
        console.log(`✅ Metas de ${loja} salvas com sucesso!`);
        
        // Mostrar feedback visual - VERDE
        const btn = document.getElementById(`edit${loja.charAt(0).toUpperCase() + loja.slice(1)}`);
        const originalText = btn.textContent;
        btn.textContent = '✅ Salvo!';
        btn.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
        
        setTimeout(() => {
            btn.textContent = 'Editar Metas';
        }, 2000);
        
        // Se estiver visualizando esta loja, atualizar dashboard
        if (lojaAtual === loja && dadosVendas[loja]) {
            atualizarDashboardLoja(loja, dadosVendas[loja], metas);
        } else if (lojaAtual === 'administrativo') {
            carregarDadosAdministrativo();
        }
        
    } catch (error) {
        console.error('❌ Erro ao salvar metas:', error);
        
        // Mostrar erro visual
        const btn = document.getElementById(`edit${loja.charAt(0).toUpperCase() + loja.slice(1)}`);
        btn.textContent = '❌ Erro!';
        btn.style.background = '#dc3545';
        
        setTimeout(() => {
            btn.textContent = 'Salvar Metas';
        }, 2000);
    }
}

// Carregar metas do Firebase - MELHORADA
async function carregarMetas() {
    try {
        if (!window.db) {
            console.log('📝 Firebase não disponível, usando metas padrão');
            return;
        }
        
        console.log('📋 Carregando metas do Firebase...');
        
        // Listener em tempo real para metas
        window.db.collection('metas').onSnapshot((snapshot) => {
            snapshot.forEach((doc) => {
                const loja = doc.id;
                const metas = doc.data();
                
                console.log(`🎯 Metas de ${loja} carregadas:`, metas);
                
                // Salvar localmente
                metasLojas[loja] = metas;
                
                // Atualizar interface
                const inputAparelhos = document.getElementById(`${loja}_meta_aparelhos`);
                const inputAcessorios = document.getElementById(`${loja}_meta_acessorios`);
                const inputVendedorAparelhos = document.getElementById(`${loja}_meta_vendedor_aparelhos`);
                const inputVendedorAcessorios = document.getElementById(`${loja}_meta_vendedor_acessorios`);
                
                if (inputAparelhos) {
                    inputAparelhos.value = metas.aparelhos || 0;
                }
                
                if (inputAcessorios) {
                    inputAcessorios.value = formatarMoedaDisplay(metas.acessorios || 0);
                }
                
                if (inputVendedorAparelhos) {
                    inputVendedorAparelhos.value = metas.vendedorAparelhos || 0;
                }
                
                if (inputVendedorAcessorios) {
                    inputVendedorAcessorios.value = formatarMoedaDisplay(metas.vendedorAcessorios || 0);
                }
                
                // Se estiver visualizando esta loja e tem dados, atualizar dashboard
                if (lojaAtual === loja && dadosVendas[loja]) {
                    atualizarDashboardLoja(loja, dadosVendas[loja], metas);
                } else if (lojaAtual === 'administrativo') {
                    carregarDadosAdministrativo();
                }
            });
        }, (error) => {
            console.error('❌ Erro ao carregar metas:', error);
        });
        
        console.log('✅ Listener de metas configurado!');
        
    } catch (error) {
        console.log('📝 Erro ao configurar listener de metas:', error);
    }
}

// Salvar dados no Firebase
async function salvarDadosFirebase(resumos, dadosOriginais) {
    try {
        if (!window.db || !window.firebaseConfig) {
            throw new Error('Firebase não está conectado');
        }

        const periodoVendas = calcularPeriodoVendas(dadosOriginais);
        
        console.log('💾 Salvando dados no Firebase...');
        console.log('📊 Dados a serem salvos:', {
            resumos: Object.keys(resumos),
            dadosOriginais: dadosOriginais.length,
            periodoVendas
        });
        
        // CORREÇÃO: Usar a referência correta do documento
        const docRef = window.db.collection('vendas').doc('dados_atuais');
        
        const dadosParaSalvar = {
            dados: resumos,
            vendasOriginais: dadosOriginais,
            ultimaAtualizacao: new Date().toISOString(),
            periodoVendas: periodoVendas
        };
        
        await docRef.set(dadosParaSalvar);
        
        // FORÇAR ATUALIZAÇÃO LOCAL IMEDIATA
        window.ultimaAtualizacao = dadosParaSalvar.ultimaAtualizacao;
        window.periodoVendasAtual = dadosParaSalvar.periodoVendas;
        window.ultimasVendasOriginais = dadosOriginais;
        dadosVendas = resumos;
        
        // ATUALIZAR TIMESTAMPS IMEDIATAMENTE
        atualizarTimestampsGlobal();
        
        console.log('✅ Dados salvos no Firebase com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro detalhado ao salvar no Firebase:', error);
        console.error('Stack trace:', error.stack);
        throw error; // Re-throw para que o erro seja capturado no processamento
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

// ============================================
// PAINEL ADMINISTRATIVO - NOVA ESTRUTURA
// ============================================

// Carregar dados do painel administrativo
function carregarDadosAdministrativo() {
    console.log('📊 Carregando dados do painel administrativo...');
    
    if (!dadosVendas || Object.keys(dadosVendas).length === 0) {
        mostrarLoadingAdministrativo();
        return;
    }
    
    // Atualizar painel na nova estrutura
    atualizarPainelAdministrativo(dadosVendas, window.ultimasVendasOriginais || []);
}

// Mostrar loading no painel administrativo - NOVA ESTRUTURA
function mostrarLoadingAdministrativo() {
    const elementos = [
        'admin_metasGerais',
        'admin_metasVendedorAparelhos', 
        'admin_metasVendedorAcessorios',
        'admin_rankingAparelhos', 
        'admin_rankingAcessorios',
        'admin_top5Aparelhos', 
        'admin_top5Acessorios'
    ];
    
    elementos.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === 'admin_top5Aparelhos' || id === 'admin_top5Acessorios') {
                // Tabelas mantêm estrutura anterior
                el.innerHTML = '<tr><td colspan="3" class="loading">Carregando dados...</td></tr>';
            } else {
                // Cards usam nova estrutura
                el.innerHTML = '<div class="admin-loading">Carregando dados...</div>';
            }
        }
    });
}

// Atualizar painel administrativo - NOVA ESTRUTURA
function atualizarPainelAdministrativo(dados, vendasOriginais) {
    console.log('📊 Atualizando painel administrativo - nova estrutura');
    
    // Metas gerais
    atualizarMetasGerais(dados);
    
    // Metas por vendedor
    atualizarMetasVendedor(dados);
    
    // Rankings
    atualizarRankings(dados);
    
    // Top 5 produtos
    atualizarTop5Produtos(vendasOriginais);
    
    // Atualizar timestamps
    atualizarTimestampsGlobal();
}

// Atualizar metas gerais - NOVO VISUAL DESTACADO E RESPONSIVO
function atualizarMetasGerais(dados) {
    const castanhal = dados.castanhal || {};
    const belem = dados.belem || {};
    const mix = dados.mix || {};

    const totalMetaAparelhos = (metasLojas.castanhal?.aparelhos || 0) + (metasLojas.belem?.aparelhos || 0) + (metasLojas.mix?.aparelhos || 0);
    const totalMetaAcessorios = (metasLojas.castanhal?.acessorios || 0) + (metasLojas.belem?.acessorios || 0) + (metasLojas.mix?.acessorios || 0);
    
    const totalAparelhos = (castanhal.aparelhos || 0) + (belem.aparelhos || 0) + (mix.aparelhos || 0);
    const totalAcessorios = (castanhal.acessorios || 0) + (belem.acessorios || 0) + (mix.acessorios || 0);
    const totalFaturamento = (castanhal.faturamento || 0) + (belem.faturamento || 0) + (mix.faturamento || 0);
    const totalLucro = (castanhal.lucro || 0) + (belem.lucro || 0) + (mix.lucro || 0);
    const totalLucroAcessorios = (castanhal.lucroAcessorios || 0) + (belem.lucroAcessorios || 0) + (mix.lucroAcessorios || 0);
    const totalFaturamentoAcessorios = (castanhal.faturamentoAcessorios || 0) + (belem.faturamentoAcessorios || 0) + (mix.faturamentoAcessorios || 0);

    const faltaDiaAparelhos = calcularFaltaPorDiaAdmin(totalMetaAparelhos, totalAparelhos);
    const faltaDiaAcessorios = calcularFaltaPorDiaAdmin(totalMetaAcessorios, totalAcessorios);

    // Card para Aparelhos - NOVO VISUAL DESTACADO
    const percentAparelhos = totalMetaAparelhos > 0 ? (totalAparelhos / totalMetaAparelhos * 100) : 0;
    const faltamAparelhos = Math.max(0, totalMetaAparelhos - totalAparelhos);
    
    // Card para Acessórios - NOVO VISUAL DESTACADO
    const percentAcessorios = totalMetaAcessorios > 0 ? (totalAcessorios / totalMetaAcessorios * 100) : 0;
    const faltamAcessorios = Math.max(0, totalMetaAcessorios - totalAcessorios);

    const htmlMetasGerais = `
        <div class="admin-metas-gerais-card">
            <div class="admin-metas-gerais-header">
                <div class="admin-metas-gerais-titulo">📱 Aparelhos</div>
                <div class="admin-metas-gerais-meta-destaque">Meta: ${totalMetaAparelhos}</div>
            </div>
            
            <div class="admin-metas-gerais-stats">
                <div class="admin-metas-gerais-stat">
                    <div class="admin-metas-gerais-stat-label">Vendidos</div>
                    <div class="admin-metas-gerais-stat-valor highlight">${totalAparelhos}</div>
                </div>
                <div class="admin-metas-gerais-stat">
                    <div class="admin-metas-gerais-stat-label">Falta/Dia</div>
                    <div class="admin-metas-gerais-stat-valor urgent">${Math.ceil(faltaDiaAparelhos)}</div>
                </div>
                <div class="admin-metas-gerais-stat">
                    <div class="admin-metas-gerais-stat-label">Faturamento</div>
                    <div class="admin-metas-gerais-stat-valor">${formatarMoedaCompleta(totalFaturamento)}</div>
                </div>
                <div class="admin-metas-gerais-stat">
                    <div class="admin-metas-gerais-stat-label">Lucro</div>
                    <div class="admin-metas-gerais-stat-valor">${formatarMoedaCompleta(totalLucro)}</div>
                </div>
            </div>
            
            <div class="admin-metas-gerais-progress-container">
                <div class="admin-metas-gerais-progress-label">
                    <span>Progresso: ${totalAparelhos}/${totalMetaAparelhos}</span>
                    <span style="background: #fff3cd; color: #856404; padding: 2px 8px; border-radius: 12px; font-size: 10px;">${Math.round(percentAparelhos)}%</span>
                </div>
                <div class="admin-metas-gerais-progress-bar">
                    <div class="admin-metas-gerais-progress-fill" style="width: ${Math.min(percentAparelhos, 100)}%;">
                        <span class="admin-metas-gerais-progress-vendidos">${totalAparelhos}</span>
                    </div>
                    <div class="admin-metas-gerais-progress-faltam">${faltamAparelhos}</div>
                </div>
            </div>
        </div>
        
        <div class="admin-metas-gerais-card">
            <div class="admin-metas-gerais-header">
                <div class="admin-metas-gerais-titulo">🎧 Acessórios</div>
                <div class="admin-metas-gerais-meta-destaque">Meta: ${formatarMoedaCompleta(totalMetaAcessorios)}</div>
            </div>
            
            <div class="admin-metas-gerais-stats">
                <div class="admin-metas-gerais-stat">
                    <div class="admin-metas-gerais-stat-label">Vendidos</div>
                    <div class="admin-metas-gerais-stat-valor highlight">${formatarMoedaCompleta(totalAcessorios)}</div>
                </div>
                <div class="admin-metas-gerais-stat">
                    <div class="admin-metas-gerais-stat-label">Falta/Dia</div>
                    <div class="admin-metas-gerais-stat-valor urgent">${formatarMoedaCompleta(faltaDiaAcessorios)}</div>
                </div>
                <div class="admin-metas-gerais-stat">
                    <div class="admin-metas-gerais-stat-label">Faturamento</div>
                    <div class="admin-metas-gerais-stat-valor">${formatarMoedaCompleta(totalFaturamentoAcessorios)}</div>
                </div>
                <div class="admin-metas-gerais-stat">
                    <div class="admin-metas-gerais-stat-label">Lucro</div>
                    <div class="admin-metas-gerais-stat-valor">${formatarMoedaCompleta(totalLucroAcessorios)}</div>
                </div>
            </div>
            
            <div class="admin-metas-gerais-progress-container">
                <div class="admin-metas-gerais-progress-label">
                    <span>Progresso: ${formatarMoedaCompleta(totalAcessorios)}/${formatarMoedaCompleta(totalMetaAcessorios)}</span>
                    <span style="background: #fff3cd; color: #856404; padding: 2px 8px; border-radius: 12px; font-size: 10px;">${Math.round(percentAcessorios)}%</span>
                </div>
                <div class="admin-metas-gerais-progress-bar">
                    <div class="admin-metas-gerais-progress-fill" style="width: ${Math.min(percentAcessorios, 100)}%;">
                        <span class="admin-metas-gerais-progress-vendidos">${formatarMoedaCompleta(totalAcessorios)}</span>
                    </div>
                    <div class="admin-metas-gerais-progress-faltam">${formatarMoedaCompleta(faltamAcessorios)}</div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('admin_metasGerais').innerHTML = htmlMetasGerais;
}

// Atualizar metas por vendedor - NOVA ESTRUTURA COM CARDS
function atualizarMetasVendedor(dados) {
    const lojas = ['castanhal', 'belem', 'mix'];
    
    // APARELHOS
    let htmlAparelhos = '';
    lojas.forEach(loja => {
        const dadosLoja = dados[loja] || {};
        const vendedores = dadosLoja.vendedores || {};
        const metaLoja = metasLojas[loja] || {};
        
        const nomeLojaFormatado = loja.charAt(0).toUpperCase() + loja.slice(1);
        const vendedoresArray = Object.keys(vendedores);
        
        if (vendedoresArray.length > 0) {
            htmlAparelhos += `
                <div class="admin-loja-group">
                    <div class="admin-loja-title">🏢 ${nomeLojaFormatado}</div>
            `;
            
            vendedoresArray.forEach(nome => {
                const vendedora = vendedores[nome];
                const aparelhosVendidos = vendedora.aparelhos || 0;
                const metaVendedor = metaLoja.vendedorAparelhos || 0;
                const faltam = Math.max(0, metaVendedor - aparelhosVendidos);
                const percent = metaVendedor > 0 ? (aparelhosVendidos / metaVendedor * 100) : 0;
                
                htmlAparelhos += `
                    <div class="admin-vendedor-card">
                        <div class="admin-vendedor-linha-superior">
                            <div class="admin-vendedor-nome">${nome}</div>
                            <div class="admin-vendedor-valor">${aparelhosVendidos} vendidos</div>
                        </div>
                        <div class="admin-vendedor-linha-inferior">
                            <div class="admin-vendedor-meta">Meta: ${metaVendedor} aparelhos</div>
                            <div class="admin-vendedor-falta">Faltam: ${faltam}</div>
                        </div>
                        <div class="admin-vendedor-progress-bar">
                            <div class="admin-vendedor-progress-fill" style="width: ${Math.min(percent, 100)}%;">
                                <span class="admin-vendedor-progress-vendidos">${aparelhosVendidos}</span>
                            </div>
                            <div class="admin-vendedor-progress-faltam">${faltam}</div>
                        </div>
                    </div>
                `;
            });
            
            htmlAparelhos += `</div>`;
        }
    });
    
    // ACESSÓRIOS
    let htmlAcessorios = '';
    lojas.forEach(loja => {
        const dadosLoja = dados[loja] || {};
        const vendedores = dadosLoja.vendedores || {};
        const metaLoja = metasLojas[loja] || {};
        
        const nomeLojaFormatado = loja.charAt(0).toUpperCase() + loja.slice(1);
        const vendedoresArray = Object.keys(vendedores);
        
        if (vendedoresArray.length > 0) {
            htmlAcessorios += `
                <div class="admin-loja-group">
                    <div class="admin-loja-title">🏢 ${nomeLojaFormatado}</div>
            `;
            
            vendedoresArray.forEach(nome => {
                const vendedora = vendedores[nome];
                const acessoriosVendidos = vendedora.acessorios || 0;
                const metaVendedor = metaLoja.vendedorAcessorios || 0;
                const faltam = Math.max(0, metaVendedor - acessoriosVendidos);
                const percent = metaVendedor > 0 ? (acessoriosVendidos / metaVendedor * 100) : 0;
                
                htmlAcessorios += `
                    <div class="admin-vendedor-card">
                        <div class="admin-vendedor-linha-superior">
                            <div class="admin-vendedor-nome">${nome}</div>
                            <div class="admin-vendedor-valor">${formatarMoedaCompleta(acessoriosVendidos)} vendidos</div>
                        </div>
                        <div class="admin-vendedor-linha-inferior">
                            <div class="admin-vendedor-meta">Meta: ${formatarMoedaCompleta(metaVendedor)} acessórios</div>
                            <div class="admin-vendedor-falta">Faltam: ${formatarMoedaCompleta(faltam)}</div>
                        </div>
                        <div class="admin-vendedor-progress-bar">
                            <div class="admin-vendedor-progress-fill" style="width: ${Math.min(percent, 100)}%;">
                                <span class="admin-vendedor-progress-vendidos">${formatarMoedaCompleta(acessoriosVendidos)}</span>
                            </div>
                            <div class="admin-vendedor-progress-faltam">${formatarMoedaCompleta(faltam)}</div>
                        </div>
                    </div>
                `;
            });
            
            htmlAcessorios += `</div>`;
        }
    });
    
    // Atualizar DOM
    document.getElementById('admin_metasVendedorAparelhos').innerHTML = htmlAparelhos || '<div class="admin-loading">Nenhum dado disponível</div>';
    document.getElementById('admin_metasVendedorAcessorios').innerHTML = htmlAcessorios || '<div class="admin-loading">Nenhum dado disponível</div>';
}

// Atualizar rankings - NOVA ESTRUTURA COM TABELA PARA DESKTOP E CARDS PARA MOBILE
function atualizarRankings(dados) {
    // Coletar todas as vendedoras
    const todasVendedoras = [];
    
    Object.keys(dados).forEach(loja => {
        const vendedores = dados[loja].vendedores || {};
        Object.keys(vendedores).forEach(nome => {
            const vendedora = vendedores[nome];
            todasVendedoras.push({
                nome: nome,
                loja: loja.charAt(0).toUpperCase() + loja.slice(1),
                aparelhos: vendedora.aparelhos || 0,
                acessorios: vendedora.acessorios || 0,
                faturamento: vendedora.faturamento || 0,
                lucro: vendedora.lucro || 0,
                lucroAcessorios: vendedora.lucroAcessorios || 0,
                quantidadeAcessorios: vendedora.quantidadeAcessorios || 0,
                faturamentoAparelhos: vendedora.faturamentoAparelhos || 0,
                lucroAparelhos: vendedora.lucroAparelhos || 0
            });
        });
    });

    // Ranking por aparelhos (ordem decrescente - maior quantidade primeiro)
    const rankingAparelhos = [...todasVendedoras]
        .sort((a, b) => b.aparelhos - a.aparelhos)
        .slice(0, 10);

    // Ranking por acessórios (ordem decrescente por faturamento)
    const rankingAcessorios = [...todasVendedoras]
        .sort((a, b) => b.acessorios - a.acessorios)
        .slice(0, 10);

    // Renderizar ranking aparelhos - TABELA PARA DESKTOP
    let htmlRankingAparelhos = `
        <div class="admin-ranking-container">
            <!-- VERSÃO DESKTOP - TABELA -->
            <div class="admin-ranking-desktop">
                <table class="admin-ranking-table">
                    <thead>
                        <tr>
                            <th>Colocação e Vendedora</th>
                            <th>Quantidade Vendida</th>
                            <th>Faturamento</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    rankingAparelhos.forEach((vendedora, index) => {
        const posicao = index + 1;
        
        htmlRankingAparelhos += `
            <tr>
                <td>
                    <div class="ranking-posicao-nome">
                        <span class="ranking-posicao">${posicao}º</span>
                        <span class="ranking-vendedora">${vendedora.nome}</span>
                        <span class="ranking-loja">${vendedora.loja}</span>
                    </div>
                </td>
                <td class="ranking-quantidade">
                    <strong>${vendedora.aparelhos}</strong> aparelhos
                </td>
                <td class="ranking-faturamento">
                    ${formatarMoedaCompleta(vendedora.faturamentoAparelhos)}
                </td>
            </tr>
        `;
    });
    
    htmlRankingAparelhos += `
                    </tbody>
                </table>
            </div>
            
            <!-- VERSÃO MOBILE - CARDS -->
            <div class="admin-ranking-mobile">
    `;
    
    rankingAparelhos.forEach((vendedora, index) => {
        const posicao = `${index + 1}º lugar`;
        
        htmlRankingAparelhos += `
            <div class="admin-ranking-card-mobile">
                <div class="ranking-mobile-header">
                    <div class="ranking-mobile-posicao">${posicao}</div>
                    <div class="ranking-mobile-vendedora">${vendedora.nome}</div>
                    <div class="ranking-mobile-loja">${vendedora.loja}</div>
                </div>
                <div class="ranking-mobile-stats">
                    <div class="ranking-mobile-stat">
                        <div class="ranking-mobile-label">Quantidade Vendida</div>
                        <div class="ranking-mobile-valor destaque">${vendedora.aparelhos} aparelhos</div>
                    </div>
                    <div class="ranking-mobile-stat">
                        <div class="ranking-mobile-label">Faturamento</div>
                        <div class="ranking-mobile-valor">${formatarMoedaCompleta(vendedora.faturamentoAparelhos)}</div>
                    </div>
                </div>
            </div>
        `;
    });
    
    htmlRankingAparelhos += `
            </div>
        </div>
    `;

    // Renderizar ranking acessórios - TABELA PARA DESKTOP
    let htmlRankingAcessorios = `
        <div class="admin-ranking-container">
            <!-- VERSÃO DESKTOP - TABELA -->
            <div class="admin-ranking-desktop">
                <table class="admin-ranking-table">
                    <thead>
                        <tr>
                            <th>Colocação e Vendedora</th>
                            <th>Quantidade Vendida</th>
                            <th>Faturamento</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    rankingAcessorios.forEach((vendedora, index) => {
        const posicao = index + 1;
        
        htmlRankingAcessorios += `
            <tr>
                <td>
                    <div class="ranking-posicao-nome">
                        <span class="ranking-posicao">${posicao}º</span>
                        <span class="ranking-vendedora">${vendedora.nome}</span>
                        <span class="ranking-loja">${vendedora.loja}</span>
                    </div>
                </td>
                <td class="ranking-quantidade">
                    <strong>${vendedora.quantidadeAcessorios}</strong> itens
                </td>
                <td class="ranking-faturamento">
                    ${formatarMoedaCompleta(vendedora.acessorios)}
                </td>
            </tr>
        `;
    });
    
    htmlRankingAcessorios += `
                    </tbody>
                </table>
            </div>
            
            <!-- VERSÃO MOBILE - CARDS -->
            <div class="admin-ranking-mobile">
    `;
    
    rankingAcessorios.forEach((vendedora, index) => {
        const posicao = `${index + 1}º lugar`;
        
        htmlRankingAcessorios += `
            <div class="admin-ranking-card-mobile">
                <div class="ranking-mobile-header">
                    <div class="ranking-mobile-posicao">${posicao}</div>
                    <div class="ranking-mobile-vendedora">${vendedora.nome}</div>
                    <div class="ranking-mobile-loja">${vendedora.loja}</div>
                </div>
                <div class="ranking-mobile-stats">
                    <div class="ranking-mobile-stat">
                        <div class="ranking-mobile-label">Quantidade Vendida</div>
                        <div class="ranking-mobile-valor">${vendedora.quantidadeAcessorios} itens</div>
                    </div>
                    <div class="ranking-mobile-stat">
                        <div class="ranking-mobile-label">Faturamento</div>
                        <div class="ranking-mobile-valor destaque">${formatarMoedaCompleta(vendedora.acessorios)}</div>
                    </div>
                </div>
            </div>
        `;
    });
    
    htmlRankingAcessorios += `
            </div>
        </div>
    `;

    // Atualizar DOM
    document.getElementById('admin_rankingAparelhos').innerHTML = htmlRankingAparelhos || '<div class="admin-loading">Nenhum dado disponível</div>';
    document.getElementById('admin_rankingAcessorios').innerHTML = htmlRankingAcessorios || '<div class="admin-loading">Nenhum dado disponível</div>';
}

// Atualizar top 5 produtos - TABELA SIMPLES SEM CARDS
function atualizarTop5Produtos(vendasOriginais) {
    console.log('🔥 Processando top 5 produtos...', vendasOriginais?.length);
    
    if (!vendasOriginais || vendasOriginais.length === 0) {
        console.log('❌ Sem dados de vendas originais');
        document.getElementById('admin_top5Aparelhos').innerHTML = '<tr><td colspan="3" class="loading">Nenhum dado disponível</td></tr>';
        document.getElementById('admin_top5Acessorios').innerHTML = '<tr><td colspan="3" class="loading">Nenhum dado disponível</td></tr>';
        return;
    }

    // Agrupar produtos
    const produtosAparelhos = {};
    const produtosAcessorios = {};

    vendasOriginais.forEach(venda => {
        const produto = venda.Produto || venda.produto || '';
        if (!produto || produto === 'TOTAL') return;
        
        const qtd = parseInt(venda.Qtd || venda.qtd || venda.quantidade || 0);
        const precoTotalStr = String(venda['Preço Total'] || venda.precoTotal || venda.preco || '0');
        
        const isAparelho = isDispositivo(produto);
        
        // Limpar e converter preço
        let preco = 0;
        if (precoTotalStr) {
            preco = parseFloat(precoTotalStr
                .replace(/"/g, '')
                .replace(/\./g, '')
                .replace(',', '.')
                .replace(/[^\d.-]/g, '')
            ) || 0;
        }
        
        const isBrinde = !isAparelho && preco === 0;
        
        if (isBrinde) return;

        if (isAparelho) {
            if (!produtosAparelhos[produto]) {
                produtosAparelhos[produto] = { quantidade: 0, faturamento: 0 };
            }
            produtosAparelhos[produto].quantidade += qtd;
            produtosAparelhos[produto].faturamento += preco;
        } else {
            if (!produtosAcessorios[produto]) {
                produtosAcessorios[produto] = { quantidade: 0, faturamento: 0 };
            }
            produtosAcessorios[produto].quantidade += qtd;
            produtosAcessorios[produto].faturamento += preco;
        }
    });

    // Top 5 - ORDEM DECRESCENTE (maior quantidade primeiro)
    const top5Aparelhos = Object.entries(produtosAparelhos)
        .sort(([,a], [,b]) => b.quantidade - a.quantidade)
        .slice(0, 5);

    const top5Acessorios = Object.entries(produtosAcessorios)
        .sort(([,a], [,b]) => b.quantidade - a.quantidade)
        .slice(0, 5);

    // Renderizar tabela aparelhos - SEM CARDS, SEM COLOCAÇÃO
    let htmlTop5Aparelhos = '';
    top5Aparelhos.forEach(([produto, dados]) => {
        htmlTop5Aparelhos += `
            <tr>
                <td>${produto}</td>
                <td><strong>${dados.quantidade}</strong></td>
                <td>${formatarMoedaCompleta(dados.faturamento)}</td>
            </tr>
        `;
    });

    // Renderizar tabela acessórios - SEM CARDS, SEM COLOCAÇÃO
    let htmlTop5Acessorios = '';
    top5Acessorios.forEach(([produto, dados]) => {
        htmlTop5Acessorios += `
            <tr>
                <td>${produto}</td>
                <td><strong>${dados.quantidade}</strong></td>
                <td>${formatarMoedaCompleta(dados.faturamento)}</td>
            </tr>
        `;
    });

    // Atualizar DOM
    document.getElementById('admin_top5Aparelhos').innerHTML = htmlTop5Aparelhos || '<tr><td colspan="3" class="loading">Nenhum produto encontrado</td></tr>';
    document.getElementById('admin_top5Acessorios').innerHTML = htmlTop5Acessorios || '<tr><td colspan="3" class="loading">Nenhum produto encontrado</td></tr>';
}

// ============================================
// MELHORIAS - SISTEMA DE BACKUP E VALIDAÇÃO
// ============================================

// Adicionar após a função configurarAutomacao()
function adicionarSecaoBackupEAlertas() {
    const uploadContent = document.querySelector('#secao-configuracao .upload-content');
    
    if (uploadContent) {
        const melhoriasSectionHtml = `
            <!-- SEÇÃO DE BACKUP -->
            <div class="upload-section">
                <div class="upload-header">
                    <h3>💾 Sistema de Backup</h3>
                </div>
                <div class="upload-content">
                    <div class="config-item">
                        <div class="config-title">🔒 BACKUP AUTOMÁTICO</div>
                        
                        <div style="text-align: center; margin-bottom: 20px;">
                            <div id="statusBackup" class="connection-status" style="display: block;">
                                🔄 Verificando status dos backups...
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                            <button id="btnCriarBackup" class="upload-btn">
                                💾 CRIAR BACKUP MANUAL
                            </button>
                            <button id="btnRestaurarBackup" class="upload-btn">
                                🔄 RESTAURAR BACKUP
                            </button>
                        </div>
                        
                        <div class="admin-metas-gerais-stats" style="margin-bottom: 15px;">
                            <div class="admin-metas-gerais-stat">
                                <div class="admin-metas-gerais-stat-label">Total de Backups</div>
                                <div id="totalBackups" class="admin-metas-gerais-stat-valor">-</div>
                            </div>
                            <div class="admin-metas-gerais-stat">
                                <div class="admin-metas-gerais-stat-label">Último Backup</div>
                                <div id="ultimoBackup" class="admin-metas-gerais-stat-valor">-</div>
                            </div>
                            <div class="admin-metas-gerais-stat">
                                <div class="admin-metas-gerais-stat-label">Espaço Usado</div>
                                <div id="espacoBackups" class="admin-metas-gerais-stat-valor">-</div>
                            </div>
                        </div>
                        
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                            <h4 style="color: #28a745; margin-bottom: 10px;">💾 Backup Automático:</h4>
                            <ul style="font-size: 14px; color: #666; padding-left: 20px;">
                                <li>Backup criado automaticamente antes de cada processamento</li>
                                <li>Últimos 30 backups são mantidos automaticamente</li>
                                <li>Verificação de integridade com checksum</li>
                                <li>Restauração rápida em caso de problemas</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            <!-- SEÇÃO DE ALERTAS E VALIDAÇÃO -->
            <div class="upload-section">
                <div class="upload-header">
                    <h3>🚨 Alertas e Validação</h3>
                </div>
                <div class="upload-content">
                    <div class="config-item">
                        <div class="config-title">⚠️ SISTEMA DE ALERTAS</div>
                        
                        <div style="text-align: center; margin-bottom: 20px;">
                            <div id="statusAlertas" class="connection-status" style="display: block;">
                                🔄 Verificando alertas ativos...
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                            <button id="btnVerAlertas" class="upload-btn">
                                🚨 VER ALERTAS ATIVOS
                            </button>
                            <button id="btnHistoricoValidacao" class="upload-btn">
                                📋 HISTÓRICO VALIDAÇÃO
                            </button>
                        </div>
                        
                        <div id="alertasAtivos" style="max-height: 200px; overflow-y: auto; margin-bottom: 15px;">
                            <!-- Alertas serão carregados aqui -->
                        </div>
                        
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                            <h4 style="color: #dc3545; margin-bottom: 10px;">🚨 Sistema de Alertas:</h4>
                            <ul style="font-size: 14px; color: #666; padding-left: 20px;">
                                <li><strong>Metas em Risco:</strong> Quando vendas estão abaixo do esperado</li>
                                <li><strong>Dados Anômalos:</strong> Preços ou quantidades suspeitas</li>
                                <li><strong>Vendedores Inativos:</strong> Sem vendas significativas</li>
                                <li><strong>Problemas Técnicos:</strong> Falhas na automação</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            <!-- SEÇÃO DE LOGS DETALHADOS -->
            <div class="upload-section">
                <div class="upload-header">
                    <h3>📊 Logs e Histórico</h3>
                </div>
                <div class="upload-content">
                    <div class="config-item">
                        <div class="config-title">📋 HISTÓRICO DETALHADO</div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                            <button id="btnLogsDetalhados" class="upload-btn">
                                📋 LOGS DETALHADOS
                            </button>
                            <button id="btnHistoricoExecucoes" class="upload-btn">
                                ⏰ HISTÓRICO EXECUÇÕES
                            </button>
                        </div>
                        
                        <div class="admin-metas-gerais-stats" style="margin-bottom: 15px;">
                            <div class="admin-metas-gerais-stat">
                                <div class="admin-metas-gerais-stat-label">Execuções (7 dias)</div>
                                <div id="execucoes7dias" class="admin-metas-gerais-stat-valor">-</div>
                            </div>
                            <div class="admin-metas-gerais-stat">
                                <div class="admin-metas-gerais-stat-label">Taxa de Sucesso</div>
                                <div id="taxaSucesso7dias" class="admin-metas-gerais-stat-valor highlight">-</div>
                            </div>
                            <div class="admin-metas-gerais-stat">
                                <div class="admin-metas-gerais-stat-label">Última Falha</div>
                                <div id="ultimaFalha" class="admin-metas-gerais-stat-valor urgent">-</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Inserir após a seção de automação existente
        const automacaoSection = document.querySelector('#statusAutomacao').closest('.upload-section');
        automacaoSection.insertAdjacentHTML('afterend', melhoriasSectionHtml);
    }
}

// ============================================
// MELHORAR SEÇÃO DE AUTOMAÇÃO EXISTENTE
// ============================================

// Modificar a função adicionarBotaoAutomacao() existente para incluir edição de horário
function melhorarSecaoAutomacao() {
    const automacaoContent = document.querySelector('#statusAutomacao').closest('.upload-content');
    
    if (automacaoContent) {
        // Encontrar a div dos botões e adicionar o botão de editar horário
        const botaoTeste = document.getElementById('btnTesteAutomacao');
        const botaoHistorico = document.getElementById('btnHistoricoAutomacao');
        
        if (botaoTeste && botaoHistorico) {
            // Criar nova estrutura de botões
            const containerBotoes = botaoTeste.parentElement;
            containerBotoes.style.gridTemplateColumns = '1fr 1fr 1fr';
            
            // Adicionar botão de editar horário
            const btnEditarHorario = document.createElement('button');
            btnEditarHorario.id = 'btnEditarHorario';
            btnEditarHorario.className = 'upload-btn';
            btnEditarHorario.innerHTML = '⏰ EDITAR HORÁRIO';
            containerBotoes.appendChild(btnEditarHorario);
            
            // Configurar evento do botão
            btnEditarHorario.addEventListener('click', mostrarModalEditarHorario);
        }
        
        // Adicionar seção de status mais detalhado
        const ultimaExecucaoDiv = document.getElementById('ultimaExecucao');
        if (ultimaExecucaoDiv) {
            ultimaExecucaoDiv.insertAdjacentHTML('afterend', `
                <div id="detalhesExecucao" style="margin-top: 15px; padding: 15px; background: #e9ecef; border-radius: 8px; display: none;">
                    <h4 style="color: #28a745; margin-bottom: 10px;">📊 Detalhes da Última Execução:</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px;">
                        <div><strong>Duração:</strong> <span id="duracaoUltimaExecucao">-</span></div>
                        <div><strong>Registros:</strong> <span id="registrosUltimaExecucao">-</span></div>
                        <div><strong>Aparelhos:</strong> <span id="aparelhosUltimaExecucao">-</span></div>
                        <div><strong>Acessórios:</strong> <span id="acessoriosUltimaExecucao">-</span></div>
                        <div><strong>Alertas:</strong> <span id="alertasUltimaExecucao">-</span></div>
                        <div><strong>Status:</strong> <span id="statusUltimaExecucao">-</span></div>
                    </div>
                </div>
            `);
        }
    }
}

// ============================================
// FUNÇÕES DE BACKUP
// ============================================

async function carregarStatusBackup() {
    try {
        if (!window.db) return;
        
        // Buscar backups existentes
        const snapshot = await window.db.collection('backups')
            .orderBy('timestamp', 'desc')
            .limit(30)
            .get();
        
        const totalBackups = snapshot.size;
        let ultimoBackup = null;
        let espacoTotal = 0;
        
        snapshot.forEach(doc => {
            const backup = doc.data();
            if (!ultimoBackup) ultimoBackup = backup;
            
            // Calcular espaço aproximado (tamanho do JSON em chars)
            espacoTotal += JSON.stringify(backup.dados).length;
        });
        
        // Atualizar interface
        document.getElementById('totalBackups').textContent = totalBackups;
        
        if (ultimoBackup) {
            const tempoDecorrido = Math.round((Date.now() - new Date(ultimoBackup.timestamp).getTime()) / (1000 * 60));
            document.getElementById('ultimoBackup').textContent = `${tempoDecorrido}min atrás`;
        } else {
            document.getElementById('ultimoBackup').textContent = 'Nenhum';
        }
        
        // Converter espaço para MB aproximadamente
        const espacoMB = (espacoTotal / (1024 * 1024)).toFixed(2);
        document.getElementById('espacoBackups').textContent = `${espacoMB} MB`;
        
        // Status geral
        const statusBackup = document.getElementById('statusBackup');
        if (totalBackups >= 5) {
            statusBackup.innerHTML = '✅ Sistema de backup funcionando';
            statusBackup.style.background = '#d4edda';
            statusBackup.style.color = '#155724';
        } else {
            statusBackup.innerHTML = '⚠️ Poucos backups disponíveis';
            statusBackup.style.background = '#fff3cd';
            statusBackup.style.color = '#856404';
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar status do backup:', error);
        document.getElementById('statusBackup').innerHTML = '❌ Erro ao verificar backups';
    }
}

async function criarBackupManual() {
    const btn = document.getElementById('btnCriarBackup');
    
    try {
        btn.disabled = true;
        btn.innerHTML = '🔄 Criando backup...';
        
        if (!window.db) {
            throw new Error('Firebase não disponível');
        }
        
        // Buscar dados atuais
        const doc = await window.db.collection('vendas').doc('dados_atuais').get();
        
        if (!doc.exists) {
            throw new Error('Nenhum dado encontrado para fazer backup');
        }
        
        const dadosAtuais = doc.data();
        
        // Criar backup
        const backup = {
            dados: dadosAtuais.dados,
            vendasOriginais: dadosAtuais.vendasOriginais,
            metadata: {
                periodo: dadosAtuais.periodoVendas,
                ultimaAtualizacao: dadosAtuais.ultimaAtualizacao,
                tipoBackup: 'manual',
                criadoPor: 'usuario'
            },
            timestamp: new Date().toISOString(),
            versao: '1.0',
            checksum: gerarChecksum(dadosAtuais.dados)
        };
        
        // Salvar backup
        const backupId = `backup_manual_${Date.now()}`;
        await window.db.collection('backups').doc(backupId).set(backup);
        
        // Limpar backups antigos
        await limparBackupsAntigos();
        
        btn.innerHTML = '✅ Backup criado!';
        mostrarSucesso(`✅ Backup manual criado com sucesso: ${backupId}`);
        
        // Atualizar status
        setTimeout(() => {
            carregarStatusBackup();
            btn.innerHTML = '💾 CRIAR BACKUP MANUAL';
            btn.disabled = false;
        }, 2000);
        
    } catch (error) {
        console.error('❌ Erro ao criar backup:', error);
        mostrarErro(`❌ Erro ao criar backup: ${error.message}`);
        btn.innerHTML = '💾 CRIAR BACKUP MANUAL';
        btn.disabled = false;
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

async function limparBackupsAntigos() {
    try {
        const snapshot = await window.db.collection('backups')
            .orderBy('timestamp', 'desc')
            .offset(30)
            .get();
        
        if (!snapshot.empty) {
            const batch = window.db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            console.log(`🗑️ Removidos ${snapshot.size} backups antigos`);
        }
        
    } catch (error) {
        console.error('❌ Erro ao limpar backups:', error);
    }
}

async function mostrarListaBackups() {
    try {
        if (!window.db) {
            mostrarErro('Firebase não disponível');
            return;
        }
        
        const snapshot = await window.db.collection('backups')
            .orderBy('timestamp', 'desc')
            .limit(20)
            .get();
        
        let backupsHtml = `
            <h3>🔄 Restaurar Backup</h3>
            <div style="max-height: 400px; overflow-y: auto;">
        `;
        
        if (snapshot.empty) {
            backupsHtml += '<p>Nenhum backup encontrado.</p>';
        } else {
            snapshot.forEach(doc => {
                const backup = doc.data();
                const data = new Date(backup.timestamp).toLocaleString('pt-BR');
                const tipo = backup.metadata?.tipoBackup || 'automático';
                
                backupsHtml += `
                    <div style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #28a745;">
                        <div style="display: flex; justify-content: between; align-items: center;">
                            <div>
                                <strong>📅 ${data}</strong>
                                <br><small>Tipo: ${tipo} | ID: ${doc.id}</small>
                                ${backup.metadata?.periodo ? `<br><small>Período: ${backup.metadata.periodo.inicio} - ${backup.metadata.periodo.fim}</small>` : ''}
                            </div>
                            <button onclick="restaurarBackup('${doc.id}')" 
                                    style="padding: 8px 15px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; margin-left: 10px;">
                                Restaurar
                            </button>
                        </div>
                    </div>
                `;
            });
        }
        
        backupsHtml += '</div>';
        
        // Mostrar modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.7); display: flex; justify-content: center; 
            align-items: center; z-index: 1000; overflow-y: auto; padding: 20px;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 15px; max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto;">
                ${backupsHtml}
                <button onclick="this.closest('.modal').remove()" 
                        style="margin-top: 20px; padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Cancelar
                </button>
            </div>
        `;
        
        modal.className = 'modal';
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('❌ Erro ao carregar backups:', error);
        mostrarErro('❌ Erro ao carregar lista de backups');
    }
}

window.restaurarBackup = async function(backupId) {
    if (!confirm('⚠️ Tem certeza que deseja restaurar este backup? Os dados atuais serão substituídos.')) {
        return;
    }
    
    try {
        console.log(`🔄 Restaurando backup: ${backupId}`);
        
        // Buscar backup
        const backupDoc = await window.db.collection('backups').doc(backupId).get();
        
        if (!backupDoc.exists) {
            throw new Error('Backup não encontrado');
        }
        
        const backup = backupDoc.data();
        
        // Verificar integridade
        const checksumAtual = gerarChecksum(backup.dados);
        if (checksumAtual !== backup.checksum) {
            throw new Error('Backup corrompido - checksum não confere');
        }
        
        // Restaurar dados
        const dadosRestaurados = {
            dados: backup.dados,
            vendasOriginais: backup.vendasOriginais,
            ultimaAtualizacao: new Date().toISOString(),
            periodoVendas: backup.metadata.periodo,
            restauradoDe: {
                backupId: backupId,
                timestampOriginal: backup.timestamp,
                timestampRestauracao: new Date().toISOString()
            }
        };
        
        await window.db.collection('vendas').doc('dados_atuais').set(dadosRestaurados);
        
        // Fechar modal
        document.querySelector('.modal')?.remove();
        
        mostrarSucesso(`✅ Backup restaurado com sucesso! Os painéis serão atualizados automaticamente.`);
        
        console.log('✅ Backup restaurado com sucesso');
        
    } catch (error) {
        console.error('❌ Erro ao restaurar backup:', error);
        mostrarErro(`❌ Erro ao restaurar backup: ${error.message}`);
    }
};

// ============================================
// SISTEMA DE ALERTAS
// ============================================

async function carregarAlertasAtivos() {
    try {
        if (!window.db) return;
        
        const doc = await window.db.collection('alertas').doc('atual').get();
        
        const statusAlertas = document.getElementById('statusAlertas');
        const alertasAtivos = document.getElementById('alertasAtivos');
        
        if (!doc.exists) {
            statusAlertas.innerHTML = '✅ Nenhum alerta ativo';
            statusAlertas.style.background = '#d4edda';
            statusAlertas.style.color = '#155724';
            alertasAtivos.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">Nenhum alerta ativo</div>';
            return;
        }
        
        const dadosAlertas = doc.data();
        const alertas = dadosAlertas.alertas || [];
        const prioridades = dadosAlertas.prioridades || {};
        
        // Status geral
        if (alertas.length === 0) {
            statusAlertas.innerHTML = '✅ Nenhum alerta ativo';
            statusAlertas.style.background = '#d4edda';
            statusAlertas.style.color = '#155724';
        } else if (prioridades.alta > 0) {
            statusAlertas.innerHTML = `🚨 ${prioridades.alta} alertas de alta prioridade`;
            statusAlertas.style.background = '#f8d7da';
            statusAlertas.style.color = '#721c24';
        } else {
            statusAlertas.innerHTML = `⚠️ ${alertas.length} alertas ativos`;
            statusAlertas.style.background = '#fff3cd';
            statusAlertas.style.color = '#856404';
        }
        
        // Lista de alertas
        let alertasHtml = '';
        alertas.slice(0, 5).forEach(alerta => {
            const corPrioridade = {
                'alta': '#dc3545',
                'média': '#ffc107',
                'baixa': '#28a745'
            }[alerta.prioridade] || '#6c757d';
            
            const iconePrioridade = {
                'alta': '🚨',
                'média': '⚠️',
                'baixa': 'ℹ️'
            }[alerta.prioridade] || '📋';
            
            alertasHtml += `
                <div style="background: #f8f9fa; padding: 10px; margin: 5px 0; border-radius: 6px; border-left: 4px solid ${corPrioridade};">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <strong>${iconePrioridade} ${alerta.mensagem}</strong>
                            ${alerta.loja ? `<br><small>Loja: ${alerta.loja}</small>` : ''}
                            ${alerta.vendedor ? `<br><small>Vendedor: ${alerta.vendedor}</small>` : ''}
                            ${alerta.acao ? `<br><small style="color: #666;">💡 ${alerta.acao}</small>` : ''}
                        </div>
                        <span style="background: ${corPrioridade}; color: white; padding: 2px 6px; border-radius: 12px; font-size: 10px; font-weight: bold;">
                            ${alerta.prioridade.toUpperCase()}
                        </span>
                    </div>
                </div>
            `;
        });
        
        if (alertas.length > 5) {
            alertasHtml += `<div style="text-align: center; color: #666; padding: 10px; font-style: italic;">E mais ${alertas.length - 5} alertas...</div>`;
        }
        
        alertasAtivos.innerHTML = alertasHtml || '<div style="text-align: center; color: #666; padding: 20px;">Nenhum alerta ativo</div>';
        
    } catch (error) {
        console.error('❌ Erro ao carregar alertas:', error);
        document.getElementById('statusAlertas').innerHTML = '❌ Erro ao verificar alertas';
    }
}

async function mostrarTodosAlertas() {
    try {
        if (!window.db) {
            mostrarErro('Firebase não disponível');
            return;
        }
        
        const doc = await window.db.collection('alertas').doc('atual').get();
        
        if (!doc.exists) {
            mostrarSucesso('✅ Nenhum alerta ativo no momento!');
            return;
        }
        
        const dadosAlertas = doc.data();
        const alertas = dadosAlertas.alertas || [];
        
        let alertasHtml = `
            <h3>🚨 Todos os Alertas Ativos (${alertas.length})</h3>
            <div style="max-height: 500px; overflow-y: auto;">
        `;
        
        if (alertas.length === 0) {
            alertasHtml += '<p style="text-align: center; color: #666; padding: 30px;">✅ Nenhum alerta ativo!</p>';
        } else {
            alertas.forEach((alerta, index) => {
                const corPrioridade = {
                    'alta': '#dc3545',
                    'média': '#ffc107',
                    'baixa': '#28a745'
                }[alerta.prioridade] || '#6c757d';
                
                const iconePrioridade = {
                    'alta': '🚨',
                    'média': '⚠️',
                    'baixa': 'ℹ️'
                }[alerta.prioridade] || '📋';
                
                alertasHtml += `
                    <div style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid ${corPrioridade};">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                            <h4 style="margin: 0; color: ${corPrioridade};">${iconePrioridade} ${alerta.tipo.replace('_', ' ').toUpperCase()}</h4>
                            <span style="background: ${corPrioridade}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold;">
                                ${alerta.prioridade.toUpperCase()}
                            </span>
                        </div>
                        <p style="margin: 5px 0;"><strong>Mensagem:</strong> ${alerta.mensagem}</p>
                        ${alerta.loja ? `<p style="margin: 5px 0;"><strong>Loja:</strong> ${alerta.loja}</p>` : ''}
                        ${alerta.vendedor ? `<p style="margin: 5px 0;"><strong>Vendedor:</strong> ${alerta.vendedor}</p>` : ''}
                        ${alerta.categoria ? `<p style="margin: 5px 0;"><strong>Categoria:</strong> ${alerta.categoria}</p>` : ''}
                        ${alerta.acao ? `<p style="margin: 5px 0; padding: 8px; background: #e9ecef; border-radius: 4px;"><strong>💡 Ação Recomendada:</strong> ${alerta.acao}</p>` : ''}
                    </div>
                `;
            });
        }
        
        alertasHtml += `
                </div>
                <div style="margin-top: 15px; padding: 15px; background: #e9ecef; border-radius: 8px; font-size: 12px;">
                    <strong>📊 Última verificação:</strong> ${new Date(dadosAlertas.timestamp).toLocaleString('pt-BR')}<br>
                    <strong>📈 Prioridades:</strong> 
                    🚨 Alta: ${dadosAlertas.prioridades?.alta || 0} | 
                    ⚠️ Média: ${dadosAlertas.prioridades?.media || 0} | 
                    ℹ️ Baixa: ${dadosAlertas.prioridades?.baixa || 0}
                </div>
        `;
        
        // Mostrar modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.7); display: flex; justify-content: center; 
            align-items: center; z-index: 1000; overflow-y: auto; padding: 20px;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 15px; max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto;">
                ${alertasHtml}
                <button onclick="this.closest('.modal').remove()" 
                        style="margin-top: 20px; padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Fechar
                </button>
            </div>
        `;
        
        modal.className = 'modal';
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('❌ Erro ao carregar alertas:', error);
        mostrarErro('❌ Erro ao carregar alertas');
    }
}

// ============================================
// MODAL DE EDIÇÃO DE HORÁRIO
// ============================================

function mostrarModalEditarHorario() {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,0,0,0.7); display: flex; justify-content: center; 
        align-items: center; z-index: 1000;
    `;
    
    // Pegar horário atual
    const horarioAtual = document.getElementById('horarioAutomacao')?.value || '15:30';
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; width: 90%;">
            <h3 style="color: #28a745; margin-bottom: 20px;">⏰ Editar Horário da Automação</h3>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #495057;">
                    🕒 Novo Horário (24h):
                </label>
                <input type="time" id="novoHorarioModal" value="${horarioAtual}" 
                       style="width: 100%; padding: 12px; border: 2px solid #e9ecef; border-radius: 8px; font-size: 16px;">
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
                <h4 style="color: #856404; margin-bottom: 10px;">⚠️ Importante:</h4>
                <ul style="font-size: 14px; color: #856404; margin: 0; padding-left: 20px;">
                    <li>A mudança de horário requer <strong>redeploy no Netlify</strong> para ter efeito</li>
                    <li>Use horário de Brasília (GMT-3)</li>
                    <li>Recomendamos horários entre 15:00 e 18:00</li>
                    <li>Evite horários de pico de uso do sistema</li>
                </ul>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="this.closest('.modal').remove()" 
                        style="padding: 12px 20px; background: #6c757d; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Cancelar
                </button>
                <button onclick="salvarNovoHorario()" 
                        style="padding: 12px 20px; background: #28a745; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    💾 Salvar Horário
                </button>
            </div>
        </div>
    `;
    
    modal.className = 'modal';
    document.body.appendChild(modal);
    
    // Focar no campo de horário
    setTimeout(() => {
        document.getElementById('novoHorarioModal').focus();
    }, 100);
}

window.salvarNovoHorario = async function() {
    const novoHorario = document.getElementById('novoHorarioModal').value;
    
    if (!novoHorario) {
        alert('❌ Digite um horário válido!');
        return;
    }
    
    try {
        console.log(`💾 Salvando novo horário: ${novoHorario}`);
        
        if (!window.db) {
            throw new Error('Firebase não está conectado');
        }
        
        const configData = {
            horarioAutomacao: novoHorario,
            ultimaAtualizacao: new Date().toISOString(),
            alteradoPor: 'usuario_painel',
            observacao: 'Horário alterado via interface do painel'
        };
        
        await window.db.collection('configuracoes').doc('automacao').set(configData);
        
        // Atualizar campo local
        const inputHorario = document.getElementById('horarioAutomacao');
        const textoHorario = document.getElementById('textoHorario');
        
        if (inputHorario) {
            inputHorario.value = novoHorario;
        }
        
        if (textoHorario) {
            textoHorario.textContent = `Todo dia às ${novoHorario} os relatórios são baixados automaticamente`;
        }
        
        // Fechar modal
        document.querySelector('.modal').remove();
        
        // Mostrar confirmação com aviso sobre redeploy
        mostrarSucesso(`
            ✅ Horário alterado para ${novoHorario}!<br><br>
            <strong style="color: #856404;">⚠️ ATENÇÃO:</strong><br>
            Para ativar a mudança, é necessário fazer <strong>redeploy no Netlify</strong>.<br>
            O arquivo <code>netlify.toml</code> precisa ser atualizado com o novo horário.
        `);
        
        console.log('✅ Novo horário salvo com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao salvar horário:', error);
        mostrarErro(`❌ Erro ao salvar horário: ${error.message}`);
    }
};

// ============================================
// HISTÓRICO E LOGS DETALHADOS
// ============================================

async function carregarEstatisticasExecucao() {
    try {
        if (!window.db) return;
        
        // Buscar execuções dos últimos 7 dias
        const setesDiasAtras = new Date();
        setesDiasAtras.setDate(setesDiasAtras.getDate() - 7);
        
        const snapshot = await window.db.collection('automacao')
            .where('timestamp', '>=', setesDiasAtras.toISOString())
            .orderBy('timestamp', 'desc')
            .get();
        
        let totalExecucoes = 0;
        let sucessos = 0;
        let ultimaFalha = null;
        
        snapshot.forEach(doc => {
            const dados = doc.data();
            totalExecucoes++;
            
            if (dados.status === 'sucesso') {
                sucessos++;
            } else if (!ultimaFalha) {
                ultimaFalha = dados.timestamp;
            }
        });
        
        // Atualizar interface
        document.getElementById('execucoes7dias').textContent = totalExecucoes;
        
        const taxaSucesso = totalExecucoes > 0 ? Math.round((sucessos / totalExecucoes) * 100) : 0;
        document.getElementById('taxaSucesso7dias').textContent = `${taxaSucesso}%`;
        
        if (ultimaFalha) {
            const tempoUltimaFalha = Math.round((Date.now() - new Date(ultimaFalha).getTime()) / (1000 * 60 * 60));
            document.getElementById('ultimaFalha').textContent = `${tempoUltimaFalha}h atrás`;
        } else {
            document.getElementById('ultimaFalha').textContent = 'Nenhuma';
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar estatísticas:', error);
    }
}

async function mostrarLogsDetalhados() {
    try {
        if (!window.db) {
            mostrarErro('Firebase não disponível');
            return;
        }
        
        // Buscar último log detalhado
        const snapshot = await window.db.collection('logs_execucao')
            .orderBy('fimExecucao', 'desc')
            .limit(1)
            .get();
        
        if (snapshot.empty) {
            mostrarErro('Nenhum log detalhado encontrado');
            return;
        }
        
        const logData = snapshot.docs[0].data();
        
        let logsHtml = `
            <h3>📋 Logs Detalhados da Última Execução</h3>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div><strong>ID Execução:</strong> ${logData.execucaoId}</div>
                    <div><strong>Duração Total:</strong> ${logData.duracaoTotal}ms</div>
                    <div><strong>Total de Logs:</strong> ${logData.totalLogs}</div>
                    <div><strong>Início:</strong> ${new Date(logData.inicioExecucao).toLocaleString('pt-BR')}</div>
                    <div><strong>Fim:</strong> ${new Date(logData.fimExecucao).toLocaleString('pt-BR')}</div>
                    <div><strong>Logs por Nível:</strong> 
                        Info: ${logData.niveis.info} | 
                        Warn: ${logData.niveis.warn} | 
                        Error: ${logData.niveis.error}
                    </div>
                </div>
            </div>
            <div style="max-height: 400px; overflow-y: auto; font-family: monospace; font-size: 12px; background: #2d3748; color: #f7fafc; padding: 15px; border-radius: 8px;">
        `;
        
        logData.logs.forEach(log => {
            const cor = {
                info: '#68d391',
                warn: '#faf089', 
                error: '#fc8181',
                debug: '#a0aec0'
            }[log.nivel] || '#a0aec0';
            
            logsHtml += `
                <div style="margin: 3px 0; padding: 2px 0;">
                    <span style="color: #a0aec0; font-size: 10px;">[${log.tempoExecucao}ms]</span>
                    <span style="color: ${cor}; font-weight: bold;">[${log.nivel.toUpperCase()}]</span>
                    <span style="color: #f7fafc;">${log.mensagem}</span>
                    ${log.dados ? `<br><span style="color: #cbd5e0; font-size: 11px; margin-left: 20px;">${JSON.stringify(log.dados)}</span>` : ''}
                </div>
            `;
        });
        
        logsHtml += '</div>';
        
        // Mostrar modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.7); display: flex; justify-content: center; 
            align-items: center; z-index: 1000; overflow-y: auto; padding: 20px;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 15px; max-width: 900px; width: 100%; max-height: 90vh; overflow-y: auto;">
                ${logsHtml}
                <button onclick="this.closest('.modal').remove()" 
                        style="margin-top: 20px; padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Fechar
                </button>
            </div>
        `;
        
        modal.className = 'modal';
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('❌ Erro ao carregar logs:', error);
        mostrarErro('❌ Erro ao carregar logs detalhados');
    }
}

async function mostrarHistoricoExecucoes() {
    try {
        if (!window.db) {
            mostrarErro('Firebase não disponível');
            return;
        }
        
        // Buscar últimas 20 execuções
        const snapshot = await window.db.collection('automacao')
            .orderBy('timestamp', 'desc')
            .limit(20)
            .get();
        
        let historicoHtml = `
            <h3>⏰ Histórico de Execuções (últimas 20)</h3>
            <div style="max-height: 500px; overflow-y: auto;">
        `;
        
        if (snapshot.empty) {
            historicoHtml += '<p style="text-align: center; color: #666; padding: 30px;">Nenhuma execução encontrada.</p>';
        } else {
            snapshot.forEach(doc => {
                const dados = doc.data();
                const data = new Date(dados.timestamp).toLocaleString('pt-BR');
                const status = dados.status === 'sucesso' ? '✅' : '❌';
                const cor = dados.status === 'sucesso' ? '#d4edda' : '#f8d7da';
                const corTexto = dados.status === 'sucesso' ? '#155724' : '#721c24';
                
                historicoHtml += `
                    <div style="background: ${cor}; color: ${corTexto}; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid ${dados.status === 'sucesso' ? '#28a745' : '#dc3545'};">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <strong>${status} ${data}</strong>
                            <span style="font-size: 12px; opacity: 0.8;">${doc.id}</span>
                        </div>
                        <div style="font-size: 14px; margin-bottom: 5px;">${dados.mensagem}</div>
                        ${dados.detalhes ? `
                            <div style="font-size: 12px; opacity: 0.8;">
                                📊 Registros: ${dados.detalhes.totalRegistros || 'N/A'} | 
                                📱 Aparelhos: ${dados.detalhes.aparelhos || 'N/A'} | 
                                🎧 Acessórios: ${dados.detalhes.acessorios || 'N/A'}
                                ${dados.detalhes.tempo_execucao ? ` | ⏱️ ${dados.detalhes.tempo_execucao}ms` : ''}
                            </div>
                        ` : ''}
                    </div>
                `;
            });
        }
        
        historicoHtml += '</div>';
        
        // Mostrar modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.7); display: flex; justify-content: center; 
            align-items: center; z-index: 1000; overflow-y: auto; padding: 20px;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 15px; max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto;">
                ${historicoHtml}
                <button onclick="this.closest('.modal').remove()" 
                        style="margin-top: 20px; padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Fechar
                </button>
            </div>
        `;
        
        modal.className = 'modal';
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('❌ Erro ao carregar histórico:', error);
        mostrarErro('❌ Erro ao carregar histórico de execuções');
    }
}

// ============================================
// CONFIGURAR EVENTOS DOS BOTÕES
// ============================================

function configurarEventosMelhorias() {
    // Backup
    document.getElementById('btnCriarBackup')?.addEventListener('click', criarBackupManual);
    document.getElementById('btnRestaurarBackup')?.addEventListener('click', mostrarListaBackups);
    
    // Alertas
    document.getElementById('btnVerAlertas')?.addEventListener('click', mostrarTodosAlertas);
    
    // Logs
    document.getElementById('btnLogsDetalhados')?.addEventListener('click', mostrarLogsDetalhados);
    document.getElementById('btnHistoricoExecucoes')?.addEventListener('click', mostrarHistoricoExecucoes);
}

// ============================================
// CARREGAR HORÁRIO SALVO
// ============================================

async function carregarHorarioAutomacao() {
    try {
        if (!window.db) return;
        
        const doc = await window.db.collection('configuracoes').doc('automacao').get();
        
        if (doc.exists) {
            const config = doc.data();
            const horarioSalvo = config.horarioAutomacao;
            
            if (horarioSalvo) {
                const inputHorario = document.getElementById('horarioAutomacao');
                const textoHorario = document.getElementById('textoHorario');
                
                if (inputHorario) {
                    inputHorario.value = horarioSalvo;
                }
                
                if (textoHorario) {
                    textoHorario.textContent = `Todo dia às ${horarioSalvo} os relatórios são baixados automaticamente`;
                }
                
                console.log(`🕒 Horário carregado: ${horarioSalvo}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar horário:', error);
    }
}

// ============================================
// SEÇÃO DE AUTOMAÇÃO - CONFIGURAÇÃO ORIGINAL
// ============================================

// Configurar automação (função original melhorada)
function configurarAutomacao() {
    console.log('🤖 Configurando automação...');
    
    // Adicionar botão de automação na interface
    adicionarBotaoAutomacao();
    
    // Configurar status da automação
    verificarStatusAutomacao();
    
    // Configurar botão de teste
    configurarBotaoTeste();
}

// Adicionar botão de automação na interface
function adicionarBotaoAutomacao() {
    const uploadContent = document.querySelector('#secao-configuracao .upload-content');
    
    if (uploadContent) {
        const automacaoSection = document.createElement('div');
        automacaoSection.innerHTML = `
            <div class="upload-section">
                <div class="upload-header">
                    <h3>🤖 Automação de Relatórios</h3>
                </div>
                <div class="upload-content">
                    <div class="config-item">
                        <div class="config-title">⚙️ CONFIGURAÇÃO DE AUTOMAÇÃO</div>
                        
                        <div style="text-align: center; margin-bottom: 20px;">
                            <div id="statusAutomacao" class="connection-status" style="display: block;">
                                🔄 Verificando status da automação...
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                            <button id="btnTesteAutomacao" class="upload-btn">
                                🧪 TESTAR AUTOMAÇÃO
                            </button>
                            <button id="btnHistoricoAutomacao" class="upload-btn">
                                📋 VER HISTÓRICO
                            </button>
                        </div>
                        
                        <div class="config-grid">
                            <div class="config-field">
                                <label class="config-label">Horário da Automação</label>
                                <input type="time" id="horarioAutomacao" class="config-input" value="15:30" disabled>
                            </div>
                            <div class="config-field" style="display: flex; align-items: end;">
                                <button id="editHorarioAutomacao" class="edit-btn" style="padding: 12px 20px; font-size: 12px;">
                                    Editar Horário
                                </button>
                            </div>
                        </div>
                        
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 15px;">
                            <h4 style="color: #28a745; margin-bottom: 10px;">📋 Como funciona:</h4>
                            <ul style="font-size: 14px; color: #666; padding-left: 20px;">
                                <li id="textoHorario">Todo dia às 15:30 os relatórios são baixados automaticamente</li>
                                <li><strong>SEMPRE do dia 1 do mês atual até hoje</strong></li>
                                <li>Os dados são processados e atualizados no Firebase</li>
                                <li>Todos os painéis são atualizados automaticamente</li>
                                <li>Notificações são enviadas em caso de erro</li>
                            </ul>
                        </div>
                        
                        <div id="ultimaExecucao" style="margin-top: 15px; padding: 10px; background: #e9ecef; border-radius: 8px; font-size: 12px; color: #666;">
                            Última execução: Carregando...
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Inserir após o botão processar tudo
        const processarSection = document.querySelector('#btnProcessarTudo').closest('.upload-section');
        processarSection.insertAdjacentElement('afterend', automacaoSection);
    }
}

// Verificar status da automação
async function verificarStatusAutomacao() {
    try {
        const statusEl = document.getElementById('statusAutomacao');
        const ultimaExecucaoEl = document.getElementById('ultimaExecucao');
        
        if (!statusEl || !ultimaExecucaoEl) return;
        
        // Verificar se existe histórico de execuções
        if (window.db) {
            const historicoRef = window.db.collection('automacao').doc('historico');
            const doc = await historicoRef.get();
            
            if (doc.exists) {
                const dados = doc.data();
                const ultimaExecucao = dados.ultimaExecucao;
                const status = dados.status;
                
                if (status === 'sucesso') {
                    statusEl.innerHTML = '✅ Automação funcionando corretamente';
                    statusEl.style.background = '#d4edda';
                    statusEl.style.color = '#155724';
                } else {
                    statusEl.innerHTML = '❌ Erro na última execução';
                    statusEl.style.background = '#f8d7da';
                    statusEl.style.color = '#721c24';
                }
                
                ultimaExecucaoEl.innerHTML = `Última execução: ${new Date(ultimaExecucao).toLocaleString('pt-BR')}`;
                
            } else {
                statusEl.innerHTML = '⚠️ Nenhuma execução automática encontrada';
                statusEl.style.background = '#fff3cd';
                statusEl.style.color = '#856404';
            }
        }
        
    } catch (error) {
        console.error('❌ Erro ao verificar status:', error);
        document.getElementById('statusAutomacao').innerHTML = '❌ Erro ao verificar status';
    }
}

// Configurar botão de teste
function configurarBotaoTeste() {
    const btnTeste = document.getElementById('btnTesteAutomacao');
    const btnHistorico = document.getElementById('btnHistoricoAutomacao');
    
    if (btnTeste) {
        btnTeste.addEventListener('click', async () => {
            btnTeste.disabled = true;
            btnTeste.innerHTML = '🔄 Executando teste...';
            
            try {
                // Chamar função de automação
                const response = await fetch('/.netlify/functions/auto-update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const resultado = await response.json();
                
                if (resultado.success) {
                    mostrarSucesso(`✅ Teste concluído com sucesso! Processados ${resultado.totalRegistros} registros.`);
                    verificarStatusAutomacao(); // Atualizar status
                } else {
                    mostrarErro(`❌ Erro no teste: ${resultado.message}`);
                }
                
            } catch (error) {
                console.error('❌ Erro no teste:', error);
                mostrarErro('❌ Erro ao executar teste de automação');
            } finally {
                btnTeste.disabled = false;
                btnTeste.innerHTML = '🧪 TESTAR AUTOMAÇÃO';
            }
        });
    }
    
    if (btnHistorico) {
        btnHistorico.addEventListener('click', () => {
            mostrarHistoricoAutomacao();
        });
    }
}

// Mostrar histórico da automação
async function mostrarHistoricoAutomacao() {
    try {
        if (!window.db) {
            mostrarErro('Firebase não disponível para carregar histórico');
            return;
        }
        
        // Buscar histórico
        const historicoRef = window.db.collection('automacao').orderBy('timestamp', 'desc').limit(10);
        const snapshot = await historicoRef.get();
        
        let historicoHtml = '<h3>📋 Histórico de Execuções</h3><div style="max-height: 300px; overflow-y: auto;">';
        
        if (snapshot.empty) {
            historicoHtml += '<p>Nenhuma execução encontrada.</p>';
        } else {
            snapshot.forEach(doc => {
                const dados = doc.data();
                const data = new Date(dados.timestamp).toLocaleString('pt-BR');
                const status = dados.status === 'sucesso' ? '✅' : '❌';
                const cor = dados.status === 'sucesso' ? '#d4edda' : '#f8d7da';
                
                historicoHtml += `
                    <div style="background: ${cor}; padding: 10px; margin: 10px 0; border-radius: 8px;">
                        <strong>${status} ${data}</strong><br>
                        <small>${dados.mensagem}</small>
                        ${dados.detalhes ? `<br><small>Registros: ${dados.detalhes.totalRegistros}</small>` : ''}
                    </div>
                `;
            });
        }
        
        historicoHtml += '</div>';
        
        // Mostrar em modal simples
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.7); display: flex; justify-content: center; 
            align-items: center; z-index: 1000;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; width: 90%;">
                ${historicoHtml}
                <button onclick="this.closest('.modal').remove()" style="margin-top: 20px; padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Fechar
                </button>
            </div>
        `;
        
        modal.className = 'modal';
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('❌ Erro ao carregar histórico:', error);
        mostrarErro('❌ Erro ao carregar histórico de automação');
    }
}

// ============================================
// INICIALIZAÇÃO DAS MELHORIAS
// ============================================

// Função para inicializar melhorias
function inicializarMelhorias() {
    setTimeout(() => {
        console.log('🔧 Inicializando melhorias do sistema...');
        
        // Adicionar seções se estiver na configuração
        if (document.getElementById('statusAutomacao')) {
            melhorarSecaoAutomacao();
            adicionarSecaoBackupEAlertas();
            configurarEventosMelhorias();
            
            // Carregar dados iniciais
            setTimeout(() => {
                carregarStatusBackup();
                carregarAlertasAtivos();
                carregarEstatisticasExecucao();
                carregarHorarioAutomacao();
                
                // Atualizar a cada 2 minutos
                setInterval(() => {
                    carregarAlertasAtivos();
                    carregarEstatisticasExecucao();
                }, 2 * 60 * 1000);
                
                // Atualizar backup a cada 5 minutos
                setInterval(carregarStatusBackup, 5 * 60 * 1000);
                
            }, 1000);
        }
        
        console.log('✅ Melhorias inicializadas com sucesso!');
        
    }, 3000);
}

// ============================================
// UTILITÁRIOS
// ============================================

// Formatar input monetário durante digitação
function formatarInputMonetario(input) {
    let valor = input.value.replace(/\D/g, '');
    
    if (valor.length > 0) {
        // Converter para centavos
        let numeroFloat = parseFloat(valor) / 100;
        
        // Formatar para moeda brasileira
        let valorFormatado = numeroFloat.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
        
        input.value = valorFormatado;
    }
}

// Formatar input monetário completo (no blur)
function formatarInputMonetarioCompleto(input) {
    let valor = input.value.replace(/\D/g, '');
    
    if (valor.length > 0) {
        // Se não tem casas decimais, adicionar ,00
        if (valor.length <= 2) {
            valor = valor.padStart(3, '0');
        }
        
        let numeroFloat = parseFloat(valor) / 100;
        
        let valorFormatado = numeroFloat.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
        
        input.value = valorFormatado;
    }
}

// Formatar moeda para exibição (carregar do Firebase)
function formatarMoedaDisplay(valor) {
    return valor.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

// Formatar moeda completa (sem abreviação)
function formatarMoedaCompleta(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

// Manter função original para compatibilidade
function formatarMoeda(valor) {
    return formatarMoedaCompleta(valor);
}

// Formatar número com pontos
function formatarInput(input) {
    let valor = input.value.replace(/\D/g, '');
    
    if (valor.length > 3) {
        valor = valor.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
    
    input.value = valor;
}

// Formatar número com pontos
function formatarNumero(valor) {
    return valor.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Mostrar erro
function mostrarErro(mensagem) {
    const errorMsg = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const successMsg = document.getElementById('successMessage');
    
    if (errorMsg && errorText) {
        errorText.textContent = mensagem;
        errorMsg.style.display = 'block';
        
        if (successMsg) {
            successMsg.style.display = 'none';
        }
        
        errorMsg.scrollIntoView({ behavior: 'smooth' });
    } else {
        alert(mensagem);
    }
}

// Função para mostrar sucesso
function mostrarSucesso(mensagem) {
    const successMsg = document.getElementById('successMessage');
    const successDetails = document.getElementById('successDetails');
    const errorMsg = document.getElementById('errorMessage');
    
    if (successMsg && successDetails) {
        successDetails.innerHTML = mensagem;
        successMsg.style.display = 'block';
        
        if (errorMsg) {
            errorMsg.style.display = 'none';
        }
        
        successMsg.scrollIntoView({ behavior: 'smooth' });
    } else {
        alert(mensagem);
    }
}

// ============================================
// MODIFICAR INICIALIZAÇÃO PRINCIPAL
// ============================================

// Adicionar melhorias ao iniciarSistema original
const iniciarSistemaOriginal = window.iniciarSistema;
window.iniciarSistema = function() {
    // Executar função original
    iniciarSistemaOriginal();
    
    // Adicionar automação
    setTimeout(() => {
        configurarAutomacao();
        // Adicionar melhorias
        inicializarMelhorias();
    }, 2000);
};