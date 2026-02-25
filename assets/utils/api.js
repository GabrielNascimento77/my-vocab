(function() {
  MyVocab.utils.api = function(path, opts = {}) {
    const headers = Object.assign({
      'Content-Type': 'application/json',
      'X-WP-Nonce': MyVocab.config.nonce,
    }, opts.headers || {});
    
    return fetch(MyVocab.config.restBase + path, Object.assign({}, opts, {
      headers,
      credentials: 'include'
    })).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.message || data?.error || 'Request failed');
      return data;
    });
  };
})();
