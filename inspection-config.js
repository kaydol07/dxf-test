/*
 * Saha denetimi tanımları uygulama kodundan ayrıdır. Yeni kontrol maddesi,
 * teknik değer veya "nasıl olmalı" referansı eklemek için bu dosya
 * güncellenir; arayüz ve kayıt modeli aynı kalır.
 */
window.DXF_INSPECTION_CONFIG = {
  version: 1,
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
