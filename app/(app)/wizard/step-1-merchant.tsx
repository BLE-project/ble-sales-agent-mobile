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
            <Text style={styles.rowName}>{item.businessName}</Text>
            <Text style={styles.rowMeta}>{item.id.substring(0, 8)}… · {item.status}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  title:     { fontSize: 22, fontWeight: '700', color: '#111827' },
  subtitle:  { fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 12 },
  search:    {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
  },
  row:       { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  rowName:   { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowMeta:   { fontSize: 12, color: '#6b7280', marginTop: 2 },
  error:     { color: '#b91c1c', marginTop: 12 },
  muted:     { color: '#6b7280', textAlign: 'center', marginTop: 24 },
})
