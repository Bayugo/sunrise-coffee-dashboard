// Calculations for the Sunrise Coffee dashboard. Each one reads the attached files only.
// "scope" is All (the estate), a store format, or a region.

dash.calc('pl_kpi', {
  title: 'Headline P&L by scope and year',
  description: 'Revenue, net profit, margin, loss-month share and loyalty totals from the store-month P&L, for the estate, each format and each region, by year.',
  inputs: ['pl'],
  fn: (pl) => {
    const rd = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
    const g = new Map();
    for (const r of pl) {
      for (const scope of ['All', r.store_format, r.region]) {
        for (const year of [r.month_id.slice(0, 4), 'All']) {
          const k = scope + '|' + year;
          if (!g.has(k)) g.set(k, { scope, year, rev: 0, np: 0, loss: 0, n: 0, sqft: 0, foot: 0, fn: 0, mem: 0, red: 0, stores: new Set() });
          const a = g.get(k);
          a.rev += +r.total_monthly_revenue_gbp; a.np += +r.net_profit_gbp; a.n += 1;
          a.loss += (r.profitability_status === 'Loss-Making' || r.profitability_status === 'Structural-Loss') ? 1 : 0;
          a.sqft += +r.revenue_per_sqft_gbp; a.mem += +r.loyalty_member_spend_gbp; a.red += +r.loyalty_redemption_cost_gbp;
          if (r.avg_daily_footfall !== '' && r.avg_daily_footfall != null) { a.foot += +r.avg_daily_footfall; a.fn += 1; }
          a.stores.add(r.store_id);
        }
      }
    }
    return [...g.values()].map((a) => ({
      scope: a.scope, year: a.year, stores: a.stores.size,
      revenue_gbp: Math.round(a.rev), profit_gbp: Math.round(a.np), revenue_m: rd(a.rev / 1e6, 2), profit_m: rd(a.np / 1e6, 2), margin_pct: rd(100 * a.np / a.rev),
      loss_month_pct: rd(100 * a.loss / a.n), rev_per_sqft: rd(a.sqft / a.n), footfall: Math.round(a.foot / a.fn),
      member_pct: rd(100 * a.mem / a.rev), member_spend_m: rd(a.mem / 1e6, 2), redeem_k: Math.round(a.red / 1e3), redeem_gbp: Math.round(a.red),
      redeem_pct_member: rd(100 * a.red / a.mem),
    }));
  },
});

dash.calc('pl_month', {
  title: 'Monthly P&L by scope',
  description: 'Revenue, net profit and net margin for each month of 2023–2024, for the estate, each format and each region.',
  inputs: ['pl'],
  fn: (pl) => {
    const rd = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
    const g = new Map();
    for (const r of pl) {
      for (const scope of ['All', r.store_format, r.region]) {
        const k = scope + '|' + r.month_id;
        if (!g.has(k)) g.set(k, { scope, month: r.month_id, rev: 0, np: 0 });
        const a = g.get(k); a.rev += +r.total_monthly_revenue_gbp; a.np += +r.net_profit_gbp;
      }
    }
    return [...g.values()].sort((a, b) => a.month < b.month ? -1 : 1).map((a) => ({
      scope: a.scope, month: a.month, revenue_k: Math.round(a.rev / 1e3), profit_k: Math.round(a.np / 1e3), margin_pct: rd(100 * a.np / a.rev),
    }));
  },
});

dash.calc('pl_status', {
  title: 'Store-months by profitability status',
  description: 'How many store-months fell in each profitability status band, for the estate, each format and each region.',
  inputs: ['pl'],
  fn: (pl) => {
    const order = ['Highly-Profitable', 'Profitable', 'Break-Even', 'Loss-Making', 'Structural-Loss'];
    const g = new Map(); const tot = new Map();
    for (const r of pl) {
      for (const scope of ['All', r.store_format, r.region]) {
        const k = scope + '|' + r.profitability_status;
        g.set(k, (g.get(k) || 0) + 1); tot.set(scope, (tot.get(scope) || 0) + 1);
      }
    }
    const out = [];
    for (const scope of tot.keys()) for (const status of order) {
      const n = g.get(scope + '|' + status) || 0;
      out.push({ scope, status, months: n, share_pct: Math.round(1000 * n / tot.get(scope)) / 10 });
    }
    return out;
  },
});

