"""
Replace broken PDF/template block inside doExportPDF in js/app.js.
Run: python3 scripts/rewrite_pdf_block.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
app_js = ROOT / "js" / "app.js"
text = app_js.read_text(encoding="utf-8")

start_marker = "  const toast = document.createElement('div');\n"
start = text.find(start_marker)
if start < 0:
    raise SystemExit("toast start marker not found")

end_marker = "  if (toast.parentNode) toast.parentNode.removeChild(toast);"
end = text.find(end_marker)
if end < 0:
    raise SystemExit("toast cleanup marker not found")

NEW = """  const toast = document.createElement('div');
  toast.textContent = Ui('flight.captureMaps');
  Object.assign(toast.style, { position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)',
    background:'#1d1d1f', color:'#fff', padding:'10px 22px', borderRadius:'20px',
    fontSize:'14px', fontFamily:'var(--font)', zIndex:9999, boxShadow:'0 4px 20px rgba(0,0,0,0.3)' });
  document.body.appendChild(toast);

  try {
  const [mapCqUrl, mapXjUrl] = await Promise.all([
    captureMap('map-cq', 'page-overview', window._mapCQ),
    captureMap('map-xj', 'page-xj', window._mapXJ),
  ]);

  toast.textContent = Ui('flight.buildPdf');
  await new Promise(r => setTimeout(r, 50));

  function txt(key) {
    const el = document.querySelector(`[data-key="${key}"]`);
    return el ? el.innerText.trim() : '';
  }

  const allDays = [...DAYS_CQ, ...DAYS_XJ];
  const cqCount = DAYS_CQ.length;
  const tmPdf = TRIP_META || {};
  const daysPdfStr = String(tmPdf.totalDays != null ? tmPdf.totalDays : allDays.length);
  const gsPdfStr = String(tmPdf.groupSize != null ? tmPdf.groupSize : 4);
  const drivePdfStr = escapeHtml(Tx(tmPdf.statDrivingKmApprox || ''));
  const budgetPdfStr = escapeHtml(Tx(tmPdf.statBudgetApprox || ''));
  const OvPdf = PAGE_SEED && PAGE_SEED.overview ? PAGE_SEED.overview : {};
  const heroSubPdfRaw = OvPdf.heroSub ? Tx(OvPdf.heroSub) : txt('hero-sub');

  function buildDayHtml(d) {
    const card = document.getElementById('card-' + d.id);
    if (card && card.classList.contains('card-hidden')) return '';
    const title = escapeHtml(txt(`${d.id}-title`) || Tx(d.title));
    const meta = escapeHtml(txt(`${d.id}-meta`) || Tx(d.meta));
    const desc = escapeHtml(txt(`${d.id}-desc`) || Tx(d.desc));

    const tlHtml = d.timeline
      ? `<div class="tl">${d.timeline.map(t =>
      `<div class="tl-item"><div class="tl-time">${escapeHtml(Tx(t.time))}</div><div class="tl-icon">${escapeHtml(String(t.icon || ''))}</div><div class="tl-lbl">${escapeHtml(Tx(t.label))}</div></div>`
    ).join('')}</div>` : '';

    const actsHtml = (d.activities || []).map((a, i) => {
      const name  = escapeHtml(txt(`${d.id}-act${i}-name`) || Tx(a.name));
      const adesc = escapeHtml(txt(`${d.id}-act${i}-desc`) || Tx(a.desc));
      const costRaw = txt(`${d.id}-act${i}-cost`) || (a.cost != null ? Tx(a.cost) : '');
      const cost  = escapeHtml(costRaw.replace(/^💰\\s*/, ''));
      return `<div class="act">
        <span class="act-ico">${escapeHtml(String(a.icon || ''))}</span>
        <div>
          <div class="act-name">${name}</div>
          <div class="act-desc">${adesc}</div>
          ${cost ? `<div class="act-cost">💰 ${cost}</div>` : ''}
        </div>
      </div>`;
    }).join('');

    return `<div class="day">
      <div class="day-hdr">
        <div class="day-num"><span>${escapeHtml(Tx(d.day))}</span><strong>${escapeHtml(Tx(d.date))}</strong><span>${escapeHtml(daySeqLabel(d.num))}</span></div>
        <div class="day-info"><div class="day-ttl">${title}</div><div class="day-meta">${meta}</div></div>
      </div>
      <div class="day-body">
        ${tlHtml}
        <p class="day-desc">${desc}</p>
        <div class="acts">${actsHtml}</div>
      </div>
    </div>`;
  }

  function buildStayHtml(s) {
    const card = document.getElementById('card-stay-' + s.id);
    if (card && card.classList.contains('card-hidden')) return '';
    const symStay = tmPdf.currencySymbol || '¥';
    const name  = escapeHtml(txt(`stay-${s.id}-name`) || Tx(s.name));
    const loc   = escapeHtml(txt(`stay-${s.id}-loc`) || Tx(s.loc));
    const areasRaw = txt(`stay-${s.id}-areas`);
    const areasJoin = areasRaw || (Array.isArray(s.areas) ? s.areas.map(x => Tx(x)).join(' · ') : '');
    const areas = escapeHtml(areasJoin);
    const min   = escapeHtml(txt(`stay-${s.id}-min`) || String(s.minPrice));
    const max   = escapeHtml(txt(`stay-${s.id}-max`) || String(s.maxPrice));
    const tip   = escapeHtml((txt(`stay-${s.id}-tip`) || Tx(s.tip)).replace(/^💡\\s*/, ''));
    const nightsLbl = escapeHtml(Tx(s.nights));
    return `<div class="stay">
      <div class="stay-top"><span class="stay-name">${name}</span><span class="stay-nights">${nightsLbl}</span></div>
      <div class="stay-loc">📍 ${loc}</div>
      <div class="stay-price">${symStay}${min}–${max} <span class="stay-price-sub">${escapeHtml(Ui('stay.perNightWhole'))}</span></div>
      <div class="stay-areas">${escapeHtml(Ui('stay.bestAreas'))}: ${areas}</div>
      <div class="stay-tip">💡 ${tip}</div>
    </div>`;
  }

  function buildCostRowsPdf() {
    let lastSlug = '';
    const sym = tmPdf.currencySymbol || '¥';
    return COSTS.map((c, i) => {
      const slug = costRowSlug(c, i);
      const span = COSTS.filter((x, j) => costRowSlug(x, j) === slug).length;
      const catCell = slug !== lastSlug ? `<td class="cost-cat" rowspan="${span}">${escapeHtml(Tx(c.cat))}</td>` : '';
      if (slug !== lastSlug) lastSlug = slug;
      const itemTxt = txt(`cost-${i}-item`);
      const item  = escapeHtml(itemTxt || Tx(c.item));
      const totalTxt = txt(`cost-${i}-total`);
      const ppTxt = txt(`cost-${i}-pp`);
      const noteTxt = txt(`cost-${i}-note`);
      const totalSrc = totalTxt !== '' ? totalTxt : String(c.total ?? '');
      const ppSrc = ppTxt !== '' ? ppTxt : String(c.pp ?? '');
      const note  = escapeHtml(noteTxt || Tx(c.note));
      const totalNum = String(totalSrc).replace(/[^0-9.]/g, '');
      const totalFmt =
        totalNum && !Number.isNaN(Number(totalNum))
          ? sym + Number(totalNum).toLocaleString(undefined, { maximumFractionDigits: 0 })
          : sym + escapeHtml(totalSrc);
      const ppNum = String(ppSrc).replace(/[^0-9.]/g, '');
      const ppFmt =
        ppNum && !Number.isNaN(Number(ppNum))
          ? sym + Number(ppNum).toLocaleString(undefined, { maximumFractionDigits: 0 })
          : sym + escapeHtml(ppSrc);
      return `<tr>${catCell}<td>${item}</td><td class="cost-amt">${totalFmt}</td><td class="cost-pp">${ppFmt}</td><td class="cost-note">${note}</td></tr>`;
    }).join('');
  }

  function buildTipHtmlPdf(t, ti) {
    const card = document.getElementById('card-tip-' + ti);
    if (card && card.classList.contains('card-hidden')) return '';
    const title = escapeHtml(txt(`tip-${ti}-title`) || Tx(t.title));
    const items = (t.items || []).map((_, ii) =>
      `<li>${escapeHtml(txt(`tip-${ti}-item${ii}`) || Tx(t.items[ii]))}</li>`
    ).join('');
    return `<div class="tip-card"><div class="tip-ico">${escapeHtml(String(t.icon || ''))}</div><div class="tip-ttl">${title}</div><ul class="tip-list">${items}</ul></div>`;
  }

  const cqPdf = allDays.slice(0, cqCount).map(buildDayHtml).join('');
  const xjPdf = allDays.slice(cqCount).map(buildDayHtml).join('');
  const staysHtml = STAYS.map(buildStayHtml).join('');
  const costRows  = buildCostRowsPdf();
  const tipsHtml  = TIPS.map(buildTipHtmlPdf).join('');

  const checklistState = loadChecklistState();
  const sortLabelsPdf = {
    urgency: Ui('checklist.sort.urgency'),
    category: Ui('checklist.sort.category'),
    city: Ui('checklist.sort.city'),
    date: Ui('checklist.sort.date'),
    status: Ui('checklist.sort.status'),
  };
  const pdfGroups = getChecklistGroups();
  const bookedPdf = Ui('checklist.slotBookedSuffix');
  const checklistHtml = pdfGroups.map(g => {
    const done  = g.items.filter(it => checklistState[it.id]).length;
    const total = g.items.length;
    return `<div class="cl-group-pdf">
      <div class="cl-group-pdf-hdr" style="background:${g.color}">
        <div><div class="cl-group-pdf-title">${escapeHtml(g.label)}</div><div class="cl-group-pdf-sub">${escapeHtml(g.sub)}</div></div>
        <div class="cl-group-pdf-badge">${done}/${total} ${escapeHtml(bookedPdf)}</div>
      </div>
      <div class="cl-items-pdf">
        ${g.items.map(it => {
          const checked = !!checklistState[it.id];
          return `<div class="cl-item-pdf">
            <div class="cl-box" style="${checked ? 'background:#34c759;border-color:#34c759' : ''}"></div>
            <div class="cl-ico-pdf">${escapeHtml(String(it.icon || ''))}</div>
            <div class="cl-body-pdf">
              <div class="cl-title-pdf"${checked ? ' style="text-decoration:line-through;color:#999"' : ''}>${escapeHtml(Tx(it.title))}</div>
              <div class="cl-dates-pdf">${escapeHtml(Tx(it.dates))}</div>
              <div class="cl-detail-pdf">${escapeHtml(Tx(it.detail))}</div>
              <div class="cl-meta-pdf"><strong>💰 ${escapeHtml(Tx(it.est))}</strong> &nbsp;·&nbsp; 🔗 ${escapeHtml(Tx(it.where))}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');

  const htmlLang = APP_LANG === 'zh' ? 'zh-Hans' : 'en';
  const heroSubPdf = escapeHtml(heroSubPdfRaw);
  const totalPP  = document.getElementById('total-pp')?.textContent    || budgetPdfStr;
  const totalGrp = document.getElementById('total-group')?.textContent || '';

  const pdfCssRaw = await fetch(contentUrl('styles/pdf-export.css')).then(r => {
    if (!r.ok) throw new Error(`pdf-export.css HTTP ${r.status}`);
    return r.text();
  });
  const pageRule = `@page { size: A4 ${isLandscape ? 'landscape' : 'portrait'}; margin: 14mm 14mm 16mm 14mm; }`;
  const CSS = pdfCssRaw.replace('/* __PDF_PAGE__ */', pageRule);

  const P = PAGE_SEED && PAGE_SEED.pdf ? PAGE_SEED.pdf : {};
  function pdfTx(key, fallback) {
    const raw = Object.prototype.hasOwnProperty.call(P, key) ? P[key] : fallback;
    return escapeHtml(Tx(raw));
  }

  const colCat = escapeHtml(Ui('pdf.thCategory'));
  const colItem = escapeHtml(Ui('pdf.thItem'));
  const colTot = escapeHtml(Ui('pdf.thGroup'));
  const colPp = escapeHtml(Ui('pdf.thPP'));
  const colNote = escapeHtml(Ui('pdf.thNotes'));
  const mapsFallback = `<p style="color:#888;font-size:9pt">${escapeHtml(Ui('pdf.mapsMissing'))}</p>`;

  const HTML = `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${pdfTx('docTitle', OvPdf.heroTitle || { en: 'Chongqing ↔ Xinjiang — itinerary', zh: '重庆 ↔ 新疆 — 行程' })}</title>
<style>${CSS}</style>
</head>
<body>

<div class="cover">
  <div>
    <div class="cover-label">${pdfTx('coverLabel')}</div>
    <div class="cover-title">${pdfTx('coverTitle', OvPdf.heroTitle || { en: 'Chongqing & Xinjiang', zh: '重庆与新疆' })}</div>
    <div class="cover-sub">${heroSubPdf}</div>
    <div class="stats">
      <div class="stat-box"><div class="stat-val">${escapeHtml(daysPdfStr)}</div><div class="stat-lbl">${escapeHtml(Ui('stat.daysTotal'))}</div></div>
      <div class="stat-box"><div class="stat-val">${escapeHtml(gsPdfStr)}</div><div class="stat-lbl">${escapeHtml(Ui('stat.travellers'))}</div></div>
      <div class="stat-box"><div class="stat-val">${drivePdfStr}</div><div class="stat-lbl">${escapeHtml(Ui('stat.drive'))}</div></div>
      <div class="stat-box"><div class="stat-val">${budgetPdfStr}</div><div class="stat-lbl">${escapeHtml(Ui('stat.pp').replace(/\{cur\}/g, tmPdf.currencySymbol || '¥'))}</div></div>
    </div>
  </div>
  <div class="cover-foot">${pdfTx('coverFoot')}</div>
</div>

<div class="sec">
  <div class="tag">${pdfTx('mapsTag')}</div>
  <h2>${pdfTx('mapsTitle')}</h2>
</div>
${(mapCqUrl || mapXjUrl) ? `
<div class="${isLandscape && mapCqUrl && mapXjUrl ? 'maps-grid' : ''}">
  ${mapCqUrl ? `<div class="map-section-pdf">
    <div class="map-label cq">🗺 ${pdfTx('mapCqLabel')}</div>
    <img class="map-img" src="${mapCqUrl}" alt="Map CQ">
    <div class="map-caption">${pdfTx('mapCqCaption')}</div>
  </div>` : ''}
  ${mapXjUrl ? `<div class="map-section-pdf">
    <div class="map-label xj">🗺 ${pdfTx('mapXjLabel')}</div>
    <img class="map-img" src="${mapXjUrl}" alt="Map XJ">
    <div class="map-caption">${pdfTx('mapXjCaption')}</div>
  </div>` : ''}
</div>` : mapsFallback}

<div class="sec">
  <div class="tag">${pdfTx('secCqTag')}</div>
  <h2>${pdfTx('secCqTitle')}</h2>
</div>
${cqPdf}

<div class="sec">
  <div class="tag">${pdfTx('secXjTag')}</div>
  <h2>${pdfTx('secXjTitle')}</h2>
</div>
${xjPdf}

<div class="sec">
  <div class="tag">${pdfTx('staysTag')}</div>
  <h2>${pdfTx('staysTitle')}</h2>
</div>
${staysHtml}

<div class="sec">
  <div class="tag">${pdfTx('budgetTag')}</div>
  <h2>${pdfTx('budgetTitle')}</h2>
</div>
<div class="b-totals">
  <div class="b-total"><div class="b-val">${escapeHtml(totalPP)}</div><div class="b-lbl">${escapeHtml(Ui('pdf.budgetPpLbl'))}</div></div>
  <div class="b-total"><div class="b-val">${escapeHtml(totalGrp)}</div><div class="b-lbl">${escapeHtml(Ui('pdf.budgetGrpLbl'))}</div></div>
</div>
<table class="ctable">
  <thead><tr><th>${colCat}</th><th>${colItem}</th><th>${colTot}</th><th>${colPp}</th><th>${colNote}</th></tr></thead>
  <tbody>${costRows}</tbody>
</table>

<div class="sec">
  <div class="tag">${pdfTx('tipsTag')}</div>
  <h2>${pdfTx('tipsTitle')}</h2>
</div>
<div class="tips">${tipsHtml}</div>

<div class="sec">
  <div class="tag">${pdfTx('checklistTag')}</div>
  <h2>${pdfTx('checklistTitle')}</h2>
  <p style="font-size:9pt;color:#888;margin-top:4pt">${escapeHtml(pdfTx('checklistSorted'))}: ${escapeHtml(sortLabelsPdf[clSort] || sortLabelsPdf.urgency)}</p>
</div>
${checklistHtml}

</body>
</html>`;


"""

updated = text[:start] + NEW + text[end:]
app_js.write_text(updated, encoding="utf-8")
print("rewrite_pdf_block.py: rewrote toast → HTML chunk in js/app.js")
