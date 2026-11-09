import type { AvatarKind } from '../types'

// Personagens ilustrados da VitraCar: dois masculinos e dois femininos.
// Cada cliente recebe um deles conforme o nome (sempre o mesmo para o mesmo nome).
const AVATARS: Record<AvatarKind, string[]> = {
  male: ['/avatars/male-1.webp', '/avatars/male-2.webp'],
  female: ['/avatars/female-1.webp', '/avatars/female-2.webp'],
}

export function avatarUri(name: string, kind: AvatarKind) {
  const key = name.trim().toLowerCase()
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  const list = AVATARS[kind] || AVATARS.male
  return list[h % list.length]
}
