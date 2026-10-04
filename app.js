const map=L.map('map',{zoomControl:false,preferCanvas:true}).setView([39.05,35.35],5);
const zoomControl=L.control.zoom({position:'bottomright'}).addTo(map);
const bases={
  satellite:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'Tiles © Esri',maxZoom:19}),
  street:L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}),
  dark:L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{attribution:'© OpenStreetMap © CARTO',maxZoom:20}),
  light:L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{attribution:'© OpenStreetMap © CARTO',maxZoom:20})
};
bases.satellite.addTo(map);
let labelLayer=L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',{attribution:'',maxZoom:20,pane:'overlayPane'}).addTo(map);
const panels=['projectPanel','fieldPanel','locationPanel','addressPanel','parcelPanel'];
function openPanel(id){panels.forEach(p=>document.getElementById(p).hidden=p!==id||!document.getElementById(p).hidden);document.querySelectorAll('.toolbar [data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===id&&!document.getElementById(id).hidden));}
document.querySelectorAll('.toolbar [data-panel]').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.panel;const wasClosed=document.getElementById(id).hidden;if(fieldPickActive)setFieldPick(false);openPanel(id);if(id==='locationPanel'&&wasClosed)startLocationTracking();if(id==='parcelPanel')setParcelPick(wasClosed)}));
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
  zoomControl.getContainer().hidden=false;
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
    map.attributionControl.remove();zoomControl.getContainer().hidden=true;
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
document.getElementById('uploadButton').addEventListener('click',()=>{if(!isBedaEditor()){showToast('Dosya yükleme yetkisi yalnızca BEDA hesabında.');return}document.getElementById('fileInput').click()});
document.getElementById('loadDisk').addEventListener('click',()=>{if(!isBedaEditor()){showToast('Proje açma yetkisi yalnızca BEDA hesabında.');return}document.getElementById('fileInput').click()});
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
  if (!isBedaEditor()) { e.target.value=''; showToast('Dosya yükleme yetkisi yalnızca BEDA hesabında.'); return; }
  const files=[...e.target.files];if(!files.length)return;
  const bundle=files.find(file=>/\.dxfproj$|\.zip$/i.test(file.name));
  if(bundle){try{await importProjectBundle(bundle)}catch(error){console.error(error);showToast(error.message||'Proje paketi açılamadı.')}e.target.value='';return}
  const dxfFiles=files.filter(file=>file.name.toLowerCase().endsWith('.dxf'));
  if(dxfFiles.length){
    const oldProjectId=activeProjectId;
    setActiveProject(dxfFiles[0].name.replace(/\.dxf$/i,''));
    await moveProjectRecords(oldProjectId,activeProjectId,activeProjectName);
  }
  cadLayers.querySelector('.message')?.remove();
  const done=[];
  for(const file of files){
    try{const name=file.name.toLowerCase();const count=name.endsWith('.dxf')?await parseDxf(file):await parseKml(file);if(backendEnabled)await storeRemoteProjectFile(file);done.push(`${file.name} (${count} nesne)`)}
    catch(error){console.error(error);showToast(`${file.name}: ${error.message||'dosya okunamadı'}`);done.push(`${file.name} — açılamadı`)}
  }
  loadedFiles.textContent=done.join(' · ');if(done.some(x=>x.includes('nesne')))showToast('Dosyalar haritaya eklendi. Katmanları sol panelden açıp kapatabilirsin.');if(dxfFiles.length)refreshFieldRecords();e.target.value='';
});
document.getElementById('allLayers').addEventListener('change',e=>{for(const item of importedLayers){const c=item.row.querySelector('input');c.checked=e.target.checked;if(e.target.checked)item.layer.addTo(map);else map.removeLayer(item.layer)}});
document.getElementById('clearMap').addEventListener('click',()=>{if(!isBedaEditor()){showToast('Harita temizleme yetkisi yalnızca BEDA hesabında.');return}for(const item of importedLayers){map.removeLayer(item.layer);item.row.remove()}importedLayers.length=0;map.eachLayer(l=>{if(l!==bases.satellite&&l!==bases.street&&l!==bases.dark&&l!==bases.light&&l!==labelLayer&&l!==locationMarker&&l!==locationAccuracy&&l!==fieldMarkerLayer)map.removeLayer(l)});if(fieldDraftMarker){map.removeLayer(fieldDraftMarker);fieldDraftMarker=null}fieldDraftLocation=null;fieldLocationStatus.textContent='Konum seçilmedi.';if(parcelRequest)parcelRequest.abort();parcelLayer=null;parcelResult.hidden=true;setParcelPick(false);cadLayers.innerHTML='<div class="message">DXF yüklendiğinde katmanlar burada görünür.</div>';loadedFiles.textContent='Henüz dosya yüklenmedi';document.getElementById('allLayers').checked=true;showToast('Harita üzerindeki işaretler temizlendi.')});
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
  if (!isBedaEditor()) { showToast('Harita temizleme yetkisi yalnızca BEDA hesabında.'); return; }
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

