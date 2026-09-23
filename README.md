# DXF Harita Görüntüleyici — test yayını

Statik GitHub Pages prototipi: [https://kaydol07.github.io/dxf-test/](https://kaydol07.github.io/dxf-test/)

## Özellikler

- Harita altlıkları ve canlı tarayıcı konumu
- Adres arama
- Haritadan seçilen koordinat için TKGM parsel API sorgusu (tarayıcı CORS erişimi izin verdiği ölçüde); resmi TKGM sayfasına yedek bağlantı
- DXF, KML ve KMZ dosyalarını istemci tarafında haritada açma ve katmanları açıp kapatma
- DXF için DOM (merkez meridyen) ve datum seçimi

DXF dosyası tarayıcı belleğinde okunur ve sunucuya gönderilmez. DXF’in doğru yere oturması için çizimin koordinat sistemi, datum ve DOM bilgileri kullanıcı tarafından doğru seçilmelidir. Bu ilk sürüm 2B çizgiler, poligonlar, çemberler, noktalar, yazılar ve blokların ekleme noktalarını gösterir; bütün CAD nesne tiplerini ve blok içi geometrileri desteklemez.

TKGM API erişimi tarayıcıdan CORS/servis kısıtına takılırsa, statik site inline parsel sonucu gösteremez; bu durumda resmi TKGM sorgu sayfasını kullanın. Parsel haritası hukuki/ölçme belgesi yerine geçmez.

Harita tabanları ve koordinat dönüştürücü için internet bağlantısı gerekir. Sayfa HTTPS ile yayımlanmalıdır.
