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
document.querySelectorAll('input[name="base"]').forEach(r=>r.addEventListener('change',()=>{Object.values(bases).forEach(l=>map.removeLayer(l));bases[r.value].addTo(map);if(document.getElementById('labelsToggle').checked)labelLayer.addTo(map);}));
document.getElementById('labelsToggle').addEventListener('change',e=>e.target.checked?labelLayer.addTo(map):map.removeLayer(labelLayer));
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
function projectionForDrawing(){
  const cm=Number(document.querySelector('.dom-grid button.selected')?.textContent||36);
  const datum=document.querySelector('[data-datum].selected')?.dataset.datum||'';
  const extra=datum.includes('ED50')?'+ellps=intl +towgs84=-84.1,-101.8,-129.7,0,0,0,0':'+ellps=GRS80 +towgs84=0.023,0.036,-0.068,0.00176,0.00912,-0.01136,0.00439';
  const id='DXF_SOURCE_'+cm+'_'+(datum.includes('ED50')?'ED50':'ITRF');
  proj4.defs(id,`+proj=tmerc +lat_0=0 +lon_0=${cm} +k=1 +x_0=500000 +y_0=0 ${extra} +units=m +no_defs`);
  return xy=>{
    if(Math.abs(xy[0])<=180&&Math.abs(xy[1])<=90)return [xy[0],xy[1]];
    return proj4(id,'EPSG:4326',[xy[0],xy[1]]);
  };
}
function makeDxfGeometry(entity,toLatLng){
  const point=(p)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)?toLatLng([p.x,p.y]):null;
  const vertices=(entity.vertices||[]).map(point).filter(Boolean);
  const type=String(entity.type||'').toUpperCase();
  if(type==='LINE'&&entity.vertices?.length>=2)return {type:'LineString',coordinates:entity.vertices.map(point).filter(Boolean)};
  if((type==='LWPOLYLINE'||type==='POLYLINE')&&vertices.length>=2){
    if(entity.shape&&vertices.length>=3)return {type:'Polygon',coordinates:[[...vertices,vertices[0]]]};
    return {type:'LineString',coordinates:vertices};
  }
  if(type==='CIRCLE'&&entity.center&&entity.radius){const c=entity.center,r=entity.radius,ring=[];for(let i=0;i<=48;i++){const a=i*Math.PI/24;ring.push(point({x:c.x+r*Math.cos(a),y:c.y+r*Math.sin(a)}))}return {type:'Polygon',coordinates:[ring]}}
  if(type==='ARC'&&entity.center&&entity.radius){let start=entity.startAngle||0,end=entity.endAngle||0;if(end<start)end+=Math.PI*2;const n=Math.max(8,Math.ceil((end-start)*12)),coords=[];for(let i=0;i<=n;i++){const a=start+(end-start)*i/n;coords.push(point({x:entity.center.x+entity.radius*Math.cos(a),y:entity.center.y+entity.radius*Math.sin(a)}))}return {type:'LineString',coordinates:coords}}
  if(type==='POINT'){const p=point(entity.position||entity.startPoint||entity);if(p)return {type:'Point',coordinates:p}}
  if(type==='INSERT'){const p=point(entity.position||entity);if(p)return {type:'Point',coordinates:p}}
  if(type==='TEXT'||type==='MTEXT'){const p=point(entity.startPoint||entity.position);if(p)return {type:'Point',coordinates:p}}
  return null;
}
function styleForFeature(feature){
  const t=feature.properties?._entityType;
  if(t==='INSERT'||t==='POINT'||t==='TEXT'||t==='MTEXT')return {radius:t==='INSERT'?5:3,color:'#ffffff',weight:1,fillColor:'#ef5b33',fillOpacity:.95};
  return {color:'#37e8c0',weight:1.5,opacity:.92,fillColor:'#28b991',fillOpacity:.16};
}
async function parseDxf(file){
  showToast('DXF okunuyor… dosya büyükse biraz sürebilir.');
  const text=await file.arrayBuffer().then(b=>new TextDecoder('windows-1254').decode(b));
  const module=await import('https://esm.sh/dxf-parser@1.1.2');
  const Parser=module.default||module.DxfParser||module;
  const dxf=new Parser().parse(text),toLatLng=projectionForDrawing();
  const groups=new Map();
  for(const entity of dxf.entities||[]){
    const geom=makeDxfGeometry(entity,toLatLng);if(!geom)continue;
    const name=entity.layer||'0';if(!groups.has(name))groups.set(name,[]);
    const props={_entityType:String(entity.type||'').toUpperCase(),_label:entity.text||entity.name||entity.type||''};
    groups.get(name).push({type:'Feature',geometry:geom,properties:props});
  }
  let total=0,fitBounds=null,firstLayerIndex=importedLayers.length;
  cadLayers.querySelector('.message')?.remove();
  for(const [name,features] of groups){
    const geo=L.geoJSON(features,{style:styleForFeature,pointToLayer:(f,ll)=>L.circleMarker(ll,styleForFeature(f)),onEachFeature:(f,l)=>{const s=f.properties?._label;if(s)l.bindTooltip(String(s).slice(0,200))}});
    addLayerEntry(`${file.name} · ${name}`,geo,features.length);geo.addTo(map);total+=features.length;
    if(/^(HAT_|DIREK_|NODE_|TRAFO_|KOFRE_)/i.test(name)){const bounds=geo.getBounds();if(bounds.isValid())fitBounds=fitBounds?fitBounds.extend(bounds):bounds}
  }
  if(!total)throw new Error('DXF içinde haritada gösterilebilen 2B çizim bulunamadı.');
  if(fitBounds?.isValid())map.fitBounds(fitBounds.pad(.08),{maxZoom:17});
  else{const first=importedLayers[firstLayerIndex];if(first)zoomTo(first.layer)}
  return total;
}
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
