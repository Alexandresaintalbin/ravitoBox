import type { CatalogDraft } from '@/lib/catalog/convert'

export function draftToPayload(draft: CatalogDraft, imagePath: string | null) {
  return {
    name: draft.name,
    brand: draft.brand,
    barcode: draft.barcode,
    product_type: draft.productType,
    flavor: draft.flavor,
    carbs_g: draft.carbsG,
    sodium_mg: draft.sodiumMg,
    caffeine_mg: draft.caffeineMg,
    volume_ml: draft.volumeMl,
    serving_label: draft.servingLabel,
    serving_size: draft.servingSize,
    serving_unit: draft.servingUnit,
    carbs_per_100: draft.carbsPer100,
    sugars_g: draft.sugarsG,
    sugars_per_100: draft.sugarsPer100,
    energy_kj: draft.energyKj,
    energy_kj_per_100: draft.energyKjPer100,
    sodium_per_100: draft.sodiumPer100,
    caffeine_per_100: draft.caffeinePer100,
    image_path: imagePath,
    image_credit: imagePath ? draft.imageCredit : null,
    source_url: draft.sourceUrl,
    data_quality: draft.dataQuality,
    off_last_modified: draft.offLastModified,
    carbs_known: true,
  }
}