dash.calc('stores', {
  title: 'Store scorecard',
  description: 'Two-year P&L per store with its 2023→2024 profit change, loss months, cost ratios and loyalty figures. Flag: Review = margin under 10% or 6+ loss months; Watch = margin under 15% or profit down 25%+ year on year.',
  inputs: ['pl'],
  fn: (pl) => {
    const rd = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
    const g = new Map();
    for (const r of pl) {
      if (!g.has(r.store_id)) g.set(r.store_id, { r, rev: 0, np: 0, p23: 0, p24: 0, loss: 0, rent: 0, staff: 0, mem: 0, red: 0, n: 0 });
      const a = g.get(r.store_id);
      a.rev += +r.total_monthly_revenue_gbp; a.np += +r.net_profit_gbp; a.n += 1;
      if (r.month_id.startsWith('2023')) a.p23 += +r.net_profit_gbp; else a.p24 += +r.net_profit_gbp;
      a.loss += (r.profitability_status === 'Loss-Making' || r.profitability_status === 'Structural-Loss') ? 1 : 0;
      a.rent += +r.monthly_rent_gbp; a.staff += +r.monthly_staffing_cost_gbp; a.mem += +r.loyalty_member_spend_gbp; a.red += +r.loyalty_redemption_cost_gbp;
    }
    return [...g.values()].map((a) => {
      const margin = 100 * a.np / a.rev;
      const chg = 100 * (a.p24 - a.p23) / Math.abs(a.p23);
      const flag = (margin < 10 || a.loss >= 6) ? 'Review' : (margin < 15 || chg <= -25) ? 'Watch' : 'Healthy';
      return {
        store_id: +a.r.store_id, store_name: a.r.store_name.replace('Sunrise Coffee ', ''), store_format: a.r.store_format, region: a.r.region,
        location_type: a.r.location_type, store_status: a.r.store_status, flag,
        revenue_m: rd(a.rev / 1e6, 2), profit_k: Math.round(a.np / 1e3), margin_pct: rd(margin),
        profit_2023_k: Math.round(a.p23 / 1e3), profit_2024_k: Math.round(a.p24 / 1e3), profit_change_pct: rd(chg),
        loss_months: a.loss, rent_k: rd(a.rent / a.n / 1e3), staff_pct: rd(100 * a.staff / a.rev), rent_pct: rd(100 * a.rent / a.rev),
        adoption_pct: rd(100 * +a.r.loyalty_adoption_rate), member_pct: rd(100 * a.mem / a.rev),
        redeem_k: rd(a.red / 1e3), member_spend_k: Math.round(a.mem / 1e3), redeem_pct_member: rd(100 * a.red / a.mem),
      };
    });
  },
});

dash.calc('regions', {
  title: 'Region league table',
  description: 'Two-year net margin, loss-month share and store count per UK region.',
  inputs: ['pl'],
  fn: (pl) => {
    const rd = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
    const g = new Map();
    for (const r of pl) {
      if (!g.has(r.region)) g.set(r.region, { region: r.region, rev: 0, np: 0, loss: 0, n: 0, s: new Set() });
      const a = g.get(r.region);
      a.rev += +r.total_monthly_revenue_gbp; a.np += +r.net_profit_gbp; a.n += 1; a.s.add(r.store_id);
      a.loss += (r.profitability_status === 'Loss-Making' || r.profitability_status === 'Structural-Loss') ? 1 : 0;
    }
    return [...g.values()].map((a) => ({ region: a.region, stores: a.s.size, revenue_m: rd(a.rev / 1e6, 2), profit_m: rd(a.np / 1e6, 2), margin_pct: rd(100 * a.np / a.rev), loss_month_pct: rd(100 * a.loss / a.n) }))
      .sort((a, b) => b.margin_pct - a.margin_pct);
  },
});

