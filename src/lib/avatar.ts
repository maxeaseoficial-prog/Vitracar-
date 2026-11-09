import { createAvatar } from '@dicebear/core'
import { personas } from '@dicebear/collection'
import type { AvatarKind } from '../types'

// Personagens ilustrados "Personas" (Draftbit, CC BY 4.0) via DiceBear.
// O mesmo nome gera sempre o mesmo personagem; cabelo e barba seguem o gênero
// escolhido e a roupa usa as cores da marca.
const HAIR = {
  male: ['shortCombover', 'shortComboverChops', 'sideShave', 'buzzcut', 'fade', 'curlyHighTop', 'balding', 'mohawk'],
  female: ['long', 'bobCut', 'bobBangs', 'curly', 'curlyBun', 'straightBun', 'extraLong', 'pigtails', 'bunUndercut']
} as const
const cache = new Map<string, string>()

export function avatarUri(name: string, kind: AvatarKind, variant = 0) {
  const seed = `${name.trim().toLowerCase() || 'cliente'}#${variant}`
  const key = `${kind}|${seed}`
  let uri = cache.get(key)
  if (!uri) {
    uri = createAvatar(personas, {
      seed,
      hair: [...HAIR[kind]] as never,
      facialHairProbability: kind === 'male' ? 45 : 0,
      // Só expressões simpáticas, sem óculos escuros ou chupeta.
      eyes: ['open', 'happy', 'wink', 'glasses'],
      mouth: ['smile', 'bigSmile', 'smirk', ...(kind === 'female' ? ['lips'] : [])] as never,
      clothingColor: ['0131cd', '0b0d12', '456dff'],
      backgroundColor: kind === 'male' ? ['dfe6ff'] : ['f2ffd1'],
      backgroundType: ['solid'],
    }).toDataUri()
    cache.set(key, uri)
  }
  return uri
}
