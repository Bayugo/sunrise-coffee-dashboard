(() => {
  const SC = window.SC;
  const f1 = d3.format('.1f'), f2 = d3.format('.2f'), fc = d3.format(',');
  const pct = (v) => f1(v) + '%';
  const pts = (v) => (v > 0 ? '+' : v < 0 ? '-' : '±') + f1(Math.abs(v)) + ' pts';
  const sgn = (v) => (v > 0 ? '+' : v < 0 ? '-' : '±') + f1(Math.abs(v)) + '%';
  const gbpM = (v) => '£' + f2(v) + 'M';
  const gbpK = (v) => '£' + fc(v) + 'k';
  const gbpMr = (v) => '£' + f2(v / 1e6) + 'M';
  const gbpKr = (v) => '£' + fc(Math.round(v / 1e3)) + 'k';
  const gbp = (v) => '£' + fc(v);
  const gbp2 = (v) => '£' + f2(v);
  const W = (o) => Object.entries(o).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  const MUTED = 'var(--cds-chart-muted)', BAD = 'var(--sc-red)', A = 'var(--sc-green)';
  const PAL = ['var(--sc-green)', 'var(--sc-orange)', 'var(--sc-blue)', 'var(--sc-yellow)'];
  const FLAG = { Review: 'var(--sc-red)', Watch: 'var(--sc-orange)', Healthy: 'var(--sc-green)' };

  const $ = (id) => document.getElementById(id);
  const put = (id, text, source, field, where) => {
    const el = $(id); if (!el) return;
    el.textContent = text; el.dataset.source = source; el.dataset.field = field;
    if (where) el.dataset.where = where; else delete el.dataset.where;
    el.classList.remove('dash-skeleton');
  };
  const blank = (id) => { const el = $(id); if (el) el.textContent = '—'; };
  const tone = (id, v, goodWhenUp = true) => {
    const el = $(id); if (!el) return;
    el.classList.remove('sc-good', 'sc-bad', 'sc-flat');
    el.classList.add(Math.abs(v) < 0.05 ? 'sc-flat' : (v > 0) === goodWhenUp ? 'sc-good' : 'sc-bad');
  };
  const failed = (el) => {
    el.classList.remove('dash-skeleton'); el.replaceChildren();
    const d = document.createElement('div'); d.className = 'sc-fail';
    d.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:6px;min-height:inherit;color:var(--color-fg-muted);font-size:var(--cds-font-size-caption)';
    const dot = document.createElement('span'); dot.style.cssText = 'width:.375rem;height:.375rem;border-radius:50%;background:var(--color-bad)';
    d.append(dot, 'Failed to load'); el.appendChild(d);
  };
  const ready = (ids) => ids.every((id) => dash.data(id).status === 'ok');
  const anyErr = (ids) => ids.some((id) => ['error', 'missing'].includes(dash.data(id).status));
  const chart = (id, deps, draw) => {
    const el = $(id); if (!el) return;
    if (ready(deps)) { el.classList.remove('dash-skeleton'); draw(el); }
    else if (anyErr(deps)) failed(el);
    else { el.replaceChildren(); el.classList.add('dash-skeleton'); }
  };


  // ---------- scope filter ----------
  if (dash.params().scope == null) dash.setParams({ scope: 'All' });
  const scope = () => dash.params().scope || 'All';
  const sel = $('scope');
  sel.addEventListener('change', () => dash.setParams({ scope: sel.value }));
  const scopeName = (s) => (s === 'All' ? 'The estate' : SC.label(s) + (formats.has(s) ? ' stores' : ''));
  let formats = new Set();
  const inScope = (r) => scope() === 'All' || r.store_format === scope() || r.region === scope();

  const drawScope = () => {
    const k = dash.data('pl_kpi'), s = dash.data('stores');
    if (k.status !== 'ok' || s.status !== 'ok') return;
    formats = new Set(s.data.map((r) => r.store_format));
    const regions = [...new Set(s.data.map((r) => r.region))].sort();
    const opts = [new Option('Whole estate', 'All')];
    const gf = document.createElement('optgroup'); gf.label = 'Store format';
    [...formats].sort().forEach((f) => gf.appendChild(new Option(SC.label(f), f)));
    const gr = document.createElement('optgroup'); gr.label = 'Region';
    regions.forEach((r) => gr.appendChild(new Option(SC.label(r), r)));
    sel.replaceChildren(...opts, gf, gr);
    sel.value = scope();
    document.querySelectorAll('.sc-scope-name').forEach((e) => { e.textContent = scopeName(scope()); });
  };

  // ---------- tabs ----------
  const tabs = [...document.querySelectorAll('.sc-tab')];
  let current = 'overview';
  let sortKey = 'margin_pct', sortDir = 1;
  const show = (name) => {
    current = name;
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    document.querySelectorAll('.sc-page').forEach((p) => { p.hidden = p.dataset.page !== name; });
    dash.setLink(name);
    render();
  };
  tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.tab)));
  document.querySelectorAll('.sc-chip[data-go]').forEach((b) => b.addEventListener('click', () => show(b.dataset.go)));
  $('cta-review').addEventListener('click', () => { sortKey = 'margin_pct'; sortDir = 1; show('stores'); const t = $('card-storetable'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); });

  // ---------- header + overview ----------
  const drawHeader = () => {
    const ids = ['lede-profit', 'lede-rev', 'lede-margin', 'lede-mchg', 'lede-loss', 'k-rev', 'k-np', 'k-m', 'k-loss', 'k-mem', 'k-rev-d', 'k-np-d', 'k-m-d', 'k-loss-d', 'k-mem-d'];
    if (!ready(['pl_kpi', 'kpi_delta'])) { ids.forEach(blank); return; }
    const sc = scope();
    const w24 = W({ scope: sc, year: '2024' }), wd = W({ scope: sc });
    const k = dash.data('pl_kpi').data.find((r) => r.scope === sc && r.year === '2024');
    const d = dash.data('kpi_delta').data.find((r) => r.scope === sc);
    if (!k || !d) { ids.forEach(blank); return; }
    put('lede-profit', gbpMr(k.profit_gbp), 'pl_kpi', 'profit_gbp', w24);
    put('lede-rev', gbpMr(k.revenue_gbp), 'pl_kpi', 'revenue_gbp', w24);
    put('lede-margin', pct(k.margin_pct), 'pl_kpi', 'margin_pct', w24);
    put('lede-mchg', pts(d.margin_chg_pts), 'kpi_delta', 'margin_chg_pts', wd);
    put('lede-loss', pct(k.loss_month_pct), 'pl_kpi', 'loss_month_pct', w24);
    put('k-rev', gbpMr(k.revenue_gbp), 'pl_kpi', 'revenue_gbp', w24);
    put('k-np', gbpMr(k.profit_gbp), 'pl_kpi', 'profit_gbp', w24);
    put('k-m', pct(k.margin_pct), 'pl_kpi', 'margin_pct', w24);
    put('k-loss', pct(k.loss_month_pct), 'pl_kpi', 'loss_month_pct', w24);
    put('k-mem', pct(k.member_pct), 'pl_kpi', 'member_pct', w24);
    put('k-rev-d', sgn(d.revenue_chg_pct), 'kpi_delta', 'revenue_chg_pct', wd); tone('k-rev-d', d.revenue_chg_pct);
    put('k-np-d', sgn(d.profit_chg_pct), 'kpi_delta', 'profit_chg_pct', wd); tone('k-np-d', d.profit_chg_pct);
    put('k-m-d', pts(d.margin_chg_pts), 'kpi_delta', 'margin_chg_pts', wd); tone('k-m-d', d.margin_chg_pts);
    put('k-loss-d', pts(d.loss_chg_pts), 'kpi_delta', 'loss_chg_pts', wd); tone('k-loss-d', d.loss_chg_pts, false);
    put('k-mem-d', pts(d.member_chg_pts), 'kpi_delta', 'member_chg_pts', wd); tone('k-mem-d', d.member_chg_pts);
  };

  const drawFindings = () => {
    const need = ['regions', 'pl_kpi', 'kpi_delta', 'drivers', 'rentband', 'loyalty_atv', 'mix_year', 'cat_margin', 'wkd', 'daytype'];
    if (!ready(need)) return;
    const reg = (r) => W({ region: r });
    put('f-lon-m', pct(dash.data('regions').data.find((r) => r.region === 'London').margin_pct), 'regions', 'margin_pct', reg('London'));
    put('f-est-m', pct(dash.data('pl_kpi').data.find((r) => r.scope === 'All' && r.year === 'All').margin_pct), 'pl_kpi', 'margin_pct', W({ scope: 'All', year: 'All' }));
    put('f-lon-loss', pct(dash.data('regions').data.find((r) => r.region === 'London').loss_month_pct), 'regions', 'loss_month_pct', reg('London'));
    put('f-lon-chg', sgn(dash.data('kpi_delta').data.find((r) => r.scope === 'London').profit_chg_pct), 'kpi_delta', 'profit_chg_pct', W({ scope: 'London' }));
    const dr = dash.data('drivers').data;
    put('f-r-staff', f2(dr[0].r), 'drivers', 'r'); $('f-r-staff').dataset.row = '0';
    put('f-r-rent', f2(dr[2].r), 'drivers', 'r'); $('f-r-rent').dataset.row = '2';
    const rb = dash.data('rentband').data;
    put('f-rb-high', pct(rb.find((r) => r.band === 'High').margin_pct), 'rentband', 'margin_pct', W({ band: 'High' }));
    put('f-rb-low', pct(rb.find((r) => r.band === 'Low').margin_pct), 'rentband', 'margin_pct', W({ band: 'Low' }));
    const atv = dash.data('loyalty_atv').data.find((r) => r.scope === 'All');
    put('f-atv-m', gbp2(atv.atv_member), 'loyalty_atv', 'atv_member', W({ scope: 'All' }));
    put('f-atv-n', gbp2(atv.atv_non_member), 'loyalty_atv', 'atv_non_member', W({ scope: 'All' }));
    const kAll = dash.data('pl_kpi').data.find((r) => r.scope === 'All' && r.year === 'All');
    put('f-red', pct(kAll.redeem_pct_member), 'pl_kpi', 'redeem_pct_member', W({ scope: 'All', year: 'All' }));
    put('r-red', pct(kAll.redeem_pct_member), 'pl_kpi', 'redeem_pct_member', W({ scope: 'All', year: 'All' }));
    const my = dash.data('mix_year').data.filter((r) => r.scope === 'All');
    const food = my.find((r) => r.category === 'Food'), beans = my.find((r) => r.category === 'Retail beans'), filt = my.find((r) => r.category === 'Filter coffee');
    const sp = (v) => (v > 0 ? '+' : v < 0 ? '-' : '±') + f1(Math.abs(v));
    put('f-food', sp(food.change_pts), 'mix_year', 'change_pts', W({ scope: 'All', category: 'Food' }));
    put('f-food24', pct(food.share_2024_pct), 'mix_year', 'share_2024_pct', W({ scope: 'All', category: 'Food' }));
    put('f-beans', sp(beans.change_pts), 'mix_year', 'change_pts', W({ scope: 'All', category: 'Retail beans' }));
    put('f-filter24', pct(filt.share_2024_pct), 'mix_year', 'share_2024_pct', W({ scope: 'All', category: 'Filter coffee' }));
    put('f-filter-gm', pct(dash.data('cat_margin').data.find((r) => r.category === 'Filter-Coffee').gross_margin_pct), 'cat_margin', 'gross_margin_pct', W({ category: 'Filter-Coffee' }));
    const wk = dash.data('wkd').data.find((r) => r.scope === 'All');
    put('f-wkd', sgn(wk.weekend_gap_pct), 'wkd', 'weekend_gap_pct', W({ scope: 'All' }));
    put('f-rph-wd', gbp2(wk.weekday_rev_per_hour), 'wkd', 'weekday_rev_per_hour', W({ scope: 'All' }));
    put('f-rph-we', gbp2(wk.weekend_rev_per_hour), 'wkd', 'weekend_rev_per_hour', W({ scope: 'All' }));
    const bh = dash.data('daytype').data.find((r) => r.scope === 'All' && r.day_type === 'Bank-Holiday');
    put('f-bh', sgn(bh.vs_standard_pct), 'daytype', 'vs_standard_pct', W({ scope: 'All', day_type: 'Bank-Holiday' }));
    const rg = dash.data('regions').data;
    put('r-ni', pct(rg.find((r) => r.region === 'Northern-Ireland').margin_pct), 'regions', 'margin_pct', reg('Northern-Ireland'));
    put('r-wm', pct(rg.find((r) => r.region === 'West-Midlands').margin_pct), 'regions', 'margin_pct', reg('West-Midlands'));
    put('r-wa', pct(rg.find((r) => r.region === 'Wales').margin_pct), 'regions', 'margin_pct', reg('Wales'));
    const kp = dash.data('pl_kpi').data;
    put('c-hs', String(kp.find((r) => r.scope === 'High-Street' && r.year === 'All').stores), 'pl_kpi', 'stores', W({ scope: 'High-Street', year: 'All' }));
    put('c-th', String(kp.find((r) => r.scope === 'Transport-Hub' && r.year === 'All').stores), 'pl_kpi', 'stores', W({ scope: 'Transport-Hub', year: 'All' }));
    put('c-days', fc(atv.days), 'loyalty_atv', 'days', W({ scope: 'All' }));
  };

  const drawOverview = () => {
    const sc = scope();
    // revenue per staff hour tile
    if (ready(['wkd'])) {
      const w = dash.data('wkd').data.find((r) => r.scope === sc);
      if (w) {
        put('k-rph', gbp2(w.all_rev_per_hour), 'wkd', 'all_rev_per_hour', W({ scope: sc }));
        put('k-rph-d', sgn(w.weekend_gap_pct) + ' weekends', 'wkd', 'weekend_gap_pct', W({ scope: sc })); tone('k-rph-d', w.weekend_gap_pct);
      } else { blank('k-rph'); blank('k-rph-d'); }
    }
    // health gauge + flag counts
    if (ready(['health'])) {
      const hv = dash.data('health').data.find((r) => r.scope === sc);
      if (hv) put('g-val', pct(hv.profitable_pct), 'health', 'profitable_pct', W({ scope: sc })); else blank('g-val');
    }
    if (ready(['flags'])) {
      for (const fl of ['Healthy', 'Watch', 'Review']) {
        const r = dash.data('flags').data.find((x) => x.scope === sc && x.flag === fl);
        if (r) put('fl-' + fl, String(r.stores), 'flags', 'stores', W({ scope: sc, flag: fl })); else blank('fl-' + fl);
      }
    }
    const SEG = [['Highly-Profitable', 'Highly profitable', 'var(--sc-green)', 'blocks'], ['Profitable', 'Profitable', 'var(--sc-blue)', 'striped'], ['Break-Even', 'Break-even', 'var(--sc-yellow)', 'solid'], ['Loss-Making', 'Loss-making', 'var(--sc-orange)', 'solid'], ['Structural-Loss', 'Structural loss', 'var(--sc-red)', 'solid']];
    chart('ch-gauge', ['pl_status'], (el) => {
      const rows = dash.data('pl_status').data.filter((r) => r.scope === sc);
      const by = (s) => (rows.find((r) => r.status === s) || { share_pct: 0 }).share_pct;
      SC.gauge(el, [
        { name: 'Loss-making or structural loss', value: by('Loss-Making') + by('Structural-Loss'), color: 'var(--sc-orange)' },
        { name: 'Break-even', value: by('Break-Even'), color: 'var(--sc-yellow)' },
        { name: 'Profitable or highly profitable', value: by('Profitable') + by('Highly-Profitable'), color: 'var(--sc-green)' },
      ], { fmt: pct, height: 150 });
    });
    chart('ch-status', ['pl_status'], (el) => {
      const rows = dash.data('pl_status').data.filter((r) => r.scope === sc);
      const segs = SEG.map(([k, name, color, style]) => ({ name, color, style, value: (rows.find((r) => r.status === k) || { share_pct: 0 }).share_pct })).filter((s) => s.value > 0);
      SC.segbar(el, segs, { fmt: (v) => f1(v) + '%' });
    });
    const lg = $('status-legend');
    lg.replaceChildren(...SEG.map(([, name, color, style]) => { const s = document.createElement('span'); const sw = document.createElement('i'); sw.className = 'sc-sw'; sw.style.background = style === 'striped' ? 'repeating-linear-gradient(90deg, var(--sc-blue) 0 2px, transparent 2px 4px)' : color; s.append(sw, name); return s; }));
    // sparks
    const pm = () => dash.data('pl_month').data.filter((r) => r.scope === sc);
    const mt = (m) => d3.utcFormat('%B %Y')(new Date(m + '-01T00:00:00Z'));
    chart('sp-rev', ['pl_month'], (el) => SC.spark(el, pm().map((r) => ({ key: r.month, value: r.revenue_k, hi: r.month.startsWith('2024'), tipTitle: mt(r.month), tip: [[null, 'Revenue', gbpK(r.revenue_k)]] })), { fmt: gbpK }));
    chart('sp-np', ['pl_month'], (el) => SC.spark(el, pm().map((r) => ({ key: r.month, value: r.profit_k, hi: r.month.startsWith('2024'), tipTitle: mt(r.month), tip: [[null, 'Net profit', gbpK(r.profit_k)]] })), { fmt: gbpK }));
    chart('sp-m', ['pl_month'], (el) => SC.spark(el, pm().map((r) => ({ key: r.month, value: r.margin_pct, hi: r.month.startsWith('2024'), tipTitle: mt(r.month), tip: [[null, 'Net margin', pct(r.margin_pct)]] })), { fmt: pct }));
    chart('sp-rph', ['dow'], (el) => SC.spark(el, dash.data('dow').data.filter((r) => r.scope === sc).map((r) => ({ key: r.day, value: r.rev_per_staff_hour, color: r.day === 'Saturday' || r.day === 'Sunday' ? 'var(--sc-orange)' : A, tipTitle: r.day, tip: [[null, 'Revenue per staff hour', gbp2(r.rev_per_staff_hour)]] })), { fmt: gbp2 }));
    // watchlist
    const tb = document.querySelector('#tbl-watch tbody');
    if (dash.data('stores').status === 'ok') {
      const rows = dash.data('stores').data.filter(inScope).sort((x, y) => x.margin_pct - y.margin_pct).slice(0, 8);
      tb.replaceChildren(...rows.map((r) => {
        const tr = document.createElement('tr');
        const cells = [[r.store_name], [r.region, 'sc-l sc-hide-sm'], [pct(r.margin_pct)], [sgn(r.profit_change_pct)], [null, '', r.flag]];
        for (const [text, cls, pill] of cells) {
          const td = document.createElement('td'); if (cls) td.className = cls;
          if (pill) { const s = document.createElement('span'); s.className = 'sc-pill ' + pill; s.textContent = pill; td.appendChild(s); } else td.textContent = text;
          tr.appendChild(td);
        }
        return tr;
      }));
    } else tb.replaceChildren();
    chart('ch-monthly', ['pl_month'], (el) => {
      const rows = dash.data('pl_month').data.filter((r) => r.scope === sc).map((r) => {
        const dt = new Date(r.month + '-01T00:00:00Z');
        return {
          key: r.month, label: d3.utcFormat('%b %y')(dt), tipTitle: d3.utcFormat('%B %Y')(dt), value: r.profit_k,
          color: r.month.startsWith('2023') ? MUTED : A,
          tip: [[null, 'Net profit', gbpK(r.profit_k)], [null, 'Revenue', gbpK(r.revenue_k)], [null, 'Margin', pct(r.margin_pct)]],
        };
      });
      SC.vbars(el, rows, { fmt: gbpK, height: 240, tickEvery: el.clientWidth < 520 ? 6 : 3 });
    });

  };

  // ---------- stores ----------
  const search = $('store-search');
  search.addEventListener('input', () => drawStoreTable());
  document.querySelectorAll('#tbl-stores th button').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.sort; if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = 1; }
    drawStoreTable();
  }));
  const drawStoreTable = () => {
    const tb = document.querySelector('#tbl-stores tbody');
    document.querySelectorAll('#tbl-stores th').forEach((th) => {
      const b = th.querySelector('button'); th.setAttribute('aria-sort', b && b.dataset.sort === sortKey ? (sortDir > 0 ? 'ascending' : 'descending') : 'none');
    });
    if (dash.data('stores').status !== 'ok') { tb.replaceChildren(); return; }
    const q = search.value.trim().toLowerCase();
    const rows = dash.data('stores').data.filter(inScope)
      .filter((r) => !q || (r.store_name + ' ' + r.region + ' ' + r.location_type + ' ' + r.flag).toLowerCase().includes(q))
      .sort((a, b) => {
        const x = a[sortKey], y = b[sortKey];
        return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * sortDir;
      });
    tb.replaceChildren(...rows.map((r) => {
      const tr = document.createElement('tr');
      const cells = [
        [r.store_name], [r.region, 'sc-l'], [r.location_type, 'sc-l sc-hide-sm'], [null, 'sc-l', r.flag],
        [f2(r.revenue_m)], [fc(r.profit_k)], [pct(r.margin_pct)], [sgn(r.profit_change_pct)], [String(r.loss_months)],
        [pct(r.staff_pct), 'sc-hide-sm'], [pct(r.rent_pct), 'sc-hide-sm'],
      ];
      for (const [text, cls, pill] of cells) {
        const td = document.createElement('td'); if (cls) td.className = cls;
        if (pill) { const s = document.createElement('span'); s.className = 'sc-pill ' + pill; s.textContent = pill; td.appendChild(s); }
        else td.textContent = text;
        tr.appendChild(td);
      }
      return tr;
    }));
  };

  const drawStores = () => {
    const sc = scope();
    chart('ch-regions', ['regions', 'pl_kpi'], (el) => {
      const est = dash.data('pl_kpi').data.find((r) => r.scope === 'All' && r.year === 'All').margin_pct;
      const data = dash.data('regions').data;
      const minM = d3.min(data, (r) => r.margin_pct);
      const isRegion = data.some((r) => r.region === sc);
      const rows = data.map((r) => ({
        label: SC.label(r.region), value: r.margin_pct,
        color: isRegion ? (r.region === sc ? A : MUTED) : (r.margin_pct === minM ? BAD : A),
        tip: [[null, 'Net margin', pct(r.margin_pct)], [null, 'Loss-making months', pct(r.loss_month_pct)], [null, 'Stores', String(r.stores)], [null, 'Net profit', gbpM(r.profit_m)]],
      }));
      SC.hbars(el, rows, { fmt: (v) => f1(v) + '%', refValue: est, refLabel: 'Estate ' + pct(est) });
    });
    chart('ch-staff', ['stores'], (el) => {
      const pts = dash.data('stores').data.map((r) => ({
        x: r.staff_pct, y: r.margin_pct, color: FLAG[r.flag], front: inScope(r), label: r.store_name,
        tip: [[null, 'Region', SC.label(r.region)], [null, 'Staffing % of revenue', pct(r.staff_pct)], [null, 'Net margin', pct(r.margin_pct)], [null, 'Flag', r.flag]],
      }));
      SC.scatter(el, pts, { xFmt: (v) => v + '%', yFmt: (v) => v + '%', xLabel: 'Staffing cost, % of revenue', yLabel: 'Net margin', height: 340 });
    });
    chart('ch-rent', ['rentband'], (el) => {
      const rows = dash.data('rentband').data.map((r) => ({
        label: r.band + ' rent', value: r.margin_pct, color: r.band === 'High' || r.band === 'Premium' ? BAD : A,
        tip: [[null, 'Net margin', pct(r.margin_pct)], [null, 'Avg monthly revenue', '£' + f1(r.avg_revenue_k) + 'k'], [null, 'Store-months', fc(r.months)]],
      }));
      SC.hbars(el, rows, { fmt: (v) => f1(v) + '%' });
    });
    chart('ch-drivers', ['drivers'], (el) => {
      const rows = dash.data('drivers').data.map((r) => ({
        label: r.driver.replace(' → ', ' vs '), value: r.r, color: Math.abs(r.r) >= 0.4 ? A : MUTED,
        tip: [[null, 'Correlation', f2(r.r)]],
      }));
      if (el.clientWidth < 560) rows.forEach((r) => { r.label = r.label.replace('Staffing cost as % of revenue', 'Staffing %').replace('Rent as % of revenue', 'Rent %').replace('Loyalty adoption', 'Adoption').replace('member revenue share', 'member share'); });
      SC.hbars(el, rows, { fmt: f2, domain: [-1, 1] });
    });
    drawStoreTable();
  };

  // ---------- loyalty ----------
  const drawLoyalty = () => {
    const sc = scope();
    const lid = ['l-mem', 'l-atv-m', 'l-atv-n', 'l-red', 'l-red-tx', 'l-be'];
    if (ready(['pl_kpi', 'loyalty_atv'])) {
      const k = dash.data('pl_kpi').data.find((r) => r.scope === sc && r.year === 'All');
      const a = dash.data('loyalty_atv').data.find((r) => r.scope === sc);
      const wk = W({ scope: sc, year: 'All' }), wa = W({ scope: sc });
      if (k && a) {
        put('l-mem', pct(k.member_pct), 'pl_kpi', 'member_pct', wk);
        put('l-atv-m', gbp2(a.atv_member), 'loyalty_atv', 'atv_member', wa);
        put('l-atv-n', gbp2(a.atv_non_member), 'loyalty_atv', 'atv_non_member', wa);
        put('l-red', gbpKr(k.redeem_gbp), 'pl_kpi', 'redeem_gbp', wk);
        put('l-red-tx', gbp2(a.redeem_per_member_tx), 'loyalty_atv', 'redeem_per_member_tx', wa);
        put('l-be', pct(k.redeem_pct_member), 'pl_kpi', 'redeem_pct_member', wk);
      } else lid.forEach(blank);
    } else lid.forEach(blank);
    chart('ch-adoption', ['stores'], (el) => {
      const pts = dash.data('stores').data.map((r) => ({
        x: r.adoption_pct, y: r.member_pct, color: A, front: inScope(r), label: r.store_name,
        tip: [[null, 'Adoption rate', pct(r.adoption_pct)], [null, 'Member revenue share', pct(r.member_pct)], [null, 'Net margin', pct(r.margin_pct)], [null, 'Redemptions', '£' + f1(r.redeem_k) + 'k']],
      }));
      SC.scatter(el, pts, { xFmt: (v) => v + '%', yFmt: (v) => v + '%', xLabel: 'Loyalty adoption rate', yLabel: 'Share of revenue from members', height: 340 });
    });
    chart('ch-quart', ['loyalty_q'], (el) => {
      const rows = dash.data('loyalty_q').data.map((r, i) => ({
        key: r.group, label: el.clientWidth < 480 ? ['Lowest', 'Lower', 'Upper', 'Highest'][i] : r.group, value: r.margin_pct, color: A,
        tip: [[null, 'Adoption', pct(r.adoption_from) + '–' + pct(r.adoption_to)], [null, 'Avg net margin', pct(r.margin_pct)], [null, 'Redemptions per store', '£' + f1(r.redeem_per_store_k) + 'k']],
      }));
      SC.vbars(el, rows, { fmt: (v) => f1(v) + '%', yFmt: (v) => v + '%', height: 200 });
    });
    const tb = document.querySelector('#tbl-quart tbody');
    if (dash.data('loyalty_q').status === 'ok') {
      tb.replaceChildren(...dash.data('loyalty_q').data.map((r) => {
        const tr = document.createElement('tr');
        [r.group, pct(r.adoption_pct), pct(r.member_pct), pct(r.margin_pct), f1(r.redeem_per_store_k), pct(r.redeem_pct_member)].forEach((t) => {
          const td = document.createElement('td'); td.textContent = t; tr.appendChild(td);
        });
        return tr;
      }));
    } else tb.replaceChildren();
  };

  // ---------- mix ----------
  const STREAMS = [['Espresso', 'espresso_pct'], ['Food', 'food_pct'], ['Filter', 'filter_pct'], ['Retail beans', 'beans_pct']];
  const drawMix = () => {
    const sc = scope();
    const lg = $('mix-legend');
    lg.replaceChildren(...STREAMS.map(([n], i) => { const s = document.createElement('span'); const sw = document.createElement('i'); sw.className = 'sc-sw'; sw.style.background = PAL[i]; s.append(sw, n); return s; }));
    chart('ch-mixq', ['mix_q'], (el) => {
      const rows = dash.data('mix_q').data.filter((r) => r.scope === sc).map((r) => ({
        key: r.period.replace('20', "'"), label: r.period, parts: STREAMS.map(([name, k], i) => ({ name, value: r[k], color: PAL[i] })),
      }));
      SC.stack(el, rows, { fmt: pct, height: 260 });
    });
    const tb = document.querySelector('#tbl-mixyear tbody');
    if (dash.data('mix_year').status === 'ok') {
      tb.replaceChildren(...dash.data('mix_year').data.filter((r) => r.scope === sc).map((r) => {
        const tr = document.createElement('tr');
        tr.dataset.key = encodeURIComponent(r.scope) + ',' + encodeURIComponent(r.category);
        [r.category, pct(r.share_2023_pct), pct(r.share_2024_pct), pts(r.change_pts)].forEach((t) => { const td = document.createElement('td'); td.textContent = t; tr.appendChild(td); });
        return tr;
      }));
    } else tb.replaceChildren();
    chart('ch-catm', ['cat_margin'], (el) => {
      const rows = dash.data('cat_margin').data.map((r) => ({
        label: SC.label(r.category), value: r.gross_margin_pct, color: r.category === 'Filter-Coffee' ? A : MUTED,
        tip: [[null, 'Gross margin', pct(r.gross_margin_pct)], [null, 'Products', String(r.products)], [null, 'Top seller, 2023', pct(r.top_seller_2023_pct) + ' of days'], [null, 'Top seller, 2024', pct(r.top_seller_2024_pct) + ' of days']],
      }));
      SC.hbars(el, rows, { fmt: (v) => f1(v) + '%', domain: [0, 100] });
    });
  };

  // ---------- patterns ----------
  const drawPatterns = () => {
    const sc = scope();
    const pid = ['p-gap', 'p-wd', 'p-we', 'p-hrs-we', 'p-hrs-wd', 'p-rph-we', 'p-rph-wd', 'p-bh'];
    if (ready(['wkd', 'daytype'])) {
      const w = dash.data('wkd').data.find((r) => r.scope === sc), ws = W({ scope: sc });
      const bh = dash.data('daytype').data.find((r) => r.scope === sc && r.day_type === 'Bank-Holiday');
      if (w) {
        put('p-gap', sgn(w.weekend_gap_pct), 'wkd', 'weekend_gap_pct', ws); tone('p-gap', w.weekend_gap_pct);
        put('p-wd', gbp(w.weekday_revenue), 'wkd', 'weekday_revenue', ws);
        put('p-we', gbp(w.weekend_revenue), 'wkd', 'weekend_revenue', ws);
        put('p-hrs-we', f1(w.weekend_hours) + ' h', 'wkd', 'weekend_hours', ws);
        put('p-hrs-wd', f1(w.weekday_hours) + ' h', 'wkd', 'weekday_hours', ws);
        put('p-rph-we', gbp2(w.weekend_rev_per_hour), 'wkd', 'weekend_rev_per_hour', ws);
        put('p-rph-wd', gbp2(w.weekday_rev_per_hour), 'wkd', 'weekday_rev_per_hour', ws);
      } else pid.forEach(blank);
      if (bh) { put('p-bh', sgn(bh.vs_standard_pct), 'daytype', 'vs_standard_pct', W({ scope: sc, day_type: 'Bank-Holiday' })); tone('p-bh', bh.vs_standard_pct); }
      else blank('p-bh');
    } else pid.forEach(blank);
    const dowRows = (field, fmt) => dash.data('dow').data.filter((r) => r.scope === sc).map((r) => ({
      key: r.day, label: r.day.slice(0, 3), tipTitle: r.day, value: r[field],
      color: r.day === 'Saturday' || r.day === 'Sunday' ? 'var(--sc-orange)' : A,
      tip: [[null, 'Avg revenue', gbp(r.avg_revenue)], [null, 'Avg staff hours', f1(r.avg_staff_hours)], [null, 'Revenue per staff hour', gbp2(r.rev_per_staff_hour)], [null, 'Store-days sampled', fc(r.days)]],
    }));
    chart('ch-dow', ['dow'], (el) => SC.vbars(el, dowRows('avg_revenue'), { fmt: gbp, height: 240 }));
    chart('ch-rph', ['dow'], (el) => SC.vbars(el, dowRows('rev_per_staff_hour'), { fmt: gbp2, yFmt: (v) => '£' + v, height: 240 }));
    chart('ch-daytype', ['daytype'], (el) => {
      const rows = dash.data('daytype').data.filter((r) => r.scope === sc).map((r) => ({
        label: SC.label(r.day_type).replace('Standard Trading Day', 'Standard day'), value: r.vs_standard_pct,
        color: r.vs_standard_pct < -10 ? BAD : A,
        tip: [[null, 'Avg revenue', gbp(r.avg_revenue)], [null, 'vs standard day', sgn(r.vs_standard_pct)], [null, 'Store-days sampled', fc(r.days)]],
      }));
      SC.hbars(el, rows, { fmt: (v) => (v > 0 ? '+' : '') + f1(v) + '%' });
    });
    chart('ch-season', ['pl_month'], (el) => {
      const rows = dash.data('pl_month').data.filter((r) => r.scope === sc);
      const mk = (y, color) => ({
        name: y, color,
        points: rows.filter((r) => r.month.startsWith(y)).map((r) => ({ x: +r.month.slice(5), y: r.profit_k, title: d3.utcFormat('%B')(new Date(Date.UTC(2024, +r.month.slice(5) - 1, 1))) })),
      });
      SC.lines(el, [mk('2023', MUTED), mk('2024', A)], {
        fmt: gbpK, height: 240, xTicks: 12, xFmt: (m) => d3.utcFormat('%b')(new Date(Date.UTC(2024, m - 1, 1))),
      });
    });
  };

  // ---------- theme toggle ----------
  const root = document.querySelector('.sc');
  const picks = [...document.querySelectorAll('[data-theme-pick]')];
  picks.forEach((b) => b.addEventListener('click', () => { applyTheme(b.dataset.themePick); dash.setParams({ theme: b.dataset.themePick }); }));
  function applyTheme(t) {
    const v = t === 'light' || t === 'dark' ? t : 'auto';
    if (v === 'auto') root.removeAttribute('data-sc-theme'); else root.setAttribute('data-sc-theme', v);
    picks.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themePick === v)));
  }

  function render() {
    applyTheme(dash.params().theme);
    drawScope(); drawHeader(); drawFindings();
    if (current === 'overview') drawOverview();
    if (current === 'stores') drawStores();
    if (current === 'loyalty') drawLoyalty();
    if (current === 'mix') drawMix();
    if (current === 'patterns') drawPatterns();
  }

  const start = location.hash.slice(1);
  if (['overview', 'stores', 'loyalty', 'mix', 'patterns'].includes(start)) {
    current = start;
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === start)));
    document.querySelectorAll('.sc-page').forEach((p) => { p.hidden = p.dataset.page !== start; });
  }
  dash.onData(render);
})();
