/**
 * FU-51: Unit tests for the beacon-config wizard state singleton
 * (BCN-CFG-002). The module is a deliberately tiny mutable singleton, so
 * these tests exercise every mutator + the reset/upsert edge cases.
 */
import {
  getWizardState,
  setMerchant,
  setBeacons,
  setScanResults,
  upsertScanResult,
  setSnapshotId,
  resetWizard,
} from './wizardState'
import type { ScanResult, BeaconSummary } from '../api/beaconHealthApi'

const beacon = (id: string): BeaconSummary => ({
  id, ibeaconUuid: `uuid-${id}`, major: 1, minor: 1,
})
const scan = (beaconId: string, pass: boolean): ScanResult => ({
  beaconId, detected: pass, pass,
})

afterEach(() => resetWizard())

describe('wizardState mutators', () => {
  it('starts empty', () => {
    const s = getWizardState()
    expect(s).toEqual({
      merchantId: null, merchantName: null,
      beacons: [], scanResults: [], snapshotId: null,
    })
  })

  it('setMerchant() records id + name and clears downstream state', () => {
    setBeacons([beacon('b-1')])
    setScanResults([scan('b-1', true)])
    setSnapshotId('snap-old')

    setMerchant('m-9', 'Bar Centrale')
    const s = getWizardState()
    expect(s.merchantId).toBe('m-9')
    expect(s.merchantName).toBe('Bar Centrale')
    // selecting a new merchant must wipe stale beacon/scan/snapshot data
    expect(s.beacons).toEqual([])
    expect(s.scanResults).toEqual([])
    expect(s.snapshotId).toBeNull()
  })

  it('setBeacons() replaces the beacon list', () => {
    setBeacons([beacon('b-1'), beacon('b-2')])
    expect(getWizardState().beacons.map(b => b.id)).toEqual(['b-1', 'b-2'])
  })

  it('setScanResults() replaces the scan list', () => {
    setScanResults([scan('b-1', true)])
    setScanResults([scan('b-2', false)])
    expect(getWizardState().scanResults.map(r => r.beaconId)).toEqual(['b-2'])
  })

  it('setSnapshotId() stores and can clear the snapshot id', () => {
    setSnapshotId('snap-1')
    expect(getWizardState().snapshotId).toBe('snap-1')
    setSnapshotId(null)
    expect(getWizardState().snapshotId).toBeNull()
  })
})

describe('upsertScanResult', () => {
  it('appends a result when the beacon is not yet present', () => {
    upsertScanResult(scan('b-1', true))
    upsertScanResult(scan('b-2', false))
    expect(getWizardState().scanResults).toHaveLength(2)
  })

  it('replaces the existing result for the same beacon (no duplicate)', () => {
    upsertScanResult(scan('b-1', false))
    upsertScanResult(scan('b-1', true))
    const results = getWizardState().scanResults
    expect(results).toHaveLength(1)
    expect(results[0].pass).toBe(true)
  })
})

describe('resetWizard', () => {
  it('returns all fields to their initial empty values', () => {
    setMerchant('m-1', 'X')
    setBeacons([beacon('b-1')])
    setScanResults([scan('b-1', true)])
    setSnapshotId('snap-1')

    resetWizard()
    expect(getWizardState()).toEqual({
      merchantId: null, merchantName: null,
      beacons: [], scanResults: [], snapshotId: null,
    })
  })
})
