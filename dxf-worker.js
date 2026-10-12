/* DXF parsing and projection run off the UI thread. The worker sends compact
   drawing commands in batches so large plans do not become thousands of DOM
   elements or GeoJSON/Leaflet objects. */
const MAX_COMMANDS = 750000;
const BATCH_SIZE = 1200;

function sectionRange(raw, name) {
  const re = /(?:^|\r?\n)[ \t]*0[ \t]*\r?\n[ \t]*SECTION[ \t]*\r?\n[ \t]*2[ \t]*\r?\n[ \t]*([A-Z0-9_]+)[ \t]*\r?\n/g;
  let match;
  while ((match = re.exec(raw))) {
    if (match[1] !== name) continue;
    const start = re.lastIndex;
    const endMatch = /(?:^|\r?\n)[ \t]*0[ \t]*\r?\n[ \t]*ENDSEC[ \t]*\r?\n/g;
    endMatch.lastIndex = start;
    const end = endMatch.exec(raw);
    return { start, end: end ? end.index : raw.length };
  }
  return null;
}

function pairList(text) {
  const lines = text.split(/\r\n|\r|\n/), pairs = [];
  for (let i = 0; i + 1 < lines.length; i += 2) pairs.push([lines[i].trim(), lines[i + 1].trim()]);
  return pairs;
}

function parseHatchBody(body) {
  const pairs = pairList(body), first = code => pairs.find(p => p[0] === code)?.[1];
  const rawColor = first('420'), colorIndex = first('62') === undefined ? undefined : Number(first('62'));
  const base = {
    type: 'HATCH', handle: first('5'), layer: first('8') || '0', lineType: first('6'),
    lineweight: first('370') === undefined ? undefined : Number(first('370')),
    colorIndex, trueColor: rawColor === undefined ? undefined : Number(rawColor),
    solidFill: Number(first('70')) === 1,
    visible: first('60') === undefined || Number(first('60')) === 0
  };
  const loops = [];
  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i][0] !== '92') continue;
    const flags = Number(pairs[i++][1]);
    if (!(flags & 2)) continue;
    let bulgeEnabled = false, closed = true, count = 0;
    if (pairs[i]?.[0] === '72') bulgeEnabled = Number(pairs[i++][1]) === 1;
    if (pairs[i]?.[0] === '73') closed = Number(pairs[i++][1]) === 1;
    if (pairs[i]?.[0] === '93') count = Math.min(10000, Number(pairs[i++][1]) || 0);
    const vertices = [];
    while (i < pairs.length && vertices.length < count) {
      if (pairs[i][0] === '92') { i--; break; }
      if (pairs[i][0] === '10' && pairs[i + 1]?.[0] === '20') {
        const vertex = { x: Number(pairs[i][1]), y: Number(pairs[i + 1][1]) };
        i += 2;
        if (bulgeEnabled && pairs[i]?.[0] === '42') vertex.bulge = Number(pairs[i++][1]);
        vertices.push(vertex);
      } else i++;
    }
    if (closed && vertices.length >= 3) loops.push({ ...base, vertices, shape: true });
  }
  return loops;
}

function injectSolidHatches(raw, dxf) {
  const hatchRx = /(?:^|\r?\n)[ \t]*0[ \t]*\r?\n[ \t]*HATCH[ \t]*\r?\n([\s\S]*?)(?=\r?\n[ \t]*0[ \t]*\r?\n[A-Z_*])/g;
  const readHatches = range => {
    const result = [];
    if (!range) return result;
    hatchRx.lastIndex = Math.max(0, range.start - 1);
    let match;
    while ((match = hatchRx.exec(raw)) && match.index < range.end) result.push(...parseHatchBody(match[1]));
    return result;
  };
  const blockRange = sectionRange(raw, 'BLOCKS');
  if (blockRange) {
    const blockRx = /(?:^|\r?\n)[ \t]*0[ \t]*\r?\n[ \t]*BLOCK[ \t]*\r?\n([\s\S]*?)(?=\r?\n[ \t]*0[ \t]*\r?\n[ \t]*ENDBLK[ \t]*\r?\n)/g;
    blockRx.lastIndex = Math.max(0, blockRange.start - 1);
    const byName = new Map(Object.values(dxf.blocks || {}).map(block => [String(block.name || '').toUpperCase(), block]));
    let match;
    while ((match = blockRx.exec(raw)) && match.index < blockRange.end) {
      const body = match[1], head = pairList(body.slice(0, Math.min(body.length, 1000)));
      const name = head.find(pair => pair[0] === '2')?.[1];
      const block = byName.get(String(name || '').toUpperCase());
      if (block) {
        const bodyStart = blockRx.lastIndex - match[0].length + match[0].indexOf(body);
        const hatches = readHatches({ start: bodyStart, end: blockRx.lastIndex });
        if (hatches.length) (block.entities || (block.entities = [])).push(...hatches);
      }
    }
  }
  const entities = readHatches(sectionRange(raw, 'ENTITIES'));
  if (entities.length) (dxf.entities || (dxf.entities = [])).push(...entities);
}

