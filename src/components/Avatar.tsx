import { initials } from '../lib/format'

// Foto de perfil, ou as iniciais quando a pessoa ainda não colocou foto
export function Avatar({ name, url, small, large }: { name: string; url?: string | null; small?: boolean; large?: boolean }) {
  const cls = `avatar${small ? ' avatar-sm' : ''}${large ? ' avatar-lg' : ''}`
  if (url) return <img className={`${cls} avatar-img`} src={url} alt="" loading="lazy" />
  return <span className={cls}>{initials(name)}</span>
}
