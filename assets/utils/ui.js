(function() {
  MyVocab.utils.ui = {
    toast(msg) {
      const box = document.querySelector('.myvocab__toast');
      if (!box) return;
      box.textContent = msg;
      box.style.display = '';
      box.classList.add('is-show');
      setTimeout(() => {
        box.classList.remove('is-show');
        setTimeout(() => (box.style.display = 'none'), 200);
      }, 1700);
    },

    escapeHtml(s) {
      return String(s ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    },

    fillCategorySelects(app) {
      const cats = app.__cats || [];
      const selects = [
        document.querySelector('[data-role="catFilter"]'),
        document.querySelector('[data-role="formCat"]'),
        document.querySelector('[data-role="importCategory"]'),
        document.querySelector('[data-role="practiceCategory"]'),
      ].filter(Boolean);

      selects.forEach(sel => {
        const current = sel.value;
        const role = sel.getAttribute('data-role');
        const isFilter = role === 'catFilter' || role === 'practiceCategory';

        sel.innerHTML = isFilter
          ? `<option value="">All categories</option>`
          : `<option value="">No category</option>`;

        cats.forEach(c => {
          const opt = document.createElement('option');
          opt.value = String(c.id);
          opt.textContent = c.name;
          sel.appendChild(opt);
        });

        if (current && cats.some(c => String(c.id) === String(current))) sel.value = current;
      });
    }
  };
})();
