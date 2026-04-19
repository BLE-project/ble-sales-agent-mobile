/**
 * Fase 3.1: Holy-IOT hardware constants (sales-agent copy).
 *
 * Kept in sync with:
 *   - terrio-e2e-tests/fixtures/holy-iot-constants.ts
 *   - terrio-backoffice-admin-web/src/constants/holyIot.ts
 *   - terrio-platform-docs/05_ble/gatt-configuration-guide.md
 *
 * DEFAULT_HOLYIOT_PASSWORD is the factory configuration-access password
 * baked into this model of Holy-IOT beacon. Anyone holding the device can
 * use it together with the official Holy-IOT Android app to change the
 * iBeacon UUID / major / minor / TX power / advertising interval over a
 * local BLE GATT connection.
 *
 * This constant is surfaced in the beacon-config reconfigure modal as a
 * helper so that a sales rep standing next to a Holy-IOT unit in the
 * field can just tap "Copy default" instead of hunting for the password
 * in docs.
 *
 * NOTE: this is a *factory default*, not a secret. It is identical
 * across every unit of this model and is intentionally checked into
 * source so that the platform ships with a self-contained "walk up to a
 * beacon and reconfigure it" UX. If a future firmware revision ships
 * with a different default, update this single constant and every
 * consumer will pick it up.
 */
export const DEFAULT_HOLYIOT_PASSWORD = 'aa14061112.'

export const DEFAULT_HOLYIOT_PASSWORD_LABEL = 'Password di fabbrica Holy-IOT'
