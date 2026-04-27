import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Send } from 'lucide-react-native'
import { useState } from 'react'
import { COLORS } from '../../constants/theme'

const MESSAGES = [
  { id: 1, author: 'M', text: 'Dorazte, vezmu sebe i pejska 🐕', own: false, bg: COLORS.accentSoft, color: COLORS.accent },
  { id: 2, author: 'K', text: 'Mám rezervaci na stůl pro 8!', own: false, bg: '#E8F4FF', color: '#3B82F6' },
  { id: 3, author: 'Ty', text: 'Super, za 20 min tam budu', own: true, bg: COLORS.accent, color: '#FFF' },
  { id: 4, author: 'J', text: 'Kdo chce kafe? Já objednávám 😄', own: false, bg: '#F0FFF4', color: '#22C55E' },
]

export default function AfterRunScreen() {
  const [message, setMessage] = useState('')

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>After-run ☕</Text>
            <Text style={styles.subtitle}>Letňáci · Dnes 18:30</Text>
          </View>

          {/* Recommended spot */}
          <View style={styles.spotCard}>
            <View style={styles.spotDecor} />
            <Text style={styles.spotBadge}>⭐ Doporučené místo</Text>
            <Text style={styles.spotName}>Café Letná</Text>
            <Text style={styles.spotDesc}>
              Teplé nápoje, terasa, parkování kol. 5 min od cíle.
            </Text>
            <View style={styles.spotActions}>
              <TouchableOpacity style={[styles.spotBtn, styles.spotBtnPrimary]}>
                <Text style={styles.spotBtnText}>Navigovat</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.spotBtn}>
                <Text style={styles.spotBtnText}>Sdílet</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Chat */}
          <View style={styles.chatSection}>
            <Text style={styles.chatTitle}>Live chat skupiny</Text>

            {MESSAGES.map((msg) => (
              <View key={msg.id} style={[styles.chatMsg, msg.own && styles.chatMsgOwn]}>
                <View style={[styles.chatAvatar, { backgroundColor: msg.bg }]}>
                  <Text style={[styles.chatAvatarText, { color: msg.color }]}>{msg.author}</Text>
                </View>
                <View
                  style={[
                    styles.chatBubble,
                    msg.own ? styles.chatBubbleOwn : styles.chatBubbleOther,
                  ]}
                >
                  <Text style={[styles.chatText, msg.own && styles.chatTextOwn]}>{msg.text}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ height: 16 }} />
        </ScrollView>

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Napiš zprávu…"
            placeholderTextColor={COLORS.muted}
            value={message}
            onChangeText={setMessage}
          />
          <TouchableOpacity style={styles.sendBtn}>
            <Send size={16} color="#FFF" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 3,
  },
  spotCard: {
    backgroundColor: COLORS.text,
    borderRadius: 22,
    marginHorizontal: 16,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  spotDecor: {
    position: 'absolute',
    bottom: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,69,0,0.15)',
  },
  spotBadge: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: COLORS.accent,
    marginBottom: 6,
  },
  spotName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
  },
  spotDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    lineHeight: 18,
  },
  spotActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  spotBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  spotBtnPrimary: {
    backgroundColor: COLORS.accent,
  },
  spotBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  chatSection: {
    padding: 16,
    paddingBottom: 0,
  },
  chatTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 14,
  },
  chatMsg: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 10,
  },
  chatMsgOwn: {
    flexDirection: 'row-reverse',
  },
  chatAvatar: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chatAvatarText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chatBubble: {
    borderRadius: 16,
    padding: 10,
    maxWidth: '65%',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  chatBubbleOther: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
  },
  chatBubbleOwn: {
    backgroundColor: COLORS.accent,
    borderBottomRightRadius: 4,
  },
  chatText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  chatTextOwn: {
    color: '#FFF',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 4,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    paddingVertical: 6,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
