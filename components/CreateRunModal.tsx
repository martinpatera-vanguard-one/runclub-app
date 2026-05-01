import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  Modal,
} from 'react-native'
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps'
import { Picker } from '@react-native-picker/picker'
import * as Location from 'expo-location'
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronLeft, ChevronRight, MapPin, X } from 'lucide-react-native'
import { COLORS } from '../constants/theme'
import { supabase } from '../lib/supabase'

const SCREEN_HEIGHT = Dimensions.get('window').height

const RUN_TYPES = [
  { key: 'longrun', label: 'Dlouhý běh' },
  { key: 'tempo', label: 'Tempo' },
  { key: 'interval', label: 'Interval' },
  { key: 'sprint', label: 'Sprint' },
  { key: 'recovery', label: 'Regenerační' },
  { key: 'fartlek', label: 'Fartlek' },
]

const DAY_LABELS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']

const TIME_SLOTS: string[] = []
for (let h = 0; h < 24; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`)
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`)
}

const DIST_LEFT = Array.from({ length: 201 }, (_, i) => String(i))
const DIST_RIGHT = ['0', '5']
const PACE_LEFT = ['', ...Array.from({ length: 98 }, (_, i) => String(i + 3))]
const PACE_RIGHT = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

type AdminClub = { id: string; name: string }

type Props = {
  visible: boolean
  adminClubs: AdminClub[]
  onClose: () => void
  onCreated: () => void
  mode?: 'club' | 'public'
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDisplayDate(d: Date) {
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })
}

