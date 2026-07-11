/**
 * BCN-CFG-002 Wizard — Step 1: pick the merchant whose beacons need
 * first-config. Reuses merchantsApi.listByAgent() (already centralised
 * in salesAgentApi.ts).
 *
 * Reference: BLE-project/ble-platform-docs#186
 */
import { useMemo, useState } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { FormattedMessage, useIntl } from 'react-intl'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { merchantsApi, type MerchantSummary } from '../../../src/api/salesAgentApi'
import { setMerchant } from '../../../src/wizard/wizardState'
import { TOKENS, spacing, radius } from '../../../src/theme/defaults/tokens'
import { typography } from '../../../src/theme/typography'

// Redesign «La Piazza» C4 (2026-07-11): solo restyle token/font — testID
// wizard-merchant-search / wizard-merchant-{id} e copy i18n INVARIATI.
const P = TOKENS.colors.surface

export default function WizardStep1Merchant() {
  const router = useRouter()
  const intl = useIntl()
  const [filter, setFilter] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['wizard', 'merchants'],
    queryFn:  merchantsApi.listByAgent,
  })

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase()
    if (!f) return data ?? []
    return (data ?? []).filter((m: MerchantSummary) =>
      m.businessName.toLowerCase().includes(f) || m.id.toLowerCase().includes(f),
    )
  }, [data, filter])

  function pick(m: MerchantSummary) {
    setMerchant(m.id, m.businessName)
    router.push('/(app)/wizard/step-2-scan' as never)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}><FormattedMessage id="wizard.step1.title" /></Text>
      <Text style={styles.subtitle}>
        <FormattedMessage id="wizard.step1.subtitle" />
      </Text>

      <TextInput
        style={styles.search}
        placeholder={intl.formatMessage({ id: 'wizard.step1.search_placeholder' })}
        value={filter}
        onChangeText={setFilter}
        autoCapitalize="none"
        testID="wizard-merchant-search"
      />

      {isLoading && <ActivityIndicator style={{ marginTop: 16 }} />}
      {error && <Text style={styles.error}><FormattedMessage id="wizard.error" values={{ reason: error.message }} /></Text>}

      <FlatList
        data={filtered}
        keyExtractor={m => m.id}
        ListEmptyComponent={isLoading ? null : <Text style={styles.muted}><FormattedMessage id="wizard.step1.no_merchants" /></Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => pick(item)}
            testID={`wizard-merchant-${item.id}`}
          >
            {/* D2 (gap BFF #84): campi potenzialmente assenti → fallback '—' */}
            <Text style={styles.rowName}>{item.businessName ?? '—'}</Text>
            <Text style={styles.rowMeta}>{item.id.substring(0, 8)}… · {item.status ?? '—'}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.base, padding: spacing.s4 },
  title:     { ...typography.displayL, color: P.ink },
  subtitle:  { ...typography.bodyS, fontSize: 13, color: P.inkSoft, marginTop: spacing.s1, marginBottom: spacing.s3 },
  search:    {
    ...typography.bodyM, borderWidth: 1, borderColor: P.line, borderRadius: radius.m,
    backgroundColor: P.surface, color: P.ink,
    paddingHorizontal: spacing.s3, paddingVertical: spacing.s3, marginBottom: spacing.s3,
  },
  row:       { paddingVertical: spacing.s3, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.line },
  rowName:   { ...typography.titleM, fontSize: 15, color: P.ink },
  rowMeta:   { fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, color: P.inkSoft, marginTop: 2 },
  error:     { ...typography.bodyM, color: TOKENS.colors.semantic.danger, marginTop: spacing.s3 },
  muted:     { ...typography.bodyM, color: P.inkSoft, textAlign: 'center', marginTop: spacing.s6 },
})