/* Field photos and notes stay in this browser until the user exports a project bundle. */
const FIELD_DB_NAME = 'dxf-field-records-v1';
const FIELD_STORE = 'records';
let fieldDbPromise = null;
let activeProjectId = localStorage.getItem('dxf-active-project-id') || 'saha-denemesi';
let activeProjectName = localStorage.getItem('dxf-active-project-name') || 'Saha Denemesi';
let fieldPhotoFile = null, fieldPhotoUrl = null, fieldDraftLocation = null;
let fieldDraftMarker = null, fieldPickActive = false;
if (!map.getPane('fieldMarkerPane')) { const pane = map.createPane('fieldMarkerPane'); pane.style.zIndex = '650'; }
const fieldMarkerLayer = L.layerGroup().addTo(map);
const fieldPhotoInput = document.getElementById('fieldPhotoInput');
const fieldPhotoPreview = document.getElementById('fieldPhotoPreview');
const fieldPhotoStatus = document.getElementById('fieldPhotoStatus');
const fieldLocationStatus = document.getElementById('fieldLocationStatus');
const fieldTitleInput = document.getElementById('fieldTitle');
const fieldNotesInput = document.getElementById('fieldNotes');
const fieldStatusInput = document.getElementById('fieldStatus');
const fieldStatusWarning = document.getElementById('fieldStatusWarning');
const fieldUserRoleInput = document.getElementById('fieldUserRole');
const fieldContractorInput = document.getElementById('fieldContractor');
const fieldContractorRow = document.getElementById('fieldContractorRow');
const fieldRoleNotice = document.getElementById('fieldRoleNotice');
const fieldReadOnlyNotice = document.getElementById('fieldReadOnlyNotice');
const fieldEditor = document.getElementById('fieldEditor');
const fieldOwnerInput = document.getElementById('fieldOwner');
const fieldRecordList = document.getElementById('fieldRecordList');
const fieldProjectLabel = document.getElementById('fieldProjectLabel');
const fieldObjectUrls = new Set();
let generatedProjectBundleUrl = null;
const FIELD_CONTRACTORS = ['ERKSİS', 'ASTAN', 'ASMİN', 'ERBU', 'AZRAM'];
function normalizeContractorCode(value) { return value === 'ERSKSİS' ? 'ERKSİS' : value; }
const DEMO_ROLES = ['beda', 'aedas', 'contractor'];
const supabaseConfig = window.DXF_SUPABASE_CONFIG || {};
const backendConfigured = Boolean(supabaseConfig.url && supabaseConfig.publishableKey);
let backendInitError = '', supabaseClient = null;
if (backendConfigured) {
  try {
    if (!window.supabase?.createClient) throw new Error('Supabase istemcisi yüklenemedi. İnternet bağlantısını kontrol et.');
    supabaseClient = window.supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey);
  } catch (error) { backendInitError = error.message || 'Supabase bağlantı ayarı hatalı.'; }
}
const backendEnabled = Boolean(supabaseClient);
document.body.classList.toggle('auth-required', backendConfigured);
document.getElementById('authGate').hidden = !backendConfigured;
let demoRole = DEMO_ROLES.includes(localStorage.getItem('dxf-demo-role')) ? localStorage.getItem('dxf-demo-role') : 'beda';
let demoContractor = FIELD_CONTRACTORS.includes(normalizeContractorCode(localStorage.getItem('dxf-demo-contractor'))) ? normalizeContractorCode(localStorage.getItem('dxf-demo-contractor')) : FIELD_CONTRACTORS[0];
let authenticatedProfile = null, authenticatedSession = null;
function activeRole() { return backendConfigured ? authenticatedProfile?.role || '' : demoRole; }
function isBedaEditor() { return activeRole() === 'beda'; }
let authApplyRevision = 0;
const authMessage = document.getElementById('authMessage');
if (backendConfigured && !backendEnabled) authMessage.textContent = backendInitError;
const authSignOutButtons = [document.getElementById('authSignOut'), document.getElementById('authGateSignOut')];
async function applyAuthenticationSession(session) {
  if (!backendEnabled) return;
  const revision = ++authApplyRevision;
  const previousUserId = authenticatedProfile?.user_id || null;
  authenticatedSession = session || null;
  authenticatedProfile = null;
  if (!session) {
    if (previousUserId) unloadDisplayedProject();
    document.body.classList.add('auth-required');
    document.getElementById('authGate').hidden = false;
    authSignOutButtons.forEach(button => { if (button) button.hidden = true; });
    authMessage.textContent = 'BEDA, AEDAŞ veya taşeron hesabınla oturum aç.';
    applyDemoRole();
    await refreshFieldRecords();
    return;
  }
  authMessage.textContent = 'Hesap yetkisi kontrol ediliyor…';
  const { data, error } = await supabaseClient.from('user_profiles')
    .select('user_id,display_name,role,contractor_code').eq('user_id', session.user.id).maybeSingle();
  if (revision !== authApplyRevision) return;
  if (error || !data || !['beda', 'aedas', 'contractor'].includes(data.role)
      || (data.role === 'contractor' && !FIELD_CONTRACTORS.includes(data.contractor_code))) {
    if (previousUserId) unloadDisplayedProject();
    document.body.classList.add('auth-required');
    document.getElementById('authGate').hidden = false;
    authSignOutButtons.forEach(button => { if (button) button.hidden = false; });
    authMessage.textContent = error ? `Hesap yetkisi okunamadı: ${error.message}` : 'Bu kullanıcıya rol atanmamış. Proje yöneticisinden hesap yetkisi iste.';
    applyDemoRole();
    await refreshFieldRecords();
    return;
  }
  if (previousUserId && previousUserId !== data.user_id) unloadDisplayedProject();
  authenticatedProfile = data;
  document.body.classList.remove('auth-required');
  document.getElementById('authGate').hidden = true;
  authSignOutButtons.forEach(button => { if (button) button.hidden = false; });
  authMessage.textContent = '';
  applyDemoRole();
  await refreshSharedProjects();
  if (revision !== authApplyRevision) return;
  const projectSelect = document.getElementById('sharedProjectSelect');
  if (projectSelect.value && (projectSelect.value !== activeProjectId
      || projectSelect.options[projectSelect.selectedIndex]?.textContent !== activeProjectName)) {
    const selected = projectSelect.options[projectSelect.selectedIndex];
    setActiveProject(selected.textContent, selected.value);
    unloadDisplayedProject();
  } else if (!projectSelect.value && activeProjectId !== 'no-authorized-projects') {
    unloadDisplayedProject();
    setActiveProject('Erişilebilir proje yok', 'no-authorized-projects');
  }
  await refreshFieldRecords();
}
async function signOutAuthenticatedUser() {
  if (!backendEnabled) return;
  authSignOutButtons.forEach(button => { if (button) button.disabled = true; });
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) authMessage.textContent = `Oturum kapatılamadı: ${error.message}`;
  } catch (error) { authMessage.textContent = `Oturum kapatılamadı: ${error.message || 'bağlantı hatası'}`; }
  finally { authSignOutButtons.forEach(button => { if (button) button.disabled = false; }); }
}
document.getElementById('authForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!backendEnabled) { authMessage.textContent = backendInitError || 'Gerçek giriş için Supabase URL ve publishable key yapılandırılmalı.'; return; }
  const button = document.getElementById('authSubmit'); button.disabled = true;
  authMessage.textContent = 'Giriş yapılıyor…';
  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: document.getElementById('authEmail').value.trim(),
      password: document.getElementById('authPassword').value
    });
    if (error) authMessage.textContent = `Giriş yapılamadı: ${error.message}`;
  } catch (error) { authMessage.textContent = `Giriş yapılamadı: ${error.message || 'bağlantı hatası'}`; }
  finally { button.disabled = false; }
});
authSignOutButtons.forEach(button => button?.addEventListener('click', signOutAuthenticatedUser));
async function initializeAuthentication() {
  if (!backendEnabled) return;
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => { void applyAuthenticationSession(session); }, 0);
  });
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) authMessage.textContent = `Oturum okunamadı: ${error.message}`;
  await applyAuthenticationSession(data?.session || null);
}
function makeRecordId() {
  return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.random() * 16 | 0; return (char === 'x' ? random : (random & 3 | 8)).toString(16);
  });
}
function applyDemoRole() {
  const role = activeRole();
  fieldUserRoleInput.value = demoRole;
  fieldContractorInput.value = demoContractor;
  document.getElementById('fieldDemoIdentity').hidden = backendConfigured;
  document.getElementById('fieldCurrentUser').hidden = !backendEnabled || !authenticatedProfile;
  document.getElementById('fieldCurrentUser').textContent = authenticatedProfile ? `Oturum: ${authenticatedProfile.display_name}` : '';
  fieldContractorRow.hidden = backendEnabled || role !== 'contractor';
  fieldEditor.hidden = !isBedaEditor();
  fieldReadOnlyNotice.hidden = isBedaEditor();
  if (role === 'contractor') {
    const contractor = backendEnabled ? authenticatedProfile?.contractor_code : demoContractor;
    fieldRoleNotice.textContent = `TAŞERON / ${contractor || 'hesap'}: yalnızca Yandex Disk’te kendi klasöründeki projeleri görüntüleyebilir.`;
    fieldReadOnlyNotice.textContent = 'Saha kayıtları yalnızca BEDA hesabına açıktır.';
  } else if (role === 'aedas') {
    fieldRoleNotice.textContent = 'AEDAŞ: tüm proje çizimlerini görüntüleyebilir.';
    fieldReadOnlyNotice.textContent = 'Saha kayıtları yalnızca BEDA hesabına açıktır.';
  } else if (role === 'beda') {
    fieldRoleNotice.textContent = 'BEDA: tüm kayıtları görüntüleyebilir, ekleyebilir, düzeltebilir ve silebilir.';
    fieldReadOnlyNotice.textContent = '';
  } else {
    fieldRoleNotice.textContent = backendConfigured ? 'Hesabın için yetki profili bulunamadı.' : '';
    fieldReadOnlyNotice.textContent = '';
  }
  for (const id of ['clearMap', 'uploadButton', 'loadDisk', 'saveProjectBundle']) document.getElementById(id).hidden = !isBedaEditor();
  const downloadBundle = document.getElementById('downloadProjectBundle');
  if (!isBedaEditor()) downloadBundle.hidden = true;
  document.getElementById('sharedProjects').hidden = !backendEnabled || !authenticatedProfile;
  document.getElementById('yandexBrowseButton').hidden = !backendEnabled || !authenticatedProfile;
  document.getElementById('yandexFolderSetupButton').hidden = !backendEnabled || !isBedaEditor();
  const privacyNotes = document.querySelectorAll('.file-privacy');
  if (backendEnabled) {
    privacyNotes[0].textContent = 'Saha kayıtları ve proje dosyaları ortak Supabase hesabında saklanır. Erişim hesabına göre denetlenir.';
    privacyNotes[1].hidden = true;
  } else {
    privacyNotes[0].textContent = 'Deneme sürümünde saha kayıtları bu tarayıcıda tutulur. “Tüm projeyi paketle” DXF ve fotoğrafları tek dosyaya alır; bu paketi Yandex Disk’e yükleyip daha sonra buradan açabilirsin.';
    privacyNotes[1].hidden = false;
  }
}
fieldUserRoleInput.addEventListener('change', () => {
  if (backendConfigured) { applyDemoRole(); return; }
  demoRole = DEMO_ROLES.includes(fieldUserRoleInput.value) ? fieldUserRoleInput.value : 'aedas';
  localStorage.setItem('dxf-demo-role', demoRole);
  applyDemoRole(); refreshFieldRecords();
});
fieldContractorInput.addEventListener('change', () => {
  if (backendConfigured) { applyDemoRole(); return; }
  demoContractor = FIELD_CONTRACTORS.includes(fieldContractorInput.value) ? fieldContractorInput.value : FIELD_CONTRACTORS[0];
  localStorage.setItem('dxf-demo-contractor', demoContractor);
  applyDemoRole(); refreshFieldRecords();
});
window.addEventListener('storage', event => {
  if (backendConfigured) return;
  if (event.key === 'dxf-demo-role' && DEMO_ROLES.includes(event.newValue)) demoRole = event.newValue;
  if (event.key === 'dxf-demo-contractor' && FIELD_CONTRACTORS.includes(event.newValue)) demoContractor = event.newValue;
  if (event.key === 'dxf-demo-role' || event.key === 'dxf-demo-contractor') { applyDemoRole(); refreshFieldRecords(); }
});
const FIELD_STATUSES = {
  problem: { label: 'Sorunlu', color: '#d83b35', className: 'problem', warning: '⚠️ UYARI: Bu kayıt sorunlu olarak işaretlenecek. Kayıt kırmızı uyarı ile gösterilecek.' },
  pending: { label: 'Düzeltilmesi bekliyor', color: '#d99a00', className: 'pending', warning: '⚠️ UYARI: Düzeltme bekleniyor. Kayıt tamamlanana kadar sarı uyarı ile takip edilecek.' },
  suitable: { label: 'Uygun', color: '#27854a', className: 'suitable', warning: '' }
};
function fieldStatusInfo(value) {
  return FIELD_STATUSES[value] || { label: 'Durum belirtilmemiş', color: '#7b8580', className: 'unknown', warning: '' };
}
function renderFieldStatusWarning() {
  const status = FIELD_STATUSES[fieldStatusInput.value];
  fieldStatusWarning.textContent = status?.warning || '';
  fieldStatusWarning.className = `message field-status-warning ${status?.className || ''}`;
  fieldStatusWarning.hidden = !status?.warning;
}
fieldStatusInput.addEventListener('change', renderFieldStatusWarning);

