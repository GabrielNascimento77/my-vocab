<?php
/**
 * Plugin Name: My Vocab (Student Dictionary + TTS + Import)
 * Description: Dicionário pessoal de vocabulário para alunos logados, com TTS, import por colar lista e prática básica.
 * Version: 0.6.1
 * Author: Gabriel Nascimento
 */

if (!defined('ABSPATH')) exit;

final class MyVocabPlugin {
  const VERSION = '0.2.0';
  const TABLE_WORDS = 'myvocab_words';
  const TABLE_CATS  = 'myvocab_categories';
  const REST_NS = 'myvocab/v1';

  public function __construct() {
  register_activation_hook(__FILE__, [$this, 'activate']);

  add_action('init', [$this, 'register_shortcodes']);
  add_action('wp_enqueue_scripts', [$this, 'register_assets']);
  add_action('rest_api_init', [$this, 'register_rest_routes']);
  add_action('plugins_loaded', [$this, 'maybe_upgrade']);
}

public function maybe_upgrade() {
  $stored = get_option('myvocab_version', '0.0.0');

  if (version_compare($stored, self::VERSION, '<')) {
    $this->ensure_tables(); // cria/atualiza tabelas/colunas com dbDelta
    update_option('myvocab_version', self::VERSION);
  }
}

  public function activate() {
    $this->ensure_tables();
  }

  private function ensure_tables() {
    global $wpdb;

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';

    $words = $wpdb->prefix . self::TABLE_WORDS;
    $cats  = $wpdb->prefix . self::TABLE_CATS;
    $charset = $wpdb->get_charset_collate();

    // Categorias
    $sqlCats = "CREATE TABLE $cats (
      id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT(20) UNSIGNED NOT NULL,
      name VARCHAR(80) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY user_id (user_id),
      KEY name (name)
    ) $charset;";