dash.calc('rentband', {
  title: 'Rent band economics',
  description: 'Average monthly revenue and net margin of store-months in each rent band.',
  inputs: ['pl'],
  fn: (pl) => {
    const rd = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
    const order = ['Low', 'Medium', 'High', 'Premium'];
    const g = new Map();
    for (const r of pl) {
      if (!g.has(r.rent_band)) g.set(r.rent_band, { band: r.rent_band, rev: 0, np: 0, n: 0 });
      const a = g.get(r.rent_band); a.rev += +r.total_monthly_revenue_gbp; a.np += +r.net_profit_gbp; a.n += 1;
    }
    return [...g.values()].sort((a, b) => order.indexOf(a.band) - order.indexOf(b.band))
      .map((a) => ({ band: a.band, months: a.n, avg_revenue_k: rd(a.rev / a.n / 1e3), margin_pct: rd(100 * a.np / a.rev) }));
  },
});

dash.calc('drivers', {
  title: 'Margin driver correlations',
  description: 'Pearson correlation across the 60 stores between each cost or loyalty measure and two-year net margin or revenue.',
  inputs: ['stores'],
  fn: (stores) => {
    const corr = (xs, ys) => {
      const n = xs.length, mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
      let sxy = 0, sxx = 0, syy = 0;
      for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
      return Math.round(100 * sxy / Math.sqrt(sxx * syy)) / 100;
    };
    const col = (k) => stores.map((s) => s[k]);
    return [
      { driver: 'Staffing cost as % of revenue → net margin', r: corr(col('staff_pct'), col('margin_pct')) },
      { driver: 'Rent as % of revenue → net margin', r: corr(col('rent_pct'), col('margin_pct')) },
      { driver: 'Monthly rent → revenue', r: corr(col('rent_k'), col('revenue_m')) },
      { driver: 'Loyalty adoption → net margin', r: corr(col('adoption_pct'), col('margin_pct')) },
      { driver: 'Loyalty adoption → member revenue share', r: corr(col('adoption_pct'), col('member_pct')) },
    ];
  },
});

dash.calc('loyalty_q', {
  title: 'Stores by loyalty adoption quartile',
  description: 'The 60 stores split into four groups of 15 by loyalty adoption rate, with each group\'s average member revenue share, net margin, redemption cost and member spend.',
  inputs: ['stores'],
  fn: (stores) => {
    const rd = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
    const s = [...stores].sort((a, b) => a.adoption_pct - b.adoption_pct);
    const names = ['Lowest adoption', 'Lower-middle', 'Upper-middle', 'Highest adoption'];
    const size = Math.ceil(s.length / 4);
    return names.map((group, i) => {
      const part = s.slice(i * size, (i + 1) * size);
      const avg = (k) => part.reduce((t, x) => t + x[k], 0) / part.length;
      const red = part.reduce((t, x) => t + x.redeem_k, 0), mem = part.reduce((t, x) => t + x.member_spend_k, 0);
      return {
        group, stores: part.length, adoption_from: part[0].adoption_pct, adoption_to: part[part.length - 1].adoption_pct,
        adoption_pct: rd(avg('adoption_pct')), member_pct: rd(avg('member_pct')), margin_pct: rd(avg('margin_pct')),
        redeem_per_store_k: rd(red / part.length), member_spend_per_store_k: Math.round(mem / part.length), redeem_pct_member: rd(100 * red / mem),
      };
    });
  },
});

