(function() {
  class BaseGame {
    constructor(app, gameId) {
      this.app = app;
      this.gameId = gameId;
      this.session = null;
      this.currentQ = null;
    }

    // Template methods a serem implementados
    init() {
      this.bindUI();
    }

    bindUI() {
      // Bind dos botões específicos do game
    }

    async start() {
      // Lógica de início do jogo
    }

    async next() {
      // Próxima pergunta
    }

    async answer() {
      // Processar resposta
    }

    finish() {
      // Finalizar jogo
    }

    back() {
      // Voltar para tela de games
    }

    renderScoreBar() {
      // Renderizar barra de pontuação
    }

    fillCategories() {
      // Preencher selects de categoria
    }

    // Métodos utilitários comuns
    hideControls() {
      const controlsRow = document.querySelector(`[data-role="${this.gameId}View"] > .myvocab__row:first-child`);
      if (controlsRow) controlsRow.style.display = 'none';
    }

    showControls() {
      const controlsRow = document.querySelector(`[data-role="${this.gameId}View"] > .myvocab__row:first-child`);
      if (controlsRow) controlsRow.style.display = 'flex';
    }

    showView() {
      document.querySelector('[data-role="gamesHome"]').style.display = 'none';
      document.querySelector(`[data-role="${this.gameId}View"]`).style.display = '';
      this.showControls();
    }

    hideView() {
      document.querySelector(`[data-role="${this.gameId}View"]`).style.display = 'none';
      document.querySelector('[data-role="gamesHome"]').style.display = '';
    }

    async loadGameState() {
      const st = await MyVocab.utils.api('/game/state', { method: 'GET' });
      this.app.__gameState = st.state || {};
      this.renderScoreBar();
    }
  }

  // Registra a classe base no objeto global
  window.MyVocab = window.MyVocab || {};
  window.MyVocab.BaseGame = BaseGame;
})();