function inspectDrawing(dxf, fileName, requested) {
  const header = JSON.stringify(dxf.header || {}).toUpperCase();
  const labels = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, projectedCount = 0, geographicCount = 0;
  const take = point => {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    const projected = point.x >= 100000 && point.x <= 900000 && point.y >= 1000000 && point.y <= 10000000;
    const geographic = Math.abs(point.x) <= 180 && Math.abs(point.y) <= 90 && (point.x !== 0 || point.y !== 0);
    if (!projected && !geographic) return;
    if (projected) projectedCount++;
    else geographicCount++;
    minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
  };
  for (const entity of dxf.entities || []) {
    const type = String(entity.type || '').toUpperCase();
    if (['TEXT', 'MTEXT', 'ATTRIB', 'ATTDEF'].includes(type)) {
      if (labels.length < 20000) labels.push(String(entity.text || entity.value || ''));
    }
    for (const key of ['vertices', 'points', 'fitPoints', 'controlPoints']) {
      if (Array.isArray(entity[key])) for (const point of entity[key]) take(point);
    }
    for (const key of ['startPoint', 'endPoint', 'position', 'center']) take(entity[key]);
  }
  const labelText = labels.join(' ').toUpperCase();
  const explicitText = header + ' ' + labelText;
  const explicitDatum = /\bED\s*[- ]?50\b|\bEPSG\s*[:=]?\s*2320\b/.test(explicitText) ? 'ED50'
    : /\b(?:ITRF|ETRF)(?:\s*[- ]?\s*\d{2,4})?\b|\bETRS\s*89\b|\bEPSG\s*[:=]?\s*5254\b/.test(explicitText) ? 'ITRF' : null;
  const projectText = (String(fileName || '') + ' ' + labelText).toLocaleUpperCase('tr-TR');
  const localWest = /GÖKÇEÖREN|GÖKÇÖREN|KAŞ|ANTALYA|YENİKÖY/.test(projectText);
  const cmText = explicitText.match(/\bTM\s*[-/]?\s*(27|30|33|36|39|42|45)\b/);
  const suggestedCm = cmText ? Number(cmText[1]) : localWest ? 30 : null;
  const datum = requested.manualDatum || explicitDatum || requested.datum || 'ITRF';
  const cm = requested.manualCm || suggestedCm || requested.cm || 36;
  let status;
  if (explicitDatum) status = 'DXF yazı/metaverisinden ' + explicitDatum + ' saptandı.';
  else status = 'DXF içinde datum kodu bulunamadı; ' + datum + ' seçili varsayım olarak kullanılacak.';
  if (suggestedCm) status += ' ' + (requested.manualCm ? 'DOM ' + cm + ' kullanıcı tarafından seçildi.' : 'Proje alanı/metaverisine göre DOM ' + cm + ' seçildi.');
  else status += ' DOM ' + cm + ' seçili.';
  if (minX !== Infinity) status += ' Koordinat aralığı: X ' + Math.round(minX) + '–' + Math.round(maxX) + ', Y ' + Math.round(minY) + '–' + Math.round(maxY) + '.';
  if (!projectedCount && !geographicCount) status += ' DXF içinde haritaya dönüştürülebilecek coğrafi/projeksiyonlu koordinat bulunamadı.';
  return { datum, cm, explicitDatum, inferredCm: !requested.manualCm && Boolean(suggestedCm), localWest, projected: projectedCount > 0, status };
}

function makeProjector(info) {
  const extra = info.datum === 'ED50'
    ? '+ellps=intl +towgs84=-84.1,-101.8,-129.7,0,0,0.468,1.05'
    : '+ellps=GRS80 +towgs84=0.023,0.036,-0.068,0.00176,0.00912,-0.01136,0.00439';
  const id = 'DXF_SOURCE_' + info.cm + '_' + info.datum;
  proj4.defs(id, '+proj=tmerc +lat_0=0 +lon_0=' + info.cm + ' +k=1 +x_0=500000 +y_0=0 ' + extra + ' +units=m +no_defs');
  return point => {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    if (info.projected) {
      if (point.x < 100000 || point.x > 900000 || point.y < 1000000 || point.y > 10000000) return null;
    } else {
      if (Math.abs(point.x) > 180 || Math.abs(point.y) > 90 || (point.x === 0 && point.y === 0)) return null;
      return [point.y, point.x];
    }
    const ll = proj4(id, 'EPSG:4326', [point.x, point.y]);
    if (!Number.isFinite(ll[0]) || !Number.isFinite(ll[1]) || Math.abs(ll[1]) > 90) return null;
    return [ll[1], ll[0]];
  };
}

/* Detection is intentionally conservative. New assets need both a clearly
   labelled new-installation layer and a physical symbol. Text stays attached
   to the nearby symbol; old poles and every existing underground route are
   drawing only and must never become inspection markers. */
