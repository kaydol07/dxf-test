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


// Infer the ED50 / TM30 grid used by the Kas-Gokceoren drawing before projecting it.
const parseDxfWithCrsDetection=parseDxf;
parseDxf=async function(file){
  const text=await file.arrayBuffer().then(b=>new TextDecoder("windows-1254").decode(b));
  const evidence=(file.name+" "+text).toLocaleUpperCase("tr-TR");
  if(/\bED\s*[- ]?50\b/.test(evidence)&&/ANTALYA|KAŞ|GÖKÇEÖREN|YENİKÖY/.test(evidence)){
    document.querySelector("[data-datum=\"ED50 (HAYFORD)\"]").click();
    document.querySelectorAll(".dom-grid button").forEach(b=>b.classList.toggle("selected",b.textContent==="30"));
    const status=document.getElementById("crsStatus");
    if(status)status.textContent="Dosyadan algılandı: ED50 / TM30 (EPSG:2320), Kaş–Gökçeören.";
  }
  return parseDxfWithCrsDetection(file);
};


// Preserve AutoCAD layer colors, line styles and additional 2D entities on the map.
const baseCadGeometry=makeDxfGeometry;
function enhancedCadGeometry(e,project){
  const p=q=>q&&Number.isFinite(q.x)&&Number.isFinite(q.y)?project([q.x,q.y]):null,t=String(e.type||'').toUpperCase();
  if(['SOLID','TRACE','3DFACE'].includes(t)){const a=(e.points||e.vertices||[]).map(p).filter(Boolean);if(a.length>=3){if(a.length>3&&a[2][0]===a[3][0]&&a[2][1]===a[3][1])a.pop();a.push(a[0]);return {type:'Polygon',coordinates:[a]}}}
  if(t==='ELLIPSE'&&e.center&&e.majorAxisEndPoint){const c=e.center,m=e.majorAxisEndPoint,r=Math.hypot(m.x,m.y),ratio=e.axisRatio||1,a0=e.startAngle||0,a1=e.endAngle||Math.PI*2,ring=[];for(let i=0;i<=64;i++){const a=a0+(a1-a0)*i/64;ring.push(p({x:c.x+m.x*Math.cos(a)-m.y*ratio*Math.sin(a),y:c.y+m.y*Math.cos(a)+m.x*ratio*Math.sin(a)}))}return {type:'Polygon',coordinates:[ring]}}
  if(t==='SPLINE'){const a=(e.fitPoints?.length?e.fitPoints:e.controlPoints||[]).map(p).filter(Boolean);if(a.length>1)return {type:'LineString',coordinates:a}}
  return baseCadGeometry(e,project);
}
function cadRgb(e,l){let c=e.trueColor??e.color;if(e.colorIndex===0||e.colorIndex===256||c==null)c=l?.trueColor??l?.color;if(Number.isFinite(c)&&c>255)return '#'+(c&0xffffff).toString(16).padStart(6,'0');const i=Number(e.colorIndex??l?.colorIndex??l?.colorNumber);const aci=['#fff','#f00','#ff0','#0f0','#0ff','#00f','#f0f','#fff','#808080','#c0c0c0'];if(i>=1&&i<=9)return aci[i];if(i>9){const h=((i-10)%24)*15,s=Math.floor((i-10)/24)%4,v=[100,80,60,50][Math.floor((i-10)/96)%4];return 'hsl('+h+' '+(s?100-s*12:0)+'% '+v/2+'%)'}return '#fff'}
function styleForFeature(f){const p=f.properties||{},t=p.kind,c=p.color;if(['POINT','INSERT','TEXT','MTEXT','ATTRIB','ATTDEF'].includes(t))return {radius:t==='INSERT'?5:2,color:c,weight:1,fillColor:c,fillOpacity:1};return {color:c,weight:p.weight,opacity:1,fillColor:c,fillOpacity:p.fill,dashArray:p.dash||null}}
parseDxf=async function(file){showToast('DXF okunuyor; büyük paftalarda işlem sürebilir.');const text=await file.arrayBuffer().then(b=>new TextDecoder('windows-1254').decode(b));const evidence=(file.name+' '+text).toLocaleUpperCase('tr-TR');if(/\bED\s*[- ]?50\b/.test(evidence)&&/ANTALYA|KAŞ|GÖKÇEÖREN|YENİKÖY/.test(evidence)){document.querySelector('[data-datum="ED50 (HAYFORD)"]').click();document.querySelectorAll('.dom-grid button').forEach(b=>b.classList.toggle('selected',b.textContent==='30'));document.getElementById('crsStatus').textContent='Dosyadan algılandı: ED50 / TM30 (EPSG:2320), Kaş–Gökçeören.'}const mod=await import('https://esm.sh/dxf-parser@1.1.2'),Parser=mod.default||mod.DxfParser||mod,dxf=new Parser().parse(text),project=projectionForDrawing(),tables=dxf.tables?.layer?.layers||{},layerMap=new Map(Object.values(tables).map(l=>[String(l.name||'').toUpperCase(),l])),groups=new Map();for(const e of dxf.entities||[]){const name=e.layer||'0',layer=layerMap.get(name.toUpperCase());if(e.visible===false||layer?.visible===false||layer?.frozen||layer?.off)continue;const geom=enhancedCadGeometry(e,project);if(!geom)continue;if(!groups.has(name))groups.set(name,[]);const type=String(e.type||'').toUpperCase(),weight=Number(e.lineweight??layer?.lineweight),lt=String(e.lineType||'').toUpperCase(),pattern=(dxf.tables?.lineType?.lineTypes||{})[lt]?.pattern||[];groups.get(name).push({type:'Feature',geometry:geom,properties:{kind:type,label:e.text||'',color:cadRgb(e,layer),weight:Number.isFinite(weight)&&weight>0?Math.max(1,weight/18):1,fill:['SOLID','TRACE','3DFACE'].includes(type)?.88:.14,dash:pattern.length?pattern.map(n=>Math.max(1,Math.abs(n)*2)).join(' '):/DASH|HIDDEN|CENTER|PHANTOM/.test(lt)?'8 5':null}})}let total=0,bounds=null,first=importedLayers.length;cadLayers.querySelector('.message')?.remove();for(const [name,features] of groups){const geo=L.geoJSON(features,{style:styleForFeature,pointToLayer:(f,ll)=>L.circleMarker(ll,styleForFeature(f)),onEachFeature:(f,l)=>{const p=f.properties;if(p.label&&['TEXT','MTEXT','ATTRIB','ATTDEF'].includes(p.kind))l.bindTooltip(String(p.label).replace(/\P/g,'\n').slice(0,200),{className:'cad-text-label'})}});addLayerEntry(file.name+' · '+name,geo,features.length);geo.addTo(map);total+=features.length;if(/^(HAT_|DIREK_|NODE_|TRAFO_|KOFRE_)/i.test(name)){const b=geo.getBounds();if(b.isValid())bounds=bounds?bounds.extend(b):b}}if(!total)throw Error('DXF içinde haritada gösterilebilir 2B çizim bulunamadı.');if(bounds?.isValid())map.fitBounds(bounds.pad(.08),{maxZoom:17});else if(importedLayers[first])zoomTo(importedLayers[first].layer);return total};



