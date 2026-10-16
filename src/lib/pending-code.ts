// Código de convite digitado (ou recebido por link) antes do login.
// Fica guardado até a pessoa entrar na conta; aí o app usa e apaga.
const KEY = 'autobil-pending-code'

export const normalizeCode = (c: string) => c.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6)

export function getPendingCode(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setPendingCode(code: string | null) {
  try {
    if (code) localStorage.setItem(KEY, normalizeCode(code))
    else localStorage.removeItem(KEY)
  } catch {
    /* sem armazenamento: o código vale só nesta tela */
  }
}

// Link de convite: https://app/?codigo=BYD8PT
export function captureCodeFromUrl() {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('codigo')
  if (!code) return
  setPendingCode(code)
  url.searchParams.delete('codigo')
  window.history.replaceState(null, '', url.pathname + url.search + url.hash)
}

export const inviteLink = (code: string) => `${window.location.origin}/?codigo=${code}`