function inspectionCandidates(dxf, project, intervalMeters = 5) {
  const candidates = [], maximum = 2500;
  const newPoleLayer = /(?=.*(?:D[Iİ]REK|POLE))(?=.*(?:YEN[Iİ]|NEW))/i;
  const newBoxLayer = /(?:YEN[Iİ]|NEW).*(?:BOX|KUTU|PANO)|(?:BOX|KUTU|PANO).*(?:YEN[Iİ]|NEW)/i;
  const newLightingLayer = /(?:YEN[Iİ]|NEW).*(?:AYDIN|ARMAT[ÜU]R|LIGHT)|(?:AYDIN|ARMAT[ÜU]R|LIGHT).*(?:YEN[Iİ]|NEW)/i;
  const newUndergroundLayer = /(?:YEN[Iİ]|NEW).*(?:KANAL|KABLO|YERALT[Iİ]|YERALTI|TRENCH)|(?:KANAL|KABLO|YERALT[Iİ]|YERALTI|TRENCH).*(?:YEN[Iİ]|NEW)/i;
  const isNewLayer = value => /(?:YEN[Iİ]|NEW)/i.test(String(value || ''));
  const transposition = /TRANS(?:POZ(?:[Iİ]SYON)?|POSITION)/i;
  const stable = value => String(value || '').replace(/[^a-zA-Z0-9_.:-]+/g, '_').slice(0, 120);
  const add = value => { if (value && candidates.length < maximum) candidates.push(value); };
  const entityPoint = entity => entity.position || entity.startPoint || entity.center || entity;
  const rawDistance = (left, right) => Math.hypot(Number(left.x) - Number(right.x), Number(left.y) - Number(right.y));
  /* VeCAD exports its pole glyphs as q, 4 or 5 TEXT characters. They are
     symbols, unlike nearby pole number/type texts. */
  const poleSymbolText = value => /^(?:q|4|5|[øØ●○])$/i.test(String(value || '').trim());
  const poleNumberText = value => /^[A-ZÇĞİÖŞÜ]{1,3}\s*[-.]?\s*\d{1,4}(?:\s*\([A-ZÇĞİÖŞÜ0-9/-]{1,8}\))?$/i.test(String(value || '').trim());
  const poleTypeText = value => /^(?:G\s*[-–—]\s*)?(?:(?:[A-ZÇĞİÖŞÜ]{1,3}\s*\d{0,4})|(?:\d{1,3}\s*[A-ZÇĞİÖŞÜ]{1,3}))(?:\s*\([A-ZÇĞİÖŞÜ0-9/-]{1,8}\))?["“”]?$/i.test(String(value || '').trim());
  /* The quotation mark is part of the pole type in these drawings, for
     example G-K3". Remove only the G- CAD prefix when presenting it. */
  const cleanPoleType = value => String(value || '').trim().replace(/^G\s*[-–—]\s*/i, '').replace(/[“”]/g, '"').replace(/·/g, '').replace(/\s+/g, '');
  const lightingLabelText = value => /^AD1(?:[\s._-]*\d+)?(?:\b|$)/i.test(String(value || '').trim());
  const sdkLabelText = value => /^GBOX(?:\b|$)/i.test(String(value || '').trim());
  const newPoleBlock = value => /(?:YEN[Iİ]|NEW).*(?:D[Iİ]REK|POLE)|(?:D[Iİ]REK|POLE).*(?:YEN[Iİ]|NEW)/i.test(String(value || ''));
  const assetBlock = (value, type) => type === 'box'
    ? /(?:BOX|KUTU|PANO)/i.test(String(value || ''))
    : type === 'sdk' ? /GBOX/i.test(String(value || ''))
    : /(?:AYDIN|ARMAT[ÜU]R|LIGHT)/i.test(String(value || ''));
  const vertex = value => {
    /* DXF exports use both {x,y} and [x,y] coordinates. The parser also
       exposes LINE endpoints through vertices for some files. Normalize all
       of these shapes before generating 5 m inspection intervals. */
    const point = Array.isArray(value) ? { x: value[0], y: value[1] } : (value?.position || value);
    return Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y))
      ? { ...point, x: Number(point.x), y: Number(point.y) } : null;
  };
  const verticesFor = entity => {
    const type = String(entity?.type || '').toUpperCase();
    const listed = entity?.vertices || entity?.points || entity?.fitPoints || entity?.controlPoints || [];
    if (Array.isArray(listed) && listed.length) return listed.map(vertex).filter(Boolean);
    if (type === 'LINE') return [entity?.startPoint || entity?.start, entity?.endPoint || entity?.end].map(vertex).filter(Boolean);
    return [];
  };
  const distanceMeters = (left, right) => {
    const radians = Math.PI / 180, latitude = (left[0] + right[0]) / 2 * radians;
    const north = (right[0] - left[0]) * 111132;
    const east = (right[1] - left[1]) * 111320 * Math.cos(latitude);
    return Math.hypot(north, east);
  };
  const interpolate = (left, right, fraction) => [left[0] + (right[0] - left[0]) * fraction, left[1] + (right[1] - left[1]) * fraction];
  const poleSymbols = [], poleLabels = [], assetSymbols = [], assetLabels = [], transpositionLabels = [];
  for (let index = 0; index < (dxf.entities || []).length && candidates.length < maximum; index++) {
    const entity = dxf.entities[index] || {}, type = String(entity.type || '').toUpperCase();
    const layer = String(entity.layer || ''), name = String(entity.name || '');
    const raw = entityPoint(entity);
    const text = String(entity.text || entity.value || '').trim();
    const taggedAssetType = sdkLabelText(text) || sdkLabelText(name) ? 'sdk'
      : lightingLabelText(text) || lightingLabelText(name) ? 'lighting' : null;
    if (isNewLayer(layer) && raw && Number.isFinite(raw.x) && Number.isFinite(raw.y) && transposition.test(`${layer} ${name} ${text}`)
        && ((['TEXT', 'MTEXT', 'ATTRIB'].includes(type) && transposition.test(text)) || (type === 'INSERT' && transposition.test(name)))) {
      transpositionLabels.push({ entity, type, layer, name, text, raw, index });
    }
    if (newPoleLayer.test(layer) && raw && Number.isFinite(raw.x) && Number.isFinite(raw.y)) {
      const isSymbol = (type === 'INSERT' && newPoleBlock(name)) || type === 'POINT' || (type === 'TEXT' && poleSymbolText(text));
      if (isSymbol) {
        poleSymbols.push({ entity, type, layer, name, text, raw, index });
        continue;
      }
      if (['TEXT', 'MTEXT', 'ATTRIB'].includes(type) && text) {
        poleLabels.push({ entity, type, layer, text, raw });
        continue;
      }
    }
    if (taggedAssetType && isNewLayer(layer) && raw && Number.isFinite(raw.x) && Number.isFinite(raw.y)) {
      if (['TEXT', 'MTEXT', 'ATTRIB'].includes(type) && text) {
        assetLabels.push({ entity, type, layer, name, text, raw, index, assetType: taggedAssetType });
      } else if ((type === 'INSERT' && assetBlock(name, taggedAssetType)) || type === 'POINT') {
        assetSymbols.push({ entity, type, layer, name, text, raw, index, assetType: taggedAssetType });
      }
    }
    if (raw && Number.isFinite(raw.x) && Number.isFinite(raw.y) && (newBoxLayer.test(layer) || newLightingLayer.test(layer))) {
      const assetType = newBoxLayer.test(layer) ? 'box' : 'lighting';
      if ((type === 'INSERT' && assetBlock(name, assetType)) || type === 'POINT') assetSymbols.push({ entity, type, layer, name, text, raw, index, assetType });
    }
  }
  /* Only collapse symbols with effectively identical source coordinates. A
     proximity merge would incorrectly combine two genuine poles drawn close
     together. */
  const uniqueSymbols = [];
  for (const symbol of poleSymbols) {
    if (!uniqueSymbols.some(existing => rawDistance(existing.raw, symbol.raw) <= 0.02)) uniqueSymbols.push(symbol);
  }
  /* A drawing can contain more than one glyph character next to one pole.
     Bind each clearly formatted pole number to its nearest glyph, then emit
     that glyph only once. This prevents q/4/5 components becoming duplicates. */
  const assignedSymbols = new Set();
  for (const label of poleLabels.filter(label => poleNumberText(label.text))) {
    const distances = uniqueSymbols.map(symbol => rawDistance(symbol.raw, label.raw));
    const nearest = Math.min(...distances);
    if (!Number.isFinite(nearest) || nearest > 14 || distances.filter(value => Math.abs(value - nearest) <= 0.02).length !== 1) continue;
    assignedSymbols.add(uniqueSymbols[distances.indexOf(nearest)]);
  }
  const candidateSymbols = uniqueSymbols.filter(symbol => assignedSymbols.has(symbol) || symbol.type === 'INSERT' || symbol.type === 'POINT');
  for (const symbol of candidateSymbols) {
    const point = project(symbol.raw); if (!point) continue;
    const labels = poleLabels.filter(label => {
      const distance = rawDistance(symbol.raw, label.raw);
      if (distance > 14) return false;
      const distances = uniqueSymbols.map(other => rawDistance(other.raw, label.raw));
      const nearest = Math.min(...distances);
      /* A label is associated only with one unambiguous nearest symbol. */
      return Math.abs(distance - nearest) <= 0.02 && distances.filter(value => Math.abs(value - nearest) <= 0.02).length === 1;
    }).sort((a, b) => rawDistance(symbol.raw, a.raw) - rawDistance(symbol.raw, b.raw));
    const values = labels.map(label => label.text);
    const rawPoleType = values.find(value => poleTypeText(value) && (/^G\s*[-–—]/i.test(value) || /\(/.test(value) || /^K\s*\d+/i.test(value) || /^\d+\s*[A-ZÇĞİÖŞÜ]/i.test(value) || /^(?:E|M)$/i.test(String(value).trim()))) || null;
    const rawPoleNumber = values.find(value => poleNumberText(value) && value !== rawPoleType) || (!rawPoleType ? values.find(value => poleNumberText(value)) : null);
    const poleNumber = rawPoleNumber?.replace(/\s+/g, '').toLocaleUpperCase('tr-TR') || null;
    const poleType = cleanPoleType(rawPoleType);
    const displayLabel = poleNumber ? poleNumber + (poleType ? ` ${poleType}` : '') : (poleType || null);
    const handle = symbol.entity.handle || `${symbol.layer}:${symbol.name}:${Number(symbol.raw.x).toFixed(3)}:${Number(symbol.raw.y).toFixed(3)}`;
    const legacyElementIds = labels.filter(label => label.entity.handle).map(label => `pole:${stable(label.entity.handle)}`);
    add({ elementId: `pole:${stable(handle)}`, elementType: 'pole', sourceLayer: symbol.layer, sourceHandle: symbol.entity.handle || null,
      label: displayLabel, poleType: poleType || null, networkRole: values.find(value => /^(?:E|M|\d+)$/i.test(value)) || null,
      lat: point[0], lon: point[1], metadata: { detected: true, candidateVersion: 2, newPole: true, entityType: symbol.type, symbol: symbol.text || symbol.name || 'POINT', detectionConfidence: 'high', poleNumber, displayLabel, labels: labels.map(label => ({ text: label.text, sourceHandle: label.entity.handle || null })), legacyElementIds } });
  }
  const uniqueAssets = [];
  for (const symbol of assetSymbols) if (!uniqueAssets.some(existing => existing.assetType === symbol.assetType && rawDistance(existing.raw, symbol.raw) <= 0.02)) uniqueAssets.push(symbol);
  const uniqueAssetLabels = [];
  for (const label of assetLabels) if (!uniqueAssetLabels.some(existing => existing.assetType === label.assetType && rawDistance(existing.raw, label.raw) <= 0.02)) uniqueAssetLabels.push(label);
  const attachedLabel = symbol => {
    const labels = uniqueAssetLabels.filter(label => label.assetType === symbol.assetType);
    const distances = labels.map(label => rawDistance(symbol.raw, label.raw));
    const nearest = Math.min(...distances);
    if (!Number.isFinite(nearest) || nearest > 14 || distances.filter(value => Math.abs(value - nearest) <= 0.02).length !== 1) return null;
    return labels[distances.indexOf(nearest)];
  };
  for (const symbol of uniqueAssets) {
    const point = project(symbol.raw); if (!point) continue;
    const handle = symbol.entity.handle || `${symbol.layer}:${symbol.name}:${Number(symbol.raw.x).toFixed(3)}:${Number(symbol.raw.y).toFixed(3)}`;
    const linkedLabel = attachedLabel(symbol);
    const label = linkedLabel?.text || (symbol.assetType === 'box' ? 'Yeni BOX' : symbol.assetType === 'sdk' ? 'SDK noktası' : 'Yeni aydınlatma noktası');
    add({ elementId: `${symbol.assetType}:${stable(handle)}`, elementType: symbol.assetType, sourceLayer: symbol.layer, sourceHandle: symbol.entity.handle || null,
      label, lat: point[0], lon: point[1], metadata: { detected: true, candidateVersion: 3, newAsset: true, entityType: symbol.type, symbol: symbol.text || symbol.name || 'POINT', labelText: linkedLabel?.text || null, detectionConfidence: 'high' } });
  }
  for (const label of uniqueAssetLabels) {
    const nearbySymbols = uniqueAssets.filter(symbol => symbol.assetType === label.assetType);
    const distances = nearbySymbols.map(symbol => rawDistance(symbol.raw, label.raw));
    const nearest = Math.min(...distances);
    /* A nearby unambiguous symbol already represents this labelled asset. */
    if (Number.isFinite(nearest) && nearest <= 14 && distances.filter(value => Math.abs(value - nearest) <= 0.02).length === 1) continue;
    const point = project(label.raw); if (!point) continue;
    const handle = label.entity.handle || `${label.layer}:${label.text}:${Number(label.raw.x).toFixed(3)}:${Number(label.raw.y).toFixed(3)}`;
    add({ elementId: `${label.assetType}-label:${stable(handle)}`, elementType: label.assetType, sourceLayer: label.layer, sourceHandle: label.entity.handle || null,
      label: label.text, lat: point[0], lon: point[1], metadata: { detected: true, candidateVersion: 3, newAsset: true, labelDriven: true, entityType: label.type, labelText: label.text, detectionConfidence: 'high' } });
  }
  const uniqueTranspositions = [];
  for (const item of transpositionLabels) if (!uniqueTranspositions.some(existing => rawDistance(existing.raw, item.raw) <= 0.02)) uniqueTranspositions.push(item);
  for (const item of uniqueTranspositions) {
    const point = project(item.raw); if (!point) continue;
    const handle = item.entity.handle || `${item.layer}:${item.name}:${Number(item.raw.x).toFixed(3)}:${Number(item.raw.y).toFixed(3)}`;
    add({ elementId: `transposition:${stable(handle)}`, elementType: 'transposition', sourceLayer: item.layer, sourceHandle: item.entity.handle || null,
      label: item.text || item.name || 'OG transpozisyon noktası', lat: point[0], lon: point[1], metadata: { detected: true, candidateVersion: 3, transposition: true, entityType: item.type, description: item.text || item.name || null, detectionConfidence: 'high' } });
  }
  /* Only routes drawn on an explicitly new channel/cable layer get interval
     points. Existing underground lines stay as CAD geometry and never create
     inspection markers. Coordinates are sampled after projection so the
     configured interval is always in metres. */
  const spacing = Number.isFinite(Number(intervalMeters)) && Number(intervalMeters) > 0 ? Number(intervalMeters) : 5;
  for (let index = 0; index < (dxf.entities || []).length && candidates.length < maximum; index++) {
    const entity = dxf.entities[index] || {}, type = String(entity.type || '').toUpperCase(), layer = String(entity.layer || '');
    if (!newUndergroundLayer.test(layer) || !['LINE', 'LWPOLYLINE', 'POLYLINE', 'SPLINE'].includes(type)) continue;
    const route = verticesFor(entity).map(project).filter(point => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]));
    if (route.length < 2) continue;
    const handle = entity.handle || `${layer}:${type}:${index}`;
    let traversed = 0, nextOffset = 0, pointIndex = 0;
    for (let vertex = 1; vertex < route.length && candidates.length < maximum; vertex++) {
      const from = route[vertex - 1], to = route[vertex], segment = distanceMeters(from, to);
      if (!Number.isFinite(segment) || segment < .01) continue;
      while (nextOffset <= traversed + segment + .001 && candidates.length < maximum) {
        const fraction = Math.max(0, Math.min(1, (nextOffset - traversed) / segment));
        const point = interpolate(from, to, fraction), offsetMeters = Math.round(nextOffset * 100) / 100;
        add({ elementId: `underground:${stable(handle)}:${pointIndex++}`, elementType: 'underground', pointType: 'underground', sourceLayer: layer, sourceHandle: entity.handle || null,
          label: `Yeni kanal · ${offsetMeters} m`, lat: point[0], lon: point[1], metadata: { detected: true, candidateVersion: 4, newUnderground: true, intervalMeters: spacing, offsetMeters, routeHandle: entity.handle || null, entityType: type, detectionConfidence: 'high' } });
        nextOffset += spacing;
      }
      traversed += segment;
    }
  }
  return candidates;
}

