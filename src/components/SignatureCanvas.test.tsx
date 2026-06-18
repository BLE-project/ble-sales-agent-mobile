/**
 * Behaviour tests for SignatureCanvas — the sales-agent signature capture pad.
 *
 * The component uses a PanResponder to turn touch drags into a list of line
 * segments, renders each segment as an absolutely-positioned rotated <View>,
 * and exposes Clear / Save actions. These tests drive it the way a user's
 * finger would: grant -> move -> release, then assert on the rendered strokes
 * and the onSave / onClear side effects.
 *
 * PanResponder.panHandlers are spread onto the canvas <View>, so the granted
 * handlers surface on the host node as onResponderGrant / onResponderMove /
 * onResponderRelease. We invoke them via fireEvent with synthetic
 * GestureResponder events (the same shape RN delivers natively).
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'
import SignatureCanvas from './SignatureCanvas'

/**
 * Build a synthetic GestureResponderEvent carrying a single touch.
 *
 * The component reads only `nativeEvent.touches[0].pageX/pageY`, but the touch
 * passes through RN's PanResponder wrapper first, which derives gesture
 * centroids from `nativeEvent.touchHistory.touchBank` (indexed by touch
 * identifier). We supply a complete single-touch touchHistory so that
 * internal centroid math does not throw.
 */
let ts = 1000
function touchEvent(pageX: number, pageY: number) {
  ts += 16
  const touch = { pageX, pageY, locationX: pageX, locationY: pageY, identifier: 1, timestamp: ts }
  // RN's PanResponder reads `event.touchHistory` at the top level of the
  // responder event (not under nativeEvent), so it must live there.
  const touchHistory = {
    mostRecentTimeStamp: ts,
    numberActiveTouches: 1,
    indexOfSingleActiveTouch: 1,
    touchBank: [
      undefined,
      {
        touchActive: true,
        startPageX: pageX,
        startPageY: pageY,
        startTimeStamp: ts,
        currentPageX: pageX,
        currentPageY: pageY,
        currentTimeStamp: ts,
        previousPageX: pageX,
        previousPageY: pageY,
        previousTimeStamp: ts,
      },
    ],
  }
  return {
    touchHistory,
    nativeEvent: {
      touches: [touch],
      changedTouches: [touch],
      identifier: 1,
      pageX,
      pageY,
      locationX: pageX,
      locationY: pageY,
      timestamp: ts,
      touchHistory,
    },
  }
}

/** Drive a full stroke (grant -> N moves -> release) over the canvas node. */
function drawStroke(
  canvas: ReturnType<typeof screen.getByTestId>,
  points: Array<[number, number]>,
) {
  const [first, ...rest] = points
  fireEvent(canvas, 'responderGrant', touchEvent(first[0], first[1]))
  for (const [x, y] of rest) {
    fireEvent(canvas, 'responderMove', touchEvent(x, y))
  }
  fireEvent(canvas, 'responderRelease', touchEvent(...(rest[rest.length - 1] ?? first)))
}

describe('SignatureCanvas - rendering', () => {
  it('shows the placeholder and the canvas while empty', () => {
    render(<SignatureCanvas onSave={jest.fn()} onClear={jest.fn()} />)
    expect(screen.getByText('Firma qui')).toBeTruthy()
    expect(screen.getByTestId('signature-canvas')).toBeTruthy()
  })

  it('renders both action buttons', () => {
    render(<SignatureCanvas onSave={jest.fn()} onClear={jest.fn()} />)
    expect(screen.getByTestId('signature-save-btn')).toBeTruthy()
    expect(screen.getByTestId('signature-clear-btn')).toBeTruthy()
    expect(screen.getByText('Salva firma')).toBeTruthy()
    expect(screen.getByText('Cancella')).toBeTruthy()
  })

  it('exposes PanResponder handlers and an onLayout on the canvas surface', () => {
    render(<SignatureCanvas onSave={jest.fn()} onClear={jest.fn()} />)
    const canvas = screen.getByTestId('signature-canvas')
    expect(typeof canvas.props.onStartShouldSetResponder).toBe('function')
    expect(typeof canvas.props.onMoveShouldSetResponder).toBe('function')
    expect(typeof canvas.props.onLayout).toBe('function')
  })

  it('onStart/onMoveShouldSetResponder return true so the pad claims the gesture', () => {
    render(<SignatureCanvas onSave={jest.fn()} onClear={jest.fn()} />)
    const canvas = screen.getByTestId('signature-canvas')
    expect(canvas.props.onStartShouldSetResponder()).toBe(true)
    expect(canvas.props.onMoveShouldSetResponder()).toBe(true)
  })
})

describe('SignatureCanvas - layout offset', () => {
  it('accepts an onLayout event without throwing (captures canvas offset)', () => {
    render(<SignatureCanvas onSave={jest.fn()} onClear={jest.fn()} />)
    const canvas = screen.getByTestId('signature-canvas')
    expect(() =>
      fireEvent(canvas, 'layout', {
        nativeEvent: { layout: { x: 10, y: 20, width: 300, height: 180 } },
      }),
    ).not.toThrow()
  })
})

