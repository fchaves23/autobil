// Gera os ícones PNG do app a partir dos SVGs em /public.
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'

const icon = await readFile('public/icon.svg')
const maskable = await readFile('public/icon-maskable.svg')

await sharp(icon).resize(192, 192).png().toFile('public/icon-192.png')
await sharp(icon).resize(512, 512).png().toFile('public/icon-512.png')
await sharp(maskable).resize(512, 512).png().toFile('public/icon-maskable-512.png')
await sharp(maskable).resize(180, 180).png().toFile('public/apple-touch-icon.png')
console.log('Ícones gerados.')