function cadColor(entity, layer, inheritedColor) {
  const index = Number(entity.colorIndex);
  let value = entity.trueColor ?? entity.color;
  if (entity.trueColor != null && Number.isFinite(Number(entity.trueColor))) return '#' + (Number(entity.trueColor) & 0xffffff).toString(16).padStart(6, '0');
  if (Number.isFinite(value) && value > 255) return '#' + (value & 0xffffff).toString(16).padStart(6, '0');
  if (index === 0 && inheritedColor) return inheritedColor;
  if (index === 0 || index === 256 || value == null) {
    if (layer?.trueColor != null && Number.isFinite(Number(layer.trueColor))) return '#' + (Number(layer.trueColor) & 0xffffff).toString(16).padStart(6, '0');
    value = layer?.color;
  }
  const aci = Number(entity.colorIndex ?? layer?.colorIndex ?? layer?.colorNumber ?? entity.color);
  if (Number.isFinite(value) && value > 255) return '#' + (value & 0xffffff).toString(16).padStart(6, '0');
  const basic = { 1: '#ff0000', 2: '#ffff00', 3: '#00ff00', 4: '#00ffff', 5: '#0000ff', 6: '#ff00ff', 7: '#ffffff', 8: '#808080', 9: '#c0c0c0' };
  if (basic[aci]) return basic[aci];
  if (aci >= 10 && aci <= 249) {
    const hue = ((aci - 10) % 24) * 15, shade = Math.floor((aci - 10) / 24), sat = Math.max(0, 100 - (shade % 4) * 12);
    const light = [50, 40, 30, 25][Math.floor(shade / 4) % 4];
    return 'hsl(' + hue + ' ' + sat + '% ' + light + '%)';
  }
  return '#ffffff';
}

