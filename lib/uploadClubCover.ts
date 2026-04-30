import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { supabase } from './supabase'

export async function pickAndUploadClubCover(
  clubId: string,
  source: 'camera' | 'library' = 'library',
): Promise<string | null> {
  const pickerOptions = { allowsEditing: true, aspect: [16, 9] as [number, number], quality: 1 as const }

  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(pickerOptions)
    : await ImagePicker.launchImageLibraryAsync({
        ...pickerOptions,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      })

  if (result.canceled) {
    console.log('[cover] picker canceled')
    return null
  }

  const asset = result.assets[0]
  console.log('[cover] asset uri:', asset.uri, 'type:', asset.type)

  const manipResult = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  )
  console.log('[cover] manipulated uri:', manipResult.uri)

  const response = await fetch(manipResult.uri)
  const blob = await response.blob()
  console.log('[cover] blob size:', blob.size, 'type:', blob.type)

  const path = `clubs/${clubId}/cover.jpg`
  console.log('[cover] uploading to path:', path)

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('club-covers')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })

  console.log('[cover] upload result data:', JSON.stringify(uploadData))
  console.log('[cover] upload error:', JSON.stringify(uploadError))

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

  const { data } = supabase.storage.from('club-covers').getPublicUrl(path)
  console.log('[cover] public URL:', data.publicUrl)

  const { error: updateError } = await supabase
    .from('clubs')
    .update({ cover_image_url: data.publicUrl })
    .eq('id', clubId)

  console.log('[cover] DB update error:', JSON.stringify(updateError))
  if (updateError) throw new Error(`DB update failed: ${updateError.message}`)

  console.log('[cover] upload complete, returning local uri for immediate display')
  // return the local file URI so expo-image can display it immediately in-session
  // the DB stores the clean remote URL (data.publicUrl) for access after app restart
  return manipResult.uri
}