/* CAD paftasini koordinatini degistirmeden haritaya oturtma iyilestirmeleri */
const cadFidelityTextItems = [];
const cadFidelityTextControl = document.getElementById('cadTextToggle');
function refreshCadFidelityText(){
  const enabled=(cadFidelityTextControl?.checked ?? true) && map.getZoom()>=18;
  const bounds=map.getBounds().pad(.08);
  for(const item of cadFidelityTextItems){
    const visible=enabled && item.layer._map===map && bounds.contains(item.layer.getLatLng());
    if(visible){
      if(!item.layer.isTooltipOpen())item.layer.openTooltip();
      const el=item.layer.getTooltip()?.getElement();
      if(el){const lat=item.layer.getLatLng().lat,mpp=40075016.686*Math.cos(lat*Math.PI/180)/(256*2**map.getZoom()),size=item.height>0?item.height/mpp:11;el.style.fontSize=Math.max(7,Math.min(28,size))+'px';el.style.color=item.color;el.style.rotate=item.rotation+'deg'}
    }else if(item.layer.isTooltipOpen())item.layer.closeTooltip();
  }
}
if(cadFidelityTextControl)cadFidelityTextControl.addEventListener('change',refreshCadFidelityText);
map.on('zoomend moveend',refreshCadFidelityText);
document.getElementById('clearMap')?.addEventListener('click',()=>cadFidelityTextItems.length=0);
function projectionForDrawing(){
  const cm=Number(document.querySelector('.dom-grid button.selected')?.textContent||36);
  const datum=document.querySelector('[data-datum].selected')?.dataset.datum||'';
  const extra=datum.includes('ED50')?'+ellps=intl +towgs84=-84.1,-101.8,-129.7,0,0,0.468,1.05':'+ellps=GRS80 +towgs84=0.023,0.036,-0.068,0.00176,0.00912,-0.01136,0.00439';
  const id='DXF_SOURCE_'+cm+'_'+(datum.includes('ED50')?'ED50':'ITRF');
  proj4.defs(id,'+proj=tmerc +lat_0=0 +lon_0='+cm+' +k=1 +x_0=500000 +y_0=0 '+extra+' +units=m +no_defs');
  return xy=>{if(Math.abs(xy[0])<=180&&Math.abs(xy[1])<=90)return [xy[0],xy[1]];return proj4(id,'EPSG:4326',[xy[0],xy[1]])};
}
function selectDrawingCrs(dxf,fileName){
  const headerEvidence=JSON.stringify(dxf.header||{}).toLocaleUpperCase('tr-TR');
  const entityLabels=(dxf.entities||[]).filter(e=>['TEXT','MTEXT','ATTRIB','ATTDEF'].includes(String(e.type||'').toUpperCase())).map(e=>e.text||e.value||'').join(' ').toLocaleUpperCase('tr-TR');
  const evidence=String(fileName||'').toLocaleUpperCase('tr-TR')+' '+headerEvidence+' '+entityLabels;
  const metadata=headerEvidence+' '+entityLabels;
  const hasEd50=/\bED\s*[- ]?50\b/.test(metadata)||/EPSG\s*[:=]?\s*2320/.test(metadata);
  const hasItrf=/\b(?:ITRF|ETRF)(?:\s*[- ]?\s*\d{2,4})?\b|\bETRS\s*89\b/.test(metadata);
  const kas=/ANTALYA|KAŞ|GÖKÇEÖREN|GÖKÇÖREN|YENİKÖY/.test(evidence);
  const pts=(dxf.entities||[]).flatMap(e=>[...(e.vertices||[]),e.startPoint,e.endPoint,e.position,e.center].filter(Boolean)).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  const east=pts.filter(p=>p.x>200000&&p.x<800000&&p.y>3500000&&p.y<5000000).map(p=>p.x).sort((a,b)=>a-b);
  const easting=east.length?east[Math.floor(east.length/2)]:NaN,tm30=kas&&Number.isFinite(easting)&&easting>400000&&easting<600000,status=document.getElementById('crsStatus');
  if(hasEd50||(tm30&&!hasItrf)){
    document.querySelector('[data-datum="ED50 (HAYFORD)"]').click();
    document.querySelectorAll('.dom-grid button').forEach(b=>b.classList.toggle('selected',b.textContent==='30'));
    status.textContent=hasEd50?'DXF metaverisinden ED50 saptandi; Kas-Gokceoren icin DOM 30 secildi.':'Oneri: ED50/TM30 (EPSG:2320), Kas-Gokceoren. DXF basliginda datum kodu yok; secim proje yeri ve koordinat araligindan cikarildi. Kaydirma duzeltmesi uygulanmiyor.';
    return;
  }
  if(hasItrf){document.querySelector('[data-datum="ITRF (GRS80)"]').click();if(kas)document.querySelectorAll('.dom-grid button').forEach(b=>b.classList.toggle('selected',b.textContent==='30'));status.textContent=kas?'ITRF/ETRF metaverisi bulundu; Kas-Gokceoren icin DOM 30 secildi.':'ITRF/ETRF metaverisi bulundu. DOM otomatik cikarilamadi; secili DOM kullaniliyor ve pafta bilgisiyle dogrulanmali.';return}
  status.textContent=tm30?'Kas-Gokceoren koordinatlari algilandi. Datum DXF basliginda yok; otomatik ED50/TM30 secimi oneridir ve kontrol noktasi ile dogrulanmalidir.':'DXF datum/DOM kaydi bulunamadi; secili ITRF/DOM ayari kullanilacak ve pafta bilgisiyle dogrulanmalidir.';
}
function makeDxfGeometry(entity,toLatLng){
  const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)?toLatLng([p.x,p.y]):null,raw=entity.vertices||[],vertices=[];
  for(let i=0;i<raw.length;i++){
    const a=raw[i],b=raw[(i+1)%raw.length],pa=point(a);if(pa)vertices.push(pa);
    const bulge=Number(a?.bulge||0);if(Math.abs(bulge)<1e-10||(!entity.shape&&!entity.closed)||!b)continue;
    const dx=b.x-a.x,dy=b.y-a.y,chord=Math.hypot(dx,dy);if(chord<1e-9)continue;
    const sweep=4*Math.atan(bulge),radius=chord*(1+bulge*bulge)/(4*Math.abs(bulge)),offset=chord*(1-bulge*bulge)/(4*bulge),cx=(a.x+b.x)/2-dy/chord*offset,cy=(a.y+b.y)/2+dx/chord*offset,start=Math.atan2(a.y-cy,a.x-cx),steps=Math.max(2,Math.ceil(Math.abs(sweep)/(Math.PI/48))); 
    for(let j=1;j<steps;j++){const ang=start+sweep*j/steps,p=point({x:cx+radius*Math.cos(ang),y:cy+radius*Math.sin(ang)});if(p)vertices.push(p)}
  }
  const type=String(entity.type||'').toUpperCase();
  if(type==='LINE'&&entity.vertices?.length>=2)return {type:'LineString',coordinates:entity.vertices.map(point).filter(Boolean)};
  if(['LWPOLYLINE','POLYLINE','HATCH'].includes(type)&&vertices.length>=2){if(entity.shape&&vertices.length>=3)return {type:'Polygon',coordinates:[[...vertices,vertices[0]]]};return {type:'LineString',coordinates:vertices}}
  if(type==='CIRCLE'&&entity.center&&entity.radius){const c=entity.center,r=entity.radius,ring=[];for(let i=0;i<=48;i++){const a=i*Math.PI/24;ring.push(point({x:c.x+r*Math.cos(a),y:c.y+r*Math.sin(a)}))}return {type:'Polygon',coordinates:[ring]}}
  if(type==='ARC'&&entity.center&&entity.radius){let a0=entity.startAngle||0,a1=entity.endAngle||0;if(a1<a0)a1+=2*Math.PI;const n=Math.max(8,Math.ceil((a1-a0)*12)),coords=[];for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n;coords.push(point({x:entity.center.x+entity.radius*Math.cos(a),y:entity.center.y+entity.radius*Math.sin(a)}))}return {type:'LineString',coordinates:coords}}
  if(['SOLID','TRACE','3DFACE'].includes(type)){const pts=(entity.points||entity.vertices||[]).map(point).filter(Boolean);if(pts.length>=3){const ring=pts.slice(0,4);if(ring.length===4&&ring[2][0]===ring[3][0]&&ring[2][1]===ring[3][1])ring.pop();ring.push(ring[0]);return {type:'Polygon',coordinates:[ring]}}}
  if(type==='ELLIPSE'&&entity.center&&entity.majorAxisEndPoint){const c=entity.center,m=entity.majorAxisEndPoint,rx=Math.hypot(m.x,m.y),ry=rx*(entity.axisRatio||1),a0=entity.startAngle||0,a1=entity.endAngle||2*Math.PI,n=64,ring=[];for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n;ring.push(point({x:c.x+m.x*Math.cos(a)-m.y*(ry/rx)*Math.sin(a),y:c.y+m.y*Math.cos(a)+m.x*(ry/rx)*Math.sin(a)}))}return {type:'Polygon',coordinates:[ring]}}
  if(type==='SPLINE'){const pts=(entity.fitPoints?.length?entity.fitPoints:entity.controlPoints||[]).map(point).filter(Boolean);if(pts.length>=2)return {type:'LineString',coordinates:pts}}
  if(type==='POINT'){const p=point(entity.position||entity.startPoint||entity);if(p)return {type:'Point',coordinates:p}}
  if(['TEXT','MTEXT','ATTRIB','ATTDEF'].includes(type)){const p=point(entity.halign&&entity.endPoint?entity.endPoint:entity.startPoint||entity.position);if(p)return {type:'Point',coordinates:p}}
  return null;
}
function dxfColor(entity,layer){
  const index=Number(entity.colorIndex);let rgb=entity.trueColor;
  if(rgb==null&&index!==0&&index!==256)rgb=entity.color;
  if(rgb==null||index===0||index===256)rgb=layer?.trueColor??layer?.color;
  if(Number.isFinite(rgb)&&rgb>255)return '#'+(rgb&0xffffff).toString(16).padStart(6,'0');
  if(Number.isFinite(rgb)&&rgb>=0)return '#'+Math.round(rgb).toString(16).padStart(6,'0').slice(-6);
  return '#ffffff';
}
function dxfDash(entity,dxf){const name=String(entity.lineType||'').toUpperCase(),table=dxf.tables?.lineType?.lineTypes||dxf.tables?.linetype?.lineTypes||{},rec=table[name]||{},pattern=rec.pattern||rec.elements||[];if(pattern.length)return pattern.map(n=>Math.max(1,Math.abs(Number(n))*2)).join(' ');if(/DASH|HIDDEN|CENTER|PHANTOM|DOT/.test(name))return name.includes('DOT')?'1 4':name.includes('CENTER')?'10 4 2 4':'8 5';return null}
function cadApplyMatrix(p,m){return {x:m.a*p.x+m.b*p.y+m.tx,y:m.c*p.x+m.d*p.y+m.ty,...(p.z===undefined?{}:{z:p.z})}}
function cadComposeMatrix(a,b){return {a:a.a*b.a+a.b*b.c,b:a.a*b.b+a.b*b.d,c:a.c*b.a+a.d*b.c,d:a.c*b.b+a.d*b.d,tx:a.a*b.tx+a.b*b.ty+a.tx,ty:a.c*b.tx+a.d*b.ty+a.ty}}
function cadInsertMatrix(insert,block,row,column){const angle=(Number(insert.rotation)||0)*Math.PI/180,sx=Number(insert.xScale)||1,sy=Number(insert.yScale)||1,co=Math.cos(angle),si=Math.sin(angle),base=block.position||{x:0,y:0},pos=insert.position||{x:0,y:0},a=co*sx,b=-si*sy,c=si*sx,d=co*sy,dx=column*(Number(insert.columnSpacing)||0),dy=row*(Number(insert.rowSpacing)||0);return {a,b,c,d,tx:pos.x-a*base.x-b*base.y+a*dx+b*dy,ty:pos.y-c*base.x-d*base.y+c*dx+d*dy}}
function cadTransformEntity(e,m){const out={...e},linear={...m,tx:0,ty:0};for(const k of ['vertices','points','fitPoints','controlPoints'])if(Array.isArray(e[k]))out[k]=e[k].map(p=>({...p,...cadApplyMatrix(p,m)}));for(const k of ['center','position','startPoint','endPoint','textMidPoint','definitionPoint'])if(e[k]&&Number.isFinite(e[k].x)&&Number.isFinite(e[k].y))out[k]=cadApplyMatrix(e[k],m);if(e.majorAxisEndPoint)out.majorAxisEndPoint=cadApplyMatrix(e.majorAxisEndPoint,linear);const sx=Math.hypot(m.a,m.c),sy=Math.hypot(m.b,m.d),scale=(sx+sy)/2;if(Number.isFinite(e.radius))out.radius=e.radius*scale;if(Number.isFinite(e.textHeight))out.textHeight=e.textHeight*sy;if(Number.isFinite(e.height))out.height=e.height*sy;if(Number.isFinite(e.rotation))out.rotation=e.rotation+Math.atan2(m.c,m.a)*180/Math.PI;return out}
function expandCadInserts(entities,dxf){const blocks=dxf.blocks||{},blockMap=new Map(Object.values(blocks).map(b=>[String(b.name||'').toUpperCase(),b])),out=[],identity={a:1,b:0,c:0,d:1,tx:0,ty:0},layers=dxf.tables?.layer?.layers||dxf.tables?.layers?.layers||{};const visit=(e,m,inheritLayer,inheritColor,depth)=>{if(depth>12)return;const name=e.layer&&e.layer!=='0'?e.layer:(inheritLayer||e.layer||'0'),copy={...e,layer:name};if(Number(copy.colorIndex)===0&&inheritColor)copy.trueColor=inheritColor;if(String(e.type||'').toUpperCase()==='INSERT'){const block=blockMap.get(String(e.name||'').toUpperCase());if(!block)return;const rows=Math.max(1,Math.min(100,Number(e.rowCount)||1)),cols=Math.max(1,Math.min(100,Number(e.columnCount)||1)),color=parseInt(dxfColor(copy,layers[name]).slice(1),16);for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const matrix=cadComposeMatrix(m,cadInsertMatrix(e,block,r,c));for(const child of block.entities||[])visit(child,matrix,name,color,depth+1)}return}out.push(cadTransformEntity(copy,m))};for(const e of entities||[])visit(e,identity,null,null,0);return out}
function injectSolidHatches(raw,dxf){const blockMap=new Map(Object.values(dxf.blocks||{}).map(b=>[String(b.name||'').toUpperCase(),b])),aci={1:0xff0000,3:0x00ff00,4:0x00ffff,5:0x0000ff,6:0xff00ff,10:0xff0000,11:0xff7f7f,32:0xcc6600,108:0x004c13,152:0x0066cc};const section=name=>{const re=new RegExp('(?:^|\\r?\\n)[ \\t]*0[ \\t]*\\r?\\n[ \\t]*SECTION[ \\t]*\\r?\\n[ \\t]*2[ \\t]*\\r?\\n[ \\t]*'+name+'[ \\t]*\\r?\\n'),m=re.exec(raw);if(!m)return '';const start=m.index+m[0].length,tail=/(?:\r?\n)[ \t]*0[ \t]*\r?\n[ \t]*ENDSEC[ \t]*\r?\n/.exec(raw.slice(start));return tail?raw.slice(start,start+tail.index):raw.slice(start)};const pairs=s=>{const a=s.split(/\r\n|\r|\n/),o=[];for(let i=0;i+1<a.length;i+=2)o.push({code:a[i].trim(),value:a[i+1].trim()});return o};const parse=s=>{const p=pairs(s),first=c=>p.find(x=>x.code===c)?.value,colorIndex=first('62')===undefined?undefined:Number(first('62')),base={type:'HATCH',handle:first('5'),layer:first('8')||'0',lineType:first('6'),lineweight:first('370')===undefined?undefined:Number(first('370')),colorIndex,trueColor:first('420')===undefined?undefined:Number(first('420')),color:aci[Math.abs(colorIndex)],solidFill:Number(first('70'))===1,visible:first('60')===undefined||Number(first('60'))===0},loops=[];for(let i=0;i<p.length;i++){if(p[i].code!=='92')continue;const flags=Number(p[i++].value);if(!(flags&2))continue;let bulge=false,closed=true,n=0;if(p[i]?.code==='72'){bulge=Number(p[i++].value)===1}if(p[i]?.code==='73'){closed=Number(p[i++].value)===1}if(p[i]?.code==='93'){n=Math.min(10000,Number(p[i++].value)||0)}const vertices=[];while(i<p.length&&vertices.length<n){if(p[i].code==='92'){i--;break}if(p[i].code==='10'&&p[i+1]?.code==='20'){const v={x:Number(p[i].value),y:Number(p[i+1].value)};i+=2;if(bulge&&p[i]?.code==='42')v.bulge=Number(p[i++].value);vertices.push(v)}else i++}if(closed&&vertices.length>=3)loops.push({...base,vertices,shape:true})}return loops};const hatchRx=/(?:^|\r?\n)[ \t]*0[ \t]*\r?\n[ \t]*HATCH[ \t]*\r?\n([\s\S]*?)(?=\r?\n[ \t]*0[ \t]*\r?\n[A-Z_*])/g;const inSection=s=>{const out=[];let m;hatchRx.lastIndex=0;while((m=hatchRx.exec(s)))out.push(...parse(m[1]));return out};const blockRx=/(?:^|\r?\n)[ \t]*0[ \t]*\r?\n[ \t]*BLOCK[ \t]*\r?\n([\s\S]*?)(?=\r?\n[ \t]*0[ \t]*\r?\n[ \t]*ENDBLK[ \t]*\r?\n)/g;let m;while((m=blockRx.exec(section('BLOCKS')))){const body=m[1],a=body.split(/\r\n|\r|\n/);let end=a.length;for(let i=0;i+1<a.length;i+=2)if(a[i].trim()==='0'){end=i;break}const name=pairs(a.slice(0,end).join('\n')).find(x=>x.code==='2')?.value||'',block=blockMap.get(name.toUpperCase());if(block)block.entities.push(...inSection(body))}dxf.entities.push(...inSection(section('ENTITIES')))}
async function parseDxf(file){
  showToast('DXF okunuyor... dosya buyukse biraz surebilir.');
  const text=await file.arrayBuffer().then(b=>new TextDecoder('windows-1254').decode(b));
  const module=await import('https://esm.sh/dxf-parser@1.1.2'),Parser=module.default||module.DxfParser||module,dxf=new Parser().parse(text);
  injectSolidHatches(text,dxf);selectDrawingCrs(dxf,file.name);const toLatLng=projectionForDrawing(),groups=new Map(),records=dxf.tables?.layer?.layers||dxf.tables?.layers?.layers||{},layerByName=new Map(Object.values(records).map(l=>[String(l.name||'').toUpperCase(),l]));
  for(const entity of expandCadInserts(dxf.entities,dxf)){
    const name=entity.layer||'0',layer=layerByName.get(name.toUpperCase());if(entity.visible===false||Number(entity.colorIndex)<0||layer?.visible===false||layer?.frozen||layer?.off||Number(layer?.colorIndex)<0)continue;
    const geometry=makeDxfGeometry(entity,toLatLng);if(!geometry)continue;if(!groups.has(name))groups.set(name,[]);const type=String(entity.type||'').toUpperCase(),weight=Number(entity.lineweight??layer?.lineweight);
    groups.get(name).push({type:'Feature',geometry,properties:{_entityType:type,_label:entity.text||entity.name||entity.type||'',_textHeight:Number(entity.textHeight||entity.height||0),_rotation:Number(entity.rotation||0),_color:dxfColor(entity,layer),_weight:Number.isFinite(weight)&&weight>0?Math.max(.7,weight/26.46):1,_opacity:1,_fillOpacity:['SOLID','TRACE','3DFACE','HATCH'].includes(type)?.88:.16,_dash:dxfDash(entity,dxf)}});
  }
  let total=0,bounds=null,first=importedLayers.length;cadLayers.querySelector('.message')?.remove();
  for(const [name,features] of groups){const geo=L.geoJSON(features,{style:styleForFeature,pointToLayer:(f,ll)=>L.circleMarker(ll,styleForFeature(f)),onEachFeature:(f,l)=>{const p=f.properties||{},s=p._label;if(s&&['TEXT','MTEXT','ATTRIB','ATTDEF'].includes(p._entityType)){const node=document.createElement('span');node.textContent=String(s).replace(/\\P/g,'\n').slice(0,200);l.bindTooltip(node,{permanent:false,direction:'center',className:'cad-text-label'});cadFidelityTextItems.push({layer:l,height:p._textHeight,color:p._color,rotation:p._rotation})}}});addLayerEntry(file.name+' · '+name,geo,features.length);geo.addTo(map);total+=features.length;if(/^(HAT_|DIREK_|NODE_|TRAFO_|KOFRE_)/i.test(name)){const b=geo.getBounds();if(b.isValid())bounds=bounds?bounds.extend(b):b}}
  if(!total)throw new Error('DXF icinde haritada gosterilebilen 2B cizim bulunamadi.');if(bounds?.isValid())map.fitBounds(bounds.pad(.08),{maxZoom:17});else{const firstLayer=importedLayers[first];if(firstLayer)zoomTo(firstLayer.layer)}setTimeout(refreshCadFidelityText,0);return total;
}


