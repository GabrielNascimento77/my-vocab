(function() {
  // Cache das vozes disponíveis
  let voicesCache = [];
  let voicesLoaded = false;

  // Função para carregar vozes
  function loadVoices() {
    return new Promise((resolve) => {
      // Se já temos vozes, resolve imediatamente
      if (window.speechSynthesis && window.speechSynthesis.getVoices().length > 0) {
        voicesCache = window.speechSynthesis.getVoices();
        voicesLoaded = true;
        resolve(voicesCache);
        return;
      }

      // Aguarda o evento onvoiceschanged
      window.speechSynthesis.onvoiceschanged = () => {
        voicesCache = window.speechSynthesis.getVoices();
        voicesLoaded = true;
        resolve(voicesCache);
      };

      // Timeout de segurança (máx 1 segundo)
      setTimeout(() => {
        if (!voicesLoaded) {
          voicesCache = window.speechSynthesis.getVoices() || [];
          voicesLoaded = true;
          resolve(voicesCache);
        }
      }, 1000);
    });
  }

  // Função principal para obter voz em inglês
  async function getEnglishVoice() {
    await loadVoices();

    // Prioridade de vozes em inglês:
    // 1. Voz nativa americana (en-US)
    // 2. Voz britânica (en-GB)
    // 3. Qualquer voz em inglês
    // 4. Primeira voz disponível (fallback)

    const preferredVoices = [
      voicesCache.find(v => v.lang === 'en-US' && v.localService), // Voz local americana
      voicesCache.find(v => v.lang === 'en-US'),                   // Qualquer voz americana
      voicesCache.find(v => v.lang === 'en-GB' && v.localService), // Voz local britânica
      voicesCache.find(v => v.lang === 'en-GB'),                   // Qualquer voz britânica
      voicesCache.find(v => v.lang && v.lang.startsWith('en')),    // Qualquer inglês
      voicesCache[0]                                                // Primeira voz disponível
    ];

    // Retorna a primeira voz encontrada
    for (const voice of preferredVoices) {
      if (voice) return voice;
    }

    return null;
  }

  MyVocab.utils.tts = async function(text) {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      alert('Seu navegador não suporta TTS.');
      return;
    }

    try {
      // Cancela qualquer fala anterior
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Obtém a melhor voz em inglês
      const voice = await getEnglishVoice();
      
      if (voice) {
        utterance.voice = voice;
        console.log('Usando voz:', voice.name, voice.lang);
      } else {
        console.warn('Nenhuma voz em inglês encontrada, usando padrão');
      }

      // Configurações para melhor pronúncia
      utterance.lang = 'en-US'; // Força idioma
      utterance.rate = 0.95;    // Velocidade ligeiramente mais lenta
      utterance.pitch = 1;       // Tom normal
      utterance.volume = 1;      // Volume máximo

      // Eventos para debug
      utterance.onstart = () => console.log('TTS iniciado');
      utterance.onerror = (e) => console.error('TTS erro:', e);
      utterance.onend = () => console.log('TTS finalizado');

      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Erro no TTS:', error);
      
      // Fallback: tenta com configuração mínima
      try {
        const fallbackUtterance = new SpeechSynthesisUtterance(text);
        fallbackUtterance.lang = 'en-US';
        window.speechSynthesis.speak(fallbackUtterance);
      } catch (fallbackError) {
        console.error('Fallback TTS também falhou:', fallbackError);
      }
    }
  };

  // Versão síncrona simplificada (para compatibilidade)
  MyVocab.utils.tts.sync = function(text) {
    if (!('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    
    // Tenta encontrar uma voz em inglês nas vozes já carregadas
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang === 'en-US') || 
                        voices.find(v => v.lang === 'en-GB') ||
                        voices.find(v => v.lang && v.lang.startsWith('en'));
    
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    
    window.speechSynthesis.speak(utterance);
  };
})();