dash.calc('loyalty_atv', {
  title: 'Member vs non-member spend per visit',
  description: 'Spend per transaction for loyalty members and non-members, estimated by regressing daily revenue on member and non-member transaction counts (no intercept), plus redemption cost per member transaction.',
  inputs: ['daily'],
  fn: (daily) => {
    const g = new Map();
    for (const r of daily) {
      const m = +r.loyalty_transactions, nm = +r.total_transactions - m, y = +r.total_revenue_gbp;
      for (const scope of ['All', r.store_format, r.region]) {
        if (!g.has(scope)) g.set(scope, { scope, aa: 0, ab: 0, bb: 0, ay: 0, by: 0, red: 0, m: 0, t: 0, n: 0 });
        const a = g.get(scope);
        a.aa += nm * nm; a.ab += nm * m; a.bb += m * m; a.ay += nm * y; a.by += m * y;
        a.red += +r.loyalty_redemption_cost_gbp; a.m += m; a.t += +r.total_transactions; a.n += 1;
      }
    }
    return [...g.values()].map((a) => {
      const det = a.aa * a.bb - a.ab * a.ab;
      const non = (a.ay * a.bb - a.by * a.ab) / det, mem = (a.aa * a.by - a.ab * a.ay) / det;
      return {
        scope: a.scope, days: a.n, atv_member: Math.round(mem * 100) / 100, atv_non_member: Math.round(non * 100) / 100,
        member_premium_pct: Math.round(1000 * (mem - non) / non) / 10, member_tx_pct: Math.round(1000 * a.m / a.t) / 10,
        redeem_per_member_tx: Math.round(100 * a.red / a.m) / 100,
      };
    });
  },
});

dash.calc('mix_q', {
  title: 'Revenue mix by quarter',
  description: 'Share of daily revenue from espresso, filter, food and retail beans in each quarter, for the estate, each format and each region.',
  inputs: ['daily'],
  fn: (daily) => {
    const g = new Map();
    for (const r of daily) {
      for (const scope of ['All', r.store_format, r.region]) {
        const period = r.year + ' Q' + r.quarter, k = scope + '|' + period;
        if (!g.has(k)) g.set(k, { scope, period, e: 0, f: 0, fo: 0, b: 0, t: 0 });
        const a = g.get(k);
        a.e += +r.espresso_revenue_gbp; a.f += +r.filter_revenue_gbp; a.fo += +r.food_revenue_gbp; a.b += +r.retail_beans_revenue_gbp; a.t += +r.total_revenue_gbp;
      }
    }
    const p = (x, t) => Math.round(1000 * x / t) / 10;
    return [...g.values()].sort((a, b) => a.period < b.period ? -1 : 1)
      .map((a) => ({ scope: a.scope, period: a.period, espresso_pct: p(a.e, a.t), filter_pct: p(a.f, a.t), food_pct: p(a.fo, a.t), beans_pct: p(a.b, a.t) }));
  },
});

dash.calc('mix_year', {
  title: 'Revenue mix, 2023 vs 2024',
  description: 'Each revenue stream\'s share of daily revenue in 2023 and 2024 and the change in percentage points, for the estate, each format and each region.',
  inputs: ['daily'],
  fn: (daily) => {
    const cats = [['Espresso drinks', 'espresso_revenue_gbp'], ['Food', 'food_revenue_gbp'], ['Filter coffee', 'filter_revenue_gbp'], ['Retail beans', 'retail_beans_revenue_gbp']];
    const g = new Map();
    for (const r of daily) {
      for (const scope of ['All', r.store_format, r.region]) {
        const k = scope + '|' + r.year;
        if (!g.has(k)) g.set(k, { t: 0, c: cats.map(() => 0) });
        const a = g.get(k); a.t += +r.total_revenue_gbp; cats.forEach(([, col], i) => { a.c[i] += +r[col]; });
      }
    }
    const out = [];
    const scopes = new Set([...g.keys()].map((k) => k.split('|')[0]));
    for (const scope of scopes) {
      const a = g.get(scope + '|2023'), b = g.get(scope + '|2024');
      if (!a || !b) continue;
      cats.forEach(([category], i) => {
        const s23 = Math.round(1000 * a.c[i] / a.t) / 10, s24 = Math.round(1000 * b.c[i] / b.t) / 10;
        out.push({ scope, category, share_2023_pct: s23, share_2024_pct: s24, change_pts: Math.round(10 * (s24 - s23)) / 10 });
      });
    }
    return out;
  },
});

