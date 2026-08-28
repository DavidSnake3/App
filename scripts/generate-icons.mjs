// Genera los íconos PNG (PWA + recursos para @capacitor/assets) desde resources/icon.svg
import sharp from 'sharp'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'resources', 'icon.svg'))

mkdirSync(join(root, 'public', 'icons'), { recursive: true })
mkdirSync(join(root, 'resources'), { recursive: true })

const out = (p) => join(root, p)

// PWA
await sharp(svg).resize(192, 192).png().toFile(out('public/icons/icon-192.png'))
await sharp(svg).resize(512, 512).png().toFile(out('public/icons/icon-512.png'))

// Maskable: el ícono al 78% centrado sobre fondo del gradiente
const inner = await sharp(svg).resize(400, 400).png().toBuffer()
await sharp({
  create: { width: 512, height: 512, channels: 4, background: { r: 91, g: 62, b: 232, alpha: 1 } },
})
  .composite([{ input: inner, left: 56, top: 56 }])
  .png()
  .toFile(out('public/icons/icon-maskable-512.png'))

// Recursos para @capacitor/assets (Android)
await sharp(svg).resize(1024, 1024).png().toFile(out('resources/icon-only.png'))
const fg = await sharp(svg).resize(720, 720).png().toBuffer()
await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([{ input: fg, left: 152, top: 152 }])
  .png()
  .toFile(out('resources/icon-foreground.png'))
await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: { r: 36, g: 23, b: 163, alpha: 1 } },
})
  .png()
  .toFile(out('resources/icon-background.png'))

// Splash 2732x2732 (logo centrado; claro y oscuro)
const splashLogo = await sharp(svg).resize(560, 560).png().toBuffer()
await sharp({
  create: { width: 2732, height: 2732, channels: 4, background: { r: 242, g: 244, b: 250, alpha: 1 } },
})
  .composite([{ input: splashLogo, left: (2732 - 560) / 2, top: (2732 - 560) / 2 }])
  .png()
  .toFile(out('resources/splash.png'))
await sharp({
  create: { width: 2732, height: 2732, channels: 4, background: { r: 11, g: 13, b: 20, alpha: 1 } },
})
  .composite([{ input: splashLogo, left: (2732 - 560) / 2, top: (2732 - 560) / 2 }])
  .png()
  .toFile(out('resources/splash-dark.png'))

console.log('Íconos generados ✔')
