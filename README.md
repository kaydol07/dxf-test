# DXF Harita Görüntüleyici — test yayını

Statik GitHub Pages prototipi: [https://kaydol07.github.io/dxf-test/](https://kaydol07.github.io/dxf-test/)

## Özellikler

- Harita altlıkları ve canlı tarayıcı konumu
- Adres arama
- Haritadan seçilen koordinat için TKGM parsel API sorgusu (tarayıcı CORS erişimi izin verdiği ölçüde); resmi TKGM sayfasına yedek bağlantı
- DXF, KML ve KMZ dosyalarını istemci tarafında haritada açma ve katmanları açıp kapatma
- DXF için DOM (merkez meridyen) ve datum seçimi

DXF dosyası tarayıcı belleğinde okunur ve sunucuya gönderilmez. Büyük çizimler ana sayfayı kilitlememesi için Web Worker içinde ayrıştırılır; çizgiler ve CAD katmanları tek tek DOM öğeleri yerine tuval üzerinde çizilir. Uygulama 2B çizgiler, poligonlar, çemberler, noktalar, yazılar, solid hatch'ler ve blok içi geometrileri gösterir. 3B nesneler bu 2B görünümde tam olarak temsil edilmez.

DOM, proje adı/bölge bilgisi varsa önerilebilir. Datum DXF metaverisinde bulunmuyorsa güvenilir biçimde otomatik anlaşılamaz; uygulama varsayılan ITRF seçimini açıkça bildirir. ED50/ITRF veya DOM ayarı değişince çizim yeni ayarla yeniden projelendirilir. Özellikle ED50 projelerinde AutoCAD pafta bilgisiyle datum doğrulanmalıdır.

TKGM API erişimi tarayıcıdan CORS/servis kısıtına takılırsa, statik site inline parsel sonucu gösteremez; bu durumda resmi TKGM sorgu sayfasını kullanın. Parsel haritası hukuki/ölçme belgesi yerine geçmez.

Harita tabanları ve koordinat dönüştürücü için internet bağlantısı gerekir. Sayfa HTTPS ile yayımlanmalıdır.