dash.calc('cat_margin', {
  title: 'Product category margins',
  description: 'Average catalogue gross margin per product category, and how often a product in that category was a store\'s top seller on a sampled day in 2023 and 2024.',
  inputs: ['products', 'daily'],
  fn: (products, daily) => {
    const g = new Map();
    for (const p of products) {
      if (!g.has(p.product_category)) g.set(p.product_category, { category: p.product_category, n: 0, gm: 0, d23: 0, d24: 0 });
      const a = g.get(p.product_category); a.n += 1; a.gm += +p.gross_margin_pct;
    }
    let t23 = 0, t24 = 0;
    for (const r of daily) {
      const a = g.get(r.product_category); if (!a) continue;
      if (String(r.year) === '2023') { a.d23 += 1; t23 += 1; } else { a.d24 += 1; t24 += 1; }
    }
    return [...g.values()].map((a) => ({
      category: a.category, products: a.n, gross_margin_pct: Math.round(1000 * a.gm / a.n) / 10,
      top_seller_2023_pct: Math.round(1000 * a.d23 / t23) / 10, top_seller_2024_pct: Math.round(1000 * a.d24 / t24) / 10,
    })).sort((a, b) => b.gross_margin_pct - a.gross_margin_pct);
  },
});

dash.calc('dow', {
  title: 'Trading by day of week',
  description: 'Average daily revenue, staff hours and revenue per staff hour for each weekday, for the estate, each format and each region.',
  inputs: ['daily'],
  fn: (daily) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const g = new Map();
    for (const r of daily) {
      for (const scope of ['All', r.store_format, r.region]) {
        const k = scope + '|' + r.day_of_week;
        if (!g.has(k)) g.set(k, { scope, day: r.day_of_week, rev: 0, hrs: 0, n: 0 });
        const a = g.get(k); a.rev += +r.total_revenue_gbp; a.hrs += +r.total_staff_hours; a.n += 1;
      }
    }
    return [...g.values()].sort((a, b) => days.indexOf(a.day) - days.indexOf(b.day))
      .map((a) => ({ scope: a.scope, day: a.day, days: a.n, avg_revenue: Math.round(a.rev / a.n), avg_staff_hours: Math.round(10 * a.hrs / a.n) / 10, rev_per_staff_hour: Math.round(10 * a.rev / a.hrs) / 10 }));
  },
});

dash.calc('wkd', {
  title: 'Weekday vs weekend',
  description: 'Average daily revenue, staff hours and revenue per staff hour on weekdays and weekends, with the weekend gap, for the estate, each format and each region.',
  inputs: ['daily'],
  fn: (daily) => {
    const g = new Map();
    for (const r of daily) {
      const w = String(r.is_weekend) === 'True' ? 'we' : 'wd';
      for (const scope of ['All', r.store_format, r.region]) {
        if (!g.has(scope)) g.set(scope, { scope, wd: { r: 0, h: 0, n: 0 }, we: { r: 0, h: 0, n: 0 } });
        const a = g.get(scope)[w]; a.r += +r.total_revenue_gbp; a.h += +r.total_staff_hours; a.n += 1;
      }
    }
    return [...g.values()].map((a) => ({
      scope: a.scope, weekday_revenue: Math.round(a.wd.r / a.wd.n), weekend_revenue: Math.round(a.we.r / a.we.n),
      weekend_gap_pct: Math.round(1000 * (a.we.r / a.we.n - a.wd.r / a.wd.n) / (a.wd.r / a.wd.n)) / 10,
      weekday_hours: Math.round(10 * a.wd.h / a.wd.n) / 10, weekend_hours: Math.round(10 * a.we.h / a.we.n) / 10,
      all_rev_per_hour: Math.round(10 * (a.wd.r + a.we.r) / (a.wd.h + a.we.h)) / 10, weekday_rev_per_hour: Math.round(10 * a.wd.r / a.wd.h) / 10, weekend_rev_per_hour: Math.round(10 * a.we.r / a.we.h) / 10,
    }));
  },
});