function fieldDb() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('Bu tarayıcı kayıt saklamayı desteklemiyor.'));
  if (!fieldDbPromise) fieldDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(FIELD_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FIELD_STORE)) db.createObjectStore(FIELD_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Saha kayıt deposu açılamadı.'));
  });
  return fieldDbPromise;
}
async function fieldRequest(mode, action) {
  const db = await fieldDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FIELD_STORE, mode), store = tx.objectStore(FIELD_STORE);
    let request;
    try { request = action(store); } catch (error) { reject(error); return; }
    let result;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error || new Error('Saha kaydı okunamadı.'));
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error('Saha kaydı kaydedilemedi.'));
    tx.onabort = () => reject(tx.error || new Error('Saha kaydı kaydedilemedi.'));
  });
}
async function getProjectRecords(projectId = activeProjectId) {
  if (backendEnabled) {
    if (!authenticatedSession || authenticatedProfile?.role !== 'beda') return [];
    const { data, error } = await supabaseClient.from('field_records').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(record => ({
      id: record.id, projectId: record.project_id, projectName: activeProjectName,
      lat: record.lat, lon: record.lon, title: record.title, category: record.category,
      status: record.status, assignedContractor: normalizeContractorCode(record.assigned_contractor || ''), notes: record.notes || '',
      createdAt: Date.parse(record.created_at), updatedAt: record.updated_at ? Date.parse(record.updated_at) : null,
      photoPath: record.photo_path || null, photoName: record.photo_name || '', photoType: record.photo_type || ''
    }));
  }
  const all = await fieldRequest('readonly', store => store.getAll());
  return demoRole === 'beda' ? all.filter(record => record.projectId === projectId)
    .map(record => ({ ...record, assignedContractor: normalizeContractorCode(record.assignedContractor || '') }))
    .sort((a, b) => b.createdAt - a.createdAt) : [];
}
async function moveProjectRecords(fromId, toId, projectName) {
  if (backendEnabled) return;
  if (!fromId || fromId === toId) return;
  const records = await getProjectRecords(fromId);
  for (const record of records) await fieldRequest('readwrite', store => store.put({ ...record, projectId: toId, projectName }));
}
function setActiveProject(name, id) {
  activeProjectName = String(name || 'Saha Denemesi').replace(/\.dxf$/i, '').trim() || 'Saha Denemesi';
  activeProjectId = id || 'local-' + activeProjectName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
  localStorage.setItem('dxf-active-project-id', activeProjectId);
  localStorage.setItem('dxf-active-project-name', activeProjectName);
  fieldProjectLabel.textContent = 'Proje: ' + activeProjectName;
}
async function refreshSharedProjects() {
  if (!backendEnabled || !authenticatedProfile) return;
  const select = document.getElementById('sharedProjectSelect');
  const { data, error } = await supabaseClient.from('projects').select('id,name').order('name');
  if (error) {
    select.replaceChildren();
    document.getElementById('yandexMessage').textContent = error.message;
    return;
  }
  const projects = data || [];
  select.replaceChildren();
  if (!projects.length) {
    const option = document.createElement('option'); option.value = ''; option.textContent = 'Henüz ortak proje yok'; select.append(option);
    return;
  }
    for (const project of projects) {
      const option = document.createElement('option'); option.value = project.id; option.textContent = project.name;
      select.append(option);
    }
  if (projects.some(project => project.id === activeProjectId)) select.value = activeProjectId;
  else if (projects.length) select.selectedIndex = 0;
}
function unloadDisplayedProject() {
  clearTimeout(reprojectTimer);
  for (const [worker, cancel] of Array.from(activeDxfJobs)) { worker.terminate(); cancel(); }
  cadDxfFiles.clear(); removeCadCanvasLayers();
  for (const item of importedLayers.splice(0)) { map.removeLayer(item.layer); item.row.remove(); }
  cadLayers.innerHTML = '<div class="message">DXF yüklendiğinde katmanlar burada görünür.</div>';
  loadedFiles.textContent = 'Henüz dosya yüklenmedi';
  if (fieldDraftMarker) { map.removeLayer(fieldDraftMarker); fieldDraftMarker = null; }
  fieldDraftLocation = null; fieldLocationStatus.textContent = 'Konum seçilmedi.';
}
async function openSharedProject() {
  if (!backendEnabled || !authenticatedProfile) return;
  const projectId = document.getElementById('sharedProjectSelect').value;
  if (!projectId) return;
  const option = Array.from(document.getElementById('sharedProjectSelect').options).find(item => item.value === projectId);
  const projectName = option?.textContent || projectId;
  const { data: files, error } = await supabaseClient.from('project_files').select('*').eq('project_id', projectId).order('created_at');
  if (error) { showToast('Ortak proje dosyaları okunamadı: ' + error.message); return; }
  unloadDisplayedProject(); setActiveProject(projectName, projectId);
  const done = [];
  for (const entry of files || []) {
    const { data: blob, error: downloadError } = await supabaseClient.storage.from('project-files').download(entry.storage_path);
    if (downloadError) { done.push(`${entry.file_name} — indirilemedi`); continue; }
    const file = new File([blob], entry.file_name, { type: entry.mime_type || 'application/octet-stream', lastModified: Date.now() });
    try {
      const count = file.name.toLowerCase().endsWith('.dxf') ? await parseDxf(file) : await parseKml(file);
      done.push(`${file.name} (${count} nesne)`);
    } catch (error) { console.error(error); done.push(`${file.name} — açılamadı`); }
  }
  loadedFiles.textContent = done.length ? done.join(' · ') : 'Projede çizim dosyası yok';
  document.querySelectorAll('.toolbar [data-panel]').forEach(button => button.classList.remove('active'));
  document.getElementById('projectPanel').hidden = true;
  await refreshFieldRecords();
  showToast(`${projectName} ortak projeden açıldı.`);
}
async function ensureRemoteProject(yandexPath = null) {
  if (!backendEnabled) return;
  if (!authenticatedProfile || !isBedaEditor()) throw new Error('Ortak projeyi yalnızca BEDA hesabı oluşturabilir.');
  const project = { id: activeProjectId, name: activeProjectName, created_by: authenticatedProfile.user_id };
  if (yandexPath) project.yandex_path = yandexPath;
  const { error } = await supabaseClient.from('projects').upsert(project, { onConflict: 'id' });
  if (error) throw error;
}
async function storeRemoteProjectFile(file, sourcePath = null) {
  if (!backendEnabled) return;
  if (!isBedaEditor()) throw new Error('Proje dosyasını ortak alana yalnızca BEDA yükleyebilir.');
  const yandexFolder = yandexFolderForPath(sourcePath);
  await ensureRemoteProject(yandexFolder);
  const storagePath = `${activeProjectId}/${safeFileName(file.name)}`;
  const { error: uploadError } = await supabaseClient.storage.from('project-files').upload(storagePath, file, { upsert: true, contentType: file.type || 'application/octet-stream' });
  if (uploadError) throw uploadError;
  const { error } = await supabaseClient.from('project_files').upsert({
    project_id: activeProjectId, file_name: file.name, storage_path: storagePath,
    source_path: sourcePath, mime_type: file.type || null, file_size: file.size,
    created_by: authenticatedProfile.user_id
  }, { onConflict: 'storage_path' });
  if (error) throw error;
}
async function saveRemoteFieldRecord(record) {
  if (!authenticatedProfile || !isBedaEditor()) throw new Error('Kayıt düzeltme yetkisi yalnızca BEDA hesabında.');
  await ensureRemoteProject();
  let photoPath = record.photoPath || null;
  if (record.photo) {
    photoPath = `${activeProjectId}/${record.id}/${safeFileName(record.photoName || 'foto.jpg')}`;
    const { error: photoError } = await supabaseClient.storage.from('field-photos').upload(photoPath, record.photo, {
      upsert: true, contentType: mimeTypeForPhoto(record.photoName, record.photoType)
    });
    if (photoError) throw photoError;
  }
  const row = {
    id: record.id, project_id: activeProjectId, title: record.title || 'Saha kaydı',
    category: record.category || 'Diğer', status: record.status || null,
    assigned_contractor: normalizeContractorCode(record.assignedContractor) || null, notes: record.notes || '',
    lat: record.lat, lon: record.lon, photo_path: photoPath,
    photo_name: record.photoName || null, photo_type: record.photoType || null,
    created_by: authenticatedProfile.user_id,
    ...(record.createdAt ? { created_at: new Date(record.createdAt).toISOString() } : {})
  };
  const { error } = await supabaseClient.from('field_records').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}
