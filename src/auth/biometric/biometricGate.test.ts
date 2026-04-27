/**
 * Tests for the biometric opt-in gate (mirror of consent.ts test pattern).
 *
 * Same shape as `src/ble/scanner.test.ts` exercises `consent.ts`:
 *   1. Reset module state in beforeEach
 *   2. Verify default-deny behavior
 *   3. Verify setter installation
 *   4. Verify reset cycle
 */

import {
  setBiometricGetter,
  getBiometricEnrolled,
  _resetBiometricGate,
} from './biometricGate'

describe('biometricGate', () => {
  let warnSpy: jest.SpyInstance

  beforeEach(() => {
    _resetBiometricGate()
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  describe('default-deny', () => {
    it('returns false when no getter is installed', () => {
      expect(getBiometricEnrolled()).toBe(false)
    })

    it('logs a one-shot warning the first time default-deny fires', () => {
      getBiometricEnrolled()
      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy.mock.calls[0][0]).toContain('setBiometricGetter() never called')
    })

    it('does NOT re-log on subsequent default-deny calls', () => {
      getBiometricEnrolled()
      getBiometricEnrolled()
      getBiometricEnrolled()
      expect(warnSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('setBiometricGetter', () => {
    it('installs a getter that returns true', () => {
      setBiometricGetter(() => true)
      expect(getBiometricEnrolled()).toBe(true)
    })

    it('installs a getter that returns false', () => {
      setBiometricGetter(() => false)
      expect(getBiometricEnrolled()).toBe(false)
    })

    it('does NOT log warning when a real getter is installed (even if it returns false)', () => {
      setBiometricGetter(() => false)
      getBiometricEnrolled()
      expect(warnSpy).not.toHaveBeenCalled()
    })

    it('replacing the getter changes the result', () => {
      setBiometricGetter(() => true)
      expect(getBiometricEnrolled()).toBe(true)
      setBiometricGetter(() => false)
      expect(getBiometricEnrolled()).toBe(false)
    })

    it('resetting via _resetBiometricGate clears the warned-default flag', () => {
      // Trigger default-deny warning once
      getBiometricEnrolled()
      expect(warnSpy).toHaveBeenCalledTimes(1)
      // Install real getter then go back to default — fresh warning should fire
      setBiometricGetter(() => true)
      _resetBiometricGate()
      getBiometricEnrolled()
      expect(warnSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('error handling', () => {
    it('returns false if the installed getter throws', () => {
      setBiometricGetter(() => { throw new Error('boom') })
      expect(getBiometricEnrolled()).toBe(false)
    })

    it('does NOT propagate getter exceptions', () => {
      setBiometricGetter(() => { throw new Error('boom') })
      expect(() => getBiometricEnrolled()).not.toThrow()
    })
  })

  describe('_resetBiometricGate', () => {
    it('restores default-deny after a real getter was installed', () => {
      setBiometricGetter(() => true)
      expect(getBiometricEnrolled()).toBe(true)
      _resetBiometricGate()
      expect(getBiometricEnrolled()).toBe(false)
    })

    it('clears the warned flag (next default-deny call re-warns)', () => {
      getBiometricEnrolled()  // first warning
      _resetBiometricGate()
      getBiometricEnrolled()  // second warning
      expect(warnSpy).toHaveBeenCalledTimes(2)
    })
  })
})