dash.calc('daytype', {
  title: 'Trading by day type',
  description: 'Average daily revenue on standard days, school holidays, the Christmas period and bank holidays, and the gap to a standard day, for the estate, each format and each region.',
  inputs: ['daily'],
  fn: (daily) => {
    const order = ['Standard-Trading-Day', 'School-Holiday', 'Christmas-Period', 'Bank-Holiday'];
    const g = new Map();
    for (const r of daily) {
      for (const scope of ['All', r.store_format, r.region]) {
        const k = scope + '|' + r.uk_trading_calendar;
        if (!g.has(k)) g.set(k, { scope, type: r.uk_trading_calendar, rev: 0, n: 0 });
        const a = g.get(k); a.rev += +r.total_revenue_gbp; a.n += 1;
      }
    }
    const rows = [...g.values()];
    return rows.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type)).map((a) => {
      const std = g.get(a.scope + '|Standard-Trading-Day');
      const avg = a.rev / a.n, base = std ? std.rev / std.n : avg;
      return { scope: a.scope, day_type: a.type, days: a.n, avg_revenue: Math.round(avg), vs_standard_pct: Math.round(1000 * (avg - base) / base) / 10 };
    });
  },
});

dash.calc('kpi_delta', {
  title: 'Change 2023 → 2024',
  description: 'Change from 2023 to 2024 in revenue and net profit (percent) and in margin, loss-month share and member revenue share (percentage points), per scope.',
  inputs: ['pl_kpi'],
  fn: (pl_kpi) => {
    const by = new Map(pl_kpi.map((r) => [r.scope + '|' + r.year, r]));
    const scopes = [...new Set(pl_kpi.map((r) => r.scope))];
    const pct = (a, b) => Math.round(1000 * (b - a) / Math.abs(a)) / 10;
    const pts = (a, b) => Math.round(10 * (b - a)) / 10;
    return scopes.map((scope) => {
      const a = by.get(scope + '|2023'), b = by.get(scope + '|2024');
      return {
        scope, revenue_chg_pct: pct(a.revenue_m, b.revenue_m), profit_chg_pct: pct(a.profit_m, b.profit_m),
        margin_chg_pts: pts(a.margin_pct, b.margin_pct), loss_chg_pts: pts(a.loss_month_pct, b.loss_month_pct), member_chg_pts: pts(a.member_pct, b.member_pct),
      };
    });
  },
});

dash.calc('health', {
  title: 'Estate health',
  description: 'Share of store-months that were Profitable or Highly-Profitable, per scope.',
  inputs: ['pl_status'],
  fn: (pl_status) => {
    const g = new Map();
    for (const r of pl_status) {
      if (!g.has(r.scope)) g.set(r.scope, { scope: r.scope, ok: 0, n: 0 });
      const a = g.get(r.scope); a.n += r.months;
      if (r.status === 'Highly-Profitable' || r.status === 'Profitable') a.ok += r.months;
    }
    return [...g.values()].map((a) => ({ scope: a.scope, profitable_pct: Math.round(1000 * a.ok / a.n) / 10 }));
  },
});

dash.calc('flags', {
  title: 'Stores by flag',
  description: 'Number of stores flagged Healthy, Watch or Review on the store scorecard, per scope.',
  inputs: ['stores'],
  fn: (stores) => {
    const out = [];
    const scopes = ['All', ...new Set(stores.map((s) => s.store_format)), ...new Set(stores.map((s) => s.region))];
    for (const scope of scopes) {
      const mine = stores.filter((s) => scope === 'All' || s.store_format === scope || s.region === scope);
      for (const flag of ['Healthy', 'Watch', 'Review']) out.push({ scope, flag, stores: mine.filter((s) => s.flag === flag).length });
    }
    return out;
  },
});
