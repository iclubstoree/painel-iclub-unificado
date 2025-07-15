// firebaseConfig.js - Configuração Firebase Unificada (Compatível com todos browsers)

// Aguardar Firebase carregar via CDN
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM carregado, aguardando Firebase...');
    
    // Aguardar Firebase global estar disponível
    function aguardarFirebase() {
        if (typeof firebase !== 'undefined') {
            console.log('🔥 Firebase global detectado, inicializando...');
            inicializarFirebase();
        } else if (typeof window.firebase !== 'undefined') {
            console.log('🔥 Firebase window detectado, inicializando...');
            inicializarFirebase();
        } else {
            console.log('⏳ Aguardando Firebase carregar...');
            setTimeout(aguardarFirebase, 500);
        }
    }
    
    aguardarFirebase();
});

function inicializarFirebase() {
    try {
        // Configuração do Firebase PAINEL ICLUB UNIFICADO
        const firebaseConfig = {
          apiKey: "AIzaSyDyLM5uIgmHs92dWvO446xLo3gPrM3OZrY",
          authDomain: "painel-iclub-unificado.firebaseapp.com",
          projectId: "painel-iclub-unificado",
          storageBucket: "painel-iclub-unificado.firebasestorage.app",
          messagingSenderId: "667447791576",
          appId: "1:667447791576:web:eaf960ba772b050ac9ecad"
        };

        // Inicializar Firebase usando método compatível
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        
        const db = firebase.firestore();
        
        // Exportar para uso global
        window.db = db;
        window.firebaseConfig = {
            collection: (path) => db.collection(path),
            doc: (collection, docId) => collection.doc ? collection.doc(docId) : db.collection(collection).doc(docId),
            setDoc: (docRef, data) => docRef.set(data),
            onSnapshot: (ref, callback, errorCallback) => ref.onSnapshot(callback, errorCallback),
            updateDoc: (docRef, data) => docRef.update(data),
            deleteDoc: (docRef) => docRef.delete(),
            getDocs: (collectionRef) => collectionRef.get(),
            addDoc: (collectionRef, data) => collectionRef.add(data)
        };

        // Teste de conexão básico
        console.log('🧪 Testando conexão com Firestore...');
        db.collection('teste-conexao').add({
            teste: true,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            console.log('✅ Teste de escrita no Firestore OK!');
        }).catch((error) => {
            console.warn('⚠️ Aviso: Teste de escrita falhou, mas continuando...', error);
        });

        console.log('✅ Firebase conectado com sucesso ao projeto: painel-iclub-unificado');
        mostrarStatusConexao();
        
        // Iniciar sistema principal
        setTimeout(() => {
            if (window.iniciarSistema) {
                console.log('🚀 Iniciando sistema ICLUB...');
                window.iniciarSistema();
            } else {
                console.log('⏳ Aguardando sistema principal...');
                setTimeout(() => {
                    if (window.iniciarSistema) {
                        window.iniciarSistema();
                    } else {
                        console.error('❌ Sistema principal não encontrado!');
                    }
                }, 2000);
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ Erro ao inicializar Firebase:', error);
        
        // Fallback: iniciar sistema sem Firebase
        setTimeout(() => {
            if (window.iniciarSistema) {
                console.log('🔄 Iniciando sistema em modo offline...');
                window.iniciarSistema();
            }
        }, 1000);
    }
}

// Status de conexão
function mostrarStatusConexao() {
    const statusEl = document.getElementById('connectionStatus');
    if (statusEl) {
        statusEl.textContent = '✅ Firebase conectado ao projeto: painel-iclub-unificado';
        statusEl.style.background = '#d4edda';
        statusEl.style.color = '#155724';
        statusEl.style.display = 'block';
        
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
    }
}

// Log de debug
console.log('🔧 Firebase Config carregado para projeto:', {
    projeto: 'painel-iclub-unificado',
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent.substring(0, 50) + '...'
});