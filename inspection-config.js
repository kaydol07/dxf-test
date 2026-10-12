/*
 * Saha denetimi tanımları uygulama kodundan ayrıdır. Yeni kontrol maddesi,
 * teknik değer veya "nasıl olmalı" referansı eklemek için bu dosya
 * güncellenir; arayüz ve kayıt modeli aynı kalır.
 */
window.DXF_INSPECTION_CONFIG = {
  version: 2,
  theme: {
    notChecked: '#77817e',
    compliant: '#27854a',
    nonCompliant: '#d83b35',
    correctionPending: '#d99a00'
  },
  settings: {
    inspectionIntervalMeters: 5,
    progressEnabled: true
  },
  completionStatuses: [
    { id: 'NOT_DONE', label: 'Yapılmadı' },
    { id: 'DONE', label: 'Yapıldı' }
  ],
  qualityStatuses: [
    { id: 'NOT_CHECKED', label: 'Kontrol edilmedi' },
    { id: 'COMPLIANT', label: 'Uygun' },
    { id: 'NON_COMPLIANT', label: 'Uygunsuz' }
  ],
  checklists: {
    pole: {
      id: 'pole',
      label: 'Direk denetimi',
      groups: [
        { id: 'pole-installation', label: 'Direk / imalat', items: [
          { id: 'pole-installation', label: 'Direk dikimi', technicalNote: 'Direk tipi ve görevine uygun dikim kontrolü.' },
          { id: 'excavation', label: 'Çukur', technicalNote: 'Çukurun proje ve zemin şartlarına uygunluğu.' },
          { id: 'foundation', label: 'Temel ölçüsü', technicalNote: 'Temel ölçüsü ve donatının proje ile uyumu.' },
          { id: 'embedment', label: 'Dikim derinliği', technicalNote: 'Direk gömme derinliği.' },
          { id: 'plumb', label: 'Şakül', technicalNote: 'Direğin düşey doğrultusu.' },
          { id: 'concrete', label: 'Beton', technicalNote: 'Beton kalitesi, yüzeyi ve kür durumu.' }
        ] },
        { id: 'equipment', label: 'Konsol ve bağlantılar', items: [
          { id: 'bracket', label: 'Konsol', technicalNote: 'Konsolun mevcut ve sabit olması.' },
          { id: 'bracket-type', label: 'Konsol tipi', technicalNote: 'Projedeki konsol tipine uygunluk.' },
          { id: 'bracket-direction', label: 'Konsol yönü', technicalNote: 'Konsol yönünün hat güzergâhı ile uyumu.' },
          { id: 'fasteners', label: 'Bağlantı elemanları', technicalNote: 'Cıvata, somun ve bağlantıların tamamlığı.' },
          { id: 'insulator', label: 'İzolatör', technicalNote: 'İzolatör tipi ve montajı.' },
          { id: 'conductor-layout', label: 'İletken tertibi', technicalNote: 'İletken düzeni ve açıklıklar.' }
        ] },
        { id: 'safety', label: 'Güvenlik', items: [
          { id: 'grounding', label: 'Topraklama', technicalNote: 'Topraklama bağlantısının devamlılığı.' },
          { id: 'guardrail', label: 'Korkuluk', technicalNote: 'Gerekli alanlarda korkuluk uygulaması.' },
          { id: 'otl', label: 'ÖTL', technicalNote: 'ÖTL ekipmanı ve işaretleme kontrolü.' }
        ] }
      ]
    },
    lighting: {
      id: 'lighting',
      label: 'Aydınlatma noktası denetimi',
      groups: [
        { id: 'lighting-installation', label: 'Aydınlatma imalatı', items: [
          { id: 'lighting-mounting', label: 'Armatür montajı', technicalNote: 'Armatürün proje konumunda, sağlam ve güvenli şekilde monte edilmesi.' },
          { id: 'lighting-bracket', label: 'Konsol / bağlantı', technicalNote: 'Konsol, bağlantı elemanları ve yönü projeye uygun olmalıdır.' },
          { id: 'lighting-luminaire', label: 'Armatür tipi', technicalNote: 'Armatür tipi, gücü ve optik yönü projedeki tanıma uygun olmalıdır.' },
          { id: 'lighting-cable-entry', label: 'Kablo bağlantısı', technicalNote: 'Kablo girişi, ekler ve klemens bağlantıları emniyetli olmalıdır.' }
        ] },
        { id: 'lighting-safety', label: 'Elektrik ve güvenlik', items: [
          { id: 'lighting-grounding', label: 'Topraklama', technicalNote: 'Topraklama iletkeni ve bağlantı sürekliliği kontrol edilmelidir.' },
          { id: 'lighting-protection', label: 'Koruma / sızdırmazlık', technicalNote: 'Kapaklar, contalar ve koruma sınıfı saha şartlarına uygun olmalıdır.' },
          { id: 'lighting-operation', label: 'Çalışma testi', technicalNote: 'Enerji verildiğinde armatürün çalışması ve yönü kontrol edilmelidir.' }
        ] }
      ]
    },
    box: {
      id: 'box',
      label: 'BOX / pano denetimi',
      groups: [
        { id: 'box-installation', label: 'Montaj ve gövde', items: [
          { id: 'box-location', label: 'Konum ve montaj', technicalNote: 'BOX/panonun proje konumunda, sağlam ve erişilebilir olması.' },
          { id: 'box-base', label: 'Kaide / sabitleme', technicalNote: 'Kaide, ankraj ve sabitleme elemanları kontrol edilmelidir.' },
          { id: 'box-enclosure', label: 'Gövde ve kapak', technicalNote: 'Gövde, kapak, kilit ve dış yüzey hasarsız olmalıdır.' },
          { id: 'box-cable-entry', label: 'Kablo girişleri', technicalNote: 'Kablo girişleri, rakorlar ve sızdırmazlık elemanları uygun olmalıdır.' }
        ] },
        { id: 'box-electrical', label: 'Elektrik ve emniyet', items: [
          { id: 'box-grounding', label: 'Topraklama', technicalNote: 'Pano gövdesi ve topraklama bağlantıları kontrol edilmelidir.' },
          { id: 'box-protection', label: 'Koruma elemanları', technicalNote: 'Sigorta, şalter ve koruma elemanları proje ile uyumlu olmalıdır.' },
          { id: 'box-labeling', label: 'Etiketleme', technicalNote: 'Pano/BOX etiketi ve devre tanımları okunabilir olmalıdır.' },
          { id: 'box-test', label: 'Enerji / fonksiyon testi', technicalNote: 'Gerekli emniyet önlemleri alınarak çalışma kontrolü yapılmalıdır.' }
        ] }
      ]
    },
    underground: {
      id: 'underground',
      label: 'Yeraltı kablo denetimi',
      groups: [
        { id: 'trench', label: 'Kanal', items: [
          { id: 'excavation', label: 'Kanal kazısı' },
          { id: 'trench-dimensions', label: 'Kanal ölçüleri', criteria: { depthCm: 80, bottomWidthCm: 40, topWidthCm: 60 }, technicalNote: 'Standart kanal: 80 cm derinlik, 40 cm dip genişliği, 60 cm üst genişliği.' },
          { id: 'bottom-sand', label: 'Dip kumlama', criteria: { minRemainingCm: 10, disallowedMaterials: ['deniz kumu', 'keskin malzeme'] }, technicalNote: 'Kablo çekiminden sonra da en az 10 cm kalmalıdır.' },
          { id: 'cable-pulling', label: 'Kablo çekimi', criteria: { requiredEquipment: ['kayar makara', 'köşe makarası', 'kablo çorabı'], prohibited: ['kepçe kovasına sıkıştırarak çekim'] } },
          { id: 'cable-layout', label: 'Kabloların kanala düzgün yerleştirilmesi', criteria: { cableToTrenchMinCm: 7, agOgAndOgGroupMinCm: 14, turnRadiusMultiplier: 15 } },
          { id: 'transposition', label: 'OG transpozisyon', criteria: { requiredWhenRouteLongerKm: 2 } }
        ] },
        { id: 'protection', label: 'Koruma ve dolgu', items: [
          { id: 'spacers', label: 'Ara taşları', criteria: { maximumIntervalMeters: 2 } },
          { id: 'guide-plate', label: 'Kılavuz plaka' },
          { id: 'top-sand', label: 'Üst kumlama', criteria: { minOverCableCm: 10 } },
          { id: 'bims-block', label: 'Bimsblok', criteria: { sizeCm: '6x20x50', lateralOverhangCm: 5 } },
          { id: 'fill', label: 'Dolgu', criteria: { afterBimsCm: 20 } },
          { id: 'warning-tape', label: 'TEDAŞ ikaz bandı', criteria: { afterBimsFillCm: 20 } }
        ] },
        { id: 'crossings', label: 'Güzergâh geçişleri', items: [
          { id: 'road-crossing', label: 'Yol geçişi' },
          { id: 'manhole-crossing', label: 'Menhol geçişi' },
          { id: 'duct-crossing', label: 'Boru / büz geçişi' },
          { id: 'grounding-route', label: 'Topraklama güzergâhı' },
          { id: 'other-underground', label: 'Gerekli diğer yeraltı kontrolleri' }
        ] }
      ]
    }
  }
};
