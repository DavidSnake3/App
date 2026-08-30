// Genera los íconos PNG (PWA + recursos para @capacitor/assets) desde resources/icon.svg
// Identidad (mejora 7): ícono con fondo BLANCO y marca SN; splash SIN logo
// (la única animación de arranque es la de la app).
import sharp from 'sharp'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'resources', 'icon.svg'))

mkdirSync(join(root, 'public', 'icons'), { recursive: true })
mkdirSync(join(root, 'resources'), { recursive: true })

const out = (p) => join(root, p)
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 }

// PWA
await sharp(svg).resize(192, 192).png().toFile(out('public/icons/icon-192.png'))
await sharp(svg).resize(512, 512).png().toFile(out('public/icons/icon-512.png'))

// Maskable: la marca al ~78% centrada sobre blanco
const inner = await sharp(svg).resize(400, 400).png().toBuffer()
await sharp({ create: { width: 512, height: 512, channels: 4, background: WHITE } })
  .composite([{ input: inner, left: 56, top: 56 }])
  .png()
  .toFile(out('public/icons/icon-maskable-512.png'))

// Recursos para @capacitor/assets (Android)
await sharp(svg).resize(1024, 1024).png().toFile(out('resources/icon-only.png'))
const fg = await sharp(svg).resize(720, 720).png().toBuffer()
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: WHITE } })
  .composite([{ input: fg, left: 152, top: 152 }])
  .png()
  .toFile(out('resources/icon-foreground.png'))
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: WHITE } })
  .png()
  .toFile(out('resources/icon-background.png'))

// Splash SIN logo: color sólido (la animación de la app es el único branding)
await sharp({ create: { width: 2732, height: 2732, channels: 4, background: { r: 242, g: 244, b: 250, alpha: 1 } } })
  .png()
  .toFile(out('resources/splash.png'))
await sharp({ create: { width: 2732, height: 2732, channels: 4, background: { r: 11, g: 13, b: 20, alpha: 1 } } })
  .png()
  .toFile(out('resources/splash-dark.png'))

// Ícono grande de notificaciones (el plugin lo busca como drawable, no mipmap)
await sharp(join(root, 'resources', 'icon-only.png'))
  .resize(256, 256)
  .png()
  .toFile(out('android/app/src/main/res/drawable/ic_notif_large.png'))

console.log('Íconos generados: fondo blanco + splash sin logo ✔')
