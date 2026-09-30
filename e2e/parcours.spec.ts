import { expect, test } from '@playwright/test'

const authUrl = process.env.AUTH_URL || 'http://localhost:8000'
const mailpitUrl = process.env.MAILPIT_URL || 'http://localhost:8025'
const appUrl = process.env.BASE_URL || 'http://localhost:8080'

async function confirmationLink(email: string) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const search = await fetch(`${mailpitUrl}/api/v1/search?query=${encodeURIComponent(email)}`)
    const body = (await search.json()) as { messages?: { ID: string }[] }
    const message = body.messages?.[0]
    if (message) {
      const detail = (await (await fetch(`${mailpitUrl}/api/v1/message/${message.ID}`)).json()) as {
        HTML?: string
        Text?: string
      }
      const raw = `${detail.HTML ?? ''} ${detail.Text ?? ''}`
      const match = raw.match(/https?:\/\/[^\s"'<>]+/)
      if (match) {
        return match[0]
          .replace(/&amp;/g, '&')
          .replace('http://localhost:8000', authUrl)
          .replace('http://localhost:8080', appUrl)
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`Aucun e-mail pour ${email}`)
}

test('parcours compte, box, triathlon 70.3, débrief et suppression', async ({ page }) => {
  const email = `ada.${Date.now()}@exemple.fr`
  const password = 'secret123'

  await page.goto('/inscription')
  await page.getByLabel('Pseudo').fill('Ada')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Mot de passe').fill(password)
  await page.getByRole('button', { name: 'Créer le compte' }).click()
  await expect(page.getByText(/confirmation/i)).toBeVisible()

  const link = await confirmationLink(email)
  await page.goto(link)
  await expect(page.getByRole('heading', { name: 'Confirmation' })).toBeVisible()

  await page.goto('/connexion')
  if (page.url().includes('/connexion')) {
    await page.getByLabel('E-mail').fill(email)
    await page.getByLabel('Mot de passe').fill(password)
    await page.getByRole('button', { name: 'Se connecter' }).click()
  }
  await expect(page).toHaveURL(/\/app/)

  await page.goto('/app/box')
  await page.getByRole('button', { name: 'Ajouter depuis le catalogue' }).click()
  await page.getByRole('button', { name: 'Ajouter à la Box' }).first().click()
  await expect(page.getByText('Gel énergétique classique')).toBeVisible()

  await page.goto('/app/produits/nouveau')
  await page.getByLabel('Nom').fill('Compote maison')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Compote maison')).toBeVisible()

  await page.goto('/app/sortie')
  await page.getByLabel('Nom').fill('70.3 de préparation')
  await page.getByLabel('Sport').selectOption('triathlon')
  await page.getByLabel('Format').selectOption('triathlon_70_3')
  await page.getByRole('button', { name: 'Calculer le plan' }).click()
  await expect(page.getByRole('heading', { name: 'Cibles horaires' })).toBeVisible()
  await page.getByRole('button', { name: 'Enregistrer dans mon compte' }).click()
  await expect(page.getByRole('heading', { name: '70.3 de préparation' })).toBeVisible()
  await expect(page.getByText(/Vélo|vélo/)).toBeVisible()

  await page.getByRole('link', { name: 'Débrief' }).click()
  await page.getByRole('button', { name: 'Enregistrer le débrief' }).click()
  await expect(page.getByText(/Débrief enregistré/)).toBeVisible()

  await page.goto('/app/compte')
  await page.getByLabel('Confirmation').fill('SUPPRIMER')
  await page.getByRole('button', { name: 'Supprimer définitivement' }).click()
  await expect(page).toHaveURL(/\/$/)
})
