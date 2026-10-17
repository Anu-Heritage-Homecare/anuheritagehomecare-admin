import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  branchPlaces,
  placeOfRecipient,
  recipientPlaces,
} from './locations-data'
import { stateLabels } from './live-data'
import type { LiveAlert, LiveVisit } from './live-data'
import { gradeDot, gradeOf, pinGradeLabels } from './pin-grade'
import type { PinGrade } from './pin-grade'
import { cn } from '@/lib/cn'

/**
 * The board on a real street map.
 *
 * Leaflet over OpenStreetMap tiles, plotting the coordinates the fixture
 * already holds — no key, no account, nothing to configure. What it plots is
 * still the *client's address*: a home is a fixed fact, and a moving dot would
 * need a device feed this app has no trace of. Nothing here tracks a
 * caregiver.
 */

/** Hex rather than a class: Leaflet paints SVG through its own options. */
const gradeColour: Record<PinGrade, string> = {
  critical: '#dc2626',
  high: '#f87171',
  medium: '#f59e0b',
  clear: '#10b981',
}

const gradeRank: Record<PinGrade, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  clear: 3,
}

interface Pin {
  /** Every visit at this address, so two at one house are one pin. */
  visits: LiveVisit[]
  grade: PinGrade
  lat: number
  lng: number
}

interface VisitTileMapProps {
  visits: LiveVisit[]
  alerts: LiveAlert[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function VisitTileMap({
  visits,
  alerts,
  selectedId,
  onSelect,
}: VisitTileMapProps) {
  const host = useRef<HTMLDivElement | null>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  /* The latest handler, so a marker bound once does not call a stale one. */
  const select = useRef(onSelect)
  useEffect(() => {
    select.current = onSelect
  }, [onSelect])

  const pins = useMemo(() => {
    const byAddress = new Map<string, Pin>()
    for (const visit of visits) {
      const place = placeOfRecipient(visit.recipientId)
      if (!place) continue
      const grade = gradeOf(visit, alerts)
      const existing = byAddress.get(place.address)
      if (existing) {
        existing.visits.push(visit)
        // A pin carries the worst thing raised against anything at that address.
        if (gradeRank[grade] < gradeRank[existing.grade]) existing.grade = grade
        continue
      }
      byAddress.set(place.address, {
        visits: [visit],
        grade,
        lat: place.lat,
        lng: place.lng,
      })
    }
    return [...byAddress.values()]
  }, [visits, alerts])

  const counts = useMemo(() => {
    const out = new Map<PinGrade, number>()
    for (const visit of visits) {
      const g = gradeOf(visit, alerts)
      out.set(g, (out.get(g) ?? 0) + 1)
    }
    return out
  }, [visits, alerts])

  /* ------------------------------- the map -------------------------------- */
  useEffect(() => {
    if (!host.current || map.current) return
    const instance = L.map(host.current, {
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(instance)
    layer.current = L.layerGroup().addTo(instance)
    map.current = instance
    return () => {
      instance.remove()
      map.current = null
      layer.current = null
    }
  }, [])

  /* ------------------------------ the markers ------------------------------ */
  useEffect(() => {
    const instance = map.current
    const group = layer.current
    if (!instance || !group) return
    group.clearLayers()

    for (const [name, place] of Object.entries(branchPlaces)) {
      L.marker([place.lat, place.lng], {
        icon: L.divIcon({
          className: '',
          html: `<span class="block size-2.5 rounded-[3px] bg-slate-600 ring-2 ring-white"></span>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        }),
        keyboard: false,
        interactive: true,
        title: `${name} — ${place.address}`,
      }).addTo(group)
    }

    for (const pin of pins) {
      const selected = pin.visits.some((v) => v.id === selectedId)
      const lead = pin.visits[0]
      const marker = L.circleMarker([pin.lat, pin.lng], {
        radius: selected ? 11 : 8,
        color: '#ffffff',
        weight: selected ? 3 : 2,
        fillColor: gradeColour[pin.grade],
        fillOpacity: 1,
      })
      marker.bindTooltip(
        pin.visits
          .map((v) => `${v.recipientName} — ${stateLabels[v.state]}`)
          .join('<br>'),
      )
      marker.on('click', () => select.current(lead.id))
      marker.addTo(group)
    }

    const points = [
      ...pins.map((p) => [p.lat, p.lng] as [number, number]),
      ...Object.values(branchPlaces).map(
        (p) => [p.lat, p.lng] as [number, number],
      ),
    ]
    if (points.length > 0) {
      instance.fitBounds(L.latLngBounds(points), { padding: [48, 48] })
    } else {
      const fallback = Object.values(recipientPlaces)[0]
      instance.setView([fallback.lat, fallback.lng], 12)
    }
  }, [pins, selectedId])

  const legend = (['critical', 'high', 'medium', 'clear'] as PinGrade[]).filter(
    (g) => counts.has(g),
  )

  return (
    <div className="relative">
      <div
        ref={host}
        role="img"
        aria-label={`${pins.length} address${pins.length === 1 ? '' : 'es'} on the map, plus the branch offices`}
        className="border-line z-0 h-[26rem] w-full rounded-xl border sm:h-[32rem]"
      />

      {/* The design's Live Status card, over the top-right of the map. */}
      <div className="border-line bg-surface pointer-events-none absolute top-3 right-3 z-[1000] rounded-xl border p-3 shadow-sm">
        <p className="text-ink text-sm font-bold">Live Status</p>
        <ul className="mt-2 space-y-1.5">
          {legend.map((g) => (
            <li key={g} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden="true"
                className={cn('size-2.5 shrink-0 rounded-full', gradeDot[g])}
              />
              <span className="text-ink font-semibold tabular-nums">
                {counts.get(g)}
              </span>
              <span className="text-ink-muted">{pinGradeLabels[g]}</span>
            </li>
          ))}
          <li className="flex items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              className="bg-ink-subtle size-2.5 shrink-0 rounded-[3px]"
            />
            <span className="text-ink-muted">Branch office</span>
          </li>
        </ul>
      </div>

      {/*
        A pin is a circle Leaflet paints into an SVG layer, which no keyboard
        can reach. The same choices, in the same order, as real buttons.
      */}
      <ul className="sr-only">
        {pins.map((pin) => (
          <li key={pin.visits[0].id}>
            <button type="button" onClick={() => onSelect(pin.visits[0].id)}>
              {pin.visits
                .map((v) => `${v.recipientName}, ${stateLabels[v.state]}`)
                .join('; ')}
              . {pinGradeLabels[pin.grade]}.
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