function cadDash(entity, dxf) {
  const name = String(entity.lineType || '').toUpperCase();
  const table = dxf.tables?.lineType?.lineTypes || dxf.tables?.linetype?.lineTypes || {};
  const pattern = table[name]?.pattern || table[name]?.elements || [];
  if (pattern.length) return pattern.map(value => Math.max(1, Math.abs(Number(value)) * 2));
  if (/DASH|HIDDEN|CENTER|PHANTOM|DOT/.test(name)) return name.includes('DOT') ? [1, 4] : name.includes('CENTER') ? [10, 4, 2, 4] : [8, 5];
  return null;
}

function applyMatrix(point, matrix) {
  return { x: matrix.a * point.x + matrix.b * point.y + matrix.tx, y: matrix.c * point.x + matrix.d * point.y + matrix.ty, ...(point.z === undefined ? {} : { z: point.z }), ...(point.bulge === undefined ? {} : { bulge: point.bulge }) };
}
function composeMatrix(a, b) {
  return { a: a.a * b.a + a.b * b.c, b: a.a * b.b + a.b * b.d, c: a.c * b.a + a.d * b.c, d: a.c * b.b + a.d * b.d, tx: a.a * b.tx + a.b * b.ty + a.tx, ty: a.c * b.tx + a.d * b.ty + a.ty };
}
function insertMatrix(insert, block, row, column) {
  const angle = (Number(insert.rotation) || 0) * Math.PI / 180, sx = Number(insert.xScale) || 1, sy = Number(insert.yScale) || 1;
  const co = Math.cos(angle), si = Math.sin(angle), base = block.position || { x: 0, y: 0 }, pos = insert.position || { x: 0, y: 0 };
  const a = co * sx, b = -si * sy, c = si * sx, d = co * sy;
  const dx = column * (Number(insert.columnSpacing) || 0), dy = row * (Number(insert.rowSpacing) || 0);
  return { a, b, c, d, tx: pos.x - a * base.x - b * base.y + a * dx + b * dy, ty: pos.y - c * base.x - d * base.y + c * dx + d * dy };
}
function transformEntity(entity, matrix) {
  const out = { ...entity }, linear = { ...matrix, tx: 0, ty: 0 };
  for (const key of ['vertices', 'points', 'fitPoints', 'controlPoints']) if (Array.isArray(entity[key])) out[key] = entity[key].map(point => applyMatrix(point, matrix));
  for (const key of ['center', 'position', 'startPoint', 'endPoint', 'textMidPoint', 'definitionPoint']) if (entity[key] && Number.isFinite(entity[key].x) && Number.isFinite(entity[key].y)) out[key] = applyMatrix(entity[key], matrix);
  if (entity.majorAxisEndPoint) out.majorAxisEndPoint = applyMatrix(entity.majorAxisEndPoint, linear);
  const sx = Math.hypot(matrix.a, matrix.c), sy = Math.hypot(matrix.b, matrix.d), scale = (sx + sy) / 2;
  if (Number.isFinite(entity.radius)) out.radius = entity.radius * scale;
  if (Number.isFinite(entity.textHeight)) out.textHeight = entity.textHeight * sy;
  if (Number.isFinite(entity.height)) out.height = entity.height * sy;
  if (Number.isFinite(entity.rotation)) out.rotation = entity.rotation + Math.atan2(matrix.c, matrix.a) * 180 / Math.PI;
  return out;
}

