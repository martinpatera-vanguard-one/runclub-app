/**
 * shareStoryCard — zachytí ClubStoryCard jako PNG a sdílí přes iOS share sheet.
 *
 * STAV: připraveno, čeká na instalaci závislostí:
 *   npx expo install react-native-view-shot expo-file-system
 *
 * Až budou nainstalované, odkomentuj celý blok níže a odstraň stub.
 */

// import ViewShot, { captureRef } from 'react-native-view-shot'
// import * as FileSystem from 'expo-file-system'
// import * as Sharing from 'expo-sharing'
// import { RefObject } from 'react'

// export async function shareStoryCard(ref: RefObject<unknown>): Promise<void> {
//   // 1. Zachyť view jako PNG
//   const uri = await captureRef(ref, {
//     format: 'png',
//     quality: 1.0,
//     result: 'tmpfile',
//   })
//
//   // 2. Zkopíruj do trvalého temp souboru (expo-file-system ho umí smazat)
//   const dest = FileSystem.cacheDirectory + `runclub-story-${Date.now()}.png`
//   await FileSystem.copyAsync({ from: uri, to: dest })
//
//   // 3. Sdílej přes iOS/Android share sheet
//   const canShare = await Sharing.isAvailableAsync()
//   if (!canShare) return
//   await Sharing.shareAsync(dest, {
//     mimeType: 'image/png',
//     dialogTitle: 'Sdílet story kartu',
//   })
//
//   // 4. Úklid temp souboru po sdílení
//   await FileSystem.deleteAsync(dest, { idempotent: true })
// }

// --- TEMPORARY STUB (odstranit až odkomentujeme výše) ---
export async function shareStoryCard(_ref: unknown): Promise<void> {
  // TODO: implement — viz komentář výše
}
