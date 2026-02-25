(function () {
  const cfg = window.MyVocabConfig || {};
  const restBase = cfg.restBase || '';
  const nonce = cfg.nonce || '';

  // Utilitários globais
  window.MyVocab = {
    config: { restBase, nonce, pluginUrl: cfg.pluginUrl || '' },
    app: null,
    games: {},
    utils: {},
    modules: {}
  };

  // Funções utilitárias básicas
  function qs(sel, root = document) { return root.querySelector(sel); }
  function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function escapeHtml(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function toast(app, msg) {
    const box = qs('.myvocab__toast', app);
    if (!box) return;
    box.textContent = msg;
    box.style.display = '';
    box.classList.add('is-show');
    setTimeout(() => {
      box.classList.remove('is-show');
      setTimeout(() => (box.style.display = 'none'), 200);
    }, 1700);
  }

  function setTab(app, tab) {
    qsa('[data-tab-panel]', app).forEach(p => {
      p.style.display = (p.getAttribute('data-tab-panel') === tab) ? '' : 'none';
    });
    qsa('.myvocab__navBtn', app).forEach(b => {
      b.classList.toggle('is-active', b.getAttribute('data-tab') === tab);
    });
  }

  // ============ FUNÇÃO INJECT GAMES HTML ============
  function injectGamesHTML(app) {
    console.log('🎮 injectGamesHTML called');
    const practiceTab = qs('[data-tab-panel="practice"]', app);
    if (!practiceTab) {
      console.log('❌ Practice tab not found');
      return;
    }
    
    if (qs('[data-role="gamesRoot"]', practiceTab)) {
      console.log('✅ Games already injected');
      return;
    }

    practiceTab.innerHTML = `
      <div class="myvocab__card" data-role="gamesRoot">
        <div class="myvocab__row myvocab__row--between">
          <div>
            <div class="myvocab__cardTitle">Games</div>
            <div class="myvocab__muted">Pick a game to practice your vocabulary.</div>
          </div>
        </div>

        <div class="myvocab__gamesGrid" data-role="gamesHome">
          <button class="myvocab__gameCard" data-game="find_translation">
            <div class="myvocab__gameIcon">🎧✅</div>
            <div class="myvocab__gameContent">
              <div class="myvocab__gameName">Listen &amp; Choose</div>
              <div class="myvocab__gameDesc">Listen and choose the correct translation.</div>
            </div>
          </button>
        
          <button class="myvocab__gameCard" data-game="listen_write">
            <div class="myvocab__gameIcon">🎧✍️</div>
            <div class="myvocab__gameContent">
              <div class="myvocab__gameName">Listen &amp; Write</div>
              <div class="myvocab__gameDesc">Listen and type what you hear.</div>
            </div>
          </button>
        
          <button class="myvocab__gameCard" data-game="listen_speak">
            <div class="myvocab__gameIcon">🎤✅</div>
            <div class="myvocab__gameContent">
              <div class="myvocab__gameName">Listen &amp; Speak</div>
              <div class="myvocab__gameDesc">Speak the word and get feedback.</div>
            </div>
          </button>
        
          <button class="myvocab__gameCard is-disabled" disabled>
            <div class="myvocab__gameIcon">🔎</div>
            <div class="myvocab__gameContent">
              <div class="myvocab__gameName">Find The Word</div>
              <div class="myvocab__gameDesc">Coming soon</div>
            </div>
          </button>
        </div>

        <!-- Game View: Listen & Choose -->
        <div data-role="gameView" style="display:none;">
          <div class="myvocab__row myvocab__row--between">
            <button class="myvocab__btn" data-action="gameBack">← Back to Games</button>
            <div class="myvocab__row">
              <select class="myvocab__select" data-role="gameMode">
                <option value="random" selected>Random</option>
                <option value="category">Choose category</option>
              </select>
              <select class="myvocab__select" data-role="gameCategory" style="display:none;">
                <option value="">All categories</option>
              </select>
              <select class="myvocab__select" data-role="gameLimit">
                <option value="10" selected>10</option>
                <option value="20">20</option>
                <option value="30">30</option>
                <option value="50">50</option>
                <option value="all">All</option>
              </select>
              <button class="myvocab__btn myvocab__btn--primary" data-action="gameStart">Start</button>
            </div>
          </div>
          <div class="myvocab__scoreBar" data-role="gameScoreBar"></div>
          <div class="myvocab__gameBox" data-role="gameBox" style="display:none;">
            <div class="myvocab__listenHead">
              <div>
                <div class="myvocab__listenTitle">Listen</div>
                <div class="myvocab__muted">Pick the correct translation.</div>
              </div>
              <button class="myvocab__btn myvocab__btn--primary" data-action="gameTts">🔊 Play</button>
            </div>
            <div class="myvocab__gameOptions" data-role="gameOptions"></div>
            <div class="myvocab__reward" data-role="gameFeedback"></div>
            <div class="myvocab__reveal" data-role="gameReveal" style="display:none;"></div>
            <div class="myvocab__row myvocab__row--between" style="margin-top:10px;">
              <div class="myvocab__muted" data-role="gameProgress"></div>
              <button class="myvocab__btn" data-action="gameNext">Next →</button>
            </div>
          </div>
          <div class="myvocab__end" data-role="gameEnd" style="display:none;"></div>
        </div>

        <!-- Game View: Listen & Write -->
        <div data-role="writeGameView" style="display:none;">
          <div class="myvocab__row myvocab__row--between">
            <button class="myvocab__btn" data-action="writeGameBack">← Back to Games</button>
            <div class="myvocab__row">
              <select class="myvocab__select" data-role="writeGameMode">
                <option value="random" selected>Random</option>
                <option value="category">Choose category</option>
              </select>
              <select class="myvocab__select" data-role="writeGameCategory" style="display:none;">
                <option value="">All categories</option>
              </select>
              <select class="myvocab__select" data-role="writeGameLimit">
                <option value="10" selected>10</option>
                <option value="20">20</option>
                <option value="30">30</option>
                <option value="50">50</option>
                <option value="all">All</option>
              </select>
              <button class="myvocab__btn myvocab__btn--primary" data-action="writeGameStart">Start</button>
            </div>
          </div>
          <div class="myvocab__scoreBar" data-role="writeGameScoreBar"></div>
          <div class="myvocab__gameBox" data-role="writeGameBox" style="display:none;">
            <div class="myvocab__listenHead">
              <div>
                <div class="myvocab__listenTitle">Listen & Write</div>
                <div class="myvocab__muted">Type exactly what you hear.</div>
              </div>
              <button class="myvocab__btn myvocab__btn--primary" data-action="writeGameTts">🔊 Play</button>
            </div>
            <div class="myvocab__writeArea">
              <input type="text" class="myvocab__input myvocab__input--large" data-role="writeAnswer" placeholder="Type the word you heard..." autocomplete="off" autocapitalize="off" spellcheck="false">
              <div class="myvocab__row" style="justify-content: center; margin-top: 15px;">
                <button class="myvocab__btn myvocab__btn--primary" data-action="writeSubmit">Check Answer</button>
                <button class="myvocab__btn" data-action="writeSkip">Skip</button>
              </div>
            </div>
            <div class="myvocab__reward" data-role="writeGameFeedback"></div>
            <div class="myvocab__reveal" data-role="writeGameReveal" style="display:none;"></div>
            <div class="myvocab__row myvocab__row--between" style="margin-top:10px;">
              <div class="myvocab__muted" data-role="writeGameProgress"></div>
            </div>
          </div>
          <div class="myvocab__end" data-role="writeGameEnd" style="display:none;"></div>
        </div>
      </div>
      
      <!-- Game View: Listen & Speak -->
        <div data-role="speakGameView" style="display:none;">
          <div class="myvocab__row myvocab__row--between">
            <button class="myvocab__btn" data-action="speakGameBack">← Back to Games</button>
        
            <div class="myvocab__row">
              <select class="myvocab__select" data-role="speakGameMode">
                <option value="random" selected>Random</option>
                <option value="category">Choose category</option>
              </select>
        
              <select class="myvocab__select" data-role="speakGameCategory" style="display:none;">
                <option value="">All categories</option>
              </select>
        
              <select class="myvocab__select" data-role="speakGameLimit">
                <option value="10" selected>10</option>
                <option value="20">20</option>
                <option value="30">30</option>
                <option value="50">50</option>
                <option value="all">All</option>
              </select>
        
              <button class="myvocab__btn myvocab__btn--primary" data-action="speakGameStart">Start</button>
            </div>
          </div>
        
          <div class="myvocab__scoreBar" data-role="speakGameScoreBar"></div>
        
          <div class="myvocab__gameBox" data-role="speakGameBox" style="display:none;">
            <div class="myvocab__speakHead">
              <div>
                <div class="myvocab__speakWord" data-role="speakWord">word</div>
                <div class="myvocab__muted">Speak this word clearly</div>
              </div>
              <div>
                <button class="myvocab__btn myvocab__btn--primary" data-action="speakPlay">🔊 Listen</button>
              </div>
            </div>
        
            <div class="myvocab__speakArea">
              <div class="myvocab__row" style="justify-content: center; gap: 15px;">
                <button class="myvocab__btn myvocab__btn--record" data-action="speakRecord">🎤 Record</button>
                <button class="myvocab__btn" data-action="speakPlayUser" disabled>▶️ Play my voice</button>
              </div>
            </div>
        
            <div class="myvocab__reward" data-role="speakGameFeedback"></div>
        
            <div class="myvocab__reveal" data-role="speakGameReveal" style="display:none;"></div>
        
            <div class="myvocab__row myvocab__row--between" style="margin-top:10px;">
              <div class="myvocab__muted" data-role="speakGameProgress"></div>
              <button class="myvocab__btn" data-action="speakGameNext" disabled>Next →</button>
            </div>
          </div>
        
          <div class="myvocab__end" data-role="speakGameEnd" style="display:none;"></div>
        </div>
    `;
    console.log('✅ Games HTML injected successfully');
  }

  // ============ CARREGAMENTO DE SCRIPTS ============
  async function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function loadAllScripts() {
    // Fallback: detecta o caminho do script atual
    const currentScript = document.querySelector('script[src*="my-vocab.js"]');
    const scriptPath = currentScript ? currentScript.src : '';
    const baseUrl = scriptPath.substring(0, scriptPath.lastIndexOf('/') + 1);
    
    console.log('Detected base path:', baseUrl);
    
    try {
      // Utilitários primeiro
      await loadScript(`${baseUrl}utils/api.js`);
      await loadScript(`${baseUrl}utils/tts.js`);
      await loadScript(`${baseUrl}utils/sounds.js`);
      await loadScript(`${baseUrl}utils/ui.js`);
      
      // Game base
      await loadScript(`${baseUrl}games/game-base.js`);
      
      // Games específicos
      await loadScript(`${baseUrl}games/listen-choose.js`);
      await loadScript(`${baseUrl}games/listen-write-v3.js`);
      await loadScript(`${baseUrl}games/listen-speak-v5.js`);
      
      console.log('All scripts loaded successfully');
      return true;
    } catch (error) {
      console.error('Error loading scripts:', error);
      return false;
    }
  }

  // ============ CATEGORIAS ============
  async function loadCategories(app) {
    try {
      const data = await MyVocab.utils.api('/categories', { method: 'GET' });
      app.__cats = data.items || [];
      if (MyVocab.utils.ui && MyVocab.utils.ui.fillCategorySelects) {
        MyVocab.utils.ui.fillCategorySelects(app);
      }
      renderCategoryList(app);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast(app, 'Error loading categories');
    }
  }

  function renderCategoryList(app) {
    const list = qs('[data-role="catList"]', app);
    const cats = app.__cats || [];

    if (!list) return;

    if (!cats.length) {
      list.innerHTML = `<div class="myvocab__empty">No categories yet. Click <strong>+ New category</strong>.</div>`;
      return;
    }

    list.innerHTML = cats.map(c => `
      <div class="myvocab__catRow" data-id="${c.id}">
        <div class="myvocab__catName">${escapeHtml(c.name)}</div>
        <div class="myvocab__catBtns">
          <button class="myvocab__iconBtn" data-action="editCat" title="Edit">✎</button>
          <button class="myvocab__iconBtn myvocab__iconBtn--danger" data-action="delCat" title="Delete">🗑</button>
        </div>
      </div>
    `).join('');

    qsa('.myvocab__catRow', list).forEach(row => {
      row.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const id = row.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        const cat = cats.find(x => String(x.id) === String(id));
        if (!cat) return;

        if (action === 'editCat') openCatModal(app, 'edit', cat);
        if (action === 'delCat') {
          if (!confirm('Delete this category? Words will be kept (category removed).')) return;
          try {
            await MyVocab.utils.api(`/categories/${id}`, { method: 'DELETE' });
            toast(app, 'Category deleted ✅');
            await loadCategories(app);
            await loadWords(app);
          } catch (err) {
            toast(app, err.message);
          }
        }
        e.stopPropagation();
      });
    });
  }

  function openCatModal(app, mode, cat) {
    const modal = qs('[data-role="catModal"]', app);
    modal.style.display = '';
    modal.dataset.mode = mode;
    modal.dataset.id = cat?.id || '';
    qs('[data-role="catModalTitle"]', app).textContent = mode === 'edit' ? 'Edit category' : 'New category';
    qs('[data-role="catName"]', app).value = cat?.name || '';
    qs('[data-role="catName"]', app).focus();
  }

  function closeCatModal(app) {
    const modal = qs('[data-role="catModal"]', app);
    modal.style.display = 'none';
    modal.dataset.mode = '';
    modal.dataset.id = '';
  }

  // ============ PALAVRAS ============
  function openWordModal(app, mode, item) {
    const modal = qs('[data-role="modal"]', app);
    modal.style.display = '';
    modal.dataset.mode = mode;
    modal.dataset.id = item?.id || '';

    qs('[data-role="modalTitle"]', app).textContent = mode === 'edit' ? 'Edit word' : 'Add word';
    qs('[data-role="formCat"]', app).value = item?.category_id ? String(item.category_id) : '';
    qs('[data-role="formWord"]', app).value = item?.word || '';
    qs('[data-role="formTrans"]', app).value = item?.translation || '';
    qs('[data-role="formDef"]', app).value = item?.definition || '';
    qs('[data-role="formEx"]', app).value = item?.example || '';

    qs('[data-role="formWord"]', app).focus();
  }

  function closeWordModal(app) {
    const modal = qs('[data-role="modal"]', app);
    modal.style.display = 'none';
    modal.dataset.mode = '';
    modal.dataset.id = '';
  }

  function catName(app, category_id) {
    if (!category_id) return '';
    const c = (app.__cats || []).find(x => String(x.id) === String(category_id));
    return c ? c.name : '';
  }

  function renderList(app, items, query) {
  const list = qs('[data-role="list"]', app);
  if (!list) return;

  if (!items.length) {
    list.innerHTML = `<div class="myvocab__empty">No words yet. Click <strong>+ Add word</strong> or use <strong>Import</strong>.</div>`;
    return;
  }

  const q = (query || '').toLowerCase();
  const filtered = q
    ? items.filter(it =>
        (it.word || '').toLowerCase().includes(q) ||
        (it.definition || '').toLowerCase().includes(q) ||
        (it.translation || '').toLowerCase().includes(q)
      )
    : items;

  if (!filtered.length) {
    list.innerHTML = `<div class="myvocab__empty">No results for "<strong>${escapeHtml(query)}</strong>".</div>`;
    return;
  }

  list.innerHTML = filtered.map(it => {
    // Construção do card com a ordem correta
    let html = `
      <div class="myvocab__item" data-id="${it.id}">
        <!-- Linha superior com palavra e botões (DESKTOP) -->
        <div class="myvocab__itemTop">
          <div>
            <div class="myvocab__wordRow">
              <div class="myvocab__word">${escapeHtml(it.word)}</div>
              ${it.translation ? `<div class="myvocab__trans">${escapeHtml(it.translation)}</div>` : ''}
            </div>
            ${it.category_id ? `<div class="myvocab__badge">${escapeHtml(catName(app, it.category_id))}</div>` : ''}
          </div>
    `;

    // Botões no topo (DESKTOP)
    html += `
          <div class="myvocab__itemBtns desktop-only">
            <button class="myvocab__iconBtn" data-action="tts" title="Listen">🔊</button>
            <button class="myvocab__iconBtn" data-action="edit" title="Edit">✎</button>
            <button class="myvocab__iconBtn myvocab__iconBtn--danger" data-action="del" title="Delete">🗑</button>
          </div>
        </div>
    `;

    // Definição e exemplo (comuns a desktop e mobile)
    html += `
        <div class="myvocab__def">${escapeHtml(it.definition || '—')}</div>
        ${it.example ? `<div class="myvocab__ex">“${escapeHtml(it.example)}”</div>` : ''}
    `;

    // Botões no final (MOBILE)
    html += `
        <div class="myvocab__itemBtns mobile-only">
          <button class="myvocab__iconBtn" data-action="tts" title="Listen">🔊 Listen</button>
          <button class="myvocab__iconBtn" data-action="edit" title="Edit">✎ Edit</button>
          <button class="myvocab__iconBtn myvocab__iconBtn--danger" data-action="del" title="Delete">🗑 Delete</button>
        </div>
      </div>
    `;

    return html;
  }).join('');

  // Event listeners
  qsa('.myvocab__item', list).forEach(row => {
    row.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const id = row.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      const item = filtered.find(x => String(x.id) === String(id));
      if (!item) return;

      if (action === 'tts' && MyVocab.utils.tts) MyVocab.utils.tts(item.word);
      if (action === 'edit') openWordModal(app, 'edit', item);
      if (action === 'del') {
        if (!confirm('Delete this word?')) return;
        MyVocab.utils.api(`/words/${id}`, { method: 'DELETE' })
          .then(() => loadWords(app))
          .then(() => toast(app, 'Deleted ✅'))
          .catch(err => toast(app, err.message));
      }
      e.stopPropagation();
    });
  });
}

  function renderFlash(app) {
    const box = qs('[data-role="flash"]', app);
    if (!box) return;

    let items = (app.__items || []).slice();
    if (!items.length) {
      box.innerHTML = `<div class="myvocab__empty">Add words first to practice.</div>`;
      return;
    }

    const selectedCat = qs('[data-role="practiceCategory"]', app)?.value || '';
    if (selectedCat) {
      items = items.filter(it => String(it.category_id || '') === String(selectedCat));
      if (!items.length) {
        box.innerHTML = `<div class="myvocab__empty">No words in this category yet.</div>`;
        return;
      }
    }

    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    let idx = 0;
    function show() {
      const it = items[idx];
      box.innerHTML = `
        <div class="myvocab__flashCard">
          <div class="myvocab__flashTop">
            <div>
              <div class="myvocab__flashWord">${escapeHtml(it.word)}</div>
              ${it.translation ? `<div class="myvocab__muted">PT: ${escapeHtml(it.translation)}</div>` : ''}
              ${it.category_id ? `<div class="myvocab__badge">${escapeHtml(catName(app, it.category_id))}</div>` : ''}
            </div>
            <button class="myvocab__iconBtn" data-action="tts" title="Listen">🔊</button>
          </div>

          <div class="myvocab__flashBlock">
            <div class="myvocab__label">Definition</div>
            <div>${escapeHtml(it.definition || '—')}</div>
          </div>

          <div class="myvocab__flashBlock">
            <div class="myvocab__label">Example</div>
            <div>${escapeHtml(it.example || '—')}</div>
          </div>

          <div class="myvocab__flashNav">
            <button class="myvocab__btn" data-action="prev">←</button>
            <div class="myvocab__muted">${idx + 1} / ${items.length}</div>
            <button class="myvocab__btn" data-action="next">→</button>
          </div>
        </div>
      `;

      qs('[data-action="tts"]', box).onclick = () => MyVocab.utils.tts && MyVocab.utils.tts(it.word);
      qs('[data-action="prev"]', box).onclick = () => { idx = (idx - 1 + items.length) % items.length; show(); };
      qs('[data-action="next"]', box).onclick = () => { idx = (idx + 1) % items.length; show(); };
    }
    show();
  }

  async function loadWords(app) {
    const q = qs('[data-role="search"]', app)?.value || '';
    const cat = qs('[data-role="catFilter"]', app)?.value || '';
    const qsCat = cat ? `&category_id=${encodeURIComponent(cat)}` : '';
    const data = await MyVocab.utils.api(`/words?q=${encodeURIComponent(q)}${qsCat}`, { method: 'GET' });
    app.__items = data.items || [];
    renderList(app, app.__items, q);
    renderFlash(app);
  }

  // ============ IMPORT CSV ============
  function parseCSV(text) {
    const rows = [];
    let i = 0, field = '', row = [], inQuotes = false;

    const pushField = () => { row.push(field); field = ''; };
    const pushRow = () => { rows.push(row); row = []; };

    while (i < text.length) {
      const c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      } else {
        if (c === '"') { inQuotes = true; i++; continue; }
        if (c === ',' || c === ';') { pushField(); i++; continue; }
        if (c === '\n') { pushField(); pushRow(); i++; continue; }
        if (c === '\r') { i++; continue; }
        field += c; i++; continue;
      }
    }
    pushField();
    if (row.length > 1 || (row.length === 1 && row[0].trim() !== '')) pushRow();
    return rows;
  }

  function normalizeHeader(h) {
    return String(h || '')
      .trim()
      .toLowerCase()
      .replaceAll(' ', '_');
  }

  function mapCSVToRows(csvRows) {
    if (!csvRows || csvRows.length < 2) return { error: 'CSV must have header + rows', rows: [] };

    const header = csvRows[0].map(normalizeHeader);

    const idx = (name) => header.indexOf(name);
    const iWord = idx('word');
    if (iWord === -1) return { error: 'CSV header must include "word"', rows: [] };

    const iTrans = idx('translation');
    const iDef = idx('definition');
    const iEx = idx('example');
    const iCat = idx('category');

    const rows = [];
    for (let r = 1; r < csvRows.length; r++) {
      const line = csvRows[r];
      const word = (line[iWord] ?? '').trim();
      if (!word) continue;

      rows.push({
        word,
        translation: iTrans >= 0 ? (line[iTrans] ?? '').trim() : '',
        definition: iDef >= 0 ? (line[iDef] ?? '').trim() : '',
        example: iEx >= 0 ? (line[iEx] ?? '').trim() : '',
        category: iCat >= 0 ? (line[iCat] ?? '').trim() : '',
      });
    }
    return { error: null, rows };
  }

  function renderImportPreview(app, preview) {
    const box = qs('[data-role="csvPreview"]', app);
    if (!box) return;

    const cats = preview.categories || [];
    const rows = preview.rows || [];

    const dupCount = rows.filter(r => r.is_duplicate_word).length;

    box.innerHTML = `
      <div class="myvocab__card" style="margin-top:12px;">
        <div class="myvocab__row myvocab__row--between">
          <div>
            <div class="myvocab__cardTitle">Preview</div>
            <div class="myvocab__muted">
              Rows: <strong>${rows.length}</strong> | Duplicates: <strong>${dupCount}</strong>
            </div>
          </div>
          <button class="myvocab__btn myvocab__btn--primary" data-action="commitCsv">Import now</button>
        </div>

        ${cats.length ? `
          <div class="myvocab__importBlock">
            <div class="myvocab__label">Category duplicates</div>
            ${cats.map(c => {
      if (c.status === 'exists') {
        return `
                  <div class="myvocab__dupRow">
                    <div><strong>${escapeHtml(c.name)}</strong> already exists.</div>
                    <select class="myvocab__select" data-role="catDecision" data-cat="${escapeHtml(c.name)}">
                      <option value="use" selected>Use existing</option>
                      <option value="new">Create another (suffix)</option>
                    </select>
                  </div>
                `;
      }
      return `
                <div class="myvocab__dupRow">
                  <div><strong>${escapeHtml(c.name)}</strong> will be created.</div>
                  <select class="myvocab__select" data-role="catDecision" data-cat="${escapeHtml(c.name)}">
                    <option value="new" selected>Create</option>
                    <option value="use">Do not create (no category)</option>
                  </select>
                </div>
              `;
    }).join('')}
          </div>
        ` : ''}

        <div class="myvocab__importBlock">
          <div class="myvocab__label">Word duplicates</div>
          <div class="myvocab__muted">For duplicate words, choose what to do.</div>

          <div class="myvocab__tableWrap">
            <table class="myvocab__table">
              <thead>
                <tr>
                  <th>Word</th>
                  <th>Translation</th>
                  <th>Category</th>
                  <th>Duplicate?</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(r => {
      const isDup = r.is_duplicate_word;
      return `
                    <tr class="${isDup ? 'is-dup' : ''}">
                      <td>${escapeHtml(r.word)}</td>
                      <td>${escapeHtml(r.translation || '')}</td>
                      <td>${escapeHtml(r.category || '')}</td>
                      <td>${isDup ? `Yes (${r.duplicates.length})` : 'No'}</td>
                      <td>
                        ${isDup
          ? `
                            <select class="myvocab__select" data-role="rowDecision" data-index="${r.index}">
                              <option value="replace">Replace</option>
                              <option value="keep" selected>Keep both</option>
                              <option value="skip">Skip</option>
                            </select>
                            <div class="myvocab__muted" style="margin-top:6px;">
                              Existing: ${escapeHtml(r.duplicates[0]?.definition || '').slice(0, 70)}${(r.duplicates[0]?.definition || '').length > 70 ? '…' : ''}
                            </div>
                          `
          : `
                            <select class="myvocab__select" data-role="rowDecision" data-index="${r.index}">
                              <option value="keep" selected>Import</option>
                              <option value="skip">Skip</option>
                            </select>
                          `
        }
                      </td>
                    </tr>
                  `;
    }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    qs('[data-action="commitCsv"]', box).onclick = () => commitCsv(app, preview).catch(err => toast(app, err.message));
  }

  async function commitCsv(app, preview) {
    const box = qs('[data-role="csvPreview"]', app);
    const rows = preview.rows || [];
    const cats = preview.categories || [];

    const category_resolution = {};
    qsa('[data-role="catDecision"]', box).forEach(sel => {
      const cat = sel.getAttribute('data-cat');
      const action = sel.value;
      category_resolution[cat] = { action };
    });

    const row_resolution = {};
    qsa('[data-role="rowDecision"]', box).forEach(sel => {
      const idx = sel.getAttribute('data-index');
      row_resolution[idx] = { action: sel.value };
    });

    const payloadRows = rows.map(r => ({
      index: r.index,
      word: r.word,
      translation: r.translation,
      definition: r.definition,
      example: r.example,
      category: r.category,
    }));

    const res = await MyVocab.utils.api('/import/csv/commit', {
      method: 'POST',
      body: JSON.stringify({ rows: payloadRows, category_resolution, row_resolution })
    });

    toast(app, `Imported: ${res.imported} | Replaced: ${res.replaced} | Kept dupes: ${res.kept_duplicates} | Skipped: ${res.skipped}`);
    await loadCategories(app);
    await loadWords(app);

    box.innerHTML = '';
    const input = qs('[data-role="csvFile"]', app);
    if (input) input.value = '';
  }

  async function previewCsv(app, rows) {
    const preview = await MyVocab.utils.api('/import/csv/preview', {
      method: 'POST',
      body: JSON.stringify({ rows })
    });
    renderImportPreview(app, preview);
    app.__lastCsvPreview = preview;
  }

  async function importPaste(app) {
    const text = qs('[data-role="paste"]', app).value;
    const category_id = qs('[data-role="importCategory"]', app).value || '';
    if (!text.trim()) { toast(app, 'Paste something first'); return; }

    const res = await MyVocab.utils.api('/import', {
      method: 'POST',
      body: JSON.stringify({ text, category_id: category_id || null })
    });
    qs('[data-role="importResult"]', app).textContent = `Imported: ${res.imported} | Skipped: ${res.skipped}`;
    toast(app, 'Import done ✅');
    await loadWords(app);
  }

  // ============ BIND PRINCIPAL ============
  function bind(app) {
    qsa('.myvocab__navBtn', app).forEach(btn => {
      btn.addEventListener('click', () => setTab(app, btn.getAttribute('data-tab')));
    });
    setTab(app, 'words');

    qs('[data-action="openAdd"]', app)?.addEventListener('click', () => openWordModal(app, 'add', null));
    qs('[data-action="openAddCat"]', app)?.addEventListener('click', () => openCatModal(app, 'add', null));

    qsa('[data-action="closeModal"]', app).forEach(b => b.addEventListener('click', () => closeWordModal(app)));
    qsa('[data-action="closeCatModal"]', app).forEach(b => b.addEventListener('click', () => closeCatModal(app)));

    qs('[data-action="saveWord"]', app)?.addEventListener('click', async () => {
      const modal = qs('[data-role="modal"]', app);
      const mode = modal.dataset.mode;
      const id = modal.dataset.id;

      const category_id = qs('[data-role="formCat"]', app).value || '';
      const word = qs('[data-role="formWord"]', app).value.trim();
      const translation = qs('[data-role="formTrans"]', app).value.trim();
      const definition = qs('[data-role="formDef"]', app).value.trim();
      const example = qs('[data-role="formEx"]', app).value.trim();

      if (!word) { toast(app, 'Word is required'); return; }

      try {
        if (mode === 'edit' && id) {
          await MyVocab.utils.api(`/words/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ category_id: category_id || null, word, translation, definition, example })
          });
          toast(app, 'Updated ✅');
        } else {
          await MyVocab.utils.api('/words', {
            method: 'POST',
            body: JSON.stringify({ category_id: category_id || null, word, translation, definition, example })
          });
          toast(app, 'Saved ✅');
        }
        closeWordModal(app);
        await loadWords(app);
      } catch (e) {
        toast(app, e.message);
      }
    });

    qs('[data-action="saveCategory"]', app)?.addEventListener('click', async () => {
      const modal = qs('[data-role="catModal"]', app);
      const mode = modal.dataset.mode;
      const id = modal.dataset.id;
      const name = qs('[data-role="catName"]', app).value.trim();
      if (!name) { toast(app, 'Category name is required'); return; }

      try {
        if (mode === 'edit' && id) {
          await MyVocab.utils.api(`/categories/${id}`, { method: 'PUT', body: JSON.stringify({ name }) });
          toast(app, 'Category updated ✅');
        } else {
          await MyVocab.utils.api('/categories', { method: 'POST', body: JSON.stringify({ name }) });
          toast(app, 'Category saved ✅');
        }
        closeCatModal(app);
        await loadCategories(app);
      } catch (e) {
        toast(app, e.message);
      }
    });

    qs('[data-role="search"]', app)?.addEventListener('input', () => loadWords(app).catch(err => toast(app, err.message)));
    qs('[data-role="catFilter"]', app)?.addEventListener('change', () => loadWords(app).catch(err => toast(app, err.message)));

    qs('[data-action="importPaste"]', app)?.addEventListener('click', () => importPaste(app).catch(err => toast(app, err.message)));

    qs('[data-action="practiceReload"]', app)?.addEventListener('click', () => renderFlash(app));
    qs('[data-role="practiceCategory"]', app)?.addEventListener('change', () => renderFlash(app));

    qs('[data-action="csvPreview"]', app)?.addEventListener('click', async () => {
      const file = qs('[data-role="csvFile"]', app)?.files?.[0];
      if (!file) { toast(app, 'Choose a CSV file first'); return; }

      const text = await file.text();
      const raw = parseCSV(text);
      const mapped = mapCSVToRows(raw);
      if (mapped.error) { toast(app, mapped.error); return; }

      await previewCsv(app, mapped.rows);
      toast(app, 'Preview ready ✅');
    });
  }

  // ============ BOOTSTRAP ============
  async function boot(app) {
    try {
      await loadCategories(app);
      await loadWords(app);
      
      // Inicializa todos os games registrados
      setTimeout(() => {
        Object.values(MyVocab.games).forEach(GameClass => {
          try {
            if (typeof GameClass === 'function') {
              const gameInstance = new GameClass(app);
              if (gameInstance.init) {
                gameInstance.init();
              }
            }
          } catch (e) {
            console.error('Error initializing game:', e);
          }
        });
      }, 500);

      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = () => {};
      }
    } catch (error) {
      console.error('Boot error:', error);
      toast(app, 'Error initializing app');
    }
  }

  // ============ INICIALIZAÇÃO ============
  document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM Content Loaded');
    const app = qs('#myvocab-app');
    if (!app) {
      console.log('❌ App element not found');
      return;
    }
    
    if (!restBase) {
      console.log('❌ REST base not configured');
      return;
    }

    console.log('✅ App element found, initializing...');
    window.MyVocab.app = app;
    
    // Injeta UI do CSV no Import tab
    const importTab = qs('[data-tab-panel="import"]', app);
    if (importTab && !qs('[data-role="csvFile"]', importTab)) {
      const firstCard = importTab.querySelector('.myvocab__card');
      const csvCard = document.createElement('div');
      csvCard.className = 'myvocab__card';
      csvCard.innerHTML = `
        <div class="myvocab__cardTitle">Import CSV</div>
        <p class="myvocab__muted">
          Header esperado: <code>word,translation,definition,example,category</code>
        </p>
        <div class="myvocab__row">
          <input class="myvocab__input" type="file" accept=".csv,text/csv" data-role="csvFile" />
          <button class="myvocab__btn myvocab__btn--primary" data-action="csvPreview">Preview</button>
        </div>
        <div data-role="csvPreview"></div>
      `;
      importTab.insertBefore(csvCard, firstCard);
    }

    // Injeta o HTML dos games
    injectGamesHTML(app);
    
    // Carrega os scripts modulares
    loadAllScripts().then(loaded => {
      if (!loaded) {
        toast(app, 'Error loading game modules');
        return;
      }

      // Inicializa o app
      bind(app);
      boot(app).catch(err => toast(app, err.message));
    });
  });

  console.log('📦 Main script loaded');
})();