function* expandCadInserts(entities, dxf) {
  const blocks = dxf.blocks || {}, byName = new Map(Object.values(blocks).map(block => [String(block.name || '').toUpperCase(), block]));
  const layers = dxf.tables?.layer?.layers || dxf.tables?.layers?.layers || {};
  const identity = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
  let emitted = 0;
  function* visit(entity, matrix, inheritedLayer, inheritedColor, depth) {
    if (depth > 12) return;
    const layerName = entity.layer && entity.layer !== '0' ? entity.layer : inheritedLayer || entity.layer || '0';
    const copy = { ...entity, layer: layerName };
    if ((Number(copy.colorIndex) === 0 || Number(copy.colorIndex) === 256) && inheritedColor) copy.trueColor = inheritedColor;
    if (String(entity.type || '').toUpperCase() === 'INSERT') {
      const block = byName.get(String(entity.name || '').toUpperCase());
      if (!block) { yield transformEntity(copy, matrix); return; }
      const rows = Math.max(1, Math.min(100, Number(entity.rowCount) || 1));
      const columns = Math.max(1, Math.min(100, Number(entity.columnCount) || 1));
      const color = parseInt(cadColor(copy, layers[layerName]).slice(1), 16);
      const instances = Math.min(rows * columns, 10000);
      for (let index = 0; index < instances; index++) {
        const row = Math.floor(index / columns), column = index % columns;
        const combined = composeMatrix(matrix, insertMatrix(entity, block, row, column));
        for (const child of block.entities || []) yield* visit(child, combined, layerName, color, depth + 1);
      }
      return;
    }
    if (++emitted > MAX_COMMANDS) throw new Error('Bu DXF 750.000’den fazla çizim öğesi üretiyor; blok tekrarlarını veya paftayı AutoCAD’de bölerek açın.');
    yield transformEntity(copy, matrix);
  }
  for (const entity of entities || []) yield* visit(entity, identity, null, null, 0);
}

