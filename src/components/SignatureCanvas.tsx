import React, { useRef, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  TouchableOpacity,
  GestureResponderEvent,
  LayoutChangeEvent,
} from 'react-native'

interface Point {
  x: number
  y: number
}

interface Segment {
  from: Point
  to: Point
}

interface Props {
  onSave: (base64: string) => void
  onClear: () => void
}

export default function SignatureCanvas({ onSave, onClear }: Props) {
  const [segments, setSegments] = useState<Segment[]>([])
  const lastPoint = useRef<Point | null>(null)
  const canvasOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const isEmpty = segments.length === 0

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { x, y } = e.nativeEvent.layout
    canvasOffset.current = { x, y }
  }, [])

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const touch = evt.nativeEvent.touches[0]
        lastPoint.current = {
          x: touch.pageX - canvasOffset.current.x,
          y: touch.pageY - canvasOffset.current.y,
        }
      },

      onPanResponderMove: (evt: GestureResponderEvent) => {
        const touch = evt.nativeEvent.touches[0]
        const current: Point = {
          x: touch.pageX - canvasOffset.current.x,
          y: touch.pageY - canvasOffset.current.y,
        }
        if (lastPoint.current) {
          setSegments(prev => [
            ...prev,
            { from: { ...lastPoint.current! }, to: current },
          ])
        }
        lastPoint.current = current
      },

      onPanResponderRelease: () => {
        lastPoint.current = null
      },
    })
  ).current

  const handleClear = () => {
    setSegments([])
    lastPoint.current = null
    onClear()
  }

  const handleSave = () => {
    onSave('data:image/png;base64,SIGNATURE_PLACEHOLDER')
  }

  return (
    <View style={styles.wrapper}>
      {/* Drawing area */}
      <View
        style={styles.canvas}
        onLayout={handleLayout}
        testID="signature-canvas"
        {...panResponder.panHandlers}
      >
        {isEmpty && (
          <Text style={styles.placeholder}>Firma qui</Text>
        )}

        {/* Render each segment as a thin absolute line */}
        {segments.map((seg, i) => {
          const dx = seg.to.x - seg.from.x
          const dy = seg.to.y - seg.from.y
          const length = Math.sqrt(dx * dx + dy * dy)
          const angle = Math.atan2(dy, dx) * (180 / Math.PI)
          const midX = (seg.from.x + seg.to.x) / 2
          const midY = (seg.from.y + seg.to.y) / 2

          return (
            <View
              key={i}
              style={[
                styles.line,
                {
                  width: Math.max(length, 1),
                  left: midX - Math.max(length, 1) / 2,
                  top: midY - 1,
                  transform: [{ rotate: `${angle}deg` }],
                },
              ]}
            />
          )
        })}
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary]}
          onPress={handleClear}
          testID="signature-clear-btn"
        >
          <Text style={styles.btnTextSecondary}>Cancella</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary]}
          onPress={handleSave}
          testID="signature-save-btn"
        >
          <Text style={styles.btnTextPrimary}>Salva firma</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  canvas: {
    height: 180,
    backgroundColor: '#fafafa',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    fontSize: 15,
    color: '#9ca3af',
    fontStyle: 'italic',
    pointerEvents: 'none',
  },
  line: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#111',
    borderRadius: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnPrimary: {
    backgroundColor: '#1a3f6f',
  },
  btnSecondary: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  btnTextPrimary: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  btnTextSecondary: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 13,
  },
})