async function getFieldPhotoUrl(record) {
  if (record.photo) return newObjectUrl(record.photo);
  if (backendEnabled && record.photoPath) {
    const { data, error } = await supabaseClient.storage.from('field-photos').createSignedUrl(record.photoPath, 900);
    if (error) { console.warn('Saha fotoğrafı açılamadı:', error); return null; }
    return data?.signedUrl || null;
  }
  return null;
}
async function callYandexBridge(payload, asBlob = false) {
  if (!backendEnabled || !authenticatedSession?.access_token) throw new Error('Önce gerçek kullanıcı hesabıyla giriş yap.');
  const response = await fetch(`${supabaseConfig.url.replace(/\/$/, '')}/functions/v1/yandex-projects`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authenticatedSession.access_token}`,
      apikey: supabaseConfig.publishableKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    let message = `Yandex Disk isteği başarısız oldu (HTTP ${response.status}).`;
    try { message = (await response.json()).error || message; } catch {}
    throw new Error(message);
  }
  return asBlob ? response.blob() : response.json();
}
async function browseYandexProjects() {
  const list = document.getElementById('yandexFileList'), message = document.getElementById('yandexMessage');
  if (!backendEnabled || !authenticatedProfile) { showToast('Yandex projeleri için giriş yap.'); return; }
  message.textContent = 'PROJELER klasörü okunuyor…'; list.hidden = true; list.replaceChildren();
  try {
    const result = await callYandexBridge({ action: 'list' });
    if (!result.files?.length) { message.textContent = 'Erişebildiğin Yandex klasörlerinde desteklenen çizim bulunamadı.'; return; }
    for (const item of result.files) {
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = `${item.contractorCode ? item.contractorCode + ' · ' : 'PROJELER · '}${item.name} · ${(Number(item.size || 0) / (1024 * 1024)).toFixed(1)} MB`;
      button.addEventListener('click', async () => {
        button.disabled = true; message.textContent = `${item.name} Yandex Disk’ten alınıyor…`;
        try {
          const blob = await callYandexBridge({ action: 'download', path: item.path }, true);
          const file = new File([blob], item.name, { type: item.mimeType || 'application/octet-stream', lastModified: Date.now() });
          if (/\.(dxfproj|zip)$/i.test(file.name)) {
            if (!isBedaEditor()) throw new Error('Saha kayıtları içerebilen proje paketlerini yalnızca BEDA açabilir.');
            await importProjectBundle(file, item.path);
          }
          else {
            unloadDisplayedProject();
            const projectName = file.name.replace(/\.(dxf|kmz|kml)$/i, '');
            setActiveProject(projectName, yandexProjectId(projectName, item.path));
            const count = file.name.toLowerCase().endsWith('.dxf') ? await parseDxf(file) : await parseKml(file);
            if (isBedaEditor()) await storeRemoteProjectFile(file, item.path);
            loadedFiles.textContent = `${file.name} (${count} nesne)`;
            await refreshFieldRecords();
            if (isBedaEditor()) await refreshSharedProjects();
            message.textContent = isBedaEditor() ? `${projectName} BEDA’nın ortak proje alanına aktarıldı.` : `${projectName} kendi klasöründen salt okunur açıldı.`;
          }
        } catch (error) { console.error(error); message.textContent = error.message || 'Yandex projesi alınamadı.'; }
        finally { button.disabled = false; }
      });
      list.append(button);
    }
    list.hidden = false; message.textContent = `${result.files.length} dosya bulundu · Yandex: ${result.folder}`;
  } catch (error) { message.textContent = error.message || 'Yandex Disk’e bağlanılamadı.'; }
}
document.getElementById('refreshSharedProjects').addEventListener('click', refreshSharedProjects);
document.getElementById('openSharedProject').addEventListener('click', openSharedProject);
document.getElementById('yandexBrowseButton').addEventListener('click', browseYandexProjects);
document.getElementById('yandexFolderSetupButton').addEventListener('click', async event => {
  const button = event.currentTarget, message = document.getElementById('yandexMessage');
  if (!isBedaEditor()) { showToast('Taşeron klasörlerini yalnızca BEDA hazırlayabilir.'); return; }
  button.disabled = true; message.textContent = 'Beş taşeron klasörü kontrol ediliyor…';
  try {
    const result = await callYandexBridge({ action: 'ensure-folders' });
    const missing = Array.isArray(result.missing) ? result.missing : [];
    message.textContent = missing.length
      ? `Yandex Disk'te eksik klasörler var: ${missing.join(', ')}. Bunları /PROJELER içine kendin oluştur.`
      : 'Beş taşeron klasörü Yandex Disk’te hazır.';
    await browseYandexProjects();
  } catch (error) { message.textContent = error.message || 'Yandex klasörleri hazırlanamadı.'; }
  finally { button.disabled = false; }
});
function newObjectUrl(blob) {
  const url = URL.createObjectURL(blob);
  fieldObjectUrls.add(url);
  return url;
}
function cleanupFieldObjectUrls() {
  for (const url of fieldObjectUrls) URL.revokeObjectURL(url);
  fieldObjectUrls.clear();
}
function updateFieldDraftPoint(point, label, center = true) {
  fieldDraftLocation = { lat: Number(point.lat), lon: Number(point.lng ?? point.lon) };
  if (!Number.isFinite(fieldDraftLocation.lat) || !Number.isFinite(fieldDraftLocation.lon)) {
    fieldDraftLocation = null;
    fieldLocationStatus.textContent = 'Geçerli konum alınamadı.';
    return;
  }
  fieldLocationStatus.textContent = `${label} · ${fieldDraftLocation.lat.toFixed(6)}, ${fieldDraftLocation.lon.toFixed(6)}`;
  const ll = [fieldDraftLocation.lat, fieldDraftLocation.lon];
  if (!fieldDraftMarker) {
    fieldDraftMarker = L.marker(ll, { draggable: true, pane: 'fieldMarkerPane' }).addTo(map).bindPopup('Yeni saha kaydı · pini sürükleyerek konumu düzelt');
    fieldDraftMarker.on('dragend', () => {
      const p = fieldDraftMarker.getLatLng();
      updateFieldDraftPoint(p, 'Haritadan seçildi', false);
    });
  } else fieldDraftMarker.setLatLng(ll);
  if (center) map.setView(ll, Math.max(map.getZoom(), 17));
}
function setFieldPick(active) {
  fieldPickActive = active;
  document.body.classList.toggle('field-pick', active);
  if (active) {
    setParcelPick(false);
    document.getElementById('fieldPanel').hidden = true;
    document.querySelectorAll('.toolbar button').forEach(button => button.classList.remove('active'));
    fieldLocationStatus.textContent = 'Haritada fotoğrafın çekildiği noktaya tıkla.';
  } else if (fieldLocationStatus.textContent.startsWith('Haritada fotoğrafın')) {
    fieldLocationStatus.textContent = fieldDraftLocation ? 'Konum seçildi.' : 'Konum seçilmedi.';
  }
}
document.getElementById('fieldPickLocation').addEventListener('click', () => setFieldPick(!fieldPickActive));
map.on('click', event => {
  if (!fieldPickActive) return;
  updateFieldDraftPoint(event.latlng, 'Haritadan seçildi');
  setFieldPick(false);
  document.getElementById('fieldPanel').hidden = false;
  document.querySelector('.toolbar [data-panel="fieldPanel"]')?.classList.add('active');
});
document.getElementById('fieldPanel').querySelector('.close').addEventListener('click', () => setFieldPick(false));
document.getElementById('fieldUseCurrentLocation').addEventListener('click', () => {
  if (!navigator.geolocation) { fieldLocationStatus.textContent = 'Bu tarayıcı konum bilgisini desteklemiyor.'; return; }
  if (!window.isSecureContext) { fieldLocationStatus.textContent = 'Anlık konum için site HTTPS üzerinden açılmalı.'; return; }
  fieldLocationStatus.textContent = 'Konum alınıyor… Tarayıcı izin isteğini onayla.';
  navigator.geolocation.getCurrentPosition(position => {
    updateFieldDraftPoint({ lat: position.coords.latitude, lng: position.coords.longitude }, `Anlık konum · ±${Math.round(position.coords.accuracy)} m`);
  }, error => {
    const messages = { 1: 'Konum izni verilmedi.', 2: 'Konum şu anda alınamıyor.', 3: 'Konum isteği zaman aşımına uğradı.' };
    fieldLocationStatus.textContent = messages[error.code] || 'Konum alınamadı.';
  }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
});

async function readJpegGps(file) {
  if (!/^image\/(jpeg|jpg)$/i.test(file.type) && !/\.jpe?g$/i.test(file.name)) return null;
  const bytes = new DataView(await file.arrayBuffer());
  const get16 = (offset, little = false) => bytes.getUint16(offset, little);
  const get32 = (offset, little = false) => bytes.getUint32(offset, little);
  if (get16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 4 < bytes.byteLength) {
    if (get16(offset) !== 0xffe1) { offset++; continue; }
    const segmentLength = get16(offset + 2);
    if (offset + segmentLength + 2 > bytes.byteLength) return null;
    const exif = offset + 4;
    if (String.fromCharCode(...new Uint8Array(bytes.buffer, exif, 6)) !== 'Exif\0\0') { offset += segmentLength + 2; continue; }
    const tiff = exif + 6;
    const byteOrder = String.fromCharCode(bytes.getUint8(tiff), bytes.getUint8(tiff + 1));
    const little = byteOrder === 'II';
    if (!little && byteOrder !== 'MM') return null;
    if (get16(tiff + 2, little) !== 42) return null;
    const ifd0 = tiff + get32(tiff + 4, little);
    const entry = (ifd, wanted) => {
      const count = get16(ifd, little);
      for (let i = 0; i < count; i++) {
        const at = ifd + 2 + i * 12;
        if (get16(at, little) === wanted) return { type: get16(at + 2, little), count: get32(at + 4, little), value: at + 8 };
      }
      return null;
    };
    const gpsPointer = entry(ifd0, 0x8825);
    if (!gpsPointer) return null;
    const gpsIfd = tiff + get32(gpsPointer.value, little);
    const value = tag => entry(gpsIfd, tag);
    const readAscii = item => {
      const at = item.count <= 4 ? item.value : tiff + get32(item.value, little);
      return String.fromCharCode(...new Uint8Array(bytes.buffer, at, Math.min(item.count, 16))).replace(/\0/g, '');
    };
    const readCoordinate = item => {
      if (!item || item.type !== 5 || item.count < 3) return null;
      const at = tiff + get32(item.value, little);
      const parts = [0, 1, 2].map(i => {
        const numerator = get32(at + i * 8, little), denominator = get32(at + i * 8 + 4, little);
        return denominator ? numerator / denominator : 0;
      });
      return parts[0] + parts[1] / 60 + parts[2] / 3600;
    };
    const latItem = value(2), lonItem = value(4);
    const lat = readCoordinate(latItem), lon = readCoordinate(lonItem);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const latRef = readAscii(value(1) || { count: 0, value: 0 }).toUpperCase();
    const lonRef = readAscii(value(3) || { count: 0, value: 0 }).toUpperCase();
    return { lat: latRef === 'S' ? -lat : lat, lon: lonRef === 'W' ? -lon : lon };
  }
  return null;
}
fieldPhotoInput.addEventListener('change', async () => {
  const file = fieldPhotoInput.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { fieldPhotoStatus.textContent = 'Lütfen bir fotoğraf dosyası seç.'; return; }
  fieldPhotoFile = file;
  if (fieldDraftMarker) { map.removeLayer(fieldDraftMarker); fieldDraftMarker = null; }
  fieldDraftLocation = null; fieldLocationStatus.textContent = 'Konum seçilmedi.';
  if (fieldPhotoUrl) URL.revokeObjectURL(fieldPhotoUrl);
  fieldPhotoUrl = URL.createObjectURL(file);
  fieldPhotoPreview.src = fieldPhotoUrl;
  fieldPhotoPreview.hidden = false;
  if (!fieldTitleInput.value.trim()) fieldTitleInput.value = file.name.replace(/\.[^.]+$/, '').slice(0, 100);
  fieldPhotoStatus.textContent = 'Fotoğrafın EXIF konum bilgisi kontrol ediliyor…';
  try {
    const gps = await readJpegGps(file);
    if (gps) {
      updateFieldDraftPoint({ lat: gps.lat, lng: gps.lon }, 'Fotoğraf GPS bilgisi');
      fieldPhotoStatus.textContent = 'Fotoğrafın GPS konumu bulundu ve haritada işaretlendi.';
    } else fieldPhotoStatus.textContent = 'Fotoğrafta GPS konumu yok. Anlık konum alabilir veya haritadan yer seçebilirsin.';
  } catch (error) {
    console.warn('Fotoğraf EXIF GPS okunamadı:', error);
    fieldPhotoStatus.textContent = 'Fotoğrafın GPS bilgisi okunamadı. Konumu anlık alabilir veya haritadan seçebilirsin.';
  }
});

function safeFileName(name) {
  return String(name || 'dosya').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'dosya';
}
function yandexFolderForPath(sourcePath) {
  const prefix = 'disk:/PROJELER/';
  if (typeof sourcePath !== 'string' || !sourcePath.startsWith(prefix)) return null;
  const firstSegment = sourcePath.slice(prefix.length).split('/')[0];
  return FIELD_CONTRACTORS.includes(firstSegment) ? `${prefix}${firstSegment}` : 'disk:/PROJELER';
}
function yandexProjectId(projectName, sourcePath) {
  const contractor = yandexFolderForPath(sourcePath)?.replace('disk:/PROJELER/', '') || '';
  const baseName = String(projectName || 'proje').replace(/\.(dxfproj|zip|dxf|kml|kmz)$/i, '');
  // Keep existing project IDs stable after correcting the contractor folder spelling.
  const idContractor = contractor === 'ERKSİS' ? 'ERSKSİS' : contractor;
  const slug = safeFileName(`${idContractor ? idContractor + '-' : ''}${baseName}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `yandex-${slug || 'proje'}`;
}
function mimeTypeForPhoto(name, declaredType = '') {
  if (declaredType.startsWith('image/')) return declaredType;
  const extension = String(name || '').split('.').pop().toLowerCase();
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', heic: 'image/heic', heif: 'image/heif' })[extension] || 'application/octet-stream';
}
function makeRecordPopup(record, photoUrl) {
  const box = document.createElement('div'); box.className = 'field-popup';
  if (photoUrl) { const image = document.createElement('img'); image.src = photoUrl; image.alt = record.title || 'Saha fotoğrafı'; box.append(image); }
  const title = document.createElement('strong'); title.textContent = record.title || record.category || 'Saha kaydı'; box.append(title);
  const status = fieldStatusInfo(record.status);
  const statusBadge = document.createElement('div'); statusBadge.className = `field-status-badge ${status.className}`; statusBadge.textContent = `${status.warning ? '⚠️ ' : ''}${status.label}`; box.append(statusBadge);
  const category = document.createElement('div'); category.className = 'field-popup-category'; category.textContent = record.category || 'Diğer'; box.append(category);
  if (record.assignedContractor) { const owner = document.createElement('div'); owner.className = 'field-popup-category'; owner.textContent = `Taşeron: ${record.assignedContractor}`; box.append(owner); }
  if (record.notes) { const notes = document.createElement('p'); notes.textContent = record.notes; box.append(notes); }
  const time = document.createElement('small'); time.textContent = new Date(record.createdAt).toLocaleString('tr-TR'); box.append(time);
  return box;
}
async function refreshFieldRecords() {
  fieldProjectLabel.textContent = 'Proje: ' + activeProjectName;
  cleanupFieldObjectUrls(); fieldMarkerLayer.clearLayers(); fieldRecordList.replaceChildren();
  if (fieldDraftMarker) { map.removeLayer(fieldDraftMarker); fieldDraftMarker = null; }
  try {
    const records = await getProjectRecords();
    if (!records.length) { const empty = document.createElement('div'); empty.className = 'message'; empty.textContent = activeRole() === 'beda' ? 'Henüz saha kaydı yok.' : 'Saha kayıtlarına yalnızca BEDA hesabı erişebilir.'; fieldRecordList.append(empty); return; }
    for (const record of records) {
      const status = fieldStatusInfo(record.status);
      const photoUrl = await getFieldPhotoUrl(record);
      const marker = L.circleMarker([record.lat, record.lon], { pane: 'fieldMarkerPane', radius: 8, color: '#fff', weight: 2, fillColor: status.color, fillOpacity: 1 }).addTo(fieldMarkerLayer);
      marker.bindPopup(makeRecordPopup(record, photoUrl));
      const row = document.createElement('article'); row.className = `field-record field-record-status-${status.className}`;
      const heading = document.createElement('strong'); heading.textContent = record.title || record.category || 'Saha kaydı'; row.append(heading);
      const badge = document.createElement('span'); badge.className = `field-status-badge ${status.className}`; badge.textContent = `${status.warning ? '⚠️ ' : ''}${status.label}`; row.append(badge);
      const detail = document.createElement('div'); detail.className = 'field-record-meta'; detail.textContent = `${record.category || 'Diğer'} · ${new Date(record.createdAt).toLocaleDateString('tr-TR')}`; row.append(detail);
      const ownerText = record.assignedContractor ? `Taşeron: ${record.assignedContractor}` : 'Taşeron atanmamış';
      if (activeRole() !== 'contractor' || record.assignedContractor === (backendEnabled ? authenticatedProfile?.contractor_code : demoContractor)) { const owner = document.createElement('div'); owner.className = 'field-record-meta'; owner.textContent = ownerText; row.append(owner); }
      if (record.notes) { const notes = document.createElement('p'); notes.textContent = record.notes; row.append(notes); }
      const actions = document.createElement('div'); actions.className = 'field-record-actions';
      const show = document.createElement('button'); show.type = 'button'; show.textContent = 'HARİTADA GÖSTER'; show.addEventListener('click', () => { map.setView([record.lat, record.lon], Math.max(17, map.getZoom())); marker.openPopup(); });
      actions.append(show);
      if (isBedaEditor()) {
        const correction = document.createElement('div'); correction.className = 'field-record-correction';
        const statusSelect = document.createElement('select'); statusSelect.className = 'field-input'; statusSelect.setAttribute('aria-label', 'Kayıt durumu');
        statusSelect.innerHTML = '<option value="">Durum seç</option><option value="problem">🔴 Sorunlu</option><option value="pending">🟡 Düzeltilmesi bekliyor</option><option value="suitable">🟢 Uygun</option>';
        statusSelect.value = record.status || '';
        const ownerSelect = document.createElement('select'); ownerSelect.className = 'field-input'; ownerSelect.setAttribute('aria-label', 'İşin taşeronu');
        ownerSelect.innerHTML = '<option value="">Taşeron atanmamış</option>' + FIELD_CONTRACTORS.map(name => `<option value="${name}">${name}</option>`).join('');
        ownerSelect.value = record.assignedContractor || '';
        const update = document.createElement('button'); update.type = 'button'; update.textContent = 'DURUM / ATAMAYI KAYDET';
        update.addEventListener('click', async () => {
          if (!isBedaEditor()) { showToast('Düzeltme yetkisi yalnızca BEDA hesabında.'); return; }
          if (!FIELD_STATUSES[statusSelect.value]) { showToast('Kaydetmeden önce bir durum seç.'); statusSelect.focus(); return; }
          try {
            const updatedRecord = { ...record, status: statusSelect.value, assignedContractor: ownerSelect.value, updatedAt: Date.now() };
            if (backendEnabled) await saveRemoteFieldRecord(updatedRecord);
            else await fieldRequest('readwrite', store => store.put(updatedRecord));
            await refreshFieldRecords(); showToast('BEDA tarafından durum ve taşeron ataması güncellendi.');
          } catch (error) { showToast(error.message || 'Düzeltme kaydedilemedi.'); }
        });
        correction.append(statusSelect, ownerSelect, update); row.append(correction);
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'SİL'; remove.addEventListener('click', async () => {
          if (!isBedaEditor()) { showToast('Silme yetkisi yalnızca BEDA hesabında.'); return; }
          try {
            if (backendEnabled) {
              if (record.photoPath) await supabaseClient.storage.from('field-photos').remove([record.photoPath]);
              const { error } = await supabaseClient.from('field_records').delete().eq('id', record.id);
              if (error) throw error;
            } else await fieldRequest('readwrite', store => store.delete(record.id));
            await refreshFieldRecords(); showToast('Saha kaydı silindi.');
          }
          catch (error) { showToast(error.message || 'Kayıt silinemedi.'); }
        });
        actions.append(remove);
      }
      row.append(actions); fieldRecordList.append(row);
    }
  } catch (error) {
    const message = document.createElement('div'); message.className = 'message error'; message.textContent = error.message || 'Saha kayıtları okunamadı.'; fieldRecordList.append(message);
  }
}
document.getElementById('saveFieldRecord').addEventListener('click', async () => {
  if (!isBedaEditor()) { showToast('Kayıt ekleme yetkisi yalnızca BEDA hesabında.'); return; }
  if (!fieldPhotoFile) { fieldPhotoStatus.textContent = 'Önce bir saha fotoğrafı seç.'; fieldPhotoInput.click(); return; }
  if (!fieldDraftLocation) { fieldLocationStatus.textContent = 'Kaydetmeden önce anlık konum al veya haritadan yer seç.'; return; }
  if (!FIELD_STATUSES[fieldStatusInput.value]) {
    fieldStatusWarning.textContent = 'Kaydı eklemeden önce durum seç: Sorunlu, Düzeltilmesi bekliyor veya Uygun.';
    fieldStatusWarning.className = 'message field-status-warning error'; fieldStatusWarning.hidden = false; fieldStatusInput.focus(); return;
  }
  const savedStatus = fieldStatusInput.value;
  const button = document.getElementById('saveFieldRecord'); button.disabled = true;
  try {
    const record = {
      id: makeRecordId(),
      projectId: activeProjectId, projectName: activeProjectName,
      lat: fieldDraftLocation.lat, lon: fieldDraftLocation.lon,
      title: fieldTitleInput.value.trim() || fieldPhotoFile.name,
      category: document.getElementById('fieldCategory').value,
      status: savedStatus,
      assignedContractor: fieldOwnerInput.value,
      notes: fieldNotesInput.value.trim(), createdAt: Date.now(),
      photo: fieldPhotoFile, photoName: fieldPhotoFile.name, photoType: fieldPhotoFile.type
    };
    if (backendEnabled) await saveRemoteFieldRecord(record);
    else await fieldRequest('readwrite', store => store.put(record));
    fieldPhotoInput.value = ''; fieldPhotoFile = null;
    if (fieldPhotoUrl) URL.revokeObjectURL(fieldPhotoUrl); fieldPhotoUrl = null;
    fieldPhotoPreview.removeAttribute('src'); fieldPhotoPreview.hidden = true;
    fieldTitleInput.value = ''; fieldNotesInput.value = ''; fieldStatusInput.value = ''; fieldOwnerInput.value = ''; renderFieldStatusWarning(); fieldPhotoStatus.textContent = 'Fotoğrafın GPS bilgisi varsa konumu otomatik okunur.';
    if (fieldDraftMarker) { map.removeLayer(fieldDraftMarker); fieldDraftMarker = null; }
    fieldDraftLocation = null; fieldLocationStatus.textContent = 'Konum seçilmedi.';
    await refreshFieldRecords();
    const savedStatusInfo = fieldStatusInfo(savedStatus);
    showToast(savedStatusInfo.warning ? `⚠️ Uyarı: ${savedStatusInfo.label} saha kaydı eklendi.` : 'Uygun saha kaydı eklendi.');
  } catch (error) { fieldPhotoStatus.textContent = error.message || 'Kayıt kaydedilemedi; tarayıcı depolama alanını kontrol et.'; }
  finally { button.disabled = false; }
});

document.getElementById('saveProjectBundle').addEventListener('click', async event => {
  if (!isBedaEditor()) { showToast('Proje paketi oluşturma yetkisi yalnızca BEDA hesabında.'); return; }
  const button = event.currentTarget; button.disabled = true;
  try {
  const dxfEntries = Array.from(cadDxfFiles.values());
    const records = await getProjectRecords();
    const zip = new JSZip();
    const manifest = {
      format: 'dxf-field-project', schemaVersion: 1,
      project: { id: activeProjectId, name: activeProjectName },
      savedAt: new Date().toISOString(),
      map: { center: [map.getCenter().lat, map.getCenter().lng], zoom: map.getZoom(), crs: selectedCrs() },
      dxfFiles: [], records: []
    };
    for (let i = 0; i < dxfEntries.length; i++) {
      const file = dxfEntries[i], path = `dxf/${String(i + 1).padStart(3, '0')}-${safeFileName(file.name)}`;
      zip.file(path, file); manifest.dxfFiles.push({ path, name: file.name });
    }
    for (const record of records) {
      const hasPhoto = Boolean(record.photo || (backendEnabled && record.photoPath));
      const photoPath = hasPhoto ? `photos/${safeFileName(record.id)}-${safeFileName(record.photoName || 'foto.jpg')}` : null;
      let photoSize = 0;
      if (photoPath) {
        let photoBlob = record.photo;
        if (!photoBlob && backendEnabled && record.photoPath) {
          const { data, error } = await supabaseClient.storage.from('field-photos').download(record.photoPath);
          if (error) throw error;
          photoBlob = data;
        }
        const photoBytes = await photoBlob.arrayBuffer();
        photoSize = photoBytes.byteLength;
        if (!photoSize) throw new Error(`“${record.photoName || record.title}” fotoğrafı boş görünüyor; kayıt paketlenemedi.`);
        zip.file(photoPath, photoBytes);
      }
      const { photo, ...metadata } = record;
      manifest.records.push({ ...metadata, photoPath, photoSize });
    }
    zip.file('project.json', JSON.stringify(manifest, null, 2));
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 3 } });
    if (generatedProjectBundleUrl) URL.revokeObjectURL(generatedProjectBundleUrl);
    generatedProjectBundleUrl = URL.createObjectURL(blob);
    const anchor = document.getElementById('downloadProjectBundle');
    anchor.href = generatedProjectBundleUrl;
    anchor.download = `${safeFileName(activeProjectName)}.dxfproj.zip`;
    anchor.textContent = `⬇️ PROJE PAKETİNİ İNDİR · ${manifest.dxfFiles.length} DXF / ${records.length} KAYIT`;
    anchor.hidden = false;
    anchor.click();
    showToast(`Paket hazır · ${manifest.dxfFiles.length} DXF ve ${records.length} saha kaydı.`);
  } catch (error) { console.error(error); showToast(error.message || 'Proje paketi oluşturulamadı.'); }
  finally { button.disabled = false; }
});

async function importProjectBundle(file, sourcePath = null) {
  if (!isBedaEditor()) throw new Error('Proje paketi açma yetkisi yalnızca BEDA hesabında.');
  showToast('Proje paketi açılıyor…');
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file('project.json');
  if (!manifestFile) throw new Error('Bu ZIP içinde project.json yok. “Tüm projeyi paketle” ile oluşturulan dosyayı seç.');
  const manifest = JSON.parse(await manifestFile.async('string'));
  if (manifest.format !== 'dxf-field-project' || manifest.schemaVersion !== 1) throw new Error('Proje paketi biçimi desteklenmiyor.');
  if (!manifest.project?.id || !Array.isArray(manifest.records) || !Array.isArray(manifest.dxfFiles)) throw new Error('Proje paketi eksik veya bozuk.');
  const dxfEntries = manifest.dxfFiles.filter(item => item?.name && /\.dxf$/i.test(item.name));
  const projectName = dxfEntries.length === 1
    ? dxfEntries[0].name.replace(/\.dxf$/i, '')
    : manifest.project.name;
  const projectId = sourcePath ? yandexProjectId(projectName, sourcePath) : manifest.project.id;
  document.getElementById('clearMap').click();
  setActiveProject(projectName, projectId);
  if (backendEnabled) await ensureRemoteProject(yandexFolderForPath(sourcePath));
  if (manifest.map?.crs) {
    document.querySelectorAll('[data-datum]').forEach(button => button.classList.toggle('selected', button.dataset.datum.includes(manifest.map.crs.datum)));
    document.querySelectorAll('.dom-grid button').forEach(button => button.classList.toggle('selected', Number(button.textContent) === Number(manifest.map.crs.cm)));
    userDatum = manifest.map.crs.datum === 'ED50' ? 'ED50' : 'ITRF'; userDom = Number(manifest.map.crs.cm) || null;
  }
  const done = [];
  for (const item of dxfEntries) {
    if (!item?.path || !item?.name) continue;
    const entry = zip.file(item.path);
    if (!entry) { done.push(`${item.name} — pakette bulunamadı`); continue; }
    const data = await entry.async('arraybuffer');
    const dxf = new File([data], item.name, { type: 'application/dxf', lastModified: Date.now() });
    try { const count = await parseDxf(dxf); if (backendEnabled) await storeRemoteProjectFile(dxf, sourcePath || item.path); done.push(`${item.name} (${count} nesne)`); }
    catch (error) { console.error(error); done.push(`${item.name} — açılamadı`); }
  }
  let importedRecords = 0;
  for (const record of manifest.records) {
    if (!record || !Number.isFinite(record.lat) || !Number.isFinite(record.lon)) continue;
    let photo = null;
    if (record.photoPath) {
      const entry = zip.file(record.photoPath);
      if (entry) {
        const photoBytes = await entry.async('arraybuffer');
        if (record.photoSize && photoBytes.byteLength !== record.photoSize) throw new Error(`“${record.photoName || record.title}” fotoğrafı eksik veya bozuk.`);
        photo = new Blob([photoBytes], { type: mimeTypeForPhoto(record.photoName, record.photoType) });
      }
    }
    const { photoPath, ...metadata } = record;
    if (backendEnabled) {
      const recordId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(metadata.id || '')) ? metadata.id : makeRecordId();
      const normalizedContractor = normalizeContractorCode(metadata.assignedContractor);
      const contractor = FIELD_CONTRACTORS.includes(normalizedContractor) ? normalizedContractor : '';
      await saveRemoteFieldRecord({ ...metadata, id: recordId, projectId: activeProjectId, projectName: activeProjectName, assignedContractor: contractor, photo, createdAt: metadata.createdAt || Date.now() });
    } else await fieldRequest('readwrite', store => store.put({ ...metadata, assignedContractor: normalizeContractorCode(metadata.assignedContractor || ''), projectId: activeProjectId, projectName: activeProjectName, photo }));
    importedRecords++;
  }
  await refreshFieldRecords();
  if (backendEnabled) await refreshSharedProjects();
  if (manifest.map?.center?.length === 2 && manifest.map.center.every(Number.isFinite)) map.setView(manifest.map.center, Number(manifest.map.zoom) || 15);
  loadedFiles.textContent = done.length ? done.join(' · ') : 'DXF yok · saha kayıtları yüklendi';
  showToast(`Proje açıldı · ${done.length} DXF, ${importedRecords} saha kaydı.`);
}

applyDemoRole();
setActiveProject(activeProjectName, activeProjectId);
void refreshFieldRecords();
void initializeAuthentication();
window.addEventListener('beforeunload', () => {
  cleanupFieldObjectUrls();
  if (generatedProjectBundleUrl) URL.revokeObjectURL(generatedProjectBundleUrl);
});
