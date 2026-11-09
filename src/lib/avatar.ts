import type { AvatarKind } from '../types'

// Personagens ilustrados da VitraCar. O valor salvo no cliente (avatar_kind)
// indica gênero e opção: 'male' / 'male-2' e 'female' / 'female-2'.
export const AVATAR_OPTIONS: Record<'male' | 'female', AvatarKind[]> = {
  male: ['male', 'male-2'],
  female: ['female', 'female-2'],
}
const FILES: Record<AvatarKind, string> = {
  'male': '/avatars/male-1.webp',
  'male-2': '/avatars/male-2.webp',
  'female': '/avatars/female-1.webp',
  'female-2': '/avatars/female-2.webp',
}
export const genderOf = (kind: AvatarKind): 'male' | 'female' => kind.startsWith('female') ? 'female' : 'male'
export const avatarUri = (kind: AvatarKind) => FILES[kind] || FILES.male
