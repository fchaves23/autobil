import { useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import type { Profile } from '../lib/types'
import { Avatar } from './Avatar'
import { Field, Sheet } from './ui'

// Recorta no centro (quadrado) e reduz para 320px: a foto fica leve para enviar
async function prepareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const size = 320
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível ler a imagem.'))), 'image/jpeg', 0.85))
}

export function ProfileSheet({ user, onClose, onSaved }: { user: Profile; onClose: () => void; onSaved: (msg: string) => void }) {
  const [name, setName] = useState(user.name)
  const [photo, setPhoto] = useState<string | null>(user.avatar_url ?? null)
  const [busy, setBusy] = useState<'photo' | 'name' | null>(null)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)

  async function pick(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Escolha uma imagem (foto).')
    setError('')
    setBusy('photo')
    try {
      const blob = await prepareImage(file)
      setPhoto(URL.createObjectURL(blob)) // mostra na hora, enquanto envia
      setPhoto(await api.uploadAvatar(blob))
      onSaved('Foto atualizada')
    } catch (err) {
      setPhoto(user.avatar_url ?? null)
      setError(`Não foi possível enviar a foto: ${(err as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Sheet title="Meu perfil" onClose={onClose}>
      <div className="stack">
        <div className="profile-photo">
          <button type="button" className="profile-photo-btn" onClick={() => input.current?.click()} aria-label="Trocar foto" disabled={busy === 'photo'}>
            <Avatar name={name || user.email} url={photo} large />
            <span className="profile-photo-badge">
              <Camera size={16} />
            </span>
          </button>
          <div className="share-actions" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => input.current?.click()} disabled={busy === 'photo'}>
              <Camera size={15} /> {busy === 'photo' ? 'Enviando…' : photo ? 'Trocar foto' : 'Adicionar foto'}
            </button>
            {photo && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                disabled={busy === 'photo'}
                onClick={async () => {
                  setBusy('photo')
                  try {
                    await api.removeAvatar()
                    setPhoto(null)
                    onSaved('Foto removida')
                  } catch (err) {
                    setError((err as Error).message)
                  } finally {
                    setBusy(null)
                  }
                }}
              >
                <Trash2 size={15} /> Remover
              </button>
            )}
          </div>
          <input ref={input} id="profile-photo" type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        </div>

        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!name.trim()) return setError('Digite seu nome.')
            setBusy('name')
            setError('')
            try {
              await api.updateProfileName(name.trim())
              onSaved('Perfil atualizado')
              onClose()
            } catch (err) {
              setError((err as Error).message)
            } finally {
              setBusy(null)
            }
          }}
        >
          <Field label="Seu nome" hint="É assim que os outros motoristas veem você nos lançamentos e no acerto.">
            <input id="profile-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
          <Field label="E-mail">
            <input id="profile-email" className="input" value={user.email} disabled />
          </Field>
          {error && <div className="error">{error}</div>}
          <button className="btn btn-block" disabled={busy !== null}>
            {busy === 'name' ? 'Salvando…' : 'Salvar'}
          </button>
        </form>
      </div>
    </Sheet>
  )
}