function geometryCommand(entity, project, style) {
  const type = String(entity.type || '').toUpperCase();
  const point = project;
  const points = values => (values || []).map(point).filter(Boolean);
  let path = null, closed = false, filled = false, fillOpacity = 0, dot = null;
  if (type === 'LINE') path = points(entity.vertices?.length ? entity.vertices : [entity.startPoint, entity.endPoint]);
  else if (['LWPOLYLINE', 'POLYLINE', 'HATCH'].includes(type)) {
    const raw = entity.vertices || [], vertices = [];
    for (let index = 0; index < raw.length; index++) {
      const a = raw[index], b = raw[(index + 1) % raw.length], pa = point(a);
      if (pa) vertices.push(pa);
      const bulge = Number(a?.bulge || 0);
      if (Math.abs(bulge) < 1e-10 || (!entity.shape && !entity.closed) || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, chord = Math.hypot(dx, dy);
      if (chord < 1e-9) continue;
      const sweep = 4 * Math.atan(bulge), radius = chord * (1 + bulge * bulge) / (4 * Math.abs(bulge));
      const offset = chord * (1 - bulge * bulge) / (4 * bulge), cx = (a.x + b.x) / 2 - dy / chord * offset, cy = (a.y + b.y) / 2 + dx / chord * offset;
      const start = Math.atan2(a.y - cy, a.x - cx), steps = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 48)));
      for (let step = 1; step < steps; step++) {
        const angle = start + sweep * step / steps, projected = point({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
        if (projected) vertices.push(projected);
      }
    }
    path = vertices; closed = Boolean(entity.shape || entity.closed); filled = type === 'HATCH'; fillOpacity = filled ? .12 : 0;
  } else if (type === 'CIRCLE' && entity.center && entity.radius) {
    path = []; for (let index = 0; index <= 48; index++) { const angle = index * Math.PI / 24; path.push(point({ x: entity.center.x + entity.radius * Math.cos(angle), y: entity.center.y + entity.radius * Math.sin(angle) })); }
    closed = true;
  } else if (type === 'ARC' && entity.center && entity.radius) {
    let start = entity.startAngle || 0, end = entity.endAngle || 0; if (end < start) end += 2 * Math.PI;
    const count = Math.max(8, Math.ceil((end - start) * 12)); path = [];
    for (let index = 0; index <= count; index++) { const angle = start + (end - start) * index / count; path.push(point({ x: entity.center.x + entity.radius * Math.cos(angle), y: entity.center.y + entity.radius * Math.sin(angle) })); }
  } else if (['SOLID', 'TRACE', '3DFACE'].includes(type)) {
    path = points(entity.points || entity.vertices);
    if (path.length > 4 && path[2][0] === path[3][0] && path[2][1] === path[3][1]) path.pop();
    closed = true; filled = path.length >= 3; fillOpacity = filled ? .45 : 0;
  } else if (type === 'ELLIPSE' && entity.center && entity.majorAxisEndPoint) {
    const center = entity.center, major = entity.majorAxisEndPoint, radius = Math.hypot(major.x, major.y), ratio = entity.axisRatio || 1;
    let start = entity.startAngle || 0, end = entity.endAngle || 2 * Math.PI; if (end < start) end += 2 * Math.PI;
    path = []; const count = Math.max(24, Math.min(128, Math.ceil((end - start) * 24)));
    for (let index = 0; index <= count; index++) { const angle = start + (end - start) * index / count; path.push(point({ x: center.x + major.x * Math.cos(angle) - major.y * ratio * Math.sin(angle), y: center.y + major.y * Math.cos(angle) + major.x * ratio * Math.sin(angle) })); }
    closed = Math.abs(end - start - 2 * Math.PI) < .001;
  } else if (type === 'SPLINE') {
    path = points(entity.fitPoints?.length ? entity.fitPoints : entity.controlPoints);
  } else if (type === 'POINT') {
    dot = point(entity.position || entity.startPoint || entity);
  } else if (type === 'INSERT') {
    dot = point(entity.position || entity);
  } else if (['TEXT', 'MTEXT', 'ATTRIB', 'ATTDEF'].includes(type)) {
    dot = point(entity.halign && entity.endPoint ? entity.endPoint : entity.startPoint || entity.position);
    if (!dot) return null;
    return { type: 'text', point: dot, text: String(entity.text || entity.value || ''), height: Number(entity.textHeight || entity.height || 0), rotation: Number(entity.rotation || 0), color: style.color };
  }
  if (dot) return { type: 'point', point: dot, radius: type === 'INSERT' ? 4 : 2, color: style.color };
  if (!path || path.length < 2) return null;
  return { type: 'path', points: path, closed, filled, isHatch: type === 'HATCH', isSolid: ['SOLID', 'TRACE', '3DFACE'].includes(type), fillOpacity, color: style.color, weight: style.weight, dash: style.dash };
}

