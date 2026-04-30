import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { supabase } from './supabase'

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function pickAndUploadAvatar(
  userId: string,
  source: 'camera' | 'library' = 'library',
): Promise<string | null> {
  const pickerOptions = { allowsEditing: true, aspect: [1, 1] as [number, number], quality: 1 as const }

  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(pickerOptions)
    : await ImagePicker.launchImageLibraryAsync({
        ...pickerOptions,
        mediaTypes: ['images'] as ImagePicker.MediaType[],
      })

  if (result.canceled) return null

  const asset = result.assets[0]

  const manipResult = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: 200 } }],
    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
  )

  const response = await fetch(manipResult.uri)
  const blob = await response.blob()
  const base64 = await blobToBase64(blob)

  const { error } = await supabase
    .from('users')
    .update({ avatar_url: base64 })
    .eq('id', userId)

  if (error) throw new Error(`DB update failed: ${error.message}`)

  return base64
}
