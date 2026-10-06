# DXF Harita Görüntüleyici — test yayını

Statik GitHub Pages prototipi: [https://kaydol07.github.io/dxf-test/](https://kaydol07.github.io/dxf-test/)

## Özellikler

- Esri, OpenStreetMap ve CartoDB harita altlıkları; oturumluk Google Uydu seçeneği
- Canlı tarayıcı konumu
- Adres arama
- Haritadan seçilen koordinat için TKGM parsel API sorgusu (tarayıcı CORS erişimi izin verdiği ölçüde); resmi TKGM sayfasına yedek bağlantı
- DXF, KML ve KMZ dosyalarını istemci tarafında haritada açma ve katmanları açıp kapatma
- DXF için DOM (merkez meridyen) ve datum seçimi
- Fotoğrafa bağlı saha kaydı, not, harita pini ve proje paketine dışa/içe aktarma
- Kalıcı proje kimliği, taşeron metadata'sı, modüler direk/yeraltı checklist'i ve uygunsuzluk takibi

DXF dosyası tarayıcı belleğinde okunur ve sunucuya gönderilmez. Büyük çizimler ana sayfayı kilitlememesi için Web Worker içinde ayrıştırılır; çizgiler ve CAD katmanları tek tek DOM öğeleri yerine tuval üzerinde çizilir. Uygulama 2B çizgiler, poligonlar, çemberler, noktalar, yazılar, solid hatch'ler ve blok içi geometrileri gösterir. 3B nesneler bu 2B görünümde tam olarak temsil edilmez.

DOM, proje adı/bölge bilgisi varsa önerilebilir. Datum DXF metaverisinde bulunmuyorsa güvenilir biçimde otomatik anlaşılamaz; uygulama varsayılan ITRF seçimini açıkça bildirir. ED50/ITRF veya DOM ayarı değişince çizim yeni ayarla yeniden projelendirilir. Özellikle ED50 projelerinde AutoCAD pafta bilgisiyle datum doğrulanmalıdır.

TKGM API erişimi tarayıcıdan CORS/servis kısıtına takılırsa, statik site inline parsel sonucu gösteremez; bu durumda resmi TKGM sorgu sayfasını kullanın. Parsel haritası hukuki/ölçme belgesi yerine geçmez.

Harita tabanları ve koordinat dönüştürücü için internet bağlantısı gerekir. Sayfa HTTPS ile yayımlanmalıdır.

Google Uydu için Google Maps JavaScript API anahtarı gerekir. Anahtar uygulama koduna yazılmaz ve sayfa yenilenince silinir; Google Maps API isteğinde tarayıcıdan Google'a gönderilir. Yalnızca Maps JavaScript API'ye ve bu sitenin HTTP referrer alan adına kısıtlanmış bir anahtar kullanın.

## Saha denetimi ve uygunsuzluk takibi

`inspection-config.js`, uygulama ekranından ayrılmış checklist/teknik kriter tanımıdır. Direk ve yeraltı kablo checklist maddeleri, 5 m varsayılan güzergâh aralığı, renk teması ve ilerleme göstergesi burada yer alır. Değerler UI içine gömülü değildir.

DXF açılırken worker; `DIREK`/`POLE` katmanlarındaki blok, nokta ve etiketlerden direk adaylarını, `YERALTI`/`KABLO` katmanlarındaki polylinelerden ise ayarlanabilir aralıkla yeraltı kontrol noktalarını önerir. Adaylar yalnızca kontrol noktasıdır; otomatik uygunluk kararı vermez. Çizimin katman yapısı uygun değilse **Manuel direk noktası ekle** ve **Manuel yeraltı noktası ekle** ile aynı checklist kullanılır.

Her checklist maddesinde imalat durumu (`Yapıldı`/`Yapılmadı`) ve kalite durumu (`Kontrol edilmedi`/`Uygun`/`Uygunsuz`) ayrı saklanır. Uygunsuz kaydı açıklama gerektirir; ilk fotoğraf **Önce**, düzeltme fotoğrafı **Sonra** olarak bağlanır. Uygunsuzluk geçmişi silinmez; BEDA sırasıyla düzeltme bekliyor veya kapatıldı durumuna geçirir. DXF üzerinde gri, yeşil, kırmızı ve sarı durum işaretleri ile hızlı filtreler bulunur.

## Kimlik, yetki ve Yandex

Ham DXF açılışında çizim içeriğinden SHA-256 tabanlı `canonical_key` üretilir. Yandex yolu, dosya adı veya cihaz değişse bile sonraki açılışlar aynı anahtarı bulup mevcut `projectId` ile ilişkilendirilir. Eski proje paketi (`schemaVersion: 1`) açılmaya devam eder; paketi BEDA ile yeniden kaydetmek kimliği ve denetim snapshot'ını yeni pakete ekler.

Yandex klasörü proje metadata'sındaki taşeronu belirler. Bu bilgi saha kaydı ve uygunsuzluklarda otomatik kullanılır; kullanıcıdan her kayıtta taşeron seçmesi istenmez. RLS migration'ı uygulandıktan sonra BEDA tüm yazma işlemlerini yapar; AEDAŞ sadece görüntüler; taşeron yalnızca kendi Yandex klasörüne bağlı proje ve kayıtları görüntüler.

Yandex'e güncel paket yazma BEDA'daki **Güncel paketi Yandex'e kaydet** düğmesindedir. Bunun için Edge Function'ın güncel sürümü ve `YANDEX_DISK_OAUTH_TOKEN` içinde `cloud_api:disk.read` ile `cloud_api:disk.write` izinleri gerekir. Ayrıntılı kurulum: [`supabase/SETUP.md`](supabase/SETUP.md).

## Yerel deneme ve eski saha kayıtları

Fotoğraf, not ve konum bu tarayıcının IndexedDB deposunda tutulur. JPEG fotoğraflardaki EXIF GPS bilgisi varsa otomatik okunur; yoksa kullanıcı anlık konum alabilir veya haritadan pini seçip sürükleyebilir. “Tüm projeyi paketle” DXF dosyalarını, fotoğrafları, notları, koordinat ayarını ve harita görünümünü `.dxfproj.zip` dosyasında toplar. Bu dosya Yandex Disk'e elle yüklenebilir; daha sonra “Proje paketi aç” ile geri alınabilir. Tarayıcı verisini temizlemek yerel kayıtları silebileceğinden paketi yedek olarak saklayın.

Canlı ortak veri için SQL migration'ları ve Edge Function yayını zorunludur. Bu dosyalar uygulanmadan uygulama yine yerel IndexedDB yedeği ile açılır; merkezi yazma ve Yandex'e paket kaydetme devreye girmez.
