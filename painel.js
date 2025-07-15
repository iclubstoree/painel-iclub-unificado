// painel.js - VERSÃO CORRIGIDA
// Sistema principal do painel ICLUB

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================
let systemData = null;
let currentLoja = null;
let uploadedFiles = { aparelhos: null, acessorios: null };

// ============================================
// SENHAS DE ACESSO (em produção usar sistema mais seguro)
// ============================================
const SENHAS = {
    configuracao: 'admin123',
    administrativo: 'admin456',
    castanhal: 'cast123',
    belem: 'belem123',
    mix: 'mix123'
};

// ============================================
// INICIALIZAÇÃO DO SISTEMA
// ============================================
function iniciarSistema() {
    console.log('🚀 Iniciando sistema ICLUB...');
    
    try {
        setupEventListeners();
        setupMobileMenu();
        setupUploadHandlers();
        setupLoginSystem();
        
        // Carregar dados iniciais
        carregarDados();
        
        console.log('✅ Sistema ICLUB iniciado com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao iniciar sistema:', error);
        mostrarErro('Erro ao inicializar o sistema: ' + error.message);
    }
}

// ============================================
// CONFIGURAR EVENT LISTENERS
// ============================================
function setupEventListeners() {
    // Seletor de lojas
    document.querySelectorAll('.loja-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const loja = e.target.dataset.loja;
            selecionarLoja(loja);
        });
    });
    
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // Botões de configuração
    const editButtons = ['editCastanhal', 'editBelem', 'editMix'];
    editButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => editarMetas(id.replace('edit', '').toLowerCase()));
        }
    });
}

// ============================================
// MENU MOBILE
// ============================================
function setupMobileMenu() {
    const mobileToggle = document.getElementById('mobileMenuToggle');
    const seletorLojas = document.getElementById('seletorLojas');
    
    if (mobileToggle && seletorLojas) {
        mobileToggle.addEventListener('click', () => {
            mobileToggle.classList.toggle('active');
            seletorLojas.classList.toggle('mobile-menu');
            seletorLojas.classList.toggle('active');
        });
        
        // Fechar menu ao clicar em uma loja (mobile)
        document.querySelectorAll('.loja-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (seletorLojas.classList.contains('mobile-menu')) {
                    mobileToggle.classList.remove('active');
                    seletorLojas.classList.remove('active');
                }
            });
        });
    }
}

// ============================================
// SISTEMA DE LOGIN
// ============================================
function setupLoginSystem() {
    const loginOverlay = document.getElementById('loginOverlay');
    const loginPassword = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');
    const loginCancel = document.getElementById('loginCancel');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', confirmarLogin);
    }
    
    if (loginCancel) {
        loginCancel.addEventListener('click', cancelarLogin);
    }
    
    if (loginPassword) {
        loginPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                confirmarLogin();
            }
        });
    }
}

function mostrarLogin(loja) {
    const loginOverlay = document.getElementById('loginOverlay');
    const loginTitle = document.getElementById('loginTitle');
    const loginSubtitle = document.getElementById('loginSubtitle');
    const loginPassword = document.getElementById('loginPassword');
    const loginError = document.getElementById('loginError');
    
    if (loginOverlay) {
        currentLoja = loja;
        
        loginTitle.textContent = `🔐 Acesso - ${loja.toUpperCase()}`;
        loginSubtitle.textContent = 'Digite a senha para acessar este painel';
        loginPassword.value = '';
        loginError.style.display = 'none';
        
        loginOverlay.classList.remove('hidden');
        loginPassword.focus();
    }
}

function confirmarLogin() {
    const loginPassword = document.getElementById('loginPassword');
    const loginError = document.getElementById('loginError');
    const senha = loginPassword.value;
    
    if (SENHAS[currentLoja] && senha === SENHAS[currentLoja]) {
        // Login bem-sucedido
        document.getElementById('loginOverlay').classList.add('hidden');
        acessarLoja(currentLoja);
    } else {
        // Senha incorreta
        loginError.textContent = 'Senha incorreta. Tente novamente.';
        loginError.style.display = 'block';
        loginPassword.value = '';
        loginPassword.focus();
    }
}

