(function() {
  class ListenChooseGame extends MyVocab.BaseGame {
    constructor(app) {
      super(app, 'game');
      this.gameId = 'game';
    }

    init() {
      this.bindUI();
      MyVocab.games['listenChoose'] = this;
    }

    bindUI() {
      // Botão para abrir o game
      document.querySelectorAll('[data-game="find_translation"]').forEach(btn => {
        btn.onclick = () => this.showView();
      });

      // Back button
      document.querySelector('[data-action="gameBack"]')?.addEventListener('click', () => this.back());

      // Mode selector
      const modeSel = document.querySelector('[data-role="gameMode"]');
      const catSel = document.querySelector('[data-role="gameCategory"]');
      if (modeSel && catSel) {
        modeSel.onchange = () => {
          catSel.style.display = modeSel.value === 'category' ? '' : 'none';
        };
      }

      // Start button
      document.querySelector('[data-action="gameStart"]')?.addEventListener('click', () => {
        this.start().catch(err => MyVocab.utils.ui.toast(err.message));
      });

      // Next button
      document.querySelector('[data-action="gameNext"]')?.addEventListener('click', () => {
        if (!this.session?.answered) {
          MyVocab.utils.ui.toast('Answer first 🙂');
          return;
        }
        this.next().catch(err => MyVocab.utils.ui.toast(err.message));
      });

      // TTS button
      document.querySelector('[data-action="gameTts"]')?.addEventListener('click', () => {
        if (this.currentQ?.word) MyVocab.utils.tts(this.currentQ.word);
      });
    }

    fillCategories() {
      const sel = document.querySelector('[data-role="gameCategory"]');
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
      const bar = document.querySelector('[data-role="gameScoreBar"]');
      if (!bar) return;

      bar.innerHTML = `
        <div class="myvocab__pill"><strong>XP</strong> ${s.xp ?? 0} <span class="myvocab__muted">(+${session.xpGained})</span></div>
        <div class="myvocab__pill"><strong>Session</strong> ✅ ${session.correct} / ❌ ${session.wrong}</div>
        <div class="myvocab__pill"><strong>Streak</strong> ${s.streak ?? 0}</div>
        <div class="myvocab__pill"><strong>Best</strong> ${s.best_streak ?? 0}</div>
      `;
    }

    async start() {
      const mode = document.querySelector('[data-role="gameMode"]')?.value || 'random';
      const cat = document.querySelector('[data-role="gameCategory"]')?.value || '';
      const limit = document.querySelector('[data-role="gameLimit"]')?.value || '10';

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
        MyVocab.utils.ui.toast('No words available for this game mode.');
        return;
      }

      document.querySelector('[data-role="gameEnd"]').style.display = 'none';
      document.querySelector('[data-role="gameBox"]').style.display = '';

      await this.loadGameState();
      await this.next();
    }

    async next() {
      const s = this.session;
      
      if (!s || !s.deck) throw new Error('Game not started');
      if (s.used.size >= s.maxQuestions) return this.finish();

      let nextId = null;
      for (const id of s.deck) {
        if (!s.used.has(id)) {
          nextId = id;
          break;
        }
      }

      if (!nextId) return this.finish();

      s.currentId = nextId;
      s.answered = false;

      let items = this.app.__items || [];
      let current = items.find(x => parseInt(x.id, 10) === nextId);

      if (!current || !current.translation) {
        await loadWords(this.app); // Função global
        items = this.app.__items || [];
        current = items.find(x => parseInt(x.id, 10) === nextId);
      }

      if (!current || !current.translation) {
        s.used.add(nextId);
        return this.next();
      }

      const correct = current.translation;

      // Monta distratores
      const pool = items
        .filter(x => x.translation && parseInt(x.id, 10) !== nextId)
        .map(x => x.translation);

      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      const wrong = pool.filter(t => t !== correct).slice(0, 3);
      const options = [correct, ...wrong];
      
      while (options.length < 4) options.push(correct);
      
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }

      this.currentQ = { 
        word_id: nextId, 
        word: current.word, 
        correct, 
        options 
      };

      const optEl = document.querySelector('[data-role="gameOptions"]');
      const fb = document.querySelector('[data-role="gameFeedback"]');
      const reveal = document.querySelector('[data-role="gameReveal"]');
      const prog = document.querySelector('[data-role="gameProgress"]');

      fb.textContent = '';
      fb.className = 'myvocab__reward';
      reveal.style.display = 'none';
      reveal.innerHTML = '';
      
      prog.textContent = `Word ${s.used.size + 1} / ${s.maxQuestions}`;

      optEl.innerHTML = options.map(o => `
        <button class="myvocab__btn myvocab__btn--choice" data-choice="${MyVocab.utils.ui.escapeHtml(o)}">${MyVocab.utils.ui.escapeHtml(o)}</button>
      `).join('');

      Array.from(optEl.querySelectorAll('button[data-choice]')).forEach(btn => {
        btn.disabled = false;
        btn.onclick = () => this.answer(btn.getAttribute('data-choice'));
      });
    }

    async answer(choice) {
      const s = this.session;
      const q = this.currentQ;
      
      if (!q || s.answered) return;

      const optEl = document.querySelector('[data-role="gameOptions"]');
      const fb = document.querySelector('[data-role="gameFeedback"]');
      const reveal = document.querySelector('[data-role="gameReveal"]');
      const gameBox = document.querySelector('[data-role="gameBox"]');

      Array.from(optEl.querySelectorAll('button')).forEach(b => b.disabled = true);

      const res = await MyVocab.utils.api('/game/answer', {
        method: 'POST',
        body: JSON.stringify({ word_id: q.word_id, choice })
      });

      const r = res.result;
      s.used.add(q.word_id);

      const chosenBtn = optEl.querySelector(`button[data-choice="${MyVocab.utils.ui.escapeHtml(choice)}"]`);
      
      if (r.is_correct) {
        s.correct += 1;
        s.xpGained += 10;
        fb.className = 'myvocab__reward is-good';
        fb.textContent = '🎉 Nice! +10 XP';
        
        if (chosenBtn) chosenBtn.classList.add('selected-correct');
        
        gameBox.classList.add('correct-answer');
        setTimeout(() => gameBox.classList.remove('correct-answer'), 500);
        
        MyVocab.utils.sounds.play('correct');
        
        if (chosenBtn) {
          const rect = chosenBtn.getBoundingClientRect();
          MyVocab.utils.sounds.createXPFloat(rect.left + rect.width/2, rect.top, 10);
        }
      } else {
        s.wrong += 1;
        fb.className = 'myvocab__reward is-bad';
        fb.textContent = `❌ Correct: ${r.correct_translation}`;
        
        if (chosenBtn) chosenBtn.classList.add('selected-wrong');
        
        Array.from(optEl.querySelectorAll('button[data-choice]')).forEach(btn => {
          if (btn.getAttribute('data-choice') === r.correct_translation) {
            btn.classList.add('selected-correct');
          }
        });
        
        gameBox.classList.add('wrong-answer');
        setTimeout(() => gameBox.classList.remove('wrong-answer'), 500);
        
        MyVocab.utils.sounds.play('wrong');
      }

      reveal.style.display = '';
      reveal.innerHTML = `<strong>Word:</strong> ${MyVocab.utils.ui.escapeHtml(q.word)}`;

      s.answered = true;
      await this.loadGameState();
      
      if (s.used.size >= s.maxQuestions) {
        setTimeout(() => this.finish(), 1500);
      }
    }

    finish() {
      const s = this.session || { correct: 0, wrong: 0, xpGained: 0, maxQuestions: 0 };

      document.querySelector('[data-role="gameBox"]').style.display = 'none';

      const end = document.querySelector('[data-role="gameEnd"]');
      end.style.display = '';
      end.innerHTML = `
        <div class="myvocab__endTitle">🎉 Round completed!</div>
        <div class="myvocab__endStats">
          <div class="myvocab__pill"><strong>Words</strong> ${s.used?.size || 0} / ${s.maxQuestions}</div>
          <div class="myvocab__pill"><strong>Correct</strong> ✅ ${s.correct}</div>
          <div class="myvocab__pill"><strong>Wrong</strong> ❌ ${s.wrong}</div>
          <div class="myvocab__pill"><strong>XP gained</strong> +${s.xpGained}</div>
        </div>
        <div class="myvocab__row" style="margin-top:12px; justify-content: center;">
          <button class="myvocab__btn myvocab__btn--primary" data-action="gameStart">Play again</button>
          <button class="myvocab__btn" data-action="gameBack">Choose another game</button>
        </div>
      `;

      MyVocab.utils.sounds.play('correct');
      setTimeout(() => MyVocab.utils.sounds.play('correct'), 200);

      end.querySelector('[data-action="gameStart"]').onclick = () => this.start();
      end.querySelector('[data-action="gameBack"]').onclick = () => this.back();
    }

    back() {
      this.showControls();
      this.hideView();
      this.session = null;
      this.currentQ = null;
    }
  }

  // Registra o game
  window.MyVocab = window.MyVocab || {};
  window.MyVocab.games = window.MyVocab.games || {};
  window.MyVocab.games.listenChoose = ListenChooseGame;
})();