function getMondayOffset(year: number, month: number): number {
  // 0 = Monday … 6 = Sunday
  const firstDay = new Date(year, month, 1).getDay()
  return (firstDay + 6) % 7
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

// ─── Calendar picker ──────────────────────────────────────────────────────────

type CalendarPickerProps = {
  visible: boolean
  selected: Date
  onSelect: (d: Date) => void
  onClose: () => void
}

function CalendarPicker({ visible, selected, onSelect, onClose }: CalendarPickerProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [viewYear, setViewYear] = useState(selected.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected.getMonth())

  useEffect(() => {
    if (visible) {
      setViewYear(selected.getFullYear())
      setViewMonth(selected.getMonth())
    }
  }, [visible])

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const offset = getMondayOffset(viewYear, viewMonth)
  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('cs-CZ', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={cal.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={cal.sheet}>
            {/* Month navigation */}
            <View style={cal.header}>
              <TouchableOpacity onPress={prevMonth} style={cal.navBtn}>
                <ChevronLeft size={18} color={COLORS.text} strokeWidth={2} />
              </TouchableOpacity>
              <Text style={cal.monthLabel}>{monthLabel}</Text>
              <TouchableOpacity onPress={nextMonth} style={cal.navBtn}>
                <ChevronRight size={18} color={COLORS.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Day headers */}
            <View style={cal.weekRow}>
              {DAY_LABELS.map((d) => (
                <Text key={d} style={cal.dayHeader}>{d}</Text>
              ))}
            </View>

            {/* Day grid */}
            {Array.from({ length: cells.length / 7 }, (_, week) => (
              <View key={week} style={cal.weekRow}>
                {cells.slice(week * 7, week * 7 + 7).map((day, col) => {
                  if (day === null) return <View key={col} style={cal.dayCell} />
                  const cellDate = new Date(viewYear, viewMonth, day)
                  cellDate.setHours(0, 0, 0, 0)
                  const isPast = cellDate < today
                  const isToday = cellDate.getTime() === today.getTime()
                  const isSelected = isoDate(cellDate) === isoDate(selected)
                  return (
                    <TouchableOpacity
                      key={col}
                      style={[
                        cal.dayCell,
                        isToday && !isSelected && cal.dayCellToday,
                        isSelected && cal.dayCellSelected,
                      ]}
                      onPress={() => {
                        if (isPast) return
                        onSelect(cellDate)
                        onClose()
                      }}
                      disabled={isPast}
                    >
                      <Text
                        style={[
                          cal.dayText,
                          isPast && cal.dayTextPast,
                          isToday && !isSelected && cal.dayTextToday,
                          isSelected && cal.dayTextSelected,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            ))}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

// ─── Time picker ──────────────────────────────────────────────────────────────

type TimePickerProps = {
  visible: boolean
  selected: string
  onSelect: (t: string) => void
  onClose: () => void
}

function TimePicker({ visible, selected, onSelect, onClose }: TimePickerProps) {
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    if (visible) {
      const idx = TIME_SLOTS.indexOf(selected)
      const target = Math.max(0, idx - 3)
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: target * 48, animated: false })
      }, 50)
    }
  }, [visible, selected])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={tp.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={tp.sheet}>
            <Text style={tp.title}>Čas začátku</Text>
            <ScrollView
              ref={scrollRef}
              style={tp.scroll}
              showsVerticalScrollIndicator={false}
            >
              {TIME_SLOTS.map((slot) => {
                const active = slot === selected
                return (
                  <TouchableOpacity
                    key={slot}
                    style={[tp.item, active && tp.itemActive]}
                    onPress={() => { onSelect(slot); onClose() }}
                  >
                    <Text style={[tp.itemText, active && tp.itemTextActive]}>{slot}</Text>
                    {active && <Check size={16} color={COLORS.accent} strokeWidth={2.5} />}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

// ─── Split picker (native iOS wheel) ─────────────────────────────────────────

type SplitPickerProps = {
  visible: boolean
  title: string
  leftItems: string[]
  rightItems: string[]
  leftSelected: string
  rightSelected: string
  separator: string
  suffix: string
  leftAnyLabel?: string
  onLeftSelect: (v: string) => void
  onRightSelect: (v: string) => void
  onClose: () => void
}

function SplitPicker({ visible, title, leftItems, rightItems, leftSelected, rightSelected, separator, suffix, leftAnyLabel, onLeftSelect, onRightSelect, onClose }: SplitPickerProps) {
  if (!visible) return null
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={sp.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={sp.sheet}>
          <View style={sp.header}>
            <Text style={sp.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={sp.done}>Hotovo</Text>
            </TouchableOpacity>
          </View>
          <View style={sp.columns}>
            <Picker
              selectedValue={leftSelected}
              onValueChange={(v) => onLeftSelect(String(v))}
              style={sp.picker}
              itemStyle={sp.pickerItem}
            >
              {leftItems.map((item) => (
                <Picker.Item key={item} label={item === '' && leftAnyLabel ? leftAnyLabel : item} value={item} />
              ))}
            </Picker>
            <Text style={sp.sep}>{separator}</Text>
            <Picker
              selectedValue={rightSelected}
              onValueChange={(v) => onRightSelect(String(v))}
              style={sp.picker}
              itemStyle={sp.pickerItem}
            >
              {rightItems.map((item) => (
                <Picker.Item key={item} label={item} value={item} />
              ))}
            </Picker>
            <Text style={sp.suffixLabel}>{suffix}</Text>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function CreateRunModal({ visible, adminClubs, onClose, onCreated, mode = 'club' }: Props) {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current

  const [selectedClubId, setSelectedClubId] = useState('')
  const [showClubPicker, setShowClubPicker] = useState(false)
  const [title, setTitle] = useState('')
  const [runType, setRunType] = useState('')
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [distLeft, setDistLeft] = useState('10')
  const [distRight, setDistRight] = useState('0')
  const [paceLeft, setPaceLeft] = useState('5')
  const [paceRight, setPaceRight] = useState('30')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedTime, setSelectedTime] = useState('07:00')
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [showDistPicker, setShowDistPicker] = useState(false)
  const [showPacePicker, setShowPacePicker] = useState(false)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [creating, setCreating] = useState(false)

  const [mapVisible, setMapVisible] = useState(false)
  const [mapRegion, setMapRegion] = useState({
    latitude: 50.094,
    longitude: 14.4295,
    latitudeDelta: 0.045,
    longitudeDelta: 0.045,
  })
  const [pendingLat, setPendingLat] = useState<number | null>(null)
  const [pendingLng, setPendingLng] = useState<number | null>(null)
  const [pendingAddress, setPendingAddress] = useState('')
  const [geocoding, setGeocoding] = useState(false)

  useEffect(() => {
    if (visible) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)
      setTitle('')
      setRunType('')
      setDistLeft('10')
      setDistRight('0')
      setPaceLeft('')
      setPaceRight('30')
      setSelectedDate(tomorrow)
      setSelectedTime('07:00')
      setLat(null)
      setLng(null)
      setAddress('')
      setNote('')
      setSelectedClubId(adminClubs.length === 1 ? adminClubs[0].id : '')

      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start()

      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then((loc) => {
          setMapRegion((r) => ({
            ...r,
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          }))
        })
        .catch(() => {})
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start()
    }
  }, [visible, adminClubs])

  const selectedClub = adminClubs.find((c) => c.id === selectedClubId)

  const canSubmit = mode === 'public'
    ? !!title.trim() && !!runType && lat !== null && lng !== null && !creating
    : !!title.trim() && !!runType && !!selectedClubId && lat !== null && lng !== null && !creating

  async function handleMapPress(coordinate: { latitude: number; longitude: number }) {
    setPendingLat(coordinate.latitude)
    setPendingLng(coordinate.longitude)
    setGeocoding(true)
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      })
      if (results.length > 0) {
        const r = results[0]
        setPendingAddress([r.street, r.name, r.city].filter(Boolean).join(', '))
      } else {
        setPendingAddress('')
      }
    } catch {
      setPendingAddress('')
    } finally {
      setGeocoding(false)
    }
  }

  function confirmMapLocation() {
    if (pendingLat === null || pendingLng === null) return
    setLat(pendingLat)
    setLng(pendingLng)
    setAddress(pendingAddress)
    setMapVisible(false)
  }

  function openMapPicker() {
    setPendingLat(lat)
    setPendingLng(lng)
    setPendingAddress(address)
    setMapVisible(true)
  }

  async function handleCreate() {
    if (!canSubmit) return
    const trimmedTitle = title.trim()
    if (trimmedTitle.length < 2) {
      Alert.alert('Chyba', 'Název běhu musí mít alespoň 2 znaky.')
      return
    }
    if (trimmedTitle.length > 80) {
      Alert.alert('Chyba', 'Název běhu může mít nejvýše 80 znaků.')
      return
    }
    const trimmedNote = note.trim()
    if (trimmedNote.length > 500) {
      Alert.alert('Chyba', 'Poznámka může mít nejvýše 500 znaků.')
      return
    }
    setCreating(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      Alert.alert('Chyba', 'Nejsi přihlášen.')
      setCreating(false)
      return
    }

    const [h, m] = selectedTime.split(':').map(Number)
    const startsAt = new Date(selectedDate)
    startsAt.setHours(h, m, 0, 0)

    const payload = {
      created_by: user.id,
      title: trimmedTitle,
      run_type: runType,
      distance_km: parseFloat(`${distLeft}.${distRight}`),
      pace_text: paceLeft === '' ? null : `${paceLeft}:${paceRight}`,
      starts_at: startsAt.toISOString(),
      lat,
      lng,
      address: address || null,
      note: trimmedNote || null,
    }

    if (mode === 'public') {
      const { data: existing } = await supabase
        .from('public_runs')
        .select('id')
        .eq('created_by', user.id)
        .gt('starts_at', new Date().toISOString())
        .limit(1)

      if (existing && existing.length > 0) {
        Alert.alert(
          'Už máš naplánovaný běh',
          'Každý může mít naplánovaný pouze jeden běh najednou. Jakmile tvůj aktuální běh proběhne, můžeš vytvořit nový.',
        )
        setCreating(false)
        return
      }
    }

    if (mode === 'public') {
      const { data: newRun, error } = await supabase
        .from('public_runs')
        .insert(payload)
        .select('id')
        .single()

      if (error || !newRun) {
        Alert.alert('Chyba', error?.message ?? 'Nepodařilo se vytvořit běh.')
        setCreating(false)
        return
      }

      await supabase
        .from('public_run_participants')
        .insert({ public_run_id: newRun.id, user_id: user.id })
    } else {
      const { error } = await supabase
        .from('club_runs')
        .insert({ ...payload, club_id: selectedClubId })

      if (error) {
        Alert.alert('Chyba', error.message)
        setCreating(false)
        return
      }
    }

    setCreating(false)
    onClose()
    onCreated()
  }

  if (!visible) return null

  return (
    <>
      <Animated.View style={[styles.overlay, { transform: [{ translateY: slideAnim }] }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.sheetTitle}>
                  {mode === 'club' ? 'Klubový běh' : 'Nový běh'}
                </Text>
                {mode === 'club' && selectedClub && (
                  <Text style={styles.sheetSubtitle}>{selectedClub.name}</Text>
                )}
                <View style={[styles.modeBadge, mode === 'public' && styles.modeBadgePublic]}>
                  <Text style={[styles.modeBadgeText, mode === 'public' && styles.modeBadgeTextPublic]}>
                    {mode === 'club' ? '🏃 Pro členy klubu' : '🌍 Otevřený běh'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={COLORS.muted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {adminClubs.length > 1 && (
                <>
                  <Text style={styles.label}>Klub *</Text>
                  <TouchableOpacity style={styles.picker} onPress={() => setShowClubPicker(true)}>
                    <Text style={[styles.pickerText, !selectedClubId && styles.placeholder]}>
                      {selectedClub?.name ?? 'Vyber klub…'}
                    </Text>
                    <ChevronDown size={16} color={COLORS.muted} strokeWidth={2} />
                  </TouchableOpacity>
                </>
              )}

              <Text style={styles.label}>Název běhu *</Text>
              <TextInput
                style={styles.input}
                placeholder="např. Ranní desítka"
                placeholderTextColor={COLORS.muted}
                value={title}
                onChangeText={setTitle}
                returnKeyType="next"
                maxLength={80}
              />

              <Text style={styles.label}>Typ běhu *</Text>
              <TouchableOpacity style={styles.picker} onPress={() => setShowTypePicker(true)}>
                <Text style={[styles.pickerText, !runType && styles.placeholder]}>
                  {runType ? RUN_TYPES.find((t) => t.key === runType)?.label : 'Vyber typ…'}
                </Text>
                <ChevronDown size={16} color={COLORS.muted} strokeWidth={2} />
              </TouchableOpacity>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Vzdálenost (km)</Text>
                  <TouchableOpacity style={styles.picker} onPress={() => setShowDistPicker(true)}>
                    <Text style={styles.pickerText}>{distLeft},{distRight} km</Text>
                    <ChevronDown size={16} color={COLORS.muted} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Tempo (min/km)</Text>
                  <TouchableOpacity style={styles.picker} onPress={() => setShowPacePicker(true)}>
                    <Text style={styles.pickerText}>
                      {paceLeft === '' ? 'Libovolné' : `${paceLeft}:${paceRight} /km`}
                    </Text>
                    <ChevronDown size={16} color={COLORS.muted} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Date + time in one row */}
              <View style={styles.row}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.label}>Datum *</Text>
                  <TouchableOpacity
                    style={styles.picker}
                    onPress={() => setShowCalendar(true)}
                  >
                    <Text style={styles.pickerText}>{formatDisplayDate(selectedDate)}</Text>
                    <ChevronDown size={16} color={COLORS.muted} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Čas *</Text>
                  <TouchableOpacity
                    style={styles.picker}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Text style={styles.pickerText}>{selectedTime}</Text>
                    <ChevronDown size={16} color={COLORS.muted} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.label}>Místo startu *</Text>
              <TouchableOpacity style={styles.picker} onPress={openMapPicker}>
                <MapPin
                  size={16}
                  color={lat !== null ? COLORS.accent : COLORS.muted}
                  strokeWidth={2}
                />
                <Text
                  style={[styles.pickerText, lat === null && styles.placeholder]}
                  numberOfLines={1}
                >
                  {lat !== null
                    ? address || `${lat.toFixed(5)}, ${lng?.toFixed(5)}`
                    : 'Vyber na mapě…'}
                </Text>
                <ChevronDown size={16} color={COLORS.muted} strokeWidth={2} />
              </TouchableOpacity>

              <Text style={styles.label}>Poznámka (volitelné)</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="např. Sraz u fontány, přineste reflexní vestu…"
                placeholderTextColor={COLORS.muted}
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={3}
                returnKeyType="done"
                maxLength={500}
              />

              <TouchableOpacity
                style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
                onPress={handleCreate}
                disabled={!canSubmit}
              >
                {creating ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Vytvořit běh</Text>
                )}
              </TouchableOpacity>

              <View style={{ height: 8 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>

      {/* Calendar picker */}
      <CalendarPicker
        visible={showCalendar}
        selected={selectedDate}
        onSelect={setSelectedDate}
        onClose={() => setShowCalendar(false)}
      />

      {/* Time picker */}
      <TimePicker
        visible={showTimePicker}
        selected={selectedTime}
        onSelect={setSelectedTime}
        onClose={() => setShowTimePicker(false)}
      />

      {/* Distance picker */}
      <SplitPicker
        visible={showDistPicker}
        title="Vzdálenost"
        leftItems={DIST_LEFT}
        rightItems={DIST_RIGHT}
        leftSelected={distLeft}
        rightSelected={distRight}
        separator=","
        suffix="km"
        onLeftSelect={setDistLeft}
        onRightSelect={setDistRight}
        onClose={() => setShowDistPicker(false)}
      />

      {/* Pace picker */}
      <SplitPicker
        visible={showPacePicker}
        title="Tempo (min/km)"
        leftItems={PACE_LEFT}
        rightItems={PACE_RIGHT}
        leftSelected={paceLeft}
        rightSelected={paceRight}
        separator=":"
        suffix="/km"
        leftAnyLabel="Volné"
        onLeftSelect={setPaceLeft}
        onRightSelect={setPaceRight}
        onClose={() => setShowPacePicker(false)}
      />

      {/* Run type picker */}
      <Modal
        visible={showTypePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTypePicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowTypePicker(false)}
        >
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerSheetTitle}>Typ běhu</Text>
            {RUN_TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.pickerOption, runType === t.key && styles.pickerOptionActive]}
                onPress={() => { setRunType(t.key); setShowTypePicker(false) }}
              >
                <Text style={[styles.pickerOptionText, runType === t.key && styles.pickerOptionTextActive]}>
                  {t.label}
                </Text>
                {runType === t.key && <Check size={16} color={COLORS.accent} strokeWidth={2.5} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Club picker */}
      <Modal
        visible={showClubPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClubPicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowClubPicker(false)}
        >
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerSheetTitle}>Vyber klub</Text>
            {adminClubs.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.pickerOption, selectedClubId === c.id && styles.pickerOptionActive]}
                onPress={() => { setSelectedClubId(c.id); setShowClubPicker(false) }}
              >
                <Text style={[styles.pickerOptionText, selectedClubId === c.id && styles.pickerOptionTextActive]}>
                  {c.name}
                </Text>
                {selectedClubId === c.id && <Check size={16} color={COLORS.accent} strokeWidth={2.5} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Map picker — full screen */}
      <Modal visible={mapVisible} animationType="slide" onRequestClose={() => setMapVisible(false)}>
        <View style={styles.mapContainer}>
          <View style={styles.mapTopBar}>
            <TouchableOpacity style={styles.mapBackBtn} onPress={() => setMapVisible(false)}>
              <X size={20} color={COLORS.text} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.mapTitle}>Místo startu</Text>
            <TouchableOpacity
              style={[styles.mapConfirmBtn, pendingLat === null && styles.mapConfirmBtnDisabled]}
              onPress={confirmMapLocation}
              disabled={pendingLat === null}
            >
              <Text style={styles.mapConfirmText}>Potvrdit</Text>
            </TouchableOpacity>
          </View>

          <MapView
            style={{ flex: 1 }}
            provider={PROVIDER_DEFAULT}
            region={mapRegion}
            onRegionChangeComplete={setMapRegion}
            showsUserLocation
            onPress={(e) => handleMapPress(e.nativeEvent.coordinate)}
          >
            {pendingLat !== null && pendingLng !== null && (
              <Marker
                coordinate={{ latitude: pendingLat, longitude: pendingLng }}
                pinColor={COLORS.accent}
              />
            )}
          </MapView>

          <View style={styles.mapBottomHint}>
            {geocoding ? (
              <ActivityIndicator size="small" color={COLORS.accent} />
            ) : pendingLat !== null ? (
              <Text style={styles.mapHintText} numberOfLines={2}>
                {pendingAddress || `${pendingLat.toFixed(5)}, ${pendingLng?.toFixed(5)}`}
              </Text>
            ) : (
              <Text style={styles.mapHintPlaceholder}>Klepni na mapu pro výběr místa startu</Text>
            )}
          </View>
        </View>
      </Modal>
    </>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 50,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: SCREEN_HEIGHT * 0.9,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 16,
  },
  inputMultiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  pickerText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  placeholder: {
    color: COLORS.muted,
  },
  row: {
    flexDirection: 'row',
  },
  submitBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    padding: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 8,
    paddingBottom: 40,
  },
  pickerSheetTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
    textAlign: 'center',
    paddingVertical: 10,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
  },
  pickerOptionActive: {
    backgroundColor: COLORS.accentSoft,
  },
  pickerOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  pickerOptionTextActive: {
    color: COLORS.accent,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  mapTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  mapBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  mapConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 20,
  },
  mapConfirmBtnDisabled: {
    opacity: 0.4,
  },
  mapConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  mapBottomHint: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    alignItems: 'center',
  },
  mapHintText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  mapHintPlaceholder: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
  },
  modeBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: COLORS.accentSoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modeBadgePublic: {
    backgroundColor: '#E8F4FD',
  },
  modeBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.accent,
  },
  modeBadgeTextPublic: {
    color: '#2E7DB8',
  },
})

const cal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    width: Dimensions.get('window').width - 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    textTransform: 'capitalize',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
    paddingBottom: 8,
    textTransform: 'uppercase',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 100,
    margin: 1,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: COLORS.accent,
  },
  dayCellSelected: {
    backgroundColor: COLORS.accent,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  dayTextPast: {
    color: COLORS.border,
  },
  dayTextToday: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  dayTextSelected: {
    color: '#FFF',
    fontWeight: '700',
  },
})

const sp = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  done: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.accent,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  picker: {
    flex: 1,
    height: 200,
  },
  pickerItem: {
    fontSize: 22,
    color: COLORS.text,
    height: 200,
  },
  sep: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  suffixLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.muted,
    width: 36,
    marginLeft: 4,
  },
})

const tp = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
    textAlign: 'center',
    paddingVertical: 10,
  },
  scroll: {
    maxHeight: 280,
  },
  item: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: 8,
  },
  itemActive: {
    backgroundColor: COLORS.accentSoft,
  },
  itemText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  itemTextActive: {
    color: COLORS.accent,
    fontWeight: '700',
  },
})