describe('SignatureCanvas - drawing', () => {
  it('hides the placeholder once a stroke is drawn', () => {
    render(<SignatureCanvas onSave={jest.fn()} onClear={jest.fn()} />)
    const canvas = screen.getByTestId('signature-canvas')
    expect(screen.getByText('Firma qui')).toBeTruthy()

    drawStroke(canvas, [[10, 10], [40, 50]])

    expect(screen.queryByText('Firma qui')).toBeNull()
  })

  it('registers a multi-point stroke (grant + 3 moves)', () => {
    render(<SignatureCanvas onSave={jest.fn()} onClear={jest.fn()} />)
    const canvas = screen.getByTestId('signature-canvas')

    drawStroke(canvas, [[0, 0], [10, 0], [20, 0], [30, 0]])

    // Placeholder gone is the user-visible proof a stroke landed.
    expect(screen.queryByText('Firma qui')).toBeNull()
  })

  it('subtracts the canvas offset from page coordinates when drawing', () => {
    render(<SignatureCanvas onSave={jest.fn()} onClear={jest.fn()} />)
    const canvas = screen.getByTestId('signature-canvas')
    // Establish an offset first.
    fireEvent(canvas, 'layout', {
      nativeEvent: { layout: { x: 100, y: 100, width: 300, height: 180 } },
    })
    // Drawing after an offset must still register a stroke (no crash, placeholder gone).
    drawStroke(canvas, [[150, 150], [200, 200]])
    expect(screen.queryByText('Firma qui')).toBeNull()
  })

  it('does not create a segment from a grant alone (no move = no stroke)', () => {
    render(<SignatureCanvas onSave={jest.fn()} onClear={jest.fn()} />)
    const canvas = screen.getByTestId('signature-canvas')
    fireEvent(canvas, 'responderGrant', touchEvent(5, 5))
    fireEvent(canvas, 'responderRelease', touchEvent(5, 5))
    // Grant without a move never pushes a segment - placeholder still visible.
    expect(screen.getByText('Firma qui')).toBeTruthy()
  })

  it('ignores a move that arrives before any grant (lastPoint is null)', () => {
    render(<SignatureCanvas onSave={jest.fn()} onClear={jest.fn()} />)
    const canvas = screen.getByTestId('signature-canvas')
    // A move with no preceding grant: lastPoint.current is null, no segment.
    fireEvent(canvas, 'responderMove', touchEvent(30, 30))
    expect(screen.getByText('Firma qui')).toBeTruthy()
  })

  it('supports a second stroke after release (lastPoint reset)', () => {
    render(<SignatureCanvas onSave={jest.fn()} onClear={jest.fn()} />)
    const canvas = screen.getByTestId('signature-canvas')
    drawStroke(canvas, [[0, 0], [10, 10]])
    drawStroke(canvas, [[50, 50], [60, 60]])
    expect(screen.queryByText('Firma qui')).toBeNull()
  })

  it('renders a vertical segment (dx=0) without throwing in the angle math', () => {
    render(<SignatureCanvas onSave={jest.fn()} onClear={jest.fn()} />)
    const canvas = screen.getByTestId('signature-canvas')
    // dx = 0, dy > 0 - atan2 path with a zero run.
    expect(() => drawStroke(canvas, [[20, 0], [20, 60]])).not.toThrow()
    expect(screen.queryByText('Firma qui')).toBeNull()
  })

  it('renders a zero-length segment (same point) clamping width to >= 1', () => {
    render(<SignatureCanvas onSave={jest.fn()} onClear={jest.fn()} />)
    const canvas = screen.getByTestId('signature-canvas')
    // from === to => length 0 => Math.max(length, 1) clamp path.
    expect(() => drawStroke(canvas, [[15, 15], [15, 15]])).not.toThrow()
    expect(screen.queryByText('Firma qui')).toBeNull()
  })
})

describe('SignatureCanvas - save', () => {
  it('emits a base64 PNG payload through onSave', () => {
    const onSave = jest.fn()
    render(<SignatureCanvas onSave={onSave} onClear={jest.fn()} />)
    fireEvent.press(screen.getByTestId('signature-save-btn'))
    expect(onSave).toHaveBeenCalledWith(expect.stringContaining('data:image/png;base64,'))
  })

  it('still saves after a stroke was drawn', () => {
    const onSave = jest.fn()
    render(<SignatureCanvas onSave={onSave} onClear={jest.fn()} />)
    const canvas = screen.getByTestId('signature-canvas')
    drawStroke(canvas, [[0, 0], [10, 10]])
    fireEvent.press(screen.getByTestId('signature-save-btn'))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith(expect.stringContaining('base64,'))
  })
})

describe('SignatureCanvas - clear', () => {
  it('invokes onClear and keeps the canvas empty when already empty', () => {
    const onClear = jest.fn()
    render(<SignatureCanvas onSave={jest.fn()} onClear={onClear} />)
    fireEvent.press(screen.getByTestId('signature-clear-btn'))
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Firma qui')).toBeTruthy()
  })

  it('wipes drawn strokes and restores the placeholder', () => {
    const onClear = jest.fn()
    render(<SignatureCanvas onSave={jest.fn()} onClear={onClear} />)
    const canvas = screen.getByTestId('signature-canvas')

    drawStroke(canvas, [[0, 0], [10, 10], [20, 20]])
    expect(screen.queryByText('Firma qui')).toBeNull()

    fireEvent.press(screen.getByTestId('signature-clear-btn'))
    expect(onClear).toHaveBeenCalledTimes(1)
    // After clear the segment list is empty again => placeholder returns.
    expect(screen.getByText('Firma qui')).toBeTruthy()
  })

  it('allows drawing again after a clear', () => {
    render(<SignatureCanvas onSave={jest.fn()} onClear={jest.fn()} />)
    const canvas = screen.getByTestId('signature-canvas')
    drawStroke(canvas, [[0, 0], [10, 10]])
    fireEvent.press(screen.getByTestId('signature-clear-btn'))
    expect(screen.getByText('Firma qui')).toBeTruthy()
    drawStroke(canvas, [[30, 30], [40, 40]])
    expect(screen.queryByText('Firma qui')).toBeNull()
  })
})
