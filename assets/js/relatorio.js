/* ==========================================================================
   Fornalha — relatório do dia (PDF)
   Resumo, caixa, formas de pagamento, fluxo por hora e lista de pedidos.
   Usa o jsPDF (assets/vendor/jspdf.umd.min.js), carregado só quando o
   relatório é gerado.
   ========================================================================== */
(function () {
  'use strict';
  const U = window.UI;

  const METHOD_LABEL = { cash: 'Dinheiro', pix: 'PIX', card: 'Cartão' };
  const STATUS_LABEL = { novo: 'Novo', preparo: 'Em preparo', entrega: 'Saiu para entrega', finalizado: 'Finalizado', cancelado: 'Cancelado' };
  const OPEN = ['novo', 'preparo', 'entrega'];

  /**
   * Números do dia.
   * orders: [{ number, createdAt: Date, customer, mode, method, status, total, fee, products: [{ label, qty }] }]
   */
  function summarize(orders, { fund = 0 } = {}) {
    const all = [...orders].sort((a, b) => a.createdAt - b.createdAt);
    const valid = all.filter(o => o.status !== 'cancelado');
    const canceled = all.filter(o => o.status === 'cancelado');
    const sum = list => list.reduce((n, o) => n + o.total, 0);
    const revenue = sum(valid);

    const byMethod = ['cash', 'pix', 'card'].map(m => {
      const list = valid.filter(o => o.method === m);
      return { method: m, label: METHOD_LABEL[m], count: list.length, total: sum(list) };
    });
    const cashDone = valid.filter(o => o.method === 'cash' && o.status === 'finalizado');
    const cashOpen = valid.filter(o => o.method === 'cash' && OPEN.includes(o.status));

    const deliveries = valid.filter(o => o.mode === 'entrega');
    const hours = {};
    valid.forEach(o => { const h = o.createdAt.getHours(); (hours[h] = hours[h] || { hour: h, count: 0, total: 0 }); hours[h].count++; hours[h].total += o.total; });
    const hourList = Object.values(hours).sort((a, b) => a.hour - b.hour);
    const peak = hourList.reduce((a, h) => (h.count > (a ? a.count : 0) ? h : a), null);

    const statusList = ['novo', 'preparo', 'entrega', 'finalizado', 'cancelado'].map(s => {
      const list = all.filter(o => o.status === s);
      return { status: s, label: STATUS_LABEL[s], count: list.length, total: sum(list) };
    });

    const prod = {};
    valid.forEach(o => (o.products || []).forEach(p => { prod[p.label] = (prod[p.label] || 0) + (p.qty || 1); }));
    const topProducts = Object.entries(prod).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, qty]) => ({ label, qty }));

    return {
      orders: all, valid, canceled, revenue,
      ticket: valid.length ? revenue / valid.length : 0,
      deliveries: deliveries.length, deliveryFees: deliveries.reduce((n, o) => n + (o.fee || 0), 0),
      pickups: valid.length - deliveries.length,
      byMethod, hourList, peak, statusList, topProducts,
      cash: {
        fund,
        done: sum(cashDone), doneCount: cashDone.length,
        open: sum(cashOpen), openCount: cashOpen.length,
        expected: fund + sum(cashDone)
      },
      openCount: valid.filter(o => OPEN.includes(o.status)).length
    };
  }

  let loading = null;
  function loadJsPDF() {
    if (window.jspdf) return Promise.resolve(window.jspdf.jsPDF);
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'assets/vendor/jspdf.umd.min.js';
        s.onload = () => (window.jspdf ? resolve(window.jspdf.jsPDF) : reject(new Error('Não foi possível preparar o PDF.')));
        s.onerror = () => { loading = null; reject(new Error('Não foi possível preparar o PDF. Confira a internet e tente de novo.')); };
        document.head.appendChild(s);
      });
    }
    return loading;
  }

  // As fontes padrão do PDF não têm alguns símbolos; troca por equivalentes simples.
  const clean = s => String(s == null ? '' : s).replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, '...').replace(/[^\x20-\x7E -ÿ]/g, '');
  const brl = v => U.brl(v).replace(/ /g, ' ');

  /** Gera o PDF e devolve o documento jsPDF. */
  async function pdf(data, meta) {
    const JsPDF = await loadJsPDF();
    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, H = 297, M = 14, CW = W - M * 2;
    const C = { brand: [184, 35, 28], ink: [42, 24, 16], ink3: [120, 100, 88], line: [225, 210, 192], soft: [250, 243, 234], ok: [31, 122, 69], cream: [244, 225, 196] };
    let y = 0;

    const text = (s, x, yy, o = {}) => {
      doc.setFont('helvetica', o.bold ? 'bold' : 'normal');
      doc.setFontSize(o.size || 10);
      doc.setTextColor(...(o.color || C.ink));
      doc.text(clean(s), x, yy, { align: o.align || 'left', maxWidth: o.maxWidth });
    };
    const fit = (s, w, size, bold) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
      let t = clean(s);
      if (doc.getTextWidth(t) <= w) return t;
      while (t.length > 1 && doc.getTextWidth(t + '...') > w) t = t.slice(0, -1);
      return t + '...';
    };
    const need = h => { if (y + h > H - 18) { doc.addPage(); y = M + 4; } };
    const section = title => {
      need(16);
      y += 4;
      text(title.toUpperCase(), M, y, { bold: true, size: 9, color: C.brand });
      doc.setDrawColor(...C.brand); doc.setLineWidth(0.4); doc.line(M, y + 1.6, M + CW, y + 1.6);
      y += 7;
    };
    /** Tabela simples: cols [{ label, w, align }], rows [[texto | { t, color } | { bar: 0..1 }]]. */
    const table = (cols, rows, o = {}) => {
      const rowH = 6.4;
      const head = () => {
        doc.setFillColor(...C.soft); doc.rect(M, y - 4.4, CW, rowH, 'F');
        let x = M;
        cols.forEach(c => { text(c.label, c.align === 'right' ? x + c.w - 2 : x + 2, y, { bold: true, size: 8, color: C.ink3, align: c.align }); x += c.w; });
        y += rowH;
      };
      need(rowH * 2); head();
      rows.forEach((r, i) => {
        if (y + rowH > H - 18) { doc.addPage(); y = M + 4; head(); }
        const bold = o.boldLast && i === rows.length - 1;
        let x = M;
        cols.forEach((c, j) => {
          const cell = r[j];
          if (cell && cell.bar !== undefined) {
            doc.setFillColor(...C.brand); doc.rect(x + 2, y - 3.2, Math.max(0.6, (c.w - 4) * cell.bar), 3.4, 'F');
          } else {
            const t = fit(cell && cell.t !== undefined ? cell.t : cell, c.w - 4, 9, bold);
            text(t, c.align === 'right' ? x + c.w - 2 : x + 2, y, { size: 9, bold, color: cell && cell.color ? cell.color : C.ink, align: c.align });
          }
          x += c.w;
        });
        doc.setDrawColor(...C.line); doc.setLineWidth(0.2); doc.line(M, y + 2.2, M + CW, y + 2.2);
        y += rowH;
      });
      y += 2;
    };

    /* ---------- Cabeçalho ---------- */
    doc.setFillColor(...C.brand); doc.rect(0, 0, W, 34, 'F');
    text(meta.store, M, 13, { bold: true, size: 18, color: C.cream });
    text('RELATÓRIO DO DIA', M, 21, { bold: true, size: 11, color: [255, 250, 243] });
    text(meta.dateLong, M, 28, { size: 10, color: C.cream });
    text(`Gerado em ${meta.generatedAt}`, W - M, 21, { size: 8.5, color: C.cream, align: 'right' });
    text(`por ${meta.user}`, W - M, 28, { size: 8.5, color: C.cream, align: 'right' });
    y = 44;

    /* ---------- Resumo ---------- */
    const boxes = [
      ['Pedidos', String(data.valid.length)],
      ['Faturamento', brl(data.revenue)],
      ['Ticket médio', brl(data.ticket)],
      ['Cancelados', String(data.canceled.length)]
    ];
    const bw = (CW - 9) / 4;
    boxes.forEach(([label, value], i) => {
      const x = M + i * (bw + 3);
      doc.setDrawColor(...C.line); doc.setLineWidth(0.3); doc.setFillColor(255, 255, 255); doc.roundedRect(x, y - 6, bw, 19, 2, 2, 'FD');
      text(label.toUpperCase(), x + 3, y - 1, { bold: true, size: 7.5, color: C.ink3 });
      text(value, x + 3, y + 8, { bold: true, size: 14 });
    });
    y += 20;
    text(`Entregas: ${data.deliveries} (taxas ${brl(data.deliveryFees)})   ·   Retiradas: ${data.pickups}   ·   ${data.peak ? `Pico: ${data.peak.hour}h com ${data.peak.count} pedido${data.peak.count > 1 ? 's' : ''}` : 'Sem pedidos no dia'}`, M, y, { size: 9, color: C.ink3 });
    y += 4;
    if (data.openCount) {
      y += 4;
      text(`Atenção: ${data.openCount} pedido${data.openCount > 1 ? 's' : ''} ainda em andamento (não finalizado${data.openCount > 1 ? 's' : ''}).`, M, y, { bold: true, size: 9, color: C.brand });
      y += 4;
    }

    /* ---------- Caixa ---------- */
    section('Caixa (dinheiro)');
    need(44);
    const cy = y - 4;
    doc.setFillColor(...C.soft); doc.setDrawColor(...C.line); doc.roundedRect(M, cy, CW, 38, 2, 2, 'FD');
    const line = (label, value, yy, o = {}) => { text(label, M + 5, yy, { size: o.size || 10, bold: o.bold, color: o.color }); text(value, M + CW - 5, yy, { size: o.size || 10, bold: o.bold, color: o.color, align: 'right' }); };
    line('Fundo de troco (início do dia)', brl(data.cash.fund), cy + 7);
    line(`+ Dinheiro de pedidos finalizados (${data.cash.doneCount})`, brl(data.cash.done), cy + 14);
    doc.setDrawColor(...C.ink); doc.setLineWidth(0.4); doc.line(M + 5, cy + 18, M + CW - 5, cy + 18);
    line('= DEVE TER NO CAIXA', brl(data.cash.expected), cy + 26, { bold: true, size: 14, color: C.brand });
    text(data.cash.openCount ? `Ainda em andamento em dinheiro: ${brl(data.cash.open)} (${data.cash.openCount} pedido${data.cash.openCount > 1 ? 's' : ''}). Entra no caixa quando o pedido for finalizado.` : 'Nenhum pedido em dinheiro em andamento.', M + 5, cy + 33.5, { size: 8.5, color: C.ink3, maxWidth: CW - 10 });
    y = cy + 38 + 6;
    const pix = data.byMethod.find(m => m.method === 'pix'), card = data.byMethod.find(m => m.method === 'card');
    text(`Fora do caixa:  PIX ${brl(pix.total)} (confira no extrato do banco)   ·   Cartão ${brl(card.total)} (confira na maquininha)`, M, y, { size: 9, color: C.ink3 });
    y += 4;

    /* ---------- Formas de pagamento ---------- */
    section('Formas de pagamento');
    table(
      [{ label: 'Forma', w: 70 }, { label: 'Pedidos', w: 30, align: 'right' }, { label: 'Valor', w: 46, align: 'right' }, { label: '% do faturamento', w: CW - 146, align: 'right' }],
      data.byMethod.map(m => [m.label, String(m.count), brl(m.total), data.revenue ? `${Math.round((m.total / data.revenue) * 1000) / 10}%`.replace('.', ',') : '0%'])
        .concat([['Total', String(data.valid.length), brl(data.revenue), '100%']]),
      { boldLast: true }
    );

    /* ---------- Fluxo por hora ---------- */
    section('Fluxo de pedidos por hora');
    if (data.hourList.length) {
      const maxC = Math.max(...data.hourList.map(h => h.count));
      table(
        [{ label: 'Horário', w: 34 }, { label: 'Pedidos', w: 24, align: 'right' }, { label: 'Valor', w: 36, align: 'right' }, { label: '', w: CW - 94 }],
        data.hourList.map(h => [`${String(h.hour).padStart(2, '0')}h - ${String(h.hour).padStart(2, '0')}h59`, String(h.count), brl(h.total), { bar: h.count / maxC }])
      );
    } else { text('Nenhum pedido neste dia.', M, y, { size: 9, color: C.ink3 }); y += 6; }

    /* ---------- Situação ---------- */
    section('Situação dos pedidos');
    table(
      [{ label: 'Situação', w: 70 }, { label: 'Pedidos', w: 30, align: 'right' }, { label: 'Valor', w: CW - 100, align: 'right' }],
      data.statusList.map(s => [s.label, String(s.count), brl(s.total)])
    );

    /* ---------- Mais vendidos ---------- */
    if (data.topProducts.length) {
      section('Mais vendidos do dia');
      table([{ label: 'Item', w: CW - 30 }, { label: 'Qtd.', w: 30, align: 'right' }], data.topProducts.map(p => [p.label, String(p.qty)]));
    }

    /* ---------- Lista ---------- */
    section(`Pedidos do dia (${data.orders.length})`);
    if (data.orders.length) {
      table(
        [{ label: 'Nº', w: 16 }, { label: 'Hora', w: 15 }, { label: 'Cliente', w: 50 }, { label: 'Tipo', w: 21 }, { label: 'Pagamento', w: 24 }, { label: 'Situação', w: 32 }, { label: 'Total', w: CW - 158, align: 'right' }],
        data.orders.map(o => [`#${o.number}`, o.time, o.customer, o.mode === 'entrega' ? 'Entrega' : 'Retirada', METHOD_LABEL[o.method] || '-', o.status === 'cancelado' ? { t: 'Cancelado', color: C.brand } : STATUS_LABEL[o.status] || o.status, brl(o.total)])
      );
    } else { text('Nenhum pedido neste dia.', M, y, { size: 9, color: C.ink3 }); y += 6; }

    /* ---------- Conferência ---------- */
    need(28);
    y += 8;
    text('Dinheiro contado no caixa: R$ ____________', M, y, { size: 10 });
    text('Diferença: R$ ____________', M + CW / 2 + 10, y, { size: 10 });
    y += 12;
    doc.setDrawColor(...C.ink); doc.setLineWidth(0.3);
    doc.line(M, y, M + 80, y); doc.line(M + CW - 80, y, M + CW, y);
    text('Conferido por', M, y + 4.5, { size: 8.5, color: C.ink3 });
    text('Assinatura', M + CW - 80, y + 4.5, { size: 8.5, color: C.ink3 });

    /* ---------- Rodapé ---------- */
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor(...C.line); doc.setLineWidth(0.2); doc.line(M, H - 11, W - M, H - 11);
      text(`${meta.store} · Relatório de ${meta.dateShort}`, M, H - 6.5, { size: 8, color: C.ink3 });
      text(`Página ${i} de ${pages}`, W - M, H - 6.5, { size: 8, color: C.ink3, align: 'right' });
    }
    return doc;
  }

  window.Relatorio = { summarize, pdf, METHOD_LABEL };
})();
