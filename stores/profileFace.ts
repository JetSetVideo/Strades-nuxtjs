import { defineStore } from 'pinia'
import { ref } from 'vue'

const KEY = 'strades_profile_face_v1'
const MAX_BYTES = 1_500_000

/**
 * Name, @ handle, and picture the desk publishes.
 * Kept in this browser. A paid desk can publish the @ name alone.
 */
export const useProfileFaceStore = defineStore('profileFace', () => {
  const displayName = ref('')
  const handle = ref('')
  const hideRealName = ref(false)
  const avatarDataUrl = ref<string | null>(null)
  const hydrated = ref(false)
  const note = ref('')

  function persist() {
    if (!import.meta.client) return
    try {
      localStorage.setItem(KEY, JSON.stringify({
        displayName: displayName.value,
        handle: handle.value,
        hideRealName: hideRealName.value,
        avatarDataUrl: avatarDataUrl.value,
      }))
      note.value = ''
    } catch {
      note.value = 'This browser could not store the picture. Try a smaller file.'
    }
  }

  function hydrate() {
    if (hydrated.value || !import.meta.client) return
    hydrated.value = true
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<{
        displayName: string
        handle: string
        hideRealName: boolean
        avatarDataUrl: string | null
      }>
      displayName.value = String(parsed.displayName || '')
      handle.value = String(parsed.handle || '').replace(/^@/, '')
      hideRealName.value = !!parsed.hideRealName
      avatarDataUrl.value = typeof parsed.avatarDataUrl === 'string' ? parsed.avatarDataUrl : null
    } catch {
      note.value = ''
    }
  }

  function setDisplayName(value: string) {
    displayName.value = value.trim()
    persist()
  }

  function setHandle(value: string) {
    handle.value = value.trim().replace(/^@/, '').replace(/\s+/g, '')
    persist()
  }

  function setHideRealName(value: boolean) {
    hideRealName.value = value
    persist()
  }

  function setAvatar(file: File) {
    if (!file.type.startsWith('image/')) {
      note.value = 'Choose an image.'
      return
    }
    if (file.size > MAX_BYTES) {
      note.value = 'Picture needs to stay under 1.5 MB.'
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      avatarDataUrl.value = typeof reader.result === 'string' ? reader.result : null
      persist()
    }
    reader.readAsDataURL(file)
  }

  function clearAvatar() {
    avatarDataUrl.value = null
    persist()
  }

  return {
    displayName,
    handle,
    hideRealName,
    avatarDataUrl,
    hydrated,
    note,
    hydrate,
    setDisplayName,
    setHandle,
    setHideRealName,
    setAvatar,
    clearAvatar,
  }
})