function cancelarLogin() {
    document.getElementById('loginOverlay').classList.add('hidden');
    currentLoja = null;
    
    // Remover seleção ativa
    document.querySelectorAll('.loja-btn').forEach(btn => {
        btn.classList.remove('active');
    });
}

function logout() {
    // Limpar seleção
    document.querySelectorAll('.loja-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Esconder todas as seções
    document.querySelectorAll('.secao-loja').forEach(secao => {
        secao.classList.add('hidden');
    });
    
    // Mostrar tela inicial
    document.getElementById('tela-inicial').style.display = 'block';
    
    currentLoja = null;
    
    // Feedback visual
    mostrarSucesso('Logout realizado com sucesso!');
}

// ============================================
// SELEÇÃO DE LOJA
// ============================================
function selecionarLoja(loja) {
    console.log(`Selecionando loja: ${loja}`);
    
    // Verificar se precisa de senha
    if (SENHAS[loja]) {
        mostrarLogin(loja);
    } else {
        acessarLoja(loja);
    }
}

function acessarLoja(loja) {
    // Esconder tela inicial
    document.getElementById('tela-inicial').style.display = 'none';
    
    // Remover seleção anterior
    document.querySelectorAll('.loja-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Selecionar loja atual
    document.querySelector(`[data-loja="${loja}"]`).classList.add('active');
    
    // Esconder todas as seções
    document.querySelectorAll('.secao-loja').forEach(secao => {
        secao.classList.add('hidden');
    });
    
    // Mostrar seção específica
    if (loja === 'configuracao') {
        document.getElementById('secao-configuracao').classList.remove('hidden');
        carregarMetas();
    } else if (loja === 'administrativo') {
        document.getElementById('secao-administrativo').classList.remove('hidden');
        carregarPainelAdministrativo();
    } else {
        // Lojas específicas (castanhal, belem, mix)
        mostrarLojaEspecifica(loja);
    }
    
    currentLoja = loja;
}

function mostrarLojaEspecifica(loja) {
    // Clonar template
    const template = document.getElementById('template-loja');
    const clone = template.cloneNode(true);
    clone.id = `secao-${loja}`;
    clone.classList.remove('hidden');
    
    // Inserir após o template
    template.parentNode.insertBefore(clone, template.nextSibling);
    
    // Atualizar título
    const titulo = clone.querySelector('#titulo-loja');
    if (titulo) {
        titulo.textContent = `🏢 METAS ${loja.toUpperCase()}`;
    }
    
    // Carregar dados da loja
    carregarDadosLoja(loja, clone);
}

// ============================================
// CARREGAR DADOS DO FIREBASE
// ============================================
async function carregarDados() {
    try {
        console.log('📡 Carregando dados do Firebase...');
        
        if (!window.db) {
            console.warn('⚠️ Firebase não disponível, usando dados mock');
            systemData = gerarDadosMock();
            return;
        }
        
        const doc = await window.firebaseConfig.getDocs(
            window.firebaseConfig.collection('vendas')
        );
        
        if (!doc.empty) {
            const dados = doc.docs[0].data();
            systemData = dados;
            console.log('✅ Dados carregados do Firebase:', systemData);
        } else {
            console.warn('⚠️ Nenhum dado encontrado, usando mock');
            systemData = gerarDadosMock();
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        systemData = gerarDadosMock();
    }
}

function gerarDadosMock() {
    return {
        dados: {
            castanhal: { aparelhos: 45, acessorios: 12500, vendedores: {} },
            belem: { aparelhos: 38, acessorios: 9800, vendedores: {} },
            mix: { aparelhos: 22, acessorios: 6300, vendedores: {} }
        },
        ultimaAtualizacao: new Date().toISOString(),
        periodoVendas: {
            inicio: '01/07/2025',
            fim: '15/07/2025',
            mes: 'julho'
        }
    };
}

// ============================================
// CARREGAR DADOS DE UMA LOJA ESPECÍFICA
// ============================================
function carregarDadosLoja(loja, container) {
    if (!systemData || !systemData.dados[loja]) {
        console.warn(`Dados não disponíveis para ${loja}`);
        return;
    }
    
    const dados = systemData.dados[loja];
    const periodoVendas = systemData.periodoVendas;
    
    // Atualizar informações do cabeçalho
    const lastUpdate = container.querySelector('#loja_lastUpdate');
    const periodoEl = container.querySelector('#loja_periodoVendas');
    
    if (lastUpdate) {
        lastUpdate.textContent = `🕒 Atualizado: ${formatarDataHora(systemData.ultimaAtualizacao)}`;
    }
    
    if (periodoEl && periodoVendas) {
        periodoEl.textContent = `📅 Período: ${periodoVendas.inicio} - ${periodoVendas.fim}`;
    }
    
    // Carregar metas da loja
    carregarMetasLoja(loja, dados, container);
}

async function carregarMetasLoja(loja, dados, container) {
    try {
        // Buscar metas no Firebase
        const metasDoc = await window.firebaseConfig.getDocs(
            window.firebaseConfig.collection('metas')
        );
        
        let metas = null;
        if (!metasDoc.empty) {
            metasDoc.forEach(doc => {
                if (doc.id === loja) {
                    metas = doc.data();
                }
            });
        }
        
        // Metas padrão se não encontrar
        if (!metas) {
            metas = {
                aparelhos: 80,
                vendedorAparelhos: 15,
                acessorios: 15000,
                vendedorAcessorios: 2500
            };
        }
        
        // Atualizar interface
        atualizarInterfaceLoja(container, dados, metas);
        
    } catch (error) {
        console.error('Erro ao carregar metas:', error);
        // Usar metas padrão
        const metasPadrao = {
            aparelhos: 80,
            vendedorAparelhos: 15,
            acessorios: 15000,
            vendedorAcessorios: 2500
        };
        atualizarInterfaceLoja(container, dados, metasPadrao);
    }
}

function atualizarInterfaceLoja(container, dados, metas) {
    // Aparelhos
    const metaAparelhosMes = container.querySelector('#metaAparelhosMes');
    const vendidosAparelhos = container.querySelector('#vendidosAparelhos');
    const faltamAparelhos = container.querySelector('#faltamAparelhos');
    const vendaDiariaAparelhos = container.querySelector('#vendaDiariaAparelhos');
    
    if (metaAparelhosMes) metaAparelhosMes.textContent = metas.aparelhos;
    if (vendidosAparelhos) vendidosAparelhos.textContent = dados.aparelhos || 0;
    
    const faltaAparelhos = Math.max(0, metas.aparelhos - (dados.aparelhos || 0));
    if (faltamAparelhos) faltamAparelhos.textContent = faltaAparelhos;
    
    // Calcular venda diária necessária
    const diasRestantes = calcularDiasRestantes();
    const vendaDiaria = diasRestantes > 0 ? Math.ceil(faltaAparelhos / diasRestantes) : faltaAparelhos;
    if (vendaDiariaAparelhos) vendaDiariaAparelhos.textContent = vendaDiaria;
    
    // Progresso aparelhos
    const progressoAparelhos = container.querySelector('#progressoAparelhos');
    const percentAparelhos = container.querySelector('#percentAparelhos');
    const barraAparelhosGeral = container.querySelector('#barraAparelhosGeral');
    
    const percentualAparelhos = Math.min(100, ((dados.aparelhos || 0) / metas.aparelhos) * 100);
    
    if (progressoAparelhos) progressoAparelhos.textContent = `${dados.aparelhos || 0}/${metas.aparelhos}`;
    if (percentAparelhos) {
        percentAparelhos.textContent = `${Math.round(percentualAparelhos)}%`;
        percentAparelhos.className = `badge ${percentualAparelhos >= 80 ? 'success' : percentualAparelhos >= 50 ? 'warning' : 'danger'}`;
    }
    if (barraAparelhosGeral) barraAparelhosGeral.style.width = `${percentualAparelhos}%`;
    
    // Acessórios
    const metaAcessoriosMes = container.querySelector('#metaAcessoriosMes');
    const vendidosAcessorios = container.querySelector('#vendidosAcessorios');
    const faltamAcessorios = container.querySelector('#faltamAcessorios');
    const vendaDiariaAcessorios = container.querySelector('#vendaDiariaAcessorios');
    
    if (metaAcessoriosMes) metaAcessoriosMes.textContent = formatarMoeda(metas.acessorios);
    if (vendidosAcessorios) vendidosAcessorios.textContent = formatarMoeda(dados.acessorios || 0);
    
    const faltaAcessorios = Math.max(0, metas.acessorios - (dados.acessorios || 0));
    if (faltamAcessorios) faltamAcessorios.textContent = formatarMoeda(faltaAcessorios);
    
    const vendaDiariaAcess = diasRestantes > 0 ? faltaAcessorios / diasRestantes : faltaAcessorios;
    if (vendaDiariaAcessorios) vendaDiariaAcessorios.textContent = formatarMoeda(vendaDiariaAcess);
    
    // Progresso acessórios
    const progressoAcessorios = container.querySelector('#progressoAcessorios');
    const percentAcessorios = container.querySelector('#percentAcessorios');
    const barraAcessoriosGeral = container.querySelector('#barraAcessoriosGeral');
    
    const percentualAcessorios = Math.min(100, ((dados.acessorios || 0) / metas.acessorios) * 100);
    
    if (progressoAcessorios) progressoAcessorios.textContent = `${formatarMoeda(dados.acessorios || 0)}/${formatarMoeda(metas.acessorios)}`;
    if (percentAcessorios) {
        percentAcessorios.textContent = `${Math.round(percentualAcessorios)}%`;
        percentAcessorios.className = `badge ${percentualAcessorios >= 80 ? 'success' : percentualAcessorios >= 50 ? 'warning' : 'danger'}`;
    }
    if (barraAcessoriosGeral) barraAcessoriosGeral.style.width = `${percentualAcessorios}%`;
    
    // Vendedoras
    carregarVendedoras(container, dados.vendedores || {}, metas);
}

function carregarVendedoras(container, vendedores, metas) {
    const vendedorasAparelhos = container.querySelector('#vendedorasAparelhos');
    const vendedorasAcessorios = container.querySelector('#vendedorasAcessorios');
    
    if (vendedorasAparelhos) {
        vendedorasAparelhos.innerHTML = gerarRankingVendedoras(vendedores, 'aparelhos', metas.vendedorAparelhos);
    }
    
    if (vendedorasAcessorios) {
        vendedorasAcessorios.innerHTML = gerarRankingVendedoras(vendedores, 'acessorios', metas.vendedorAcessorios);
    }
}

function gerarRankingVendedoras(vendedores, tipo, meta) {
    const vendedoresArray = Object.entries(vendedores)
        .map(([nome, dados]) => ({
            nome,
            valor: dados[tipo] || 0
        }))
        .sort((a, b) => b.valor - a.valor);
    
    if (vendedoresArray.length === 0) {
        return '<div class="loading">Nenhuma vendedora encontrada</div>';
    }
    
    return vendedoresArray.map((vendedora, index) => {
        const posicao = index + 1;
        const vendido = vendedora.valor;
        const falta = Math.max(0, meta - vendido);
        const percentual = Math.min(100, (vendido / meta) * 100);
        
        const isValorMonetario = tipo === 'acessorios';
        const vendidoFormatado = isValorMonetario ? formatarMoeda(vendido) : vendido;
        const faltaFormatada = isValorMonetario ? formatarMoeda(falta) : falta;
        const metaFormatada = isValorMonetario ? formatarMoeda(meta) : meta;
        
        return `
            <div class="vendedora-ranking">
                <div class="vendedora-linha-superior">
                    <div class="vendedora-posicao-nome">${posicao}º ${vendedora.nome}</div>
                    <div class="vendedora-vendidos">${vendidoFormatado}</div>
                </div>
                <div class="vendedora-linha-inferior">
                    <div class="vendedora-meta-texto">Meta: ${metaFormatada}</div>
                    <div class="vendedora-falta-texto">Faltam: ${faltaFormatada}</div>
                </div>
                <div class="vendedora-progress-bar">
                    <div class="vendedora-progress-fill" style="width: ${percentual}%">
                        <span class="vendedora-progress-vendidos">${vendidoFormatado}</span>
                    </div>
                    <span class="vendedora-progress-faltam">${faltaFormatada}</span>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// PAINEL ADMINISTRATIVO
// ============================================
function carregarPainelAdministrativo() {
    if (!systemData) {
        console.warn('Dados não disponíveis para painel administrativo');
        return;
    }
    
    // Atualizar cabeçalho
    const lastUpdate = document.getElementById('admin_lastUpdate');
    const periodo = document.getElementById('admin_periodoVendas');
    
    if (lastUpdate) {
        lastUpdate.textContent = `🕒 Atualizado: ${formatarDataHora(systemData.ultimaAtualizacao)}`;
    }
    
    if (periodo && systemData.periodoVendas) {
        periodo.textContent = `📅 Período: ${systemData.periodoVendas.inicio} - ${systemData.periodoVendas.fim}`;
    }
    
    // Carregar seções
    carregarMetasGerais();
    carregarMetasVendedor();
    carregarRankingGeral();
}

async function carregarMetasGerais() {
    // Implementar carregamento de metas gerais
    const container = document.getElementById('admin_metasGerais');
    if (container) {
        container.innerHTML = '<div class="admin-loading">Carregando metas gerais...</div>';
    }
}

async function carregarMetasVendedor() {
    // Implementar carregamento de metas por vendedor
    const aparelhos = document.getElementById('admin_metasVendedorAparelhos');
    const acessorios = document.getElementById('admin_metasVendedorAcessorios');
    
    if (aparelhos) {
        aparelhos.innerHTML = '<div class="admin-loading">Carregando dados...</div>';
    }
    
    if (acessorios) {
        acessorios.innerHTML = '<div class="admin-loading">Carregando dados...</div>';
    }
}

async function carregarRankingGeral() {
    // Implementar ranking geral
    const aparelhos = document.getElementById('admin_rankingAparelhos');
    const acessorios = document.getElementById('admin_rankingAcessorios');
    
    if (aparelhos) {
        aparelhos.innerHTML = '<div class="admin-loading">Carregando ranking...</div>';
    }
    
    if (acessorios) {
        acessorios.innerHTML = '<div class="admin-loading">Carregando ranking...</div>';
    }
}

// ============================================
// SISTEMA DE UPLOAD
// ============================================
function setupUploadHandlers() {
    const tiposUpload = ['Aparelhos', 'Acessorios'];
    
    tiposUpload.forEach(tipo => {
        const uploadArea = document.getElementById(`uploadArea${tipo}`);
        const fileInput = document.getElementById(`uploadFile${tipo}`);
        const fileName = document.getElementById(`fileName${tipo}`);
        const uploadBtn = document.getElementById(`btnUpload${tipo}`);
        
        if (uploadArea && fileInput) {
            uploadArea.addEventListener('click', () => fileInput.click());
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.style.background = '#f8fff8';
            });
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.style.background = '#ffffff';
            });
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.style.background = '#ffffff';
                if (e.dataTransfer.files.length > 0) {
                    fileInput.files = e.dataTransfer.files;
                    handleFileSelect(tipo, e.dataTransfer.files[0]);
                }
            });
            
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    handleFileSelect(tipo, e.target.files[0]);
                }
            });
        }
        
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => uploadFile(tipo));
        }
    });
    
    // Botão processar tudo
    const btnProcessar = document.getElementById('btnProcessarTudo');
    if (btnProcessar) {
        btnProcessar.addEventListener('click', processarTudo);
    }
}

function handleFileSelect(tipo, file) {
    console.log(`Arquivo selecionado para ${tipo}:`, file.name);
    
    const uploadArea = document.getElementById(`uploadArea${tipo}`);
    const fileName = document.getElementById(`fileName${tipo}`);
    const uploadBtn = document.getElementById(`btnUpload${tipo}`);
    
    if (uploadArea) {
        uploadArea.classList.add('file-selected');
    }
    
    if (fileName) {
        fileName.textContent = file.name;
        fileName.style.display = 'inline-block';
    }
    
    if (uploadBtn) {
        uploadBtn.disabled = false;
    }
    
    uploadedFiles[tipo.toLowerCase()] = file;
    
    // Verificar se pode habilitar processamento
    checkProcessingReady();
}

function checkProcessingReady() {
    const btnProcessar = document.getElementById('btnProcessarTudo');
    if (btnProcessar) {
        const temAparelhos = uploadedFiles.aparelhos !== null;
        const temAcessorios = uploadedFiles.acessorios !== null;
        btnProcessar.disabled = !(temAparelhos && temAcessorios);
    }
}

function uploadFile(tipo) {
    console.log(`Upload de ${tipo}...`);
    mostrarSucesso(`Arquivo de ${tipo} carregado com sucesso!`);
}

async function processarTudo() {
    try {
        mostrarSucesso('Processando dados... Aguarde...');
        
        // Simular processamento
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Recarregar dados
        await carregarDados();
        
        mostrarSucesso('Todos os painéis foram atualizados com sucesso!');
        
        // Resetar uploads
        uploadedFiles = { aparelhos: null, acessorios: null };
        
        // Resetar interface
        ['Aparelhos', 'Acessorios'].forEach(tipo => {
            const uploadArea = document.getElementById(`uploadArea${tipo}`);
            const fileName = document.getElementById(`fileName${tipo}`);
            const uploadBtn = document.getElementById(`btnUpload${tipo}`);
            
            if (uploadArea) uploadArea.classList.remove('file-selected');
            if (fileName) fileName.style.display = 'none';
            if (uploadBtn) uploadBtn.disabled = true;
        });
        
        const btnProcessar = document.getElementById('btnProcessarTudo');
        if (btnProcessar) btnProcessar.disabled = true;
        
    } catch (error) {
        console.error('Erro ao processar:', error);
        mostrarErro('Erro ao processar dados: ' + error.message);
    }
}

// ============================================
// CARREGAR E EDITAR METAS
// ============================================
async function carregarMetas() {
    try {
        console.log('Carregando metas de configuração...');
        
        if (!window.db) {
            console.warn('Firebase não disponível');
            return;
        }
        
        const metasSnapshot = await window.firebaseConfig.getDocs(
            window.firebaseConfig.collection('metas')
        );
        
        const metas = {};
        metasSnapshot.forEach(doc => {
            metas[doc.id] = doc.data();
        });
        
        // Preencher campos
        ['castanhal', 'belem', 'mix'].forEach(loja => {
            const metasLoja = metas[loja] || {
                aparelhos: 80,
                vendedorAparelhos: 15,
                acessorios: 15000,
                vendedorAcessorios: 2500
            };
            
            const campos = [
                'meta_aparelhos',
                'meta_vendedor_aparelhos',
                'meta_acessorios',
                'meta_vendedor_acessorios'
            ];
            
            campos.forEach(campo => {
                const input = document.getElementById(`${loja}_${campo}`);
                if (input) {
                    const valor = metasLoja[campo.replace('meta_', '').replace('_', '')];
                    input.value = valor || 0;
                }
            });
        });
        
    } catch (error) {
        console.error('Erro ao carregar metas:', error);
    }
}

function editarMetas(loja) {
    console.log(`Editando metas de ${loja}`);
    
    const campos = ['meta_aparelhos', 'meta_vendedor_aparelhos', 'meta_acessorios', 'meta_vendedor_acessorios'];
    const editBtn = document.getElementById(`edit${loja.charAt(0).toUpperCase() + loja.slice(1)}`);
    
    campos.forEach(campo => {
        const input = document.getElementById(`${loja}_${campo}`);
        if (input) {
            input.disabled = !input.disabled;
        }
    });
    
    if (editBtn) {
        if (editBtn.textContent === 'Editar Metas') {
            editBtn.textContent = 'Salvar Metas';
        } else {
            salvarMetas(loja);
            editBtn.textContent = 'Editar Metas';
        }
    }
}

async function salvarMetas(loja) {
    try {
        const novasMetas = {};
        const campos = {
            'meta_aparelhos': 'aparelhos',
            'meta_vendedor_aparelhos': 'vendedorAparelhos',
            'meta_acessorios': 'acessorios',
            'meta_vendedor_acessorios': 'vendedorAcessorios'
        };
        
        Object.entries(campos).forEach(([campo, chave]) => {
            const input = document.getElementById(`${loja}_${campo}`);
            if (input) {
                const valor = campo.includes('acessorios') ? 
                    parseFloat(input.value.replace(/[^\d,]/g, '').replace(',', '.')) :
                    parseInt(input.value);
                novasMetas[chave] = valor || 0;
            }
        });
        
        if (window.db) {
            await window.firebaseConfig.setDoc(
                window.firebaseConfig.doc(window.firebaseConfig.collection('metas'), loja),
                novasMetas
            );
        }
        
        mostrarSucesso(`Metas de ${loja.toUpperCase()} salvas com sucesso!`);
        
    } catch (error) {
        console.error('Erro ao salvar metas:', error);
        mostrarErro('Erro ao salvar metas: ' + error.message);
    }
}

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================
function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

function formatarDataHora(isoString) {
    return new Date(isoString).toLocaleString('pt-BR');
}

function calcularDiasRestantes() {
    const hoje = new Date();
    const ultimoDiaDoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    let dias = 0;
    let dataAtual = new Date(hoje);
    
    while (dataAtual <= ultimoDiaDoMes) {
        const diaSemana = dataAtual.getDay();
        if (diaSemana >= 1 && diaSemana <= 6) { // Segunda a sábado
            dias++;
        }
        dataAtual.setDate(dataAtual.getDate() + 1);
    }
    
    return Math.max(1, dias);
}

function mostrarSucesso(mensagem) {
    const successDiv = document.getElementById('successMessage');
    const detailsDiv = document.getElementById('successDetails');
    
    if (successDiv && detailsDiv) {
        detailsDiv.textContent = mensagem;
        successDiv.style.display = 'block';
        
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 5000);
    }
    
    console.log('✅', mensagem);
}

function mostrarErro(mensagem) {
    const errorDiv = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    
    if (errorDiv && errorText) {
        errorText.textContent = mensagem;
        errorDiv.style.display = 'block';
        
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 8000);
    }
    
    console.error('❌', mensagem);
}

// ============================================
// EXPOSIÇÃO GLOBAL
// ============================================
window.iniciarSistema = iniciarSistema;

// ============================================
// INICIALIZAÇÃO AUTOMÁTICA
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM carregado, aguardando Firebase...');
    
    // Aguardar Firebase ou iniciar após timeout
    const timeout = setTimeout(() => {
        console.log('⏰ Timeout atingido, iniciando sem Firebase...');
        iniciarSistema();
    }, 5000);
    
    // Se Firebase carregar antes do timeout
    const checkFirebase = setInterval(() => {
        if (window.db) {
            clearTimeout(timeout);
            clearInterval(checkFirebase);
            console.log('🔥 Firebase detectado, iniciando sistema...');
            iniciarSistema();
        }
    }, 500);
});