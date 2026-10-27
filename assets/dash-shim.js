// Minimal data runtime for the standalone site.
// Loads the CSVs, runs the registered calculations in order, and redraws the page
// whenever data, filters or the window width change.
(() => {
  const DATASETS = {
    pl: 'data/store_monthly_pl.csv',
    daily: 'data/daily_sales.csv',
    products: 'data/product_catalogue.csv',
  };
  const DEFAULT_PARAMS = { scope: 'All', theme: 'auto' };

  const store = {};      // id -> {status, data, message}
  const calcs = [];      // [{id, inputs, fn}]
  const listeners = [];
  let params = { ...DEFAULT_PARAMS };
  try {
    const saved = localStorage.getItem('sunrise-theme');
    if (saved) params.theme = saved;
  } catch (e) { /* storage unavailable */ }

  const run = () => listeners.forEach((fn) => {
    try { fn(); } catch (e) { console.error(e); }
  });

  const computeCalcs = () => {
    for (const c of calcs) {
      const inputs = c.inputs.map((id) => store[id]);
      if (inputs.every((s) => s && s.status === 'ok')) {
        try { store[c.id] = { status: 'ok', data: c.fn(...inputs.map((s) => s.data)) }; }
        catch (e) { console.error('calc ' + c.id, e); store[c.id] = { status: 'error', data: [], message: String(e) }; }
      } else if (inputs.some((s) => s && s.status === 'error')) {
        store[c.id] = { status: 'error', data: [] };
      }
    }
  };

  window.dash = {
    colors: ['var(--sc-green)', 'var(--sc-orange)', 'var(--sc-blue)', 'var(--sc-yellow)', 'var(--sc-red)', '#8b5cf6', '#14b8a6', '#64748b'],
    data: (id) => store[id] || { status: 'loading', data: [] },
    calc: (id, def) => { calcs.push({ id, inputs: def.inputs, fn: def.fn }); store[id] = { status: 'loading', data: [] }; },
    onData: (fn) => { listeners.push(fn); fn(); },
    params: () => ({ ...params }),
    setParams: (p) => {
      params = { ...params, ...p };
      if (p.theme) { try { localStorage.setItem('sunrise-theme', p.theme); } catch (e) { /* ignore */ } }
      run();
    },
    resetParams: () => { params = { ...DEFAULT_PARAMS }; run(); },
    setLink: (name) => { try { history.replaceState(null, '', '#' + name); } catch (e) { /* ignore */ } },
    refresh: () => {},
  };

  for (const id of Object.keys(DATASETS)) store[id] = { status: 'loading', data: [] };
  Promise.all(Object.entries(DATASETS).map(([id, url]) =>
    d3.csv(url).then(
      (rows) => { store[id] = { status: 'ok', data: rows }; },
      (err) => { store[id] = { status: 'error', data: [], message: String(err) }; },
    ),
  )).then(() => {
    // calcs are registered by later scripts; wait until they have run
    const go = () => { computeCalcs(); run(); };
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
  });

  let w = window.innerWidth;
  window.addEventListener('resize', () => {
    if (Math.abs(window.innerWidth - w) < 8) return;
    w = window.innerWidth;
    clearTimeout(window.__scResize);
    window.__scResize = setTimeout(run, 120);
  });
})();
