import sharp from 'sharp'

export async function toWebpSizes(input: Buffer): Promise<{ thumb: Buffer; detail: Buffer }> {
  const image = sharp(input, { failOn: 'error' })
  const detail = await image.clone().rotate().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
  const thumb = await image.clone().rotate().resize({ width: 160, height: 160, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
  return { thumb, detail }
}
