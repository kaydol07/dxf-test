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
    locationStatus.textContent='Konum güncellendi · doğruluk yaklaşık '+Math.round(accuracy)+' m · '+new Date(pos.timestamp).toLocaleTimeString('tr-TR');
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
  const title=document.createElement('strong');title.textContent=properties.ozet||((properties.mahalleAd||'Parsel')+' · '+(properties.adaNo||'—')+'/'+(properties.parselNo||'—'));
  const list=document.createElement('dl');for(const [label,key] of fields){if(properties[key]===undefined||properties[key]===null||properties[key]==='')continue;const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=String(properties[key]);list.append(dt,dd)}
  parcelResult.replaceChildren(title,list);parcelResult.hidden=false;
}
async function queryParcel(latlng){
  if(parcelRequest)parcelRequest.abort();parcelRequest=new AbortController();
  parcelMessage.textContent='TKGM parsel servisine sorgu gönderiliyor…';parcelResult.hidden=true;
  if(parcelLayer){map.removeLayer(parcelLayer);parcelLayer=null}
  const endpoint='https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/parsel/'+latlng.lat.toFixed(7)+'/'+latlng.lng.toFixed(7)+'/';
  try{
    const response=await fetch(endpoint,{headers:{Accept:'application/json'},signal:parcelRequest.signal});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const data=await response.json();const feature=findParcelFeature(data);
    if(!feature){parcelMessage.textContent='Parsel bulunamadı. Konum yol, su alanı veya kayıt dışı bir yerde olabilir.';return}
    showParcelDetails(feature.properties||{});
    if(feature.geometry){parcelLayer=L.geoJSON(feature,{style:{color:'#ffb000',weight:3,fillColor:'#ffd45c',fillOpacity:.32}}).addTo(map);const bounds=parcelLayer.getBounds();if(bounds.isValid())map.fitBounds(bounds.pad(.25));parcelLayer.bindPopup(feature.properties?.ozet||('Ada '+(feature.properties?.adaNo||'—')+' / Parsel '+(feature.properties?.parselNo||'—'))).openPopup()}
    parcelMessage.textContent='Parsel bilgisi TKGM servisinden alındı.';
  }catch(error){if(error.name==='AbortError')return;parcelMessage.textContent='TKGM servisine bu siteden erişilemedi. Tarayıcı bağlantıyı engellemiş olabilir; resmî sorguyu yeni sekmede açabilirsin.';}
}
map.on('click',event=>{if(parcelPickActive)queryParcel(event.latlng)});
document.getElementById('uploadButton').addEventListener('click',()=>document.getElementById('fileInput').click());
document.getElementById('loadDisk').addEventListener('click',()=>document.getElementById('fileInput').click());
document.getElementById('fileInput').addEventListener('change',e=>{const files=[...e.target.files];if(!files.length)return;document.getElementById('loadedFiles').textContent=files.map(f=>f.name).join(', ');showToast(files.length+' dosya seçildi. DXF/KMZ/KML gösterimi için katman dönüştürücü eklenecek.')});
document.getElementById('clearMap').addEventListener('click',()=>{map.eachLayer(l=>{if(l!==bases.satellite&&l!==bases.street&&l!==bases.dark&&l!==bases.light&&l!==labelLayer&&l!==locationMarker&&l!==locationAccuracy)map.removeLayer(l)});if(parcelRequest)parcelRequest.abort();parcelLayer=null;parcelResult.hidden=true;setParcelPick(false);document.getElementById('loadedFiles').textContent='Henüz dosya yüklenmedi';showToast('Harita üzerindeki işaretler temizlendi.')});
document.querySelectorAll('[data-datum]').forEach(b=>b.addEventListener('click',()=>showToast('Koordinat sistemi: '+b.dataset.datum)));
document.getElementById('printButton').addEventListener('click',()=>window.print());