    // Palavras (agora com translation + category_id)
    $sqlWords = "CREATE TABLE $words (
      id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT(20) UNSIGNED NOT NULL,
      category_id BIGINT(20) UNSIGNED NULL,
      word VARCHAR(191) NOT NULL,
      translation VARCHAR(191) NULL,
      definition TEXT NULL,
      example TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY user_id (user_id),
      KEY category_id (category_id),
      KEY word (word)
    ) $charset;";

    $progress = $wpdb->prefix . 'myvocab_progress';

    $sqlProgress = "CREATE TABLE $progress (
      user_id BIGINT(20) UNSIGNED NOT NULL,
      xp INT NOT NULL DEFAULT 0,
      streak INT NOT NULL DEFAULT 0,
      best_streak INT NOT NULL DEFAULT 0,
      correct INT NOT NULL DEFAULT 0,
      wrong INT NOT NULL DEFAULT 0,
      last_play_date DATE NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id)
    ) $charset;";

    dbDelta($sqlProgress);


    dbDelta($sqlCats);
    dbDelta($sqlWords);
  }

  public function register_assets() {
  $css_path = plugin_dir_path(__FILE__) . 'assets/my-vocab.css';
  $js_path  = plugin_dir_path(__FILE__) . 'assets/my-vocab.js';

  wp_register_style(
    'myvocab-css',
    plugins_url('assets/my-vocab.css', __FILE__),
    [],
    file_exists($css_path) ? filemtime($css_path) : self::VERSION
  );

  wp_register_script(
    'myvocab-js',
    plugins_url('assets/my-vocab.js', __FILE__),
    [],
    file_exists($js_path) ? filemtime($js_path) : self::VERSION,
    true
  );

  // CORREÇÃO: Adicione a URL base do plugin
  wp_localize_script('myvocab-js', 'MyVocabConfig', [
    'restBase' => esc_url_raw(rest_url(self::REST_NS)),
    'nonce' => wp_create_nonce('wp_rest'),
    'pluginUrl' => plugin_dir_url(__FILE__) // Isso retorna a URL correta da pasta do plugin
  ]);
  
  // Phonemize
    wp_enqueue_script(
      'phonemize',
      'https://unpkg.com/phonemize@1.1.0/dist/phonemize.umd.js',
      [],
      '1.1.0',
      true
    );
}

  private function table_progress() { global $wpdb; return $wpdb->prefix . 'myvocab_progress'; }

  public function register_shortcodes() {
    add_shortcode('my_vocab', [$this, 'render_app']);
  }

  public function render_app($atts = []) {
    if (!is_user_logged_in()) {
      return '<div class="myvocab myvocab--locked">Você precisa estar logado para acessar seu vocabulário.</div>';
    }

    wp_enqueue_style('myvocab-css');
    wp_enqueue_script('myvocab-js');

    $rest_base = esc_url_raw(rest_url(self::REST_NS));
    $nonce = wp_create_nonce('wp_rest');

    wp_add_inline_script('myvocab-js', 'window.MyVocabConfig = ' . wp_json_encode([
      'restBase' => $rest_base,
      'nonce' => $nonce,
    ]) . ';', 'before');

    ob_start();
    ?>
      <div class="myvocab" id="myvocab-app">
        <aside class="myvocab__aside">
          <div class="myvocab__brand">
            <div class="myvocab__kicker">Student Dictionary</div>
            <div class="myvocab__title">My Vocabulary</div>
          </div>

          <nav class="myvocab__nav">
            <button class="myvocab__navBtn" data-tab="words">My Words</button>
            <button class="myvocab__navBtn" data-tab="categories">Categories</button>
            <button class="myvocab__navBtn" data-tab="import">Import</button>
            <button class="myvocab__navBtn" data-tab="practice">Practice</button>
          </nav>

          <div class="myvocab__asideFooter">
            <div class="myvocab__muted">Dica: use categorias para organizar por tema (Jobs, Food, Travel...).</div>
          </div>
        </aside>

        <main class="myvocab__main">
          <div class="myvocab__panel">
            <div class="myvocab__toast" aria-live="polite" style="display:none;"></div>

            <!-- Words tab -->
            <section class="myvocab__tab" data-tab-panel="words">
              <div class="myvocab__toolbar">
                <input class="myvocab__input" type="search" placeholder="Search..." data-role="search" />

                <select class="myvocab__select" data-role="catFilter">
                  <option value="">All categories</option>
                </select>

                <button class="myvocab__btn myvocab__btn--primary" data-action="openAdd">+ Add word</button>
              </div>

              <div class="myvocab__list" data-role="list">
                <div class="myvocab__skeleton">Loading...</div>
              </div>
            </section>

            <!-- Categories tab -->
            <section class="myvocab__tab" data-tab-panel="categories" style="display:none;">
              <div class="myvocab__card">
                <div class="myvocab__row myvocab__row--between">
                  <div>
                    <div class="myvocab__cardTitle">Categories</div>
                    <div class="myvocab__muted">Crie categorias para organizar seu vocabulário.</div>
                  </div>
                  <button class="myvocab__btn myvocab__btn--primary" data-action="openAddCat">+ New category</button>
                </div>

                <div class="myvocab__catList" data-role="catList">
                  <div class="myvocab__skeleton">Loading...</div>
                </div>
              </div>
            </section>

            <!-- Import tab -->
            <section class="myvocab__tab" data-tab-panel="import" style="display:none;">
              <div class="myvocab__card">
                <div class="myvocab__cardTitle">Paste your list</div>
                <p class="myvocab__muted">
                  One per line. Formats supported:
                  <br/>• <code>word - definition</code>
                  <br/>• <code>word;translation;definition;example</code>
                </p>

                <textarea class="myvocab__textarea" rows="9"
                  placeholder="reasonable;razoável;não muito caro;The rent is reasonable for this area.
check out;dar uma olhada;to look at something to see if it is good;Let's check out the apartment tomorrow."
                  data-role="paste"></textarea>

                <div class="myvocab__row">
                  <select class="myvocab__select" data-role="importCategory">
                    <option value="">(Optional) category for imported words</option>
                  </select>

                  <button class="myvocab__btn myvocab__btn--primary" data-action="importPaste">Import</button>
                  <span class="myvocab__muted" data-role="importResult"></span>
                </div>
              </div>
            </section>

            <!-- Practice tab -->
            <section class="myvocab__tab" data-tab-panel="practice" style="display:none;">
              <div class="myvocab__card">
                <div class="myvocab__row myvocab__row--between">
                  <div>
                    <div class="myvocab__cardTitle">Flashcards</div>
                    <div class="myvocab__muted">Shuffle automático. Use 🔊 para ouvir.</div>
                  </div>
                  <div class="myvocab__row">
                    <select class="myvocab__select" data-role="practiceCategory">
                      <option value="">All categories</option>
                    </select>
                    <button class="myvocab__btn" data-action="practiceReload">Reload</button>
                  </div>
                </div>

                <div class="myvocab__flash" data-role="flash">
                  <div class="myvocab__skeleton">Loading...</div>
                </div>
              </div>
            </section>

          </div>

          <!-- Modal Word -->
          <div class="myvocab__modal" data-role="modal" style="display:none;">
            <div class="myvocab__modalBackdrop" data-action="closeModal"></div>
            <div class="myvocab__modalBox" role="dialog" aria-modal="true">
              <div class="myvocab__modalHeader">
                <div class="myvocab__modalTitle" data-role="modalTitle">Add word</div>
                <button class="myvocab__iconBtn" data-action="closeModal" aria-label="Close">✕</button>
              </div>

              <div class="myvocab__modalBody">
                <label class="myvocab__label">Category</label>
                <select class="myvocab__select" data-role="formCat">
                  <option value="">No category</option>
                </select>

                <label class="myvocab__label">Word</label>
                <input class="myvocab__input" type="text" data-role="formWord" placeholder="reasonable" />

                <label class="myvocab__label">Translation (PT-BR)</label>
                <input class="myvocab__input" type="text" data-role="formTrans" placeholder="razoável" />

                <label class="myvocab__label">Definition (English)</label>
                <textarea class="myvocab__textarea" rows="3" data-role="formDef" placeholder="not too expensive; fair"></textarea>

                <label class="myvocab__label">Example</label>
                <textarea class="myvocab__textarea" rows="3" data-role="formEx" placeholder="The rent is reasonable for this area."></textarea>
              </div>

              <div class="myvocab__modalFooter">
                <button class="myvocab__btn" data-action="closeModal">Cancel</button>
                <button class="myvocab__btn myvocab__btn--primary" data-action="saveWord">Save</button>
              </div>
            </div>
          </div>

          <!-- Modal Category -->
          <div class="myvocab__modal" data-role="catModal" style="display:none;">
            <div class="myvocab__modalBackdrop" data-action="closeCatModal"></div>
            <div class="myvocab__modalBox" role="dialog" aria-modal="true">
              <div class="myvocab__modalHeader">
                <div class="myvocab__modalTitle" data-role="catModalTitle">New category</div>
                <button class="myvocab__iconBtn" data-action="closeCatModal" aria-label="Close">✕</button>
              </div>

              <div class="myvocab__modalBody">
                <label class="myvocab__label">Name</label>
                <input class="myvocab__input" type="text" data-role="catName" placeholder="Jobs and Occupations" />
              </div>

              <div class="myvocab__modalFooter">
                <button class="myvocab__btn" data-action="closeCatModal">Cancel</button>
                <button class="myvocab__btn myvocab__btn--primary" data-action="saveCategory">Save</button>
              </div>
            </div>
          </div>

        </main>
      </div>
    <?php
    return ob_get_clean();
  }

  public function register_rest_routes() {
    // WORDS
    register_rest_route(self::REST_NS, '/words', [
      [
        'methods' => WP_REST_Server::READABLE,
        'callback' => [$this, 'rest_list_words'],
        'permission_callback' => [$this, 'must_be_logged'],
      ],
      [
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => [$this, 'rest_create_word'],
        'permission_callback' => [$this, 'must_be_logged'],
      ],
    ]);

    register_rest_route(self::REST_NS, '/words/(?P<id>\d+)', [
      [
        'methods' => WP_REST_Server::EDITABLE,
        'callback' => [$this, 'rest_update_word'],
        'permission_callback' => [$this, 'must_be_logged'],
      ],
      [
        'methods' => WP_REST_Server::DELETABLE,
        'callback' => [$this, 'rest_delete_word'],
        'permission_callback' => [$this, 'must_be_logged'],
      ],
    ]);

    // CATEGORIES
    register_rest_route(self::REST_NS, '/categories', [
      [
        'methods' => WP_REST_Server::READABLE,
        'callback' => [$this, 'rest_list_categories'],
        'permission_callback' => [$this, 'must_be_logged'],
      ],
      [
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => [$this, 'rest_create_category'],
        'permission_callback' => [$this, 'must_be_logged'],
      ],
    ]);

    register_rest_route(self::REST_NS, '/categories/(?P<id>\d+)', [
      [
        'methods' => WP_REST_Server::EDITABLE,
        'callback' => [$this, 'rest_update_category'],
        'permission_callback' => [$this, 'must_be_logged'],
      ],
      [
        'methods' => WP_REST_Server::DELETABLE,
        'callback' => [$this, 'rest_delete_category'],
        'permission_callback' => [$this, 'must_be_logged'],
      ],
    ]);

    // IMPORT
    register_rest_route(self::REST_NS, '/import', [
      [
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => [$this, 'rest_import_paste'],
        'permission_callback' => [$this, 'must_be_logged'],
      ],
    ]);
    
    // CSV IMPORT (preview + commit)
    register_rest_route(self::REST_NS, '/import/csv/preview', [
      [
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => [$this, 'rest_import_csv_preview'],
        'permission_callback' => [$this, 'must_be_logged'],
      ],
    ]);
    
    register_rest_route(self::REST_NS, '/import/csv/commit', [
      [
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => [$this, 'rest_import_csv_commit'],
        'permission_callback' => [$this, 'must_be_logged'],
      ],
    ]);

    // GAME
    register_rest_route(self::REST_NS, '/game/state', [
      [
        'methods' => WP_REST_Server::READABLE,
        'callback' => [$this, 'rest_game_state'],
        'permission_callback' => [$this, 'must_be_logged'],
      ],
    ]);

    register_rest_route(self::REST_NS, '/game/next', [
      [
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => [$this, 'rest_game_next'],
        'permission_callback' => [$this, 'must_be_logged'],
      ],
    ]);

    register_rest_route(self::REST_NS, '/game/answer', [
      [
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => [$this, 'rest_game_answer'],
        'permission_callback' => [$this, 'must_be_logged'],
      ],
    ]);

    // GAME: deck (round)
    register_rest_route(self::REST_NS, '/game/deck', [
      [
        'methods'  => WP_REST_Server::CREATABLE,
        'callback' => [$this, 'rest_game_deck'],
        'permission_callback' => [$this, 'must_be_logged'],
      ],
    ]);

  }

  public function must_be_logged() { return is_user_logged_in(); }

  private function sanitize_text($s, $max = 2000) {
    $s = wp_strip_all_tags((string)$s);
    $s = preg_replace('/\s+/', ' ', $s);
    $s = trim($s);
    if (mb_strlen($s) > $max) $s = mb_substr($s, 0, $max);
    return $s;
  }

  public function rest_game_deck(WP_REST_Request $req) {
  global $wpdb;

  $user_id = get_current_user_id();
  $words = $this->table_words();

  $mode = $req->get_param('mode');
  $mode = ($mode === 'category') ? 'category' : 'random';

  $cat = $req->get_param('category_id');
  $cat = is_numeric($cat) ? (int)$cat : 0;

  $limit = $req->get_param('limit'); // "all" ou numero
  $limit_is_all = (is_string($limit) && strtolower($limit) === 'all');

  if (!$limit_is_all) {
    $limit = is_numeric($limit) ? (int)$limit : 10;
    // permite 10/20/30/50 e também números maiores, mas coloca teto
    $limit = max(1, min(200, $limit));
  }

  $where = "user_id=%d AND translation IS NOT NULL AND translation<>''";
  $params = [$user_id];

  if ($mode === 'category' && $cat > 0) {
    $where .= " AND category_id=%d";
    $params[] = $cat;
  }

  $sql = "SELECT id FROM $words WHERE $where ORDER BY RAND()";
  if (!$limit_is_all) {
    $sql .= " LIMIT $limit";
  }

  $ids = $wpdb->get_col($wpdb->prepare($sql, ...$params));

  if (!$ids) {
    return new WP_Error('no_words', 'No words found (need translation).', ['status' => 400]);
  }

  // ✅ BLINDAGEM: remove duplicatas e normaliza
  $ids = array_values(array_unique(array_map('intval', $ids)));

  // ✅ GARANTIA: respeita o limite final (caso venha algo inesperado)
  if (!$limit_is_all && count($ids) > $limit) {
    $ids = array_slice($ids, 0, $limit);
  }

  return new WP_REST_Response(['deck' => $ids], 200);
}



  private function table_words() { global $wpdb; return $wpdb->prefix . self::TABLE_WORDS; }
  private function table_cats()  { global $wpdb; return $wpdb->prefix . self::TABLE_CATS; }

  private function assert_owner($table, $id, $user_id) {
    global $wpdb;
    $row = $wpdb->get_row($wpdb->prepare("SELECT id, user_id FROM $table WHERE id=%d", $id), ARRAY_A);
    if (!$row) return new WP_Error('not_found', 'Item not found', ['status' => 404]);
    if ((int)$row['user_id'] !== (int)$user_id) return new WP_Error('forbidden', 'Forbidden', ['status' => 403]);
    return true;
  }

  // ---------- CATEGORIES ----------
  public function rest_list_categories(WP_REST_Request $req) {
    global $wpdb;
    $user_id = get_current_user_id();
    $cats = $this->table_cats();
    $rows = $wpdb->get_results(
      $wpdb->prepare("SELECT id, name, created_at, updated_at
                      FROM $cats
                      WHERE user_id=%d
                      ORDER BY name ASC
                      LIMIT 500", $user_id),
      ARRAY_A
    );
    return new WP_REST_Response(['items' => $rows], 200);
  }

  public function rest_create_category(WP_REST_Request $req) {
    global $wpdb;
    $user_id = get_current_user_id();
    $cats = $this->table_cats();
    $name = $this->sanitize_text($req->get_param('name') ?? '', 80);

    if ($name === '') return new WP_Error('bad_request', 'Name is required', ['status' => 400]);

    $exists = $wpdb->get_var($wpdb->prepare(
      "SELECT id FROM $cats WHERE user_id=%d AND LOWER(name)=LOWER(%s) LIMIT 1",
      $user_id, $name
    ));
    if ($exists) return new WP_Error('conflict', 'Category already exists', ['status' => 409]);

    $ok = $wpdb->insert($cats, ['user_id' => $user_id, 'name' => $name], ['%d','%s']);
    if (!$ok) return new WP_Error('db_error', 'Could not save category', ['status' => 500]);

    return new WP_REST_Response(['id' => (int)$wpdb->insert_id], 201);
  }

  public function rest_update_category(WP_REST_Request $req) {
    global $wpdb;
    $user_id = get_current_user_id();
    $cats = $this->table_cats();
    $id = (int)$req['id'];

    $owner = $this->assert_owner($cats, $id, $user_id);
    if (is_wp_error($owner)) return $owner;

    $name = $this->sanitize_text($req->get_param('name') ?? '', 80);
    if ($name === '') return new WP_Error('bad_request', 'Name is required', ['status' => 400]);

    $conflict = $wpdb->get_var($wpdb->prepare(
      "SELECT id FROM $cats WHERE user_id=%d AND LOWER(name)=LOWER(%s) AND id<>%d LIMIT 1",
      $user_id, $name, $id
    ));
    if ($conflict) return new WP_Error('conflict', 'Another category already has this name', ['status' => 409]);

    $ok = $wpdb->update($cats, ['name' => $name], ['id' => $id], ['%s'], ['%d']);
    if ($ok === false) return new WP_Error('db_error', 'Could not update category', ['status' => 500]);

    return new WP_REST_Response(['ok' => true], 200);
  }

  public function rest_delete_category(WP_REST_Request $req) {
    global $wpdb;
    $user_id = get_current_user_id();
    $cats = $this->table_cats();
    $words = $this->table_words();
    $id = (int)$req['id'];

    $owner = $this->assert_owner($cats, $id, $user_id);
    if (is_wp_error($owner)) return $owner;

    // Desvincula palavras da categoria
    $wpdb->query($wpdb->prepare("UPDATE $words SET category_id=NULL WHERE user_id=%d AND category_id=%d", $user_id, $id));

    $ok = $wpdb->delete($cats, ['id' => $id], ['%d']);
    if (!$ok) return new WP_Error('db_error', 'Could not delete category', ['status' => 500]);

    return new WP_REST_Response(['ok' => true], 200);
  }

  // ---------- WORDS ----------
  public function rest_list_words(WP_REST_Request $req) {
    global $wpdb;
    $user_id = get_current_user_id();
    $words = $this->table_words();

    $q = $this->sanitize_text($req->get_param('q') ?? '', 120);
    $cat = $req->get_param('category_id');
    $cat = is_numeric($cat) ? (int)$cat : 0;

    $where = "user_id=%d";
    $params = [$user_id];

    if ($cat > 0) {
      $where .= " AND category_id=%d";
      $params[] = $cat;
    }

    if ($q !== '') {
      $like = '%' . $wpdb->esc_like($q) . '%';
      $where .= " AND (word LIKE %s OR definition LIKE %s OR translation LIKE %s)";
      $params[] = $like;
      $params[] = $like;
      $params[] = $like;
    }

    $sql = "SELECT id, category_id, word, translation, definition, example, created_at, updated_at
            FROM $words
            WHERE $where
            ORDER BY updated_at DESC
            LIMIT 500";

    $rows = $wpdb->get_results($wpdb->prepare($sql, ...$params), ARRAY_A);

    return new WP_REST_Response(['items' => $rows], 200);
  }

  public function rest_create_word(WP_REST_Request $req) {
    global $wpdb;
    $user_id = get_current_user_id();
    $words = $this->table_words();

    $word = $this->sanitize_text($req->get_param('word') ?? '', 191);
    $translation = $this->sanitize_text($req->get_param('translation') ?? '', 191);
    $def  = $this->sanitize_text($req->get_param('definition') ?? '', 2000);
    $ex   = $this->sanitize_text($req->get_param('example') ?? '', 2000);

    $cat = $req->get_param('category_id');
    $cat = is_numeric($cat) ? (int)$cat : 0;
    if ($cat <= 0) $cat = null;

    if ($word === '') return new WP_Error('bad_request', 'Word is required', ['status' => 400]);

    $exists = $wpdb->get_var($wpdb->prepare(
      "SELECT id FROM $words WHERE user_id=%d AND LOWER(word)=LOWER(%s) LIMIT 1",
      $user_id, $word
    ));
    if ($exists) return new WP_Error('conflict', 'Word already exists', ['status' => 409]);

    $ok = $wpdb->insert($words, [
      'user_id' => $user_id,
      'category_id' => $cat,
      'word' => $word,
      'translation' => $translation,
      'definition' => $def,
      'example' => $ex,
    ], ['%d','%d','%s','%s','%s','%s']);

    if (!$ok) return new WP_Error('db_error', 'Could not save', ['status' => 500]);

    return new WP_REST_Response(['id' => (int)$wpdb->insert_id], 201);
  }

  public function rest_update_word(WP_REST_Request $req) {
    global $wpdb;
    $user_id = get_current_user_id();
    $words = $this->table_words();
    $id = (int)$req['id'];

    $owner = $this->assert_owner($words, $id, $user_id);
    if (is_wp_error($owner)) return $owner;

    $word = $this->sanitize_text($req->get_param('word') ?? '', 191);
    $translation = $this->sanitize_text($req->get_param('translation') ?? '', 191);
    $def  = $this->sanitize_text($req->get_param('definition') ?? '', 2000);
    $ex   = $this->sanitize_text($req->get_param('example') ?? '', 2000);

    $cat = $req->get_param('category_id');
    $cat = is_numeric($cat) ? (int)$cat : 0;
    if ($cat <= 0) $cat = null;

    if ($word === '') return new WP_Error('bad_request', 'Word is required', ['status' => 400]);

    $conflict = $wpdb->get_var($wpdb->prepare(
      "SELECT id FROM $words WHERE user_id=%d AND LOWER(word)=LOWER(%s) AND id<>%d LIMIT 1",
      $user_id, $word, $id
    ));
    if ($conflict) return new WP_Error('conflict', 'Another item already has this word', ['status' => 409]);

    $ok = $wpdb->update($words, [
      'category_id' => $cat,
      'word' => $word,
      'translation' => $translation,
      'definition' => $def,
      'example' => $ex,
    ], ['id' => $id], ['%d','%s','%s','%s','%s'], ['%d']);

    if ($ok === false) return new WP_Error('db_error', 'Could not update', ['status' => 500]);

    return new WP_REST_Response(['ok' => true], 200);
  }

  public function rest_delete_word(WP_REST_Request $req) {
    global $wpdb;
    $user_id = get_current_user_id();
    $words = $this->table_words();
    $id = (int)$req['id'];

    $owner = $this->assert_owner($words, $id, $user_id);
    if (is_wp_error($owner)) return $owner;

    $ok = $wpdb->delete($words, ['id' => $id], ['%d']);
    if (!$ok) return new WP_Error('db_error', 'Could not delete', ['status' => 500]);

    return new WP_REST_Response(['ok' => true], 200);
  }

  // ---------- IMPORT ----------
  public function rest_import_paste(WP_REST_Request $req) {
    global $wpdb;
    $user_id = get_current_user_id();
    $words = $this->table_words();

    $raw = trim((string)($req->get_param('text') ?? ''));
    if ($raw === '') return new WP_Error('bad_request', 'Text is required', ['status' => 400]);

    $cat = $req->get_param('category_id');
    $cat = is_numeric($cat) ? (int)$cat : 0;
    if ($cat <= 0) $cat = null;

    $lines = preg_split("/\r\n|\n|\r/", $raw);
    $imported = 0;
    $skipped = 0;

    foreach ($lines as $line) {
      $line = trim($line);
      if ($line === '') continue;

      $word = ''; $translation = ''; $def = ''; $ex = '';

      // word;translation;definition;example
      if (strpos($line, ';') !== false) {
        $parts = array_map('trim', explode(';', $line));
        $word = $parts[0] ?? '';
        $translation = $parts[1] ?? '';
        $def = $parts[2] ?? '';
        $ex  = $parts[3] ?? '';
      }
      // word - definition
      else if (strpos($line, ' - ') !== false) {
        [$w, $d] = array_map('trim', explode(' - ', $line, 2));
        $word = $w;
        $def = $d;
      } else {
        $word = $line;
      }

      $word = $this->sanitize_text($word, 191);
      $translation = $this->sanitize_text($translation, 191);
      $def  = $this->sanitize_text($def, 2000);
      $ex   = $this->sanitize_text($ex, 2000);

      if ($word === '') { $skipped++; continue; }

      $exists = $wpdb->get_var($wpdb->prepare(
        "SELECT id FROM $words WHERE user_id=%d AND LOWER(word)=LOWER(%s) LIMIT 1",
        $user_id, $word
      ));
      if ($exists) { $skipped++; continue; }

      $ok = $wpdb->insert($words, [
        'user_id' => $user_id,
        'category_id' => $cat,
        'word' => $word,
        'translation' => $translation,
        'definition' => $def,
        'example' => $ex,
      ], ['%d','%d','%s','%s','%s','%s']);

      if ($ok) $imported++;
      else $skipped++;
    }

    return new WP_REST_Response(['imported' => $imported, 'skipped' => $skipped], 200);
  }
  
  private function get_existing_categories_by_names($user_id, $namesLower) {
  global $wpdb;
  $cats = $this->table_cats();
  if (!$namesLower) return [];

  // Monta IN com placeholders
  $placeholders = implode(',', array_fill(0, count($namesLower), '%s'));
  $params = array_merge([$user_id], $namesLower);

  $sql = "SELECT id, name
          FROM $cats
          WHERE user_id=%d AND LOWER(name) IN ($placeholders)";
  $rows = $wpdb->get_results($wpdb->prepare($sql, ...$params), ARRAY_A);

  $map = [];
  foreach ($rows as $r) {
    $map[mb_strtolower($r['name'])] = $r;
  }
  return $map;
}

private function find_word_duplicates($user_id, $wordsLower) {
  global $wpdb;
  $words = $this->table_words();
  if (!$wordsLower) return [];

  $placeholders = implode(',', array_fill(0, count($wordsLower), '%s'));
  $params = array_merge([$user_id], $wordsLower);

  $sql = "SELECT id, category_id, word, translation, definition, example, updated_at
          FROM $words
          WHERE user_id=%d AND LOWER(word) IN ($placeholders)
          ORDER BY updated_at DESC";
  $rows = $wpdb->get_results($wpdb->prepare($sql, ...$params), ARRAY_A);

  $map = [];
  foreach ($rows as $r) {
    $k = mb_strtolower($r['word']);
    if (!isset($map[$k])) $map[$k] = [];
    $map[$k][] = $r;
  }
  return $map;
}

/**
 * Preview:
 * input: { rows: [{word,translation,definition,example,category}] }
 * output: categories_status + rows with duplicate info
 */
public function rest_import_csv_preview(WP_REST_Request $req) {
  global $wpdb;

  $user_id = get_current_user_id();
  $rows = $req->get_param('rows');

  if (!is_array($rows) || count($rows) === 0) {
    return new WP_Error('bad_request', 'Rows are required', ['status' => 400]);
  }

  // Sanitize rows
  $clean = [];
  $catNames = [];
  $wordsLower = [];

  foreach ($rows as $i => $r) {
    $word = $this->sanitize_text($r['word'] ?? '', 191);
    if ($word === '') continue;

    $translation = $this->sanitize_text($r['translation'] ?? '', 191);
    $definition  = $this->sanitize_text($r['definition'] ?? '', 2000);
    $example     = $this->sanitize_text($r['example'] ?? '', 2000);
    $category    = $this->sanitize_text($r['category'] ?? '', 80);

    $clean[] = [
      'index' => (int)$i,
      'word' => $word,
      'translation' => $translation,
      'definition' => $definition,
      'example' => $example,
      'category' => $category,
    ];

    if ($category !== '') $catNames[] = mb_strtolower($category);
    $wordsLower[] = mb_strtolower($word);
  }

  // Unique
  $catNames = array_values(array_unique($catNames));
  $wordsLower = array_values(array_unique($wordsLower));

  // Existing cats/words
  $existingCats = $this->get_existing_categories_by_names($user_id, $catNames);
  $dups = $this->find_word_duplicates($user_id, $wordsLower);

  // Build categories status
  $catStatus = [];
  foreach ($catNames as $cLower) {
    if (isset($existingCats[$cLower])) {
      $catStatus[] = [
        'name' => $existingCats[$cLower]['name'],
        'status' => 'exists',
        'existing_id' => (int)$existingCats[$cLower]['id'],
      ];
    } else {
      // name original? vamos achar a primeira ocorrência
      $orig = '';
      foreach ($clean as $cr) {
        if (mb_strtolower($cr['category']) === $cLower) { $orig = $cr['category']; break; }
      }
      $catStatus[] = [
        'name' => $orig ?: $cLower,
        'status' => 'new',
        'existing_id' => null,
      ];
    }
  }

  // Attach duplicates info per row
  $outRows = [];
  foreach ($clean as $r) {
    $k = mb_strtolower($r['word']);
    $dupList = $dups[$k] ?? [];
    $outRows[] = [
      'index' => $r['index'],
      'word' => $r['word'],
      'translation' => $r['translation'],
      'definition' => $r['definition'],
      'example' => $r['example'],
      'category' => $r['category'],
      'is_duplicate_word' => count($dupList) > 0,
      'duplicates' => array_map(function($d){
        return [
          'id' => (int)$d['id'],
          'category_id' => $d['category_id'] ? (int)$d['category_id'] : null,
          'word' => $d['word'],
          'translation' => $d['translation'],
          'definition' => $d['definition'],
          'example' => $d['example'],
          'updated_at' => $d['updated_at'],
        ];
      }, $dupList),
    ];
  }

  return new WP_REST_Response([
    'categories' => $catStatus,
    'rows' => $outRows,
  ], 200);
}

/**
 * Commit:
 * input:
 * {
 *   rows: [{index, word, translation, definition, example, category}],
 *   category_resolution: { "<categoryName>": { action:"use"|"new", new_name?: "..." } },
 *   row_resolution: { "<rowIndex>": { action:"replace"|"keep"|"skip", target_id?: 123 } }
 * }
 */
    public function rest_import_csv_commit(WP_REST_Request $req) {
      global $wpdb;
    
      $user_id = get_current_user_id();
      $rows = $req->get_param('rows');
      $catRes = $req->get_param('category_resolution');
      $rowRes = $req->get_param('row_resolution');
    
      if (!is_array($rows) || count($rows) === 0) {
        return new WP_Error('bad_request', 'Rows are required', ['status' => 400]);
      }
      if (!is_array($catRes)) $catRes = [];
      if (!is_array($rowRes)) $rowRes = [];
    
      $catsTable = $this->table_cats();
      $wordsTable = $this->table_words();
    
      // 1) Resolve categories (map nameLower -> id)
      // Busca existentes por nomes presentes no arquivo
      $catNamesLower = [];
      foreach ($rows as $r) {
        $c = $this->sanitize_text($r['category'] ?? '', 80);
        if ($c !== '') $catNamesLower[] = mb_strtolower($c);
      }
      $catNamesLower = array_values(array_unique($catNamesLower));
      $existingCats = $this->get_existing_categories_by_names($user_id, $catNamesLower);
    
      $catMap = []; // lower(nameFromCSV) -> category_id|null
      foreach ($catNamesLower as $cLower) {
        $origName = $existingCats[$cLower]['name'] ?? null; // se existir, tem o nome “real”
        // encontra o nome original do CSV
        $csvName = '';
        foreach ($rows as $rr) {
          if (mb_strtolower($this->sanitize_text($rr['category'] ?? '', 80)) === $cLower) {
            $csvName = $this->sanitize_text($rr['category'] ?? '', 80);
            break;
          }
        }
    
        $choice = $catRes[$csvName] ?? $catRes[$origName] ?? null;
        // padrão: se existe, usa; se não existe, cria
        $action = $choice['action'] ?? (isset($existingCats[$cLower]) ? 'use' : 'new');
        $newName = $this->sanitize_text($choice['new_name'] ?? $csvName, 80);
    
        if ($action === 'use' && isset($existingCats[$cLower])) {
          $catMap[$cLower] = (int)$existingCats[$cLower]['id'];
          continue;
        }
    
        if ($action === 'new') {
          // se já existe e usuário quer “manter as duas”, criamos com sufixo se precisar
          if ($newName === '') $newName = $csvName ?: $cLower;
    
          // se conflitar com existente por nome, cria sufixo automático
          $base = $newName;
          $try = $base;
          $n = 2;
          while (true) {
            $conf = $wpdb->get_var($wpdb->prepare(
              "SELECT id FROM $catsTable WHERE user_id=%d AND LOWER(name)=LOWER(%s) LIMIT 1",
              $user_id, $try
            ));
            if (!$conf) break;
            $try = $base . " ($n)";
            $n++;
            if ($n > 50) break;
          }
    
          $ok = $wpdb->insert($catsTable, [
            'user_id' => $user_id,
            'name' => $try,
          ], ['%d','%s']);
    
          if ($ok) {
            $catMap[$cLower] = (int)$wpdb->insert_id;
          } else {
            // fallback: sem categoria
            $catMap[$cLower] = null;
          }
          continue;
        }
    
        // action use, mas não existe -> sem categoria
        $catMap[$cLower] = null;
      }
    
      // 2) Apply rows with resolution
      $imported = 0;
      $replaced = 0;
      $skipped = 0;
      $kept_dupes = 0;
    
      foreach ($rows as $r) {
        $index = (int)($r['index'] ?? -1);
        $word = $this->sanitize_text($r['word'] ?? '', 191);
        if ($word === '') { $skipped++; continue; }
    
        $translation = $this->sanitize_text($r['translation'] ?? '', 191);
        $definition  = $this->sanitize_text($r['definition'] ?? '', 2000);
        $example     = $this->sanitize_text($r['example'] ?? '', 2000);
        $category    = $this->sanitize_text($r['category'] ?? '', 80);
    
        $category_id = null;
        if ($category !== '') {
          $category_id = $catMap[mb_strtolower($category)] ?? null;
        }
    
        $decision = $rowRes[(string)$index] ?? [];
        $action = $decision['action'] ?? 'keep'; // default: keep
    
        if ($action === 'skip') { $skipped++; continue; }
    
        // Verifica duplicata no banco (mais seguro no commit)
        $existing = $wpdb->get_row($wpdb->prepare(
          "SELECT id FROM $wordsTable WHERE user_id=%d AND LOWER(word)=LOWER(%s) ORDER BY updated_at DESC LIMIT 1",
          $user_id, $word
        ), ARRAY_A);
    
        if ($existing && $action === 'replace') {
          $target_id = isset($decision['target_id']) && is_numeric($decision['target_id'])
            ? (int)$decision['target_id']
            : (int)$existing['id'];
    
          // Atualiza (overwrite)
          $ok = $wpdb->update($wordsTable, [
            'category_id' => $category_id,
            'word' => $word,
            'translation' => $translation,
            'definition' => $definition,
            'example' => $example,
          ], ['id' => $target_id], ['%d','%s','%s','%s','%s'], ['%d']);
    
          if ($ok !== false) $replaced++;
          else $skipped++;
          continue;
        }
    
        // keep: inserir mesmo duplicado (ou normal)
        $ok = $wpdb->insert($wordsTable, [
          'user_id' => $user_id,
          'category_id' => $category_id,
          'word' => $word,
          'translation' => $translation,
          'definition' => $definition,
          'example' => $example,
        ], ['%d','%d','%s','%s','%s','%s']);
    
        if ($ok) {
          $imported++;
          if ($existing) $kept_dupes++;
        } else {
          $skipped++;
        }
      }
    
      return new WP_REST_Response([
        'imported' => $imported,
        'replaced' => $replaced,
        'kept_duplicates' => $kept_dupes,
        'skipped' => $skipped,
      ], 200);
    }

    public function rest_game_state(WP_REST_Request $req) {
  global $wpdb;
  $user_id = get_current_user_id();
  $p = $this->table_progress();

  $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM $p WHERE user_id=%d", $user_id), ARRAY_A);

  if (!$row) {
    $wpdb->insert($p, ['user_id' => $user_id], ['%d']);
    $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM $p WHERE user_id=%d", $user_id), ARRAY_A);
  }

  return new WP_REST_Response(['state' => $row], 200);
}

public function rest_game_next(WP_REST_Request $req) {
  global $wpdb;
  $user_id = get_current_user_id();
  $words = $this->table_words();

  $cat = $req->get_param('category_id');
  $cat = is_numeric($cat) ? (int)$cat : 0;

  // pega candidatos (precisa ter translation)
  $where = "user_id=%d AND translation IS NOT NULL AND translation<>''";
  $params = [$user_id];

  if ($cat > 0) {
    $where .= " AND category_id=%d";
    $params[] = $cat;
  }

  // pega 1 palavra aleatória
  $sqlOne = "SELECT id, word, translation FROM $words WHERE $where ORDER BY RAND() LIMIT 1";
  $one = $wpdb->get_row($wpdb->prepare($sqlOne, ...$params), ARRAY_A);

  if (!$one) {
    return new WP_Error('no_words', 'Add words with translation to play this game.', ['status' => 400]);
  }

  // pega 3 traduções erradas (distractors)
  $sqlWrong = "SELECT DISTINCT translation
               FROM $words
               WHERE $where AND id<>%d
               ORDER BY RAND()
               LIMIT 3";

  $wrong = $wpdb->get_col($wpdb->prepare($sqlWrong, ...array_merge($params, [(int)$one['id']])));

  // se não tiver 3, completa com qualquer coisa do usuário (mesmo fora do filtro)
  if (count($wrong) < 3) {
    $more = $wpdb->get_col($wpdb->prepare(
      "SELECT DISTINCT translation FROM $words
       WHERE user_id=%d AND translation IS NOT NULL AND translation<>'' AND id<>%d
       ORDER BY RAND() LIMIT %d",
      $user_id, (int)$one['id'], (3 - count($wrong))
    ));
    $wrong = array_values(array_unique(array_merge($wrong, $more)));
  }

  // monta opções e embaralha
  $options = array_values(array_unique(array_merge([$one['translation']], $wrong)));
  while (count($options) < 4) $options[] = $one['translation']; // fallback extremo
  $options = array_slice($options, 0, 4);
  shuffle($options);

  // retorna question sem revelar resposta (usa answer_token simples: id)
  return new WP_REST_Response([
    'question' => [
      'word_id' => (int)$one['id'],
      'word' => $one['word'],
      'options' => $options,
    ]
  ], 200);
}

  public function rest_game_answer(WP_REST_Request $req) {
    global $wpdb;
    $user_id = get_current_user_id();
    $words = $this->table_words();
    $p = $this->table_progress();

    $word_id = (int)($req->get_param('word_id') ?? 0);
    $choice = $this->sanitize_text($req->get_param('choice') ?? '', 191);

    if ($word_id <= 0 || $choice === '') {
      return new WP_Error('bad_request', 'word_id and choice are required', ['status' => 400]);
    }

    // pega resposta correta do word_id garantindo ownership
    $row = $wpdb->get_row($wpdb->prepare(
      "SELECT id, translation FROM $words WHERE id=%d AND user_id=%d LIMIT 1",
      $word_id, $user_id
    ), ARRAY_A);

    if (!$row) return new WP_Error('not_found', 'Word not found', ['status' => 404]);

    $correct = (mb_strtolower(trim($choice)) === mb_strtolower(trim($row['translation'])));

    // garante state
    $state = $wpdb->get_row($wpdb->prepare("SELECT * FROM $p WHERE user_id=%d", $user_id), ARRAY_A);
    if (!$state) {
      $wpdb->insert($p, ['user_id' => $user_id], ['%d']);
      $state = $wpdb->get_row($wpdb->prepare("SELECT * FROM $p WHERE user_id=%d", $user_id), ARRAY_A);
    }

    $today = current_time('Y-m-d');
    $last = $state['last_play_date'];

    // streak: se hoje já jogou, mantém lógica
    $streak = (int)$state['streak'];
    if ($last === null || $last === '') {
      $streak = 0;
    } else {
      // diferença em dias
      $d1 = new DateTime($last);
      $d2 = new DateTime($today);
      $diff = (int)$d1->diff($d2)->format('%r%a');
      if ($diff >= 2) $streak = 0; // quebrou
    }

    // XP rules
    // acerto: +10 XP, erro: +0 (por enquanto)
    // streak incrementa apenas em acerto
    $xp = (int)$state['xp'];
    $best = (int)$state['best_streak'];
    $correctCount = (int)$state['correct'];
    $wrongCount = (int)$state['wrong'];

    if ($correct) {
      $xp += 10;
      $correctCount += 1;
      $streak += 1;
      if ($streak > $best) $best = $streak;
    } else {
      $wrongCount += 1;
      // erro quebra streak? (mais gamificado)
      $streak = 0;
    }

    $wpdb->update($p, [
      'xp' => $xp,
      'streak' => $streak,
      'best_streak' => $best,
      'correct' => $correctCount,
      'wrong' => $wrongCount,
      'last_play_date' => $today,
    ], ['user_id' => $user_id], ['%d','%d','%d','%d','%d','%s'], ['%d']);

    return new WP_REST_Response([
      'result' => [
        'is_correct' => $correct,
        'correct_translation' => $row['translation'],
        'xp' => $xp,
        'streak' => $streak,
        'best_streak' => $best,
        'correct' => $correctCount,
        'wrong' => $wrongCount,
      ]
    ], 200);
  }


}

new MyVocabPlugin();