/* Render the expanded CAD entities with CAD-style colors and per-layer controls. */
styleForFeature=function(feature){const p=feature.properties||{},type=p._entityType||p.kind,color=p._color||p.color||'#ffffff';if(['INSERT','POINT','TEXT','MTEXT','ATTRIB','ATTDEF'].includes(type))return {radius:type==='INSERT'?5:3,color,weight:1,fillColor:color,fillOpacity:.92};return {color,weight:p._weight??p.weight??1,opacity:p._opacity??1,fillColor:color,fillOpacity:p._fillOpacity??p.fill??.16,dashArray:p._dash||p.dash||null}};
parseDxf=async function(file){
  showToast('DXF okunuyor… büyük paftalarda işlem sürebilir.');
  const text=await file.arrayBuffer().then(b=>new TextDecoder('windows-1254').decode(b));
  const mod=await import('https://esm.sh/dxf-parser@1.1.2'),Parser=mod.default||mod.DxfParser||mod,dxf=new Parser().parse(text);
  injectSolidHatches(text,dxf);selectDrawingCrs(dxf,file.name);const project=projectionForDrawing(),records=dxf.tables?.layer?.layers||dxf.tables?.layers?.layers||{},layerMap=new Map(Object.values(records).map(l=>[String(l.name||'').toUpperCase(),l])),groups=new Map();
  for(const e of expandCadInserts(dxf.entities,dxf)){const name=e.layer||'0',layer=layerMap.get(name.toUpperCase());if(e.visible===false||Number(e.colorIndex)<0||layer?.visible===false||layer?.frozen||layer?.off||Number(layer?.colorIndex)<0)continue;const geometry=makeDxfGeometry(e,project);if(!geometry)continue;if(!groups.has(name))groups.set(name,[]);const type=String(e.type||'').toUpperCase(),weight=Number(e.lineweight??layer?.lineweight);groups.get(name).push({type:'Feature',geometry,properties:{kind:type,label:e.text||e.name||e.type||'',color:dxfColor(e,layer),weight:Number.isFinite(weight)&&weight>0?Math.max(.7,weight/26.46):1,fill:['SOLID','TRACE','3DFACE','HATCH'].includes(type)?.88:.16,dash:dxfDash(e,dxf),_textHeight:Number(e.textHeight||e.height||0),_rotation:Number(e.rotation||0)}})}
  let total=0,bounds=null,first=importedLayers.length;cadLayers.querySelector('.message')?.remove();
  for(const [name,features] of groups){const geo=L.geoJSON(features,{style:styleForFeature,pointToLayer:(f,ll)=>L.circleMarker(ll,styleForFeature(f)),onEachFeature:(f,l)=>{const p=f.properties||{},label=p.label;if(label&&['TEXT','MTEXT','ATTRIB','ATTDEF'].includes(p.kind)){const node=document.createElement('span');node.textContent=String(label).replace(/\\P/g,'\n').slice(0,200);l.bindTooltip(node,{permanent:false,direction:'center',className:'cad-text-label'});cadFidelityTextItems.push({layer:l,height:p._textHeight,color:p.color,rotation:p._rotation})}}});addLayerEntry(file.name+' · '+name,geo,features.length);geo.addTo(map);total+=features.length;if(/^(HAT_|DIREK_|NODE_|TRAFO_|KOFRE_)/i.test(name)){const b=geo.getBounds();if(b.isValid())bounds=bounds?bounds.extend(b):b}}
  if(!total)throw new Error('DXF içinde haritada gösterilebilir 2B çizim bulunamadı.');if(bounds?.isValid())map.fitBounds(bounds.pad(.08),{maxZoom:17});else if(importedLayers[first])zoomTo(importedLayers[first].layer);setTimeout(refreshCadFidelityText,0);return total;
};
