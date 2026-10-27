// Small chart kit shared by the page (window.SC).
(() => {
  const SC = {};
  SC.label = (s) => String(s).replace(/-/g, ' ');

  // Tooltip inside a position:relative box
  SC.tip = (box) => {
    let t = box.querySelector(':scope > .sc-tip');
    if (!t) { t = document.createElement('div'); t.className = 'sc-tip'; t.hidden = true; box.appendChild(t); }
    return {
      show(event, title, lines) {
        t.replaceChildren();
        const h = document.createElement('div'); h.className = 'sc-tip-h'; h.textContent = title; t.appendChild(h);
        for (const [color, name, value] of lines) {
          const row = document.createElement('div'); row.className = 'sc-tip-r';
          if (color) { const sw = document.createElement('span'); sw.className = 'sc-sw'; sw.style.background = color; row.appendChild(sw); }
          const n = document.createElement('span'); n.textContent = name; row.appendChild(n);
          const v = document.createElement('b'); v.textContent = value; row.appendChild(v);
          t.appendChild(row);
        }
        t.hidden = false;
        const b = box.getBoundingClientRect();
        let x = event.clientX - b.left + 12, y = event.clientY - b.top + 12;
        const w = t.offsetWidth, hh = t.offsetHeight;
        if (x + w > b.width) x = Math.max(0, event.clientX - b.left - w - 12);
        if (y + hh > b.height) y = Math.max(0, event.clientY - b.top - hh - 12);
        t.style.left = x + 'px'; t.style.top = y + 'px';
      },
      hide() { t.hidden = true; },
    };
  };

  const textW = (svg, strings, cls = 'sc-tick') => {
    const g = svg.append('g').attr('class', cls);
    let m = 0;
    for (const s of strings) { const t = g.append('text').text(s); m = Math.max(m, t.node().getComputedTextLength()); }
    g.remove();
    return m;
  };

  const frame = (el, height) => {
    const box = el; box.replaceChildren();
    const width = Math.max(240, box.clientWidth);
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${width} ${height}`).attr('height', height).attr('role', 'img');
    return { svg, width, height, tip: SC.tip(box.parentElement.classList.contains('sc-chart-wrap') ? box.parentElement : box) };
  };

  const styleAxis = (g) => {
    g.attr('font-size', null).attr('font-family', null).attr('class', 'sc-tick');
    g.select('.domain').attr('stroke', 'var(--cds-chart-axis)');
    g.selectAll('.tick line').attr('stroke', 'var(--cds-chart-grid)');
    g.selectAll('.tick text').attr('fill', 'var(--color-fg-muted)');
  };

  // Horizontal bars: rows [{label, value, color?, tip}]
  SC.hbars = (el, rows, { fmt, height, refValue, refLabel, domain } = {}) => {
    const rowH = 28, h = height || rows.length * rowH + 34;
    const { svg, width, tip } = frame(el, h);
    const left = Math.ceil(textW(svg, rows.map((r) => r.label))) + 12;
    const valW = Math.ceil(textW(svg, rows.map((r) => fmt(r.value)))) + 10;
    const lo = Math.min(0, d3.min(rows, (r) => r.value)), hi = Math.max(0, d3.max(rows, (r) => r.value));
    const x = d3.scaleLinear(domain || [lo, hi], [left, width - valW]).nice();
    const y = d3.scaleBand(rows.map((r) => r.label), [6, h - 26]).padding(0.28);
    svg.append('g').attr('transform', `translate(0,${h - 24})`).call(d3.axisBottom(x).ticks(Math.max(2, Math.floor((width - left) / 90))).tickFormat(fmt).tickSize(-(h - 30))).call(styleAxis).call((g) => g.select('.domain').remove());
    svg.append('g').selectAll('text').data(rows).join('text').attr('class', 'sc-tick').attr('x', left - 8).attr('y', (r) => y(r.label) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').attr('fill', 'var(--color-fg)').text((r) => r.label);
    svg.append('g').selectAll('rect').data(rows).join('rect')
      .attr('x', (r) => x(Math.min(0, r.value))).attr('y', (r) => y(r.label)).attr('height', Math.min(22, y.bandwidth()))
      .attr('width', (r) => Math.max(1, Math.abs(x(r.value) - x(0)))).attr('rx', 4)
      .attr('fill', (r) => r.color || dash.colors[0])
      .on('mousemove', (e, r) => tip.show(e, r.label, r.tip || [[null, '', fmt(r.value)]])).on('mouseleave', () => tip.hide());
    svg.append('g').selectAll('text').data(rows).join('text').attr('class', 'sc-tick sc-val')
      .attr('x', (r) => (r.value >= 0 ? x(r.value) + 6 : x(0) + 6)).attr('y', (r) => y(r.label) + Math.min(22, y.bandwidth()) / 2).attr('dy', '0.35em')
      .attr('fill', 'var(--color-fg)').text((r) => fmt(r.value));
    if (refValue != null) {
      svg.append('line').attr('x1', x(refValue)).attr('x2', x(refValue)).attr('y1', 2).attr('y2', h - 24).attr('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '4 3');
      if (refLabel) svg.append('text').attr('class', 'sc-tick').attr('x', x(refValue) + 4).attr('y', 10).attr('fill', 'var(--color-fg-muted)').text(refLabel);
    }
  };

  // Vertical bars: rows [{key, label, value, color?, tip}]
  SC.vbars = (el, rows, { fmt, height = 240, tickEvery = 1, yFmt } = {}) => {
    const { svg, width, tip } = frame(el, height);
    const yf = yFmt || fmt;
    const lo = Math.min(0, d3.min(rows, (r) => r.value)), hi = Math.max(0, d3.max(rows, (r) => r.value));
    const y0 = d3.scaleLinear([lo, hi], [height - 28, 14]).nice();
    const left = Math.ceil(textW(svg, y0.ticks(5).map(yf))) + 10;
    const x = d3.scaleBand(rows.map((r) => r.key), [left, width - 4]).padding(0.25);
    svg.append('g').attr('transform', `translate(${left},0)`).call(d3.axisLeft(y0).ticks(5).tickFormat(yf).tickSize(-(width - left - 4))).call(styleAxis).call((g) => g.select('.domain').remove());
    const xa = svg.append('g').attr('transform', `translate(0,${height - 28})`).call(d3.axisBottom(x).tickSizeOuter(0).tickFormat((k, i) => (i % tickEvery === 0 ? (rows.find((r) => r.key === k) || {}).label : ''))).call(styleAxis);
    xa.selectAll('.tick line').remove();
    const bw = Math.min(32, x.bandwidth());
    svg.append('g').selectAll('rect').data(rows).join('rect')
      .attr('x', (r) => x(r.key) + (x.bandwidth() - bw) / 2).attr('width', bw)
      .attr('y', (r) => y0(Math.max(0, r.value))).attr('height', (r) => Math.max(1, Math.abs(y0(r.value) - y0(0)))).attr('rx', 4)
      .attr('fill', (r) => r.color || dash.colors[0])
      .on('mousemove', (e, r) => tip.show(e, r.tipTitle || r.label, r.tip || [[null, '', fmt(r.value)]])).on('mouseleave', () => tip.hide());
    svg.append('line').attr('x1', left).attr('x2', width - 4).attr('y1', y0(0)).attr('y2', y0(0)).attr('stroke', 'var(--cds-chart-axis)');
  };

  // Lines: series [{name, color, points:[{x (Date|number), y, tip}]}]
  SC.lines = (el, series, { fmt, height = 240, xFmt, xTicks = 6 } = {}) => {
    const { svg, width, tip } = frame(el, height);
    const all = series.flatMap((s) => s.points);
    const ext = d3.extent(all, (p) => p.y); const pad = (ext[1] - ext[0]) * 0.15 || 1;
    const y = d3.scaleLinear([ext[0] - pad, ext[1] + pad], [height - 28, 12]).nice();
    const left = Math.ceil(textW(svg, y.ticks(5).map(fmt))) + 10;
    const endW = Math.ceil(textW(svg, series.map((s) => s.name))) + 12;
    const xs = d3.extent(all, (p) => p.x);
    const x = (xs[0] instanceof Date ? d3.scaleUtc : d3.scaleLinear)(xs, [left + 6, width - endW]);
    svg.append('g').attr('transform', `translate(${left},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(fmt).tickSize(-(width - left - endW))).call(styleAxis).call((g) => g.select('.domain').remove());
    svg.append('g').attr('transform', `translate(0,${height - 28})`).call(d3.axisBottom(x).ticks(Math.min(xTicks, Math.floor(width / 80))).tickFormat(xFmt).tickSizeOuter(0)).call(styleAxis).call((g) => g.selectAll('.tick line').remove());
    const line = d3.line().x((p) => x(p.x)).y((p) => y(p.y));
    const ends = [];
    for (const s of series) {
      svg.append('path').datum(s.points).attr('d', line).attr('fill', 'none').attr('stroke', s.color).attr('stroke-width', 2).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
      svg.append('g').selectAll('circle').data(s.points).join('circle').attr('cx', (p) => x(p.x)).attr('cy', (p) => y(p.y)).attr('r', 3).attr('fill', s.color);
      const last = s.points[s.points.length - 1]; ends.push({ s, y: y(last.y), x: x(last.x) });
    }
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
    for (const e of ends) svg.append('text').attr('class', 'sc-tick').attr('x', e.x + 8).attr('y', e.y).attr('dy', '0.35em').attr('fill', e.s.color).text(e.s.name);
    const hover = svg.append('line').attr('y1', 12).attr('y2', height - 28).attr('stroke', 'var(--cds-chart-reference)').attr('opacity', 0);
    const xsAll = [...new Set(all.map((p) => +p.x))].sort((a, b) => a - b);
    svg.append('rect').attr('x', left).attr('y', 0).attr('width', width - left - endW + 6).attr('height', height - 28).attr('fill', 'transparent')
      .on('mousemove', (e) => {
        const [mx] = d3.pointer(e); const v = +x.invert(mx);
        const near = xsAll[d3.minIndex(xsAll, (t) => Math.abs(t - v))];
        hover.attr('x1', x(near)).attr('x2', x(near)).attr('opacity', 1);
        const pts = series.map((s) => [s, s.points.find((p) => +p.x === near)]).filter(([, p]) => p);
        tip.show(e, pts[0][1].title || String(near), pts.map(([s, p]) => [s.color, s.name, fmt(p.y)]));
      }).on('mouseleave', () => { hover.attr('opacity', 0); tip.hide(); });
  };

  // Scatter: points [{x, y, color, r?, label, tip}]
  SC.scatter = (el, pts, { xFmt, yFmt, xLabel, yLabel, height = 280 } = {}) => {
    const { svg, width, tip } = frame(el, height);
    const xe = d3.extent(pts, (p) => p.x), ye = d3.extent(pts, (p) => p.y);
    const xp = (xe[1] - xe[0]) * 0.06, yp = (ye[1] - ye[0]) * 0.08;
    const y = d3.scaleLinear([ye[0] - yp, ye[1] + yp], [height - 40, 12]).nice();
    const left = Math.ceil(textW(svg, y.ticks(5).map(yFmt))) + 12;
    const x = d3.scaleLinear([xe[0] - xp, xe[1] + xp], [left + 4, width - 10]).nice();
    svg.append('g').attr('transform', `translate(${left},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(yFmt).tickSize(-(width - left - 10))).call(styleAxis).call((g) => g.select('.domain').remove());
    svg.append('g').attr('transform', `translate(0,${height - 40})`).call(d3.axisBottom(x).ticks(Math.max(3, Math.floor(width / 90))).tickFormat(xFmt).tickSize(-(height - 52))).call(styleAxis).call((g) => g.select('.domain').remove());
    if (xLabel) svg.append('text').attr('class', 'sc-tick').attr('x', width - 10).attr('y', height - 6).attr('text-anchor', 'end').attr('fill', 'var(--color-fg-muted)').text(xLabel);
    if (yLabel) svg.append('text').attr('class', 'sc-tick').attr('x', left + 4).attr('y', 10).attr('fill', 'var(--color-fg-muted)').text(yLabel);
    const sorted = [...pts].sort((a, b) => (a.front ? 1 : 0) - (b.front ? 1 : 0));
    svg.append('g').selectAll('circle').data(sorted).join('circle').attr('cx', (p) => x(p.x)).attr('cy', (p) => y(p.y)).attr('r', (p) => p.r || 5)
      .attr('fill', (p) => p.color).attr('fill-opacity', (p) => (p.front === false ? 0.35 : 0.85)).attr('stroke', 'var(--color-bg)').attr('stroke-width', 1)
      .on('mousemove', (e, p) => tip.show(e, p.label, p.tip)).on('mouseleave', () => tip.hide());
  };

  // 100% stacked columns: rows [{key, label, parts:[{name, value, color}]}]
  SC.stack = (el, rows, { height = 260, fmt } = {}) => {
    const { svg, width, tip } = frame(el, height);
    const y = d3.scaleLinear([0, 100], [height - 28, 8]);
    const left = Math.ceil(textW(svg, y.ticks(4).map((v) => v + '%'))) + 10;
    const x = d3.scaleBand(rows.map((r) => r.key), [left, width - 4]).padding(0.22);
    svg.append('g').attr('transform', `translate(${left},0)`).call(d3.axisLeft(y).ticks(4).tickFormat((v) => v + '%').tickSize(-(width - left - 4))).call(styleAxis).call((g) => g.select('.domain').remove());
    const step = x.bandwidth() < 44 ? 2 : 1;
    svg.append('g').attr('transform', `translate(0,${height - 28})`).call(d3.axisBottom(x).tickSizeOuter(0).tickFormat((k, i) => (i % step === 0 ? k : ''))).call(styleAxis).call((g) => g.selectAll('.tick line').remove());
    for (const r of rows) {
      let acc = 0; const total = d3.sum(r.parts, (p) => p.value);
      for (const p of r.parts) {
        const v = 100 * p.value / total;
        svg.append('rect').attr('x', x(r.key)).attr('width', x.bandwidth()).attr('y', y(acc + v)).attr('height', Math.max(0, y(acc) - y(acc + v) - 1)).attr('fill', p.color)
          .on('mousemove', (e) => tip.show(e, r.label, r.parts.map((q) => [q.color, q.name, fmt(q.value)]))).on('mouseleave', () => tip.hide());
        acc += v;
      }
    }
  };


  // Thin spark bars: rows [{key, value, hi (bool), tipTitle, tip}]
  SC.spark = (el, rows, { height = 56, fmt } = {}) => {
    const { svg, width, tip } = frame(el, height);
    const lo = Math.min(0, d3.min(rows, (r) => r.value)), hi = Math.max(0, d3.max(rows, (r) => r.value));
    const y = d3.scaleLinear([lo, hi], [height - 2, 4]);
    const x = d3.scaleBand(rows.map((r) => r.key), [0, width]).padding(0.45);
    const bw = Math.max(2, Math.min(6, x.bandwidth()));
    svg.append('g').selectAll('rect').data(rows).join('rect')
      .attr('x', (r) => x(r.key) + (x.bandwidth() - bw) / 2).attr('width', bw)
      .attr('y', (r) => y(Math.max(0, r.value))).attr('height', (r) => Math.max(1.5, Math.abs(y(r.value) - y(0)))).attr('rx', bw / 2)
      .attr('fill', (r) => r.color || 'var(--sc-green)').attr('opacity', (r) => (r.hi === false ? 0.35 : 1));
    svg.append('rect').attr('width', width).attr('height', height).attr('fill', 'transparent')
      .on('mousemove', (e) => {
        const [mx] = d3.pointer(e); const i = Math.max(0, Math.min(rows.length - 1, Math.floor((mx / width) * rows.length)));
        const r = rows[i]; tip.show(e, r.tipTitle || r.key, r.tip || [[null, '', fmt(r.value)]]);
      }).on('mouseleave', () => tip.hide());
  };

  // Semicircle gauge from segments [{name, value, color}] (values sum to 100)
  SC.gauge = (el, segs, { height = 150, fmt } = {}) => {
    const { svg, width, tip } = frame(el, height);
    const r = Math.min(width / 2 - 8, height - 14), cx = width / 2, cy = height - 6;
    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);
    const total = d3.sum(segs, (s) => s.value); let a0 = -Math.PI / 2;
    const arc = d3.arc().innerRadius(r - 16).outerRadius(r).cornerRadius(8);
    for (const s of segs) {
      const a1 = a0 + Math.PI * (s.value / total);
      g.append('path').attr('d', arc({ startAngle: a0 + 0.035, endAngle: a1 - 0.035 })).attr('fill', s.color)
        .on('mousemove', (e) => tip.show(e, s.name, [[s.color, 'Share', fmt(s.value)]])).on('mouseleave', () => tip.hide());
      a0 = a1;
    }
  };

  // Segmented bar: segs [{name, value, color, style: 'solid'|'striped'|'blocks'}] values in %
  SC.segbar = (el, segs, { height = 76, fmt } = {}) => {
    const { svg, width, tip } = frame(el, height);
    const defs = svg.append('defs');
    const pid = 'sc-stripe-' + Math.random().toString(36).slice(2, 8);
    const pat = defs.append('pattern').attr('id', pid).attr('width', 6).attr('height', 6).attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(0)');
    pat.append('rect').attr('width', 3).attr('height', 6).attr('fill', 'var(--sc-blue)');
    const total = d3.sum(segs, (s) => s.value);
    const x = d3.scaleLinear([0, total], [0, width]);
    const top = 30, bh = 26; let acc = 0; const labels = [];
    for (const s of segs) {
      const x0 = x(acc), w = Math.max(0, x(acc + s.value) - x0 - 4);
      const g = svg.append('g').on('mousemove', (e) => tip.show(e, s.name, [[s.color, 'Share of store-months', fmt(s.value)]])).on('mouseleave', () => tip.hide());
      if (s.style === 'blocks') {
        const n = Math.max(1, Math.floor(w / (bh + 4)));
        const bw = (w - (n - 1) * 4) / n;
        for (let i = 0; i < n; i++) g.append('rect').attr('x', x0 + i * (bw + 4)).attr('y', top).attr('width', Math.max(1, bw)).attr('height', bh).attr('rx', 4).attr('fill', s.color);
      } else {
        g.append('rect').attr('x', x0).attr('y', top).attr('width', Math.max(1, w)).attr('height', bh).attr('rx', 4).attr('fill', s.style === 'striped' ? `url(#${pid})` : s.color);
      }
      labels.push({ x: x0, text: fmt(s.value), w });
      acc += s.value;
    }
    let lastEnd = -Infinity;
    for (const l of labels) {
      const t = svg.append('text').attr('class', 'sc-tick').attr('x', Math.max(l.x, lastEnd + 6)).attr('y', top - 10).attr('fill', 'var(--color-fg)').text(l.text);
      const tw = t.node().getComputedTextLength();
      if (Math.max(l.x, lastEnd + 6) + tw > width) {
        if (width - tw < lastEnd + 6) { t.remove(); continue; }
        t.attr('x', width - tw);
      }
      lastEnd = +t.attr('x') + tw;
      svg.append('line').attr('x1', l.x + 0.5).attr('x2', l.x + 0.5).attr('y1', top - 6).attr('y2', top + bh + 6).attr('stroke', 'var(--color-fg-muted)').attr('stroke-dasharray', '2 2').attr('opacity', 0.5);
    }
  };

  window.SC = SC;
})();
