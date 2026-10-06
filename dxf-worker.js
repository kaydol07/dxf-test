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

/* Detection is intentionally conservative.  A candidate is emitted only from
   an INSERT/POINT on a pole layer, or a polyline on an underground-cable layer.
   The UI always keeps manual control points available for drawings that do not
   use these conventional names. */
function inspectionCandidates(dxf, project, intervalMeters = 5) {
  const candidates = [], maximum = 2500;
  const poleLayer = /(?:D[Iİ]REK|\bPOLE\b|\bD[._ -]?AG\b|\bD[._ -]?OG\b)/i;
  const undergroundLayer = /(?:YERALTI|YER[ _-]?ALTI|KABLO|UG|OG[ _-]?YERALTI)/i;
  const stable = value => String(value || '').replace(/[^a-zA-Z0-9_.:-]+/g, '_').slice(0, 120);
  const add = value => { if (value && candidates.length < maximum) candidates.push(value); };
  const entityPoint = entity => entity.position || entity.startPoint || entity.center || entity;
  for (let index = 0; index < (dxf.entities || []).length && candidates.length < maximum; index++) {
    const entity = dxf.entities[index] || {}, type = String(entity.type || '').toUpperCase();
    const layer = String(entity.layer || ''), name = String(entity.name || '');
    if (['INSERT', 'POINT', 'TEXT', 'MTEXT', 'ATTRIB'].includes(type) && poleLayer.test(layer + ' ' + name)) {
      const raw = entityPoint(entity), point = project(raw);
      if (!point) continue;
      const handle = entity.handle || `${layer}:${name}:${Number(raw.x).toFixed(3)}:${Number(raw.y).toFixed(3)}`;
      add({ elementId: `pole:${stable(handle)}`, elementType: 'pole', sourceLayer: layer, sourceHandle: entity.handle || null,
        label: String(entity.text || entity.value || name || layer || 'Direk').slice(0, 120), poleType: name || null, networkRole: null, lat: point[0], lon: point[1], metadata: { detected: true, entityType: type, detectionConfidence: type === 'INSERT' || type === 'POINT' ? 'high' : 'layer-label' } });
      continue;
    }
    if (!['LWPOLYLINE', 'POLYLINE'].includes(type) || !undergroundLayer.test(layer + ' ' + name)) continue;
    const vertices = (entity.vertices || []).filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.y));
    if (vertices.length < 2) continue;
    const handle = stable(entity.handle || `${layer}:${index}`), interval = Math.max(1, Math.min(100, Number(intervalMeters) || 5));
    let carried = 0, offset = 0;
    const addRoutePoint = (raw, distance) => {
      const point = project(raw); if (!point) return;
      add({ elementId: `underground:${handle}:${Math.round(distance * 10)}`, elementType: 'underground_route', sourceLayer: layer, sourceHandle: entity.handle || null,
        label: `${name || layer || 'Yeraltı güzergâhı'} · ${Math.round(distance)} m`, lat: point[0], lon: point[1], metadata: { detected: true, entityType: type, offsetMeters: distance } });
    };
    addRoutePoint(vertices[0], 0);
    for (let vertexIndex = 1; vertexIndex < vertices.length && candidates.length < maximum; vertexIndex++) {
      const start = vertices[vertexIndex - 1], end = vertices[vertexIndex], dx = end.x - start.x, dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      if (!Number.isFinite(length) || length <= 0 || length > 100000) continue;
      let next = interval - carried;
      while (next <= length && candidates.length < maximum) {
        const fraction = next / length;
        addRoutePoint({ x: start.x + dx * fraction, y: start.y + dy * fraction }, offset + next);
        next += interval;
      }
      carried = (carried + length) % interval; offset += length;
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
  let path = null, closed = false, filled = false, dot = null;
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
    path = vertices; closed = Boolean(entity.shape || entity.closed); filled = type === 'HATCH' || closed && ['SOLID', 'TRACE'].includes(type);
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
    closed = true; filled = path.length >= 3;
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
  return { type: 'path', points: path, closed, filled, color: style.color, weight: style.weight, dash: style.dash };
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
