/* Spring to Sea field report (NEW_DIRECTION step 5).
   The game sends the trip as JSON (Quiz/FieldReport.cs -> SeaShowReport in SeaBridge.jslib) and
   this script draws the report over the game: the watershed pH profile of the student's own
   samples, a table of the samples, their photos, score and completion code, and one text box.
   The student can save it as a PDF (the browser's print window) or as a PNG picture.
   Everything happens in this browser tab: nothing is sent anywhere, and the text box is not saved. */
(function () {
  'use strict';

  // The pH paper chart colors, pH 0 to 14 (Quiz/PhPaper.cs, from the CHM 1020 virtual pH lab).
  var PAPER = ['#c41e3a', '#e03232', '#ee622c', '#f49228', '#f7be2d', '#f1de3e', '#c0d644', '#78bc4e',
               '#37a062', '#209682', '#287eac', '#3658a6', '#544298', '#683486', '#502668'];
  var TINTS = ['#eaf5fa', '#f6efe4', '#e9f4ec', '#eceff9', '#f3ecf6'];
  var INK = '#17211e', HEAD = '#0b3a52', MUTED = '#55666a', LINE = '#dbe5e8';
  var FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  var SVGNS = 'http://www.w3.org/2000/svg';

  var root = null, data = null, chartSvg = null, answer = '';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function svg(tag, attrs, text) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function swatch(ph) { return Math.max(0, Math.min(14, Math.round(ph))); }
  function paper(ph) { return PAPER[swatch(ph)]; }
  function textOn(ph) { var i = swatch(ph); return i >= 3 && i <= 7 ? INK : '#ffffff'; }
  function kindOf(s) { return s.kind === 'rain' ? 'rain' : s.kind === 'extra' ? 'extra' : 'water'; }

  // ---------------------------------------------------------------- styles
  function injectStyle() {
    if (document.getElementById('sea-report-style')) return;
    var css = [
      '#sea-report{position:fixed;inset:0;z-index:1000;overflow:auto;background:rgba(4,18,28,.9);padding:0 16px 32px;color:' + INK + ';font:15px/1.45 ' + FONT + '}',
      '#sea-report .bar{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;padding:10px 8px;margin:0 -16px 16px;background:rgba(4,18,28,.97)}',
      '#sea-report .bar button{font:inherit;font-weight:600;border:0;border-radius:8px;padding:9px 16px;cursor:pointer;background:#1c4c9a;color:#fff}',
      '#sea-report .bar button.alt{background:#e3e9e7;color:' + INK + '}',
      '#sea-report .bar .tip{color:#b6cad6;font-size:.88rem;flex-basis:100%;text-align:center}',
      '#sea-report .sheet{max-width:920px;margin:0 auto;background:#fff;border-radius:10px;padding:28px 32px 22px;box-shadow:0 10px 40px rgba(0,0,0,.35)}',
      '#sea-report h1{font-size:1.75rem;line-height:1.15;margin:0 0 4px;color:' + HEAD + '}',
      '#sea-report h2{font-size:1.1rem;margin:24px 0 8px;color:' + HEAD + ';border-bottom:2px solid ' + LINE + ';padding-bottom:4px}',
      '#sea-report .meta{color:' + MUTED + ';margin:0}',
      '#sea-report .code{font-weight:700;font-family:ui-monospace,Consolas,monospace;letter-spacing:.04em;color:' + INK + '}',
      '#sea-report .chart svg{width:100%;height:auto;display:block}',
      '#sea-report .legend{color:' + MUTED + ';font-size:.88rem;margin:4px 0 0}',
      '#sea-report table{width:100%;border-collapse:collapse;font-size:.92rem}',
      '#sea-report th,#sea-report td{text-align:left;padding:5px 6px;border-bottom:1px solid ' + LINE + ';vertical-align:middle}',
      '#sea-report th{font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;color:' + MUTED + '}',
      '#sea-report .chip{display:inline-block;min-width:3.6em;text-align:center;border-radius:4px;padding:1px 6px;font-weight:700}',
      '#sea-report .tool{color:' + MUTED + ';font-size:.82rem;margin-left:6px}',
      '#sea-report td.reading{white-space:nowrap}',
      '#sea-report .yes{color:#1d7a46;font-weight:600}',
      '#sea-report .no{color:#b3261e;font-weight:600}',
      '#sea-report .stats{display:flex;flex-wrap:wrap;gap:6px 26px;margin:0}',
      '#sea-report .stats b{color:' + HEAD + '}',
      '#sea-report .photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}',
      '#sea-report .photos img{width:100%;border-radius:6px;display:block}',
      '#sea-report textarea{width:100%;min-height:96px;font:inherit;padding:8px 10px;border:1px solid #b9c6c2;border-radius:6px;box-sizing:border-box}',
      '#sea-report .print-answer{display:none;white-space:pre-wrap;border:1px solid #b9c6c2;border-radius:6px;padding:8px 10px;min-height:60px}',
      '#sea-report .soft{color:' + MUTED + ';font-size:.88rem;margin:4px 0 0}',
      '#sea-report .foot{margin-top:22px;color:' + MUTED + ';font-size:.82rem}',
      '@media print{',
      '  @page{margin:12mm}',
      '  body.sea-report-open{background:#fff!important}',
      '  body.sea-report-open>*:not(#sea-report){display:none!important}',
      '  #sea-report{position:static;background:none;padding:0;overflow:visible}',
      '  #sea-report .bar,#sea-report textarea,#sea-report .no-print{display:none!important}',
      '  #sea-report .sheet{box-shadow:none;padding:0;max-width:none;border-radius:0}',
      '  #sea-report .print-answer{display:block}',
      '  #sea-report .chart,#sea-report tr,#sea-report .photos img{break-inside:avoid}',
      '}'
    ].join('\n');
    var style = el('style');
    style.id = 'sea-report-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------------------------------------------------------------- the pH profile chart
  // The student's own readings in route order, spring to reef, on the pH paper's color scale.
  function buildChart(samples, zones) {
    var W = 860, H = 340, L = 64, R = 18, T = 40, B = 46;
    var w = W - L - R, h = H - T - B, n = samples.length;
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img',
      'aria-label': 'Watershed pH profile: your samples from the spring to the reef.' });
    s.appendChild(svg('rect', { x: 0, y: 0, width: W, height: H, fill: '#ffffff' }));
    var y = function (ph) { return T + (14.5 - ph) / 15 * h; };
    var step = n > 0 ? w / n : w;
    var x = function (i) { return L + (i + 0.5) * step; };

    // Zone bands, named at the top.
    var names = {};
    (zones || []).forEach(function (z) { names[z.id] = z.name; });
    var start = 0, band = 0;
    for (var i = 1; i <= n; i++) {
      if (i === n || samples[i].zone !== samples[start].zone) {
        var x0 = L + start * step, x1 = L + i * step;
        s.appendChild(svg('rect', { x: x0, y: T, width: x1 - x0, height: h, fill: TINTS[band % TINTS.length] }));
        var label = names[samples[start].zone] || '';
        s.appendChild(svg('text', { x: (x0 + x1) / 2, y: T - 12, 'text-anchor': 'middle', 'font-family': FONT,
          'font-size': (x1 - x0) < 110 ? 11 : 13, 'font-weight': 700, fill: '#33515e' }, label));
        band++;
        start = i;
      }
    }

    // pH paper scale on the left, grid lines, neutral line.
    for (var p = 0; p <= 14; p++) {
      s.appendChild(svg('rect', { x: L - 16, y: y(p + 0.5), width: 10, height: h / 15, fill: PAPER[p] }));
    }
    for (p = 0; p <= 14; p += 2) {
      s.appendChild(svg('line', { x1: L, x2: W - R, y1: y(p), y2: y(p), stroke: '#c9d6db', 'stroke-width': 1 }));
      s.appendChild(svg('text', { x: L - 22, y: y(p) + 4, 'text-anchor': 'end', 'font-family': FONT, 'font-size': 12, fill: MUTED }, String(p)));
    }
    s.appendChild(svg('text', { x: 14, y: T - 12, 'font-family': FONT, 'font-size': 13, 'font-weight': 700, fill: '#33515e' }, 'pH'));
    s.appendChild(svg('line', { x1: L, x2: W - R, y1: y(7), y2: y(7), stroke: '#55666a', 'stroke-width': 1.5, 'stroke-dasharray': '6 5' }));
    s.appendChild(svg('text', { x: 2, y: y(7) + 4, 'font-family': FONT, 'font-size': 11, fill: MUTED }, 'neutral'));
    s.appendChild(svg('text', { x: L + 6, y: y(1.2), 'font-family': FONT, 'font-size': 11, fill: '#9a5a5a' }, 'more acidic'));
    s.appendChild(svg('text', { x: L + 6, y: y(13.2), 'font-family': FONT, 'font-size': 11, fill: '#4d5f9a' }, 'more basic'));

    if (n === 0) {
      s.appendChild(svg('text', { x: L + w / 2, y: T + h / 2, 'text-anchor': 'middle', 'font-family': FONT, 'font-size': 15, fill: MUTED }, 'No samples recorded on this trip.'));
      return s;
    }

    // A line through the water samples (buoys and stations), in route order.
    var pts = [];
    samples.forEach(function (sm, i) { if (kindOf(sm) === 'water') pts.push(x(i).toFixed(1) + ',' + y(sm.reading).toFixed(1)); });
    if (pts.length > 1) s.appendChild(svg('polyline', { points: pts.join(' '), fill: 'none', stroke: '#7d939b', 'stroke-width': 2 }));

    samples.forEach(function (sm, i) {
      var cx = x(i), cy = y(sm.reading), mark, k = kindOf(sm);
      if (k === 'rain') {
        mark = svg('path', { d: 'M' + cx + ' ' + (cy - 11) + ' L' + (cx + 10) + ' ' + cy + ' L' + cx + ' ' + (cy + 11) + ' L' + (cx - 10) + ' ' + cy + ' Z',
          fill: paper(sm.reading), stroke: INK, 'stroke-width': 1.5 });
      } else if (k === 'extra') {
        mark = svg('circle', { cx: cx, cy: cy, r: 7.5, fill: '#ffffff', stroke: paper(sm.reading), 'stroke-width': 3.5 });
      } else {
        mark = svg('circle', { cx: cx, cy: cy, r: 9, fill: paper(sm.reading), stroke: INK, 'stroke-width': 1.5 });
      }
      mark.appendChild(svg('title', {}, sm.label + ': pH ' + sm.readingText + ' (' + sm.tool + ')'));
      s.appendChild(mark);
      s.appendChild(svg('text', { x: cx, y: T + h + 17, 'text-anchor': 'middle', 'font-family': FONT,
        'font-size': step < 44 ? 10 : 12, fill: INK }, sm.tag));
    });
    s.appendChild(svg('text', { x: L + w / 2, y: H - 6, 'text-anchor': 'middle', 'font-family': FONT, 'font-size': 12, fill: MUTED },
      'Your samples in route order, spring to reef (numbers are buoys)'));
    return s;
  }

  // ---------------------------------------------------------------- the report
  function build() {
    var d = data;
    var overlay = el('div');
    overlay.id = 'sea-report';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Your field report');

    var bar = el('div', 'bar');
    var pdf = el('button', null, 'Save as PDF');
    var png = el('button', null, 'Download picture (PNG)');
    var back = el('button', 'alt', 'Back to the game');
    var tip = el('div', 'tip', 'Save as PDF opens the print window: choose "Save as PDF" as the printer. Nothing is sent anywhere.');
    pdf.type = png.type = back.type = 'button';
    pdf.onclick = function () { window.print(); };
    png.onclick = function () { downloadPng(png); };
    back.onclick = close;
    bar.appendChild(pdf); bar.appendChild(png); bar.appendChild(back); bar.appendChild(tip);
    overlay.appendChild(bar);

    var sheet = el('div', 'sheet');
    overlay.appendChild(sheet);
    sheet.appendChild(el('h1', null, 'Spring to Sea: field report'));
    sheet.appendChild(el('p', 'meta', 'CHM 1025 · Chapter 14: Acids and Bases · ' + d.date));
    var codeLine = el('p', 'meta');
    if (d.code) {
      codeLine.appendChild(document.createTextNode('Completion code '));
      codeLine.appendChild(el('span', 'code', d.code));
      codeLine.appendChild(document.createTextNode(' for the D2L username ' + d.username));
    } else {
      codeLine.textContent = 'No completion code yet: type your D2L username on the trip summary to get one.';
    }
    sheet.appendChild(codeLine);

    sheet.appendChild(el('h2', null, 'Watershed pH profile'));
    var chart = el('div', 'chart');
    chartSvg = buildChart(d.samples || [], d.zones || []);
    chart.appendChild(chartSvg);
    sheet.appendChild(chart);
    sheet.appendChild(el('p', 'legend', '● a buoy or station sample   ◆ rain from the rain gauge   ○ an extra sample. ' +
      'Each mark has the color your pH paper shows at that pH.'));

    sheet.appendChild(el('h2', null, 'Your samples'));
    var samples = d.samples || [];
    if (samples.length === 0) {
      sheet.appendChild(el('p', 'soft', 'No samples recorded on this trip.'));
    } else {
      var table = el('table');
      var head = el('tr');
      ['', 'Where', 'You predicted', 'Reading', 'Prediction'].forEach(function (t) { head.appendChild(el('th', null, t)); });
      table.appendChild(head);
      samples.forEach(function (sm, i) {
        var tr = el('tr');
        tr.appendChild(el('td', null, String(i + 1)));
        tr.appendChild(el('td', null, sm.label));
        tr.appendChild(el('td', null, sm.prediction));
        var td = el('td', 'reading');
        var chip = el('span', 'chip', 'pH ' + sm.readingText);
        chip.style.background = paper(sm.reading);
        chip.style.color = textOn(sm.reading);
        td.appendChild(chip);
        td.appendChild(el('span', 'tool', sm.tool));
        tr.appendChild(td);
        tr.appendChild(el('td', sm.predictionRight ? 'yes' : 'no', sm.predictionRight ? 'right' : 'not this time'));
        table.appendChild(tr);
      });
      sheet.appendChild(table);
    }

    sheet.appendChild(el('h2', null, 'Results'));
    var stats = el('p', 'stats');
    [['Questions right', d.questionsRight + ' of ' + d.questionsTotal],
     ['Predictions right', d.predictionsRight + ' of ' + d.predictionsTotal],
     ['Hints used', String(d.hints)],
     ['Score', String(d.score)]].forEach(function (pair) {
      var span = el('span');
      span.appendChild(document.createTextNode(pair[0] + ': '));
      span.appendChild(el('b', null, pair[1]));
      stats.appendChild(span);
    });
    sheet.appendChild(stats);

    sheet.appendChild(el('h2', null, 'Photos from the trip'));
    var photos = d.photos || [];
    if (photos.length === 0) {
      sheet.appendChild(el('p', 'soft', 'No photos on this trip. (Press P while you paddle to take some.)'));
    } else {
      var grid = el('div', 'photos');
      photos.forEach(function (src, i) {
        var img = el('img');
        img.src = src;
        img.alt = 'Photo ' + (i + 1) + ' from the trip';
        grid.appendChild(img);
      });
      sheet.appendChild(grid);
    }

    sheet.appendChild(el('h2', null, 'In your own words'));
    sheet.appendChild(el('p', null, d.prompt));
    var box = el('textarea');
    box.setAttribute('aria-label', d.prompt);
    box.maxLength = 1200;
    box.value = answer;
    var printed = el('div', 'print-answer', answer);
    box.addEventListener('input', function () { answer = box.value; printed.textContent = answer; });
    sheet.appendChild(box);
    sheet.appendChild(printed);
    sheet.appendChild(el('p', 'soft no-print', 'Your answer goes into the PDF and the picture. It is not saved: download the report before you leave the page.'));

    sheet.appendChild(el('p', 'foot', 'Made in Spring to Sea, a CHM 1025 game. This report was made in your browser; nothing was sent anywhere.'));

    overlay.addEventListener('keydown', function (e) {
      e.stopPropagation();   // keep the game from reacting to keys typed here
      if (e.key === 'Escape' && e.target !== box) close();
    });
    return overlay;
  }

  function open(d) {
    data = d || {};
    injectStyle();
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = build();
    document.body.appendChild(root);
    document.body.classList.add('sea-report-open');
    root.scrollTop = 0;
    var first = root.querySelector('.bar button');
    if (first) first.focus();
  }

  function close() {
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null;
    document.body.classList.remove('sea-report-open');
    var canvas = document.querySelector('#unity-canvas');
    if (canvas) canvas.focus();
  }

  // ---------------------------------------------------------------- PNG picture of the report
  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function wrap(ctx, text, maxWidth) {
    var lines = [];
    String(text).split(/\n/).forEach(function (para) {
      var words = para.split(/\s+/), line = '';
      words.forEach(function (word) {
        var test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
        else line = test;
      });
      lines.push(line);
    });
    return lines;
  }

  function downloadPng(button) {
    var d = data, W = 1200, M = 48, CW = W - 2 * M;
    var label = button.textContent;
    button.disabled = true;
    button.textContent = 'Making the picture…';

    var svgText = new XMLSerializer().serializeToString(chartSvg);
    var chartUrl = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
    var jobs = [loadImage(chartUrl)].concat((d.photos || []).map(loadImage));

    Promise.all(jobs).then(function (imgs) {
      URL.revokeObjectURL(chartUrl);
      var chartImg = imgs[0], photos = imgs.slice(1).filter(Boolean);
      var canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = 8000;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, canvas.height);
      var yy = M;
      var font = function (size, weight) { ctx.font = (weight || 400) + ' ' + size + 'px ' + FONT; };
      var text = function (t, x, size, color, weight) { font(size, weight); ctx.fillStyle = color || INK; ctx.fillText(t, x, yy); };
      var heading = function (t) {
        yy += 40; text(t, M, 24, HEAD, 700);
        yy += 10; ctx.fillStyle = LINE; ctx.fillRect(M, yy, CW, 3); yy += 30;
      };

      ctx.textBaseline = 'alphabetic';
      yy += 34; text('Spring to Sea: field report', M, 38, HEAD, 700);
      yy += 34; text('CHM 1025 · Chapter 14: Acids and Bases · ' + d.date, M, 20, MUTED);
      yy += 30; text(d.code ? 'Completion code ' + d.code + ' for the D2L username ' + d.username
                            : 'No completion code yet.', M, 20, d.code ? INK : MUTED, d.code ? 600 : 400);

      heading('Watershed pH profile');
      if (chartImg) {
        var ch = CW * chartImg.height / chartImg.width;
        ctx.drawImage(chartImg, M, yy - 12, CW, ch);
        yy += ch;
      }
      font(17); ctx.fillStyle = MUTED;
      wrap(ctx, '● a buoy or station sample   ◆ rain from the rain gauge   ○ an extra sample. Each mark has the color your pH paper shows at that pH.', CW)
        .forEach(function (ln) { yy += 24; ctx.fillText(ln, M, yy); });

      heading('Your samples');
      var cols = [M, M + 44, M + 520, M + 760, M + 960];
      font(15, 700); ctx.fillStyle = MUTED;
      ['', 'WHERE', 'YOU PREDICTED', 'READING', 'PREDICTION'].forEach(function (t, i) { ctx.fillText(t, cols[i], yy); });
      (d.samples || []).forEach(function (sm, i) {
        yy += 36;
        ctx.fillStyle = LINE; ctx.fillRect(M, yy - 26, CW, 1);
        font(17); ctx.fillStyle = INK;
        ctx.fillText(String(i + 1), cols[0], yy);
        var where = sm.label;
        while (ctx.measureText(where).width > cols[2] - cols[1] - 16 && where.length > 4) where = where.slice(0, -2);
        if (where !== sm.label) where = where.replace(/\s+$/, '') + '…';
        ctx.fillText(where, cols[1], yy);
        ctx.fillText(sm.prediction, cols[2], yy);
        ctx.fillStyle = paper(sm.reading); ctx.fillRect(cols[3], yy - 20, 92, 27);
        font(17, 700); ctx.fillStyle = textOn(sm.reading); ctx.fillText('pH ' + sm.readingText, cols[3] + 8, yy);
        font(14); ctx.fillStyle = MUTED; ctx.fillText(sm.tool, cols[3] + 100, yy);
        font(17, 600); ctx.fillStyle = sm.predictionRight ? '#1d7a46' : '#b3261e';
        ctx.fillText(sm.predictionRight ? 'right' : 'not this time', cols[4], yy);
      });
      if (!(d.samples || []).length) { yy += 30; text('No samples recorded on this trip.', M, 17, MUTED); }

      heading('Results');
      text('Questions right: ' + d.questionsRight + ' of ' + d.questionsTotal +
           '     Predictions right: ' + d.predictionsRight + ' of ' + d.predictionsTotal +
           '     Hints used: ' + d.hints + '     Score: ' + d.score, M, 18, INK, 600);

      heading('Photos from the trip');
      if (photos.length === 0) {
        text('No photos on this trip.', M, 17, MUTED);
      } else {
        var gap = 12, pw = (CW - 2 * gap) / 3, ph = pw * 9 / 16, top = yy - 16;
        photos.forEach(function (img, i) {
          var px = M + (i % 3) * (pw + gap), py = top + Math.floor(i / 3) * (ph + gap);
          ctx.drawImage(img, px, py, pw, ph);
        });
        yy = top + Math.ceil(photos.length / 3) * (ph + gap) - gap + 4;
      }

      heading('In your own words');
      font(18, 600); ctx.fillStyle = INK;
      wrap(ctx, d.prompt, CW).forEach(function (ln, i) { if (i) yy += 26; ctx.fillText(ln, M, yy); });
      yy += 14;
      font(18); ctx.fillStyle = answer.trim() ? INK : MUTED;
      var lines = answer.trim() ? wrap(ctx, answer.trim(), CW - 24) : ['(no answer written)'];
      var boxTop = yy;
      lines.forEach(function (ln) { yy += 28; ctx.fillText(ln, M + 12, yy); });
      yy += 16;
      ctx.strokeStyle = '#b9c6c2'; ctx.lineWidth = 1.5; ctx.strokeRect(M, boxTop, CW, yy - boxTop);

      yy += 44; text('Made in Spring to Sea, a CHM 1025 game. This report was made in your browser; nothing was sent anywhere.', M, 15, MUTED);
      yy += M;

      var out = document.createElement('canvas');
      out.width = W; out.height = Math.ceil(yy);
      out.getContext('2d').drawImage(canvas, 0, 0);
      out.toBlob(function (blob) {
        if (!blob) { button.disabled = false; button.textContent = 'The picture did not work: use Save as PDF'; return; }
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'spring-to-sea-field-report.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
        button.disabled = false; button.textContent = label;
      }, 'image/png');
    }).catch(function () {
      button.disabled = false;
      button.textContent = 'The picture did not work: use Save as PDF';
    });
  }

  window.SpringToSeaReport = { open: open, close: close };
})();
