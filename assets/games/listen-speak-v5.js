(function() {
  function escapeHtml(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  class ListenSpeakGame extends MyVocab.BaseGame {
    constructor(app) {
      super(app, 'speakGame');
      this.gameId = 'speakGame';
      this.recognition = null;
      this.isListening = false;
    }

    init() {
      this.bindUI();
      this.initSpeechRecognition();
      MyVocab.games.listenSpeak = this;
      console.log('🎤 Listen & Speak game v6 initialized');
    }

    initSpeechRecognition() {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        toast(this.app, 'Seu navegador não suporta reconhecimento de fala');
        return;
      }

      try {
        this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        this.recognition.lang = 'en-US';
        this.recognition.continuous = false;
        this.recognition.interimResults = false;

        this.recognition.onstart = () => {
          this.isListening = true;
          this.updateRecordButton(true);
          toast(this.app, '🎤 Ouvindo...');
        };

        this.recognition.onresult = (event) => {
          const userSpeech = event.results[0][0].transcript;
          console.log('User said:', userSpeech);
          this.evaluateSpeech(userSpeech);
        };

        this.recognition.onerror = (event) => {
          console.error('Recognition error:', event.error);
          toast(this.app, 'Erro: ' + event.error);
          this.isListening = false;
          this.updateRecordButton(false);
        };

        this.recognition.onend = () => {
          console.log('Recognition ended');
          this.isListening = false;
          this.updateRecordButton(false);
        };
      } catch (err) {
        console.error('Error initializing speech recognition:', err);
        toast(this.app, 'Erro ao inicializar reconhecimento de fala');
      }
    }

    bindUI() {
      document.querySelectorAll('[data-game="listen_speak"]').forEach(btn => {
        btn.onclick = () => {
          console.log('Opening speak game');
          this.showView();
        };
      });

      const backBtn = document.querySelector('[data-action="speakGameBack"]');
      if (backBtn) backBtn.addEventListener('click', () => this.back());

      const modeSel = document.querySelector('[data-role="speakGameMode"]');
      const catSel = document.querySelector('[data-role="speakGameCategory"]');
      if (modeSel && catSel) {
        modeSel.onchange = () => {
          catSel.style.display = modeSel.value === 'category' ? 'inline-block' : 'none';
        };
      }

      const startBtn = document.querySelector('[data-action="speakGameStart"]');
      if (startBtn) {
        startBtn.addEventListener('click', () => {
          this.start().catch(err => toast(this.app, err.message));
        });
      }

      const speakBtn = document.querySelector('[data-action="speakRecord"]');
      if (speakBtn) {
        speakBtn.addEventListener('click', () => {
          this.toggleListening();
        });
      }

      const nextBtn = document.querySelector('[data-action="speakGameNext"]');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          if (!this.session?.answered) {
            toast(this.app, 'Fale a palavra primeiro!');
            return;
          }
          this.next();
        });
      }

      const playBtn = document.querySelector('[data-action="speakPlay"]');
      if (playBtn) {
        playBtn.addEventListener('click', () => {
          if (this.currentQ?.word) MyVocab.utils.tts(this.currentQ.word);
        });
      }

      const playUserBtn = document.querySelector('[data-action="speakPlayUser"]');
      if (playUserBtn) playUserBtn.style.display = 'none';
    }

    updateRecordButton(isListening) {
      const recordBtn = document.querySelector('[data-action="speakRecord"]');
      if (!recordBtn) return;
      
      recordBtn.textContent = isListening ? '⏹️ Parar' : '🎤 Falar';
      recordBtn.classList.toggle('is-recording', isListening);
    }

    toggleListening() {
      if (!this.recognition) {
        toast(this.app, 'Reconhecimento de fala não suportado');
        return;
      }

      if (this.isListening) {
        this.recognition.stop();
      } else {
        try {
          this.recognition.start();
        } catch (err) {
          toast(this.app, 'Erro ao iniciar reconhecimento');
        }
      }
    }

    // NOVO MÉTODO: Normaliza palavras compostas
    normalizeCompoundWord(word) {
      // Remove espaços extras e normaliza
      let normalized = word.toLowerCase().trim();
      
      // Remove pontuação
      normalized = normalized.replace(/[.,!?;:'"\-]/g, ' ');
      
      // Remove espaços múltiplos e trim
      normalized = normalized.replace(/\s+/g, ' ').trim();
      
      // Cria variações: com espaço, sem espaço, com hífen
      const variations = new Set();
      variations.add(normalized); // versão normal
      variations.add(normalized.replace(/\s+/g, '')); // sem espaços
      variations.add(normalized.replace(/\s+/g, '-')); // com hífen
      
      // Se for uma única palavra, também adiciona
      if (!normalized.includes(' ')) {
        variations.add(normalized);
      }
      
      console.log('Variações para "' + word + '":', Array.from(variations));
      return variations;
    }

    isPronunciationCorrect(spoken, expected) {
      // Normaliza as strings
      const spokenNorm = spoken.toLowerCase().trim();
      const expectedNorm = expected.toLowerCase().trim();
      
      console.log(`Comparando: "${spokenNorm}" com "${expectedNorm}"`);
      
      // 1. Verificação exata
      if (spokenNorm === expectedNorm) {
        console.log('✅ Match exato');
        return true;
      }
      
      // 2. Gera variações da palavra esperada (para compostos)
      const expectedVariations = this.normalizeCompoundWord(expectedNorm);
      
      // 3. Verifica se o que o usuário falou corresponde a alguma variação
      for (const variation of expectedVariations) {
        if (spokenNorm === variation) {
          console.log(`✅ Match com variação: "${variation}"`);
          return true;
        }
      }
      
      // 4. Para palavras compostas, verifica se as palavras estão presentes na ordem correta
      if (expectedNorm.includes(' ')) {
        const expectedWords = expectedNorm.split(/\s+/);
        const spokenWords = spokenNorm.split(/\s+/);
        
        // Verifica se todas as palavras esperadas estão presentes na fala
        let allWordsFound = true;
        for (const word of expectedWords) {
          if (!spokenWords.includes(word)) {
            allWordsFound = false;
            break;
          }
        }
        
        if (allWordsFound && spokenWords.length === expectedWords.length) {
          console.log('✅ Todas as palavras encontradas na ordem');
          return true;
        }
      }
      
      // 5. Verifica similaridade apenas para casos extremos
      const similarity = this.calculateSimilarity(spokenNorm, expectedNorm);
      console.log(`Similaridade: ${similarity}`);
      
      if (similarity > 0.9) { // Aumentei o limiar
        console.log('✅ Similaridade muito alta');
        return true;
      }
      
      console.log('❌ Não aceito');
      return false;
    }

    calculateSimilarity(str1, str2) {
      const len1 = str1.length;
      const len2 = str2.length;
      const matrix = [];

      for (let i = 0; i <= len2; i++) {
        matrix[i] = [i];
      }
      for (let j = 0; j <= len1; j++) {
        matrix[0][j] = j;
      }

      for (let i = 1; i <= len2; i++) {
        for (let j = 1; j <= len1; j++) {
          if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
          }
        }
      }

      const maxLen = Math.max(len1, len2);
      return maxLen === 0 ? 1 : (maxLen - matrix[len2][len1]) / maxLen;
    }

    evaluateSpeech(userSpeech) {
      console.log('Evaluating speech:', userSpeech);
      
      const s = this.session;
      const q = this.currentQ;
      
      if (!q || s.answered) return;

      s.answered = true;
      s.used.add(q.word_id);
      
      console.log('Used words:', Array.from(s.used));
      console.log(`Progress: ${s.used.size}/${s.maxQuestions}`);

      const fb = document.querySelector('[data-role="speakGameFeedback"]');
      const reveal = document.querySelector('[data-role="speakGameReveal"]');
      const gameBox = document.querySelector('[data-role="speakGameBox"]');
      const nextBtn = document.querySelector('[data-action="speakGameNext"]');

      const isCorrect = this.isPronunciationCorrect(userSpeech, q.word);

      if (isCorrect) {
        s.correct += 1;
        s.xpGained += 10;
        
        fb.className = 'myvocab__reward is-good';
        fb.textContent = `🎉 Correto! +10 XP`;
        
        gameBox.classList.add('correct-answer');
        setTimeout(() => gameBox.classList.remove('correct-answer'), 500);
        
        if (MyVocab.utils.sounds) {
          MyVocab.utils.sounds.play('correct');
        }
      } else {
        s.wrong += 1;
        
        fb.className = 'myvocab__reward is-bad';
        fb.textContent = `❌ Incorreto`;
        
        gameBox.classList.add('wrong-answer');
        setTimeout(() => gameBox.classList.remove('wrong-answer'), 500);
        
        if (MyVocab.utils.sounds) {
          MyVocab.utils.sounds.play('wrong');
        }
      }

      reveal.style.display = '';
      reveal.innerHTML = `
        <div><strong>Você disse:</strong> "${escapeHtml(userSpeech)}"</div>
        <div><strong>Esperado:</strong> "${escapeHtml(q.word)}"</div>
        <div style="margin-top:10px; font-weight:bold; color:${isCorrect ? '#4caf50' : '#f44336'}">
          ${isCorrect ? '✅ Correto!' : '❌ Tente novamente'}
        </div>
      `;

      nextBtn.disabled = false;
      this.loadGameState();

      if (s.used.size >= s.maxQuestions) {
        setTimeout(() => this.finish(), 1500);
      }
    }

    async start() {
      console.log('Starting game...');
      
      const mode = document.querySelector('[data-role="speakGameMode"]')?.value || 'random';
      const cat = document.querySelector('[data-role="speakGameCategory"]')?.value || '';
      const limit = document.querySelector('[data-role="speakGameLimit"]')?.value || '10';

      this.hideControls();

      this.session = {
        deck: [],
        used: new Set(),
        maxQuestions: 10,
        xpGained: 0,
        correct: 0,
        wrong: 0,
        answered: false,
        currentId: null
      };

      const payload = {
        mode,
        category_id: mode === 'category' ? (cat || null) : null,
        limit
      };

      const res = await MyVocab.utils.api('/game/deck', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      let deck = Array.from(new Set((res.deck || []).map(x => parseInt(x, 10)).filter(Boolean)));
      
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }

      this.session.deck = deck;

      if (String(limit).toLowerCase() === 'all') {
        this.session.maxQuestions = deck.length;
      } else {
        const requested = parseInt(limit, 10) || 10;
        this.session.maxQuestions = Math.min(requested, deck.length);
      }

      if (this.session.maxQuestions === 0) {
        toast(this.app, 'Nenhuma palavra disponível');
        return;
      }

      document.querySelector('[data-role="speakGameEnd"]').style.display = 'none';
      document.querySelector('[data-role="speakGameBox"]').style.display = '';

      await this.loadGameState();
      await this.next();
    }

    async next() {
      console.log('Next question');
      
      const s = this.session;
      
      if (!s || !s.deck) return;
      
      if (s.used.size >= s.maxQuestions) {
        return this.finish();
      }

      let nextId = null;
      for (const id of s.deck) {
        if (!s.used.has(id)) {
          nextId = id;
          break;
        }
      }

      if (!nextId) {
        return this.finish();
      }

      console.log('Next ID:', nextId);

      s.currentId = nextId;
      s.answered = false;

      const fb = document.querySelector('[data-role="speakGameFeedback"]');
      const reveal = document.querySelector('[data-role="speakGameReveal"]');
      const prog = document.querySelector('[data-role="speakGameProgress"]');
      const nextBtn = document.querySelector('[data-action="speakGameNext"]');
      const recordBtn = document.querySelector('[data-action="speakRecord"]');

      if (fb) {
        fb.textContent = '';
        fb.className = 'myvocab__reward';
      }
      if (reveal) {
        reveal.style.display = 'none';
        reveal.innerHTML = '';
      }
      if (nextBtn) {
        nextBtn.disabled = true;
      }
      if (recordBtn) {
        recordBtn.disabled = false;
      }

      let items = this.app.__items || [];
      let current = items.find(x => parseInt(x.id, 10) === nextId);

      if (!current || !current.word) {
        await loadWords(this.app);
        items = this.app.__items || [];
        current = items.find(x => parseInt(x.id, 10) === nextId);
      }

      if (!current || !current.word) {
        s.used.add(nextId);
        return this.next();
      }

      this.currentQ = { 
        word_id: nextId, 
        word: current.word
      };

      if (prog) {
        prog.textContent = `Palavra ${s.used.size + 1} / ${s.maxQuestions}`;
      }

      const wordDisplay = document.querySelector('[data-role="speakWord"]');
      if (wordDisplay) {
        wordDisplay.textContent = current.word;
      }

      setTimeout(() => MyVocab.utils.tts(this.currentQ.word), 100);
    }

    finish() {
      const s = this.session || { correct: 0, wrong: 0, xpGained: 0, maxQuestions: 0 };

      document.querySelector('[data-role="speakGameBox"]').style.display = 'none';

      const end = document.querySelector('[data-role="speakGameEnd"]');
      end.style.display = '';
      end.innerHTML = `
        <div class="myvocab__endTitle">🎤 Prática concluída!</div>
        <div class="myvocab__endStats">
          <div class="myvocab__pill"><strong>Palavras</strong> ${s.used?.size || 0} / ${s.maxQuestions}</div>
          <div class="myvocab__pill"><strong>Corretas</strong> ✅ ${s.correct}</div>
          <div class="myvocab__pill"><strong>Erradas</strong> ❌ ${s.wrong}</div>
          <div class="myvocab__pill"><strong>XP ganho</strong> +${s.xpGained}</div>
        </div>
        <div class="myvocab__row" style="margin-top:12px; justify-content: center;">
          <button class="myvocab__btn myvocab__btn--primary" data-action="speakGameStart">Jogar novamente</button>
          <button class="myvocab__btn" data-action="speakGameBack">Escolher outro jogo</button>
        </div>
      `;

      if (MyVocab.utils.sounds) {
        MyVocab.utils.sounds.play('correct');
        setTimeout(() => MyVocab.utils.sounds.play('correct'), 200);
      }

      end.querySelector('[data-action="speakGameStart"]').onclick = () => this.start();
      end.querySelector('[data-action="speakGameBack"]').onclick = () => this.back();

      this.showControls();
    }

    back() {
      if (this.isListening && this.recognition) {
        this.recognition.stop();
      }
      this.showControls();
      this.hideView();
      this.session = null;
      this.currentQ = null;
    }
  }

  window.MyVocab = window.MyVocab || {};
  window.MyVocab.games = window.MyVocab.games || {};
  window.MyVocab.games.listenSpeak = ListenSpeakGame;
})();