function hatchColorForLegacy(entity, layer) {
  if (entity.trueColor != null && entity.trueColor > 255) return '#' + (entity.trueColor & 0xffffff).toString(16).padStart(6, '0');
  return cadColor(entity, layer);
}

self.onmessage = async event => {
  const data = event.data || {};
  if (data.type !== 'parse') return;
  try {
    importScripts('https://cdn.jsdelivr.net/npm/proj4@2.15.0/dist/proj4.js');
    const module = await import('https://esm.sh/dxf-parser@1.1.2');
    const Parser = module.default || module.DxfParser || module;
    const raw = new TextDecoder('windows-1254').decode(data.buffer);
    const dxf = new Parser().parse(raw);
    injectSolidHatches(raw, dxf);
    const info = inspectDrawing(dxf, data.fileName, data.crs || {});
    const project = makeProjector(info);
    const records = dxf.tables?.layer?.layers || dxf.tables?.layers?.layers || {};
    const layerMap = new Map(Object.values(records).map(layer => [String(layer.name || '').toUpperCase(), layer]));
    self.postMessage({ type: 'crs', info });
    const candidates = inspectionCandidates(dxf, project, data.inspectionIntervalMeters);
    if (candidates.length) self.postMessage({ type: 'inspection-candidates', candidates });
    let batches = new Map(), pending = 0, total = 0, processed = 0;
    const flush = () => {
      if (!pending) return;
      self.postMessage({ type: 'batch', batches: Array.from(batches, ([name, commands]) => ({ name, commands })) });
      batches.clear(); pending = 0;
    };
    for (const entity of expandCadInserts(dxf.entities, dxf)) {
      processed++;
      const name = entity.layer || '0', layer = layerMap.get(name.toUpperCase());
      if (entity.visible === false || Number(entity.colorIndex) < 0 || layer?.visible === false || layer?.frozen || layer?.off || Number(layer?.colorIndex) < 0) continue;
      const lineweight = Number(entity.lineweight ?? layer?.lineweight), style = {
        color: hatchColorForLegacy(entity, layer),
        weight: Number.isFinite(lineweight) && lineweight > 0 ? Math.max(.7, lineweight / 26.46) : 1,
        dash: cadDash(entity, dxf)
      };
      const command = geometryCommand(entity, project, style);
      if (!command) continue;
      if (++total > MAX_COMMANDS) throw new Error('Bu DXF 750.000’den fazla çizim öğesi üretiyor; dosyayı AutoCAD’de parçalara ayırarak açın.');
      if (!batches.has(name)) batches.set(name, []);
      batches.get(name).push(command); pending++;
      if (pending >= BATCH_SIZE) {
        flush();
        if (processed % 12000 < BATCH_SIZE) self.postMessage({ type: 'progress', processed, total, layers: layerMap.size });
      }
    }
    flush();
    if (!total) throw new Error('DXF içinde haritada gösterilebilen 2B çizim bulunamadı.');
    self.postMessage({ type: 'done', total, processed, layers: layerMap.size, status: info.status });
  } catch (error) {
    self.postMessage({ type: 'error', message: error?.message || 'DXF ayrıştırma işlemi başarısız oldu.' });
  }
};
