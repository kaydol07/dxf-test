const map=L.map('map',{zoomControl:false,preferCanvas:true}).setView([39.05,35.35],5);
L.control.zoom({position:'bottomright'}).addTo(map);
const bases={
  satellite:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'Tiles © Esri',maxZoom:19}),
  street:L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}),
  dark:L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{attribution:'© OpenStreetMap © CARTO',maxZoom:20}),
  light:L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{attribution:'© OpenStreetMap © CARTO',maxZoom:20})
};
bases.satellite.addTo(map);
let labelLayer=L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',{attribution:'',maxZoom:20,pane:'overlayPane'}).addTo(map);
const panels=['projectPanel','locationPanel','addressPanel','parcelPanel'];
function openPanel(id){panels.forEach(p=>document.getElementById(p).hidden=p!==id||!document.getElementById(p).hidden);document.querySelectorAll('.toolbar [data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===id&&!document.getElementById(id).hidden));}
document.querySelectorAll('.toolbar [data-panel]').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.panel;const wasClosed=document.getElementById(id).hidden;openPanel(id);if(id==='locationPanel'&&wasClosed)startLocationTracking();if(id==='parcelPanel')setParcelPick(wasClosed)}));
document.querySelectorAll('.close').forEach(button=>button.addEventListener('click',()=>{button.closest('.drawer').hidden=true;document.querySelectorAll('.toolbar button').forEach(b=>b.classList.remove('active'));}));
const layerToggle=document.getElementById('layerToggle'),layersPanel=document.getElementById('layersPanel');
layerToggle.addEventListener('click',()=>layersPanel.hidden=!layersPanel.hidden);
const googleMapBase=document.createElement('div');
googleMapBase.id='googleMapBase';googleMapBase.hidden=true;document.getElementById('map').append(googleMapBase);
let googleMap=null,googleMapsApiPromise=null,googleMapSync=null;
function disableGoogleMap(){
  if(googleMapSync){map.off('moveend zoomend',googleMapSync);googleMapSync=null}
  googleMap=null;googleMapBase.replaceChildren();googleMapBase.hidden=true;
  document.body.classList.remove('google-map-active');
  document.getElementById('labelsToggle').disabled=false;
  map.zoomControl.getContainer().hidden=false;
  map.attributionControl.addTo(map);
}
function setStandardBase(name){
  disableGoogleMap();Object.values(bases).forEach(layer=>map.removeLayer(layer));
  bases[name].addTo(map);
  if(document.getElementById('labelsToggle').checked)labelLayer.addTo(map);
  document.querySelector(`input[name="base"][value="${name}"]`).checked=true;
}
document.querySelectorAll('input[name="base"]').forEach(r=>r.addEventListener('change',()=>setStandardBase(r.value)));
document.getElementById('labelsToggle').addEventListener('change',e=>{
  if(document.body.classList.contains('google-map-active'))return;
  e.target.checked?labelLayer.addTo(map):map.removeLayer(labelLayer);
});
function loadGoogleMapsApi(key){
  if(window.google?.maps)return Promise.resolve();
  if(googleMapsApiPromise)return googleMapsApiPromise;
  googleMapsApiPromise=new Promise((resolve,reject)=>{
    const callbackName='__dxfGoogleMapsReady';let settled=false;
    const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);delete window[callbackName];error?reject(error):resolve()};
    window[callbackName]=()=>finish();
    const script=document.createElement('script');script.async=true;
    script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=${callbackName}`;
    script.onerror=()=>finish(new Error('Google Maps API yüklenemedi. Anahtarı ve internet bağlantısını kontrol edin.'));
    const timer=setTimeout(()=>finish(new Error('Google Maps yanıt vermedi. API anahtarı, alan adı kısıtlaması ve API yetkisini kontrol edin.')),18000);
    document.head.append(script);
  }).catch(error=>{googleMapsApiPromise=null;throw error});
  return googleMapsApiPromise;
}
async function enableGoogleSatellite(){
  const input=document.getElementById('googleMapsKey'),status=document.getElementById('googleMapStatus'),button=document.getElementById('googleMapButton');
  const key=input.value.trim();
  if(!key){status.textContent='Önce Google Maps API anahtarını girin. Anahtar bu sayfada kaydedilmez.';input.focus();return}
  input.value='';button.disabled=true;status.textContent='Google Uydu yükleniyor…';
  try{
    await loadGoogleMapsApi(key);
    setStandardBase('satellite');map.removeLayer(bases.satellite);
    if(map.hasLayer(labelLayer))map.removeLayer(labelLayer);
    document.getElementById('labelsToggle').disabled=true;
    map.attributionControl.remove();map.zoomControl.getContainer().hidden=true;
    googleMapBase.hidden=false;document.body.classList.add('google-map-active');
    googleMap=new google.maps.Map(googleMapBase,{center:map.getCenter(),zoom:map.getZoom(),mapTypeId:'satellite',disableDefaultUI:true,gestureHandling:'none',keyboardShortcuts:false,clickableIcons:false});
    googleMapSync=()=>googleMap?.moveCamera({center:map.getCenter(),zoom:map.getZoom()});
    map.on('moveend zoomend',googleMapSync);
    layersPanel.hidden=true;
    status.textContent='Google Uydu açık. Anahtar yalnızca bu sekmenin belleğinde kullanılıyor; sayfayı yenileyince yeniden girmeniz gerekir.';
  }catch(error){
    disableGoogleMap();setStandardBase('satellite');
    status.textContent=error.message||'Google Uydu açılamadı.';
  }finally{button.disabled=false}
}
document.getElementById('googleMapButton').addEventListener('click',enableGoogleSatellite);
document.querySelectorAll('.dom-grid').forEach(grid=>{grid.textContent='';[27,30,33,36,39,42,45].forEach(n=>{const b=document.createElement('button');b.textContent=n;b.className=n===36?'selected':'';b.addEventListener('click',()=>{grid.querySelectorAll('button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected')});grid.append(b)})});
document.querySelectorAll('[data-datum]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-datum]').forEach(x=>x.classList.toggle('selected',x===b))}));
const toast=document.getElementById('toast');let toastTimer;function showToast(text){toast.textContent=text;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2800)}
let locationWatchId=null,locationMarker=null,locationAccuracy=null,hasLocationFix=false;
const locationButton=document.getElementById('locateButton'),locationStatus=document.getElementById('locationStatus');
function startLocationTracking(){
  if(locationWatchId!==null)return;
  if(!navigator.geolocation){locationStatus.textContent='Bu tarayıcı konum bilgisini desteklemiyor.';showToast('Konum takibi desteklenmiyor.');return}
  if(!window.isSecureContext){locationStatus.textContent='Konum için güvenli bağlantı (HTTPS) gerekiyor.';showToast('Konum takibi HTTPS üzerinden kullanılabilir.');return}
  locationButton.textContent='TAKİBİ DURDUR';locationButton.classList.add('danger');locationStatus.textContent='Konum bekleniyor… Tarayıcı izin isteğini onaylayın.';
  locationWatchId=navigator.geolocation.watchPosition(pos=>{
    if(locationWatchId===null)return;
    const point=[pos.coords.latitude,pos.coords.longitude],accuracy=Math.max(5,pos.coords.accuracy||0);
    if(!locationMarker)locationMarker=L.circleMarker(point,{radius:8,color:'#fff',weight:3,fillColor:'#1684ee',fillOpacity:1}).addTo(map).bindPopup('Canlı konum');else locationMarker.setLatLng(point);
    if(!locationAccuracy)locationAccuracy=L.circle(point,{radius:accuracy,color:'#1684ee',weight:1,fillColor:'#1684ee',fillOpacity:.12}).addTo(map);else locationAccuracy.setLatLng(point).setRadius(accuracy);
    map.setView(point,Math.max(map.getZoom(),16),{animate:hasLocationFix});hasLocationFix=true;
    locationStatus.textContent=`Konum güncellendi · doğruluk yaklaşık ${Math.round(accuracy)} m · ${new Date(pos.timestamp).toLocaleTimeString('tr-TR')}`;
  },err=>{
    const messages={1:'Konum izni verilmedi. Tarayıcı ayarlarından bu siteye konum izni verin.',2:'Konum bilgisi şu anda alınamıyor.',3:'Konum isteği zaman aşımına uğradı.'};
    locationStatus.textContent=messages[err.code]||'Konum alınamadı.';stopLocationTracking();showToast(locationStatus.textContent);
  },{enableHighAccuracy:true,maximumAge:0,timeout:20000});
}
function stopLocationTracking(){
  if(locationWatchId!==null)navigator.geolocation.clearWatch(locationWatchId);
  locationWatchId=null;locationButton.textContent='CANLI TAKİBİ BAŞLAT';locationButton.classList.remove('danger');
  if(locationStatus.textContent.startsWith('Konum güncellendi'))locationStatus.textContent='Takip durduruldu';
}
locationButton.addEventListener('click',()=>locationWatchId===null?startLocationTracking():stopLocationTracking());
document.getElementById('addressForm').addEventListener('submit',async e=>{e.preventDefault();const input=document.getElementById('addressInput'),msg=document.getElementById('addressMessage');msg.textContent='Aranıyor…';try{const url='https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(input.value);const res=await fetch(url);const data=await res.json();if(!data.length){msg.textContent='Adres bulunamadı.';return}const p=data[0];map.setView([+p.lat,+p.lon],16);L.marker([+p.lat,+p.lon]).addTo(map).bindPopup(p.display_name).openPopup();msg.textContent=p.display_name}catch{msg.textContent='Adres aranamadı. Bağlantınızı kontrol edin.'}});
let parcelPickActive=false,parcelLayer=null,parcelRequest=null;
const parcelButton=document.getElementById('parcelPickButton'),parcelMessage=document.getElementById('parcelMessage'),parcelResult=document.getElementById('parcelResult');
function setParcelPick(active){parcelPickActive=active;document.body.classList.toggle('parcel-pick',active);parcelButton.classList.toggle('is-active',active);parcelButton.textContent=active?'SEÇİMİ KAPAT':'HARİTADAN PARSEL SEÇ';if(active)parcelMessage.textContent='Haritada parselin içine tıkla. TKGM’den parsel sınırı ve bilgileri aranacak.';else if(!parcelMessage.textContent.startsWith('Parsel bulunamadı')&&!parcelMessage.textContent.startsWith('TKGM servisine'))parcelMessage.textContent='Parsel sorgusu kapalı.'}
parcelButton.addEventListener('click',()=>setParcelPick(!parcelPickActive));
document.getElementById('parcelPanel').querySelector('.close').addEventListener('click',()=>setParcelPick(false));
function findParcelFeature(payload){
  const queue=[payload];let found=null;
  while(queue.length){const item=queue.shift();if(!item||typeof item!=='object')continue;if(Array.isArray(item)){queue.push(...item);continue}const geometry=item.geometry||item.geom||item.shape;const properties=item.properties||item.attributes||item.ozellik||item;if(geometry&&typeof geometry==='object'&&geometry.type&&geometry.coordinates){found={type:'Feature',geometry,properties};break}for(const key of ['data','result','results','feature','features','parsel','parcel','geojson'])if(item[key])queue.push(item[key]);}
  return found;
}
function showParcelDetails(properties){
  const fields=[['İl','ilAd'],['İlçe','ilceAd'],['Mahalle','mahalleAd'],['Ada','adaNo'],['Parsel','parselNo'],['Alan','alan'],['Nitelik','nitelik'],['Pafta','pafta']];
  const title=document.createElement('strong');title.textContent=properties.ozet||`${properties.mahalleAd||'Parsel'} · ${properties.adaNo||'—'}/${properties.parselNo||'—'}`;
  const list=document.createElement('dl');for(const [label,key] of fields){if(properties[key]===undefined||properties[key]===null||properties[key]==='')continue;const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=String(properties[key]);list.append(dt,dd)}
  parcelResult.replaceChildren(title,list);parcelResult.hidden=false;
}
async function queryParcel(latlng){
  if(parcelRequest)parcelRequest.abort();parcelRequest=new AbortController();
  parcelMessage.textContent='TKGM parsel servisine sorgu gönderiliyor…';parcelResult.hidden=true;
  if(parcelLayer){map.removeLayer(parcelLayer);parcelLayer=null}
  const endpoint=`https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/parsel/${latlng.lat.toFixed(7)}/${latlng.lng.toFixed(7)}/`;
  try{
    const response=await fetch(endpoint,{headers:{Accept:'application/json'},signal:parcelRequest.signal});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();const feature=findParcelFeature(data);
    if(!feature){parcelMessage.textContent='Parsel bulunamadı. Konum yol, su alanı veya kayıt dışı bir yerde olabilir.';return}
    showParcelDetails(feature.properties||{});
    if(feature.geometry){parcelLayer=L.geoJSON(feature,{style:{color:'#ffb000',weight:3,fillColor:'#ffd45c',fillOpacity:.32}}).addTo(map);const bounds=parcelLayer.getBounds();if(bounds.isValid())map.fitBounds(bounds.pad(.25));parcelLayer.bindPopup(feature.properties?.ozet||`Ada ${feature.properties?.adaNo||'—'} / Parsel ${feature.properties?.parselNo||'—'}`).openPopup()}
    parcelMessage.textContent='Parsel bilgisi TKGM servisinden alındı.';
  }catch(error){if(error.name==='AbortError')return;parcelMessage.textContent='TKGM servisine bu siteden erişilemedi. Tarayıcı bağlantıyı engellemiş olabilir; resmî sorguyu yeni sekmede açabilirsin.';}
}
map.on('click',event=>{if(parcelPickActive)queryParcel(event.latlng)});
document.getElementById('uploadButton').addEventListener('click',()=>document.getElementById('fileInput').click());
document.getElementById('loadDisk').addEventListener('click',()=>document.getElementById('fileInput').click());
const importedLayers=[];
const cadLayers=document.getElementById('cadLayers');
const loadedFiles=document.getElementById('loadedFiles');
function addLayerEntry(name,layer,count){
  const row=document.createElement('label');row.className='cad-layer-row';
  const check=document.createElement('input');check.type='checkbox';check.checked=true;
  const title=document.createElement('span');title.className='cad-layer-name';title.textContent=name;
  const amount=document.createElement('span');amount.className='cad-layer-count';amount.textContent=String(count);
  check.addEventListener('change',()=>check.checked?layer.addTo(map):map.removeLayer(layer));
  row.append(check,title,amount);cadLayers.append(row);
  importedLayers.push({layer,row});
  return layer;
}
function zoomTo(layer){try{const b=layer.getBounds?.();if(b?.isValid())map.fitBounds(b.pad(.08),{maxZoom:18});else{const ll=layer.getLatLng?.();if(ll)map.setView(ll,18)}}catch{}}
async function parseKml(file){
  let xmlText;
  if(file.name.toLowerCase().endsWith('.kmz')){
    const zip=await JSZip.loadAsync(file);const kmlPath=Object.keys(zip.files).find(n=>n.toLowerCase().endsWith('.kml'));
    if(!kmlPath)throw new Error('KMZ arşivinde KML bulunamadı.');xmlText=await zip.files[kmlPath].async('string');
  }else xmlText=await file.text();
  const xml=new DOMParser().parseFromString(xmlText,'application/xml');
  if(xml.querySelector('parsererror'))throw new Error('KML dosyası okunamadı.');
  const geojson=toGeoJSON.kml(xml),layer=L.geoJSON(geojson,{style:{color:'#37e8c0',weight:2,fillColor:'#28b991',fillOpacity:.18},pointToLayer:(_,ll)=>L.circleMarker(ll,{radius:5,color:'#fff',weight:1,fillColor:'#ed5733',fillOpacity:1}),onEachFeature:(f,l)=>{const n=f.properties?.name;if(n)l.bindPopup(String(n))}}).addTo(map);
  const n=geojson.features?.length||0;if(!n)throw new Error('KML içinde gösterilebilir nesne bulunamadı.');
  cadLayers.querySelector('.message')?.remove();addLayerEntry(file.name,layer,n);zoomTo(layer);return n;
}
document.getElementById('fileInput').addEventListener('change',async e=>{
  const files=[...e.target.files];if(!files.length)return;
  cadLayers.querySelector('.message')?.remove();
  const done=[];
  for(const file of files){
    try{const name=file.name.toLowerCase();const count=name.endsWith('.dxf')?await parseDxf(file):await parseKml(file);done.push(`${file.name} (${count} nesne)`)}
    catch(error){console.error(error);showToast(`${file.name}: ${error.message||'dosya okunamadı'}`);done.push(`${file.name} — açılamadı`)}
  }
  loadedFiles.textContent=done.join(' · ');if(done.some(x=>x.includes('nesne')))showToast('Dosyalar haritaya eklendi. Katmanları sol panelden açıp kapatabilirsin.');e.target.value='';
});
document.getElementById('allLayers').addEventListener('change',e=>{for(const item of importedLayers){const c=item.row.querySelector('input');c.checked=e.target.checked;if(e.target.checked)item.layer.addTo(map);else map.removeLayer(item.layer)}});
document.getElementById('clearMap').addEventListener('click',()=>{for(const item of importedLayers){map.removeLayer(item.layer);item.row.remove()}importedLayers.length=0;map.eachLayer(l=>{if(l!==bases.satellite&&l!==bases.street&&l!==bases.dark&&l!==bases.light&&l!==labelLayer&&l!==locationMarker&&l!==locationAccuracy)map.removeLayer(l)});if(parcelRequest)parcelRequest.abort();parcelLayer=null;parcelResult.hidden=true;setParcelPick(false);cadLayers.innerHTML='<div class="message">DXF yüklendiğinde katmanlar burada görünür.</div>';loadedFiles.textContent='Henüz dosya yüklenmedi';document.getElementById('allLayers').checked=true;showToast('Harita üzerindeki işaretler temizlendi.')});
document.querySelectorAll('[data-datum]').forEach(b=>b.addEventListener('click',()=>showToast('Koordinat sistemi: '+b.dataset.datum)));
document.getElementById('printButton').addEventListener('click',()=>window.print());


/* Large DXF files are parsed in a worker and drawn by one canvas per CAD layer. */
const cadCanvasLayers = [];
const cadDxfFiles = new Map();
const activeDxfJobs = new Map();
let dxfBusyCount = 0, userDatum = null, userDom = null, reprojectTimer = null, applyingDetectedCrs = false;
const cadTextToggle = document.getElementById('cadTextToggle');

if (!map.getPane('cadCanvasPane')) {
  const pane = map.createPane('cadCanvasPane');
  pane.style.zIndex = '450';
}

const CadCanvasLayer = L.Layer.extend({
  initialize: function(name) {
    this.name = name;
    this.commands = [];
    this.bounds = L.latLngBounds([]);
    this._drawScheduled = false;
    this._reset = this._reset.bind(this);
  },
  onAdd: function(targetMap) {
    this._map = targetMap;
    this._canvas = L.DomUtil.create('canvas', 'cad-canvas-layer');
    this._canvas.setAttribute('aria-hidden', 'true');
    this._ctx = this._canvas.getContext('2d', { alpha: true, desynchronized: true });
    targetMap.getPane('cadCanvasPane').appendChild(this._canvas);
    targetMap.on('moveend zoomend resize viewreset', this._reset, this);
    this._reset();
  },
  onRemove: function(targetMap) {
    targetMap.off('moveend zoomend resize viewreset', this._reset, this);
    this._canvas?.remove();
    this._canvas = null;
    this._ctx = null;
    this._map = null;
  },
  addCommands: function(commands) {
    this.commands.push(...commands);
    for (const command of commands) {
      const include = point => {
        if (point && Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180) this.bounds.extend(point);
      };
      if (command.point) include(command.point);
      for (const point of command.points || []) include(point);
    }
    this._scheduleDraw();
  },
  getBounds: function() { return this.bounds; },
  _reset: function() {
    if (!this._map || !this._canvas) return;
    const size = this._map.getSize(), ratio = Math.max(1, window.devicePixelRatio || 1);
    this._canvas.style.width = size.x + 'px';
    this._canvas.style.height = size.y + 'px';
    this._canvas.width = Math.round(size.x * ratio);
    this._canvas.height = Math.round(size.y * ratio);
    this._ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this._topLeft = this._map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this._canvas, this._topLeft);
    this._draw();
  },
  _canvasPoint: function(latlng) {
    return this._map.latLngToLayerPoint(latlng).subtract(this._topLeft);
  },
  _scheduleDraw: function() {
    if (!this._map || this._drawScheduled) return;
    this._drawScheduled = true;
    requestAnimationFrame(() => { this._drawScheduled = false; this._draw(); });
  },
  _draw: function() {
    if (!this._ctx || !this._map) return;
    const ctx = this._ctx, size = this._map.getSize(), zoom = this._map.getZoom();
    ctx.clearRect(0, 0, size.x, size.y);
    let viewBounds = null;
    const showText = Boolean(cadTextToggle?.checked) && zoom >= 18;
    if (showText) viewBounds = this._map.getBounds().pad(.04);
    for (const command of this.commands) {
      if (command.type === 'text') {
        if (!showText || !viewBounds?.contains(command.point)) continue;
        const p = this._canvasPoint(command.point), latitude = command.point[0];
        const metersPerPixel = 40075016.686 * Math.max(.05, Math.cos(latitude * Math.PI / 180)) / (256 * 2 ** zoom);
        const fontSize = command.height > 0 ? Math.max(6, Math.min(48, command.height / metersPerPixel)) : 11;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(-(command.rotation || 0) * Math.PI / 180);
        ctx.fillStyle = command.color || '#ffffff';
        ctx.font = fontSize + 'px Arial, sans-serif';
        ctx.textBaseline = 'alphabetic';
        String(command.text || '').replace(/\\P/g, '\n').slice(0, 200).split('\n').forEach((line, index) => ctx.fillText(line, 0, index * fontSize * 1.15));
        ctx.restore();
        continue;
      }
      if (command.type === 'point') {
        const p = this._canvasPoint(command.point);
        ctx.beginPath(); ctx.arc(p.x, p.y, command.radius || 2, 0, Math.PI * 2);
        ctx.fillStyle = command.color || '#ffffff'; ctx.fill();
        continue;
      }
      const points = command.points || [];
      if (points.length < 2) continue;
      ctx.beginPath();
      let started = false;
      for (const coordinate of points) {
        if (!coordinate) continue;
        const p = this._canvasPoint(coordinate);
        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
      }
      if (!started) continue;
      if (command.closed) ctx.closePath();
      ctx.lineWidth = Math.max(.65, Math.min(8, command.weight || 1));
      ctx.strokeStyle = command.color || '#ffffff';
      ctx.fillStyle = command.color || '#ffffff';
      ctx.setLineDash(command.dash || []);
      if (command.filled) { ctx.globalAlpha = .72; ctx.fill(); ctx.globalAlpha = 1; }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
});

if (cadTextToggle) cadTextToggle.addEventListener('change', () => cadCanvasLayers.forEach(item => item.layer._scheduleDraw?.()));

function selectedCrs() {
  return {
    datum: document.querySelector('[data-datum].selected')?.dataset.datum?.includes('ED50') ? 'ED50' : 'ITRF',
    cm: Number(document.querySelector('.dom-grid button.selected')?.textContent || 36)
  };
}
function applyDetectedCrs(info) {
  applyingDetectedCrs = true;
  document.querySelectorAll('[data-datum]').forEach(button => button.classList.toggle('selected', button.dataset.datum.includes(info.datum)));
  document.querySelectorAll('.dom-grid button').forEach(button => button.classList.toggle('selected', Number(button.textContent) === info.cm));
  const status = document.getElementById('crsStatus');
  if (status) status.textContent = info.status + (info.explicitDatum ? '' : ' Datum harita üzerinde yaklaşık 100 m fark oluşturabilir; pafta bilgisiyle doğrulayın.');
  applyingDetectedCrs = false;
}
function removeCadCanvasLayers() {
  for (const item of cadCanvasLayers.splice(0)) {
    map.removeLayer(item.layer);
    item.row?.remove();
    const index = importedLayers.indexOf(item);
    if (index >= 0) importedLayers.splice(index, 1);
  }
}
function scheduleDxfReproject() {
  if (applyingDetectedCrs || !cadDxfFiles.size) return;
  clearTimeout(reprojectTimer);
  reprojectTimer = setTimeout(async () => {
    if (dxfBusyCount) { scheduleDxfReproject(); return; }
    const files = Array.from(cadDxfFiles.values());
    removeCadCanvasLayers();
    showToast('Yeni koordinat ayarıyla DXF yeniden çiziliyor…');
    for (const file of files) {
      try { await parseDxf(file, { keepFile: true }); }
      catch (error) { console.error(error); showToast(file.name + ': ' + (error.message || 'dosya okunamadı')); }
    }
  }, 250);
}
document.querySelectorAll('[data-datum]').forEach(button => button.addEventListener('click', () => {
  if (applyingDetectedCrs) return;
  userDatum = button.dataset.datum.includes('ED50') ? 'ED50' : 'ITRF';
  scheduleDxfReproject();
}));
document.querySelectorAll('.dom-grid button').forEach(button => button.addEventListener('click', () => {
  if (applyingDetectedCrs) return;
  userDom = Number(button.textContent);
  scheduleDxfReproject();
}));
document.getElementById('clearMap').addEventListener('click', () => {
  clearTimeout(reprojectTimer);
  for (const [worker, cancel] of Array.from(activeDxfJobs)) { worker.terminate(); cancel(); }
  cadDxfFiles.clear();
  cadCanvasLayers.length = 0;
});

async function parseDxf(file, options = {}) {
  showToast(file.size > 15 * 1024 * 1024 ? 'Büyük DXF ayrı işlem alanında okunuyor…' : 'DXF okunuyor…');
  const key = file.name + '|' + file.size + '|' + file.lastModified;
  if (!options.keepFile) cadDxfFiles.set(key, file);
  dxfBusyCount++;
  const fileLayers = new Map();
  let worker, settled = false;
  const cleanup = () => {
    if (worker) { activeDxfJobs.delete(worker); worker.terminate(); }
    dxfBusyCount = Math.max(0, dxfBusyCount - 1);
  };
  try {
    const buffer = await file.arrayBuffer();
    worker = new Worker(new URL('./dxf-worker.js?v=2', document.baseURI));
    const result = await new Promise((resolve, reject) => {
      const cancel = () => { if (settled) return; settled = true; reject(new Error('DXF yüklemesi iptal edildi.')); };
      activeDxfJobs.set(worker, cancel);
      worker.onmessage = event => {
        const message = event.data || {};
        if (message.type === 'crs') applyDetectedCrs(message.info);
        else if (message.type === 'batch') {
          for (const batch of message.batches || []) {
            let entry = fileLayers.get(batch.name);
            if (!entry) {
              const layer = new CadCanvasLayer(batch.name).addTo(map);
              entry = { layer, count: 0 };
              fileLayers.set(batch.name, entry);
            }
            entry.layer.addCommands(batch.commands || []);
            entry.count += (batch.commands || []).length;
          }
        } else if (message.type === 'progress') {
          const text = file.name + ' · ' + Number(message.processed || 0).toLocaleString('tr-TR') + ' nesne incelendi';
          loadedFiles.textContent = text;
        } else if (message.type === 'done') {
          if (settled) return;
          settled = true;
          resolve(message);
        } else if (message.type === 'error') {
          if (settled) return;
          settled = true;
          reject(new Error(message.message || 'DXF ayrıştırma başarısız oldu.'));
        }
      };
      worker.onerror = event => {
        if (settled) return;
        settled = true;
        reject(new Error(event.message || 'DXF işlem alanı kapandı. Dosya çok büyük veya ayrıştırılamadı.'));
      };
      worker.postMessage({
        type: 'parse', buffer, fileName: file.name,
        crs: { ...selectedCrs(), manualDatum: userDatum, manualCm: userDom }
      }, [buffer]);
    });
    let bounds = null;
    for (const [name, entry] of fileLayers) {
      const rowLayer = addLayerEntry(file.name + ' · ' + name, entry.layer, entry.count);
      const controlEntry = importedLayers[importedLayers.length - 1];
      cadCanvasLayers.push(controlEntry);
      if (!document.getElementById('allLayers').checked) map.removeLayer(rowLayer);
      if (entry.layer.getBounds().isValid()) bounds = bounds ? bounds.extend(entry.layer.getBounds()) : entry.layer.getBounds();
    }
    if (!result.total) throw new Error('DXF içinde haritada gösterilebilen çizim bulunamadı.');
    if (bounds?.isValid()) map.fitBounds(bounds.pad(.08), { maxZoom: 18 });
    loadedFiles.textContent = file.name + ' (' + Number(result.total).toLocaleString('tr-TR') + ' nesne)';
    showToast(file.name + ' · ' + Number(result.total).toLocaleString('tr-TR') + ' öğe yüklendi.');
    return result.total;
  } catch (error) {
    for (const entry of fileLayers.values()) map.removeLayer(entry.layer);
    if (!options.keepFile) cadDxfFiles.delete(key);
    throw error;
  } finally { cleanup(); }
}
