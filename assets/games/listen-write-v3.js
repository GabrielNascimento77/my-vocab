(function() {
  class ListenWriteGame extends MyVocab.BaseGame {
    constructor(app) {
      super(app, 'writeGame');
      this.gameId = 'writeGame';
    }

    init() {
      this.bindUI();
      MyVocab.games.listenWrite = this;
    }

    bindUI() {
      // Botão para abrir o game
      document.querySelectorAll('[data-game="listen_write"]').forEach(btn => {
        btn.onclick = () => this.showView();
      });

      // Back button
      document.querySelector('[data-action="writeGameBack"]')?.addEventListener('click', () => this.back());

      // Mode selector
      const modeSel = document.querySelector('[data-role="writeGameMode"]');
      const catSel = document.querySelector('[data-role="writeGameCategory"]');
      if (modeSel && catSel) {
        modeSel.onchange = () => {
          catSel.style.display = modeSel.value === 'category' ? 'inline-block' : 'none';
        };
      }

      // Start button
      document.querySelector('[data-action="writeGameStart"]')?.addEventListener('click', () => {
        this.start().catch(err => toast(this.app, err.message));
      });

      // Submit button (Check Answer / Next)
      const submitBtn = document.querySelector('[data-action="writeSubmit"]');
      const input = document.querySelector('[data-role="writeAnswer"]');
      
      if (submitBtn) {
        submitBtn.onclick = () => {
          if (!this.session) return;
          
          if (this.session.answered) {
            // Se já respondeu, avança para próxima pergunta
            console.log('Avançando para próxima pergunta...');
            this.next().catch(err => toast(this.app, err.message));
          } else {
            // Se não respondeu, verifica a resposta
            this.answer().catch(err => toast(this.app, err.message));
          }
        };
      }

      // Enter key no input
      if (input) {
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (!this.session) return;
            
            if (this.session.answered) {
              this.next().catch(err => toast(this.app, err.message));
            } else {
              this.answer().catch(err => toast(this.app, err.message));
            }
          }
        });
      }

      // Skip button
      document.querySelector('[data-action="writeSkip"]')?.addEventListener('click', () => {
        if (!this.session || this.session.answered) return;
        this.skip();
      });

      // TTS button
      document.querySelector('[data-action="writeGameTts"]')?.addEventListener('click', () => {
        if (this.currentQ?.word) MyVocab.utils.tts(this.currentQ.word);
      });
    }

    fillCategories() {
      const sel = document.querySelector('[data-role="writeGameCategory"]');
      if (!sel) return;
      const current = sel.value;
      sel.innerHTML = '<option value="">All categories</option>';
      (this.app.__cats || []).forEach(c => {
        const opt = document.createElement('option');
        opt.value = String(c.id);
        opt.textContent = c.name;
        sel.appendChild(opt);
      });
      if (current) sel.value = current;
    }

    renderScoreBar() {
      const s = this.app.__gameState || {};
      const session = this.session || { xpGained: 0, correct: 0, wrong: 0 };
      const bar = document.querySelector('[data-role="writeGameScoreBar"]');
      if (!bar) return;

      bar.innerHTML = `
        <div class="myvocab__pill"><strong>XP</strong> ${s.xp ?? 0} <span class="myvocab__muted">(+${session.xpGained})</span></div>
        <div class="myvocab__pill"><strong>Session</strong> ✅ ${session.correct} / ❌ ${session.wrong}</div>
        <div class="myvocab__pill"><strong>Streak</strong> ${s.streak ?? 0}</div>
        <div class="myvocab__pill"><strong>Best</strong> ${s.best_streak ?? 0}</div>
      `;
    }

    updateButtonState() {
      const submitBtn = document.querySelector('[data-action="writeSubmit"]');
      if (!submitBtn) return;
      
      if (this.session && this.session.answered) {
        submitBtn.textContent = 'Next →';
        submitBtn.classList.add('myvocab__btn--next');
      } else {
        submitBtn.textContent = 'Check Answer';
        submitBtn.classList.remove('myvocab__btn--next');
      }
    }

    async start() {
      const mode = document.querySelector('[data-role="writeGameMode"]')?.value || 'random';
      const cat = document.querySelector('[data-role="writeGameCategory"]')?.value || '';
      const limit = document.querySelector('[data-role="writeGameLimit"]')?.value || '10';

      this.hideControls();

      this.session = {
        deck: [],
        used: new Set(),
        maxQuestions: 10,
        xpGained: 0,
        correct: 0,
        wrong: 0,
        answered: false,
        currentId: null,
        currentIndex: 0 // Controla a posição atual no deck
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
      
      // Embaralha
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
        toast(this.app, 'No words available for this game mode.');
        return;
      }

      document.querySelector('[data-role="writeGameEnd"]').style.display = 'none';
      document.querySelector('[data-role="writeGameBox"]').style.display = '';

      await this.loadGameState();
      await this.next();
    }

    async next() {
      const s = this.session;
      
      if (!s || !s.deck) throw new Error('Game not started');
      
      // Verifica se já usou todas as palavras
      if (s.used.size >= s.maxQuestions) {
        return this.finish();
      }

      // Pega o próximo ID não usado do deck
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

      s.currentId = nextId;
      s.answered = false;

      // Atualiza o botão para "Check Answer"
      this.updateButtonState();

      const input = document.querySelector('[data-role="writeAnswer"]');
      if (input) {
        input.value = '';
        input.disabled = false;
        input.focus();
      }

      // Busca a palavra atual
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
        word: current.word,
        correct: current.word.toLowerCase().trim()
      };

      const fb = document.querySelector('[data-role="writeGameFeedback"]');
      const reveal = document.querySelector('[data-role="writeGameReveal"]');
      const prog = document.querySelector('[data-role="writeGameProgress"]');

      fb.textContent = '';
      fb.className = 'myvocab__reward';
      reveal.style.display = 'none';
      reveal.innerHTML = '';
      
      prog.textContent = `Word ${s.used.size + 1} / ${s.maxQuestions}`;

      // Toca o áudio automaticamente
      setTimeout(() => MyVocab.utils.tts(this.currentQ.word), 100);
    }

    async answer() {
      const s = this.session;
      const q = this.currentQ;
      
      if (!q || s.answered) return;

      const input = document.querySelector('[data-role="writeAnswer"]');
      const fb = document.querySelector('[data-role="writeGameFeedback"]');
      const reveal = document.querySelector('[data-role="writeGameReveal"]');
      const gameBox = document.querySelector('[data-role="writeGameBox"]');

      const userAnswer = input.value.trim().toLowerCase();
      
      if (!userAnswer) {
        toast(this.app, 'Type your answer first!');
        return;
      }

      // Marca como respondido e desabilita input
      s.answered = true;
      input.disabled = true;

      // Registra a palavra como usada
      s.used.add(q.word_id);

      // Atualiza o botão para "Next"
      this.updateButtonState();

      const isCorrect = userAnswer === q.correct;

      if (isCorrect) {
        s.correct += 1;
        s.xpGained += 10;
        fb.className = 'myvocab__reward is-good';
        fb.textContent = '🎉 Perfect! +10 XP';
        
        gameBox.classList.add('correct-answer');
        setTimeout(() => gameBox.classList.remove('correct-answer'), 500);
        
        MyVocab.utils.sounds.play('correct');
        
        const rect = input.getBoundingClientRect();
        MyVocab.utils.sounds.createXPFloat(rect.left + rect.width/2, rect.top, 10);
      } else {
        s.wrong += 1;
        fb.className = 'myvocab__reward is-bad';
        fb.textContent = `❌ Not quite. Correct: ${q.word}`;
        
        gameBox.classList.add('wrong-answer');
        setTimeout(() => gameBox.classList.remove('wrong-answer'), 500);
        
        MyVocab.utils.sounds.play('wrong');
      }

      reveal.style.display = '';
      reveal.innerHTML = `<strong>You wrote:</strong> "${escapeHtml(userAnswer)}"<br>
                          <strong>Correct:</strong> "${escapeHtml(q.word)}"`;

      await this.loadGameState();
      
      // Se já usou todas as palavras, finaliza após um delay
      if (s.used.size >= s.maxQuestions) {
        setTimeout(() => this.finish(), 2000);
      }
    }

    skip() {
      const s = this.session;
      const q = this.currentQ;
      
      if (!q || s.answered) return;

      const input = document.querySelector('[data-role="writeAnswer"]');
      const fb = document.querySelector('[data-role="writeGameFeedback"]');
      const reveal = document.querySelector('[data-role="writeGameReveal"]');

      s.answered = true;
      input.disabled = true;
      
      // Registra a palavra como usada
      s.used.add(q.word_id);

      // Atualiza o botão para "Next"
      this.updateButtonState();

      s.wrong += 1;
      
      fb.className = 'myvocab__reward is-bad';
      fb.textContent = `⏭️ Skipped. Correct: ${q.word}`;
      
      reveal.style.display = '';
      reveal.innerHTML = `<strong>Correct word:</strong> "${escapeHtml(q.word)}"`;

      MyVocab.utils.sounds.play('wrong');
      this.loadGameState();
      
      if (s.used.size >= s.maxQuestions) {
        setTimeout(() => this.finish(), 2000);
      }
    }

    finish() {
      const s = this.session || { correct: 0, wrong: 0, xpGained: 0, maxQuestions: 0 };

      document.querySelector('[data-role="writeGameBox"]').style.display = 'none';

      const end = document.querySelector('[data-role="writeGameEnd"]');
      end.style.display = '';
      end.innerHTML = `
        <div class="myvocab__endTitle">📝 Round completed!</div>
        <div class="myvocab__endStats">
          <div class="myvocab__pill"><strong>Words</strong> ${s.used?.size || 0} / ${s.maxQuestions}</div>
          <div class="myvocab__pill"><strong>Correct</strong> ✅ ${s.correct}</div>
          <div class="myvocab__pill"><strong>Wrong</strong> ❌ ${s.wrong}</div>
          <div class="myvocab__pill"><strong>XP gained</strong> +${s.xpGained}</div>
        </div>
        <div class="myvocab__row" style="margin-top:12px; justify-content: center;">
          <button class="myvocab__btn myvocab__btn--primary" data-action="writeGameStart">Play again</button>
          <button class="myvocab__btn" data-action="writeGameBack">Choose another game</button>
        </div>
      `;

      MyVocab.utils.sounds.play('correct');
      setTimeout(() => MyVocab.utils.sounds.play('correct'), 200);

      end.querySelector('[data-action="writeGameStart"]').onclick = () => this.start();
      end.querySelector('[data-action="writeGameBack"]').onclick = () => this.back();

      // Mostra os controles novamente
      this.showControls();
    }

    back() {
      this.showControls();
      this.hideView();
      this.session = null;
      this.currentQ = null;
    }
  }

  window.MyVocab = window.MyVocab || {};
  window.MyVocab.games = window.MyVocab.games || {};
  window.MyVocab.games.listenWrite = ListenWriteGame;
})();
