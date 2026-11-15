import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { MapPoint, MapSos } from './useLiveMonitoring'
import { cn } from '@/lib/cn'

/**
 * The live board on a real street map. Leaflet over OpenStreetMap tiles, plotting
 * the coordinates the backend returns: a recipient pin per active visit, plus any
 * SOS position. No key, no account. A point with no coordinates on file is not
 * plotted rather than placed at a made up location.
 */

const categoryColour: Record<MapPoint['category'], string> = {
  ACTIVE: '#10b981',
  RUNNING_LATE: '#f59e0b',
}

interface LiveVisitMapProps {
  visits: MapPoint[]
  sos: MapSos[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function LiveVisitMap({ visits, sos, selectedId, onSelect }: LiveVisitMapProps) {
  const host = useRef<HTMLDivElement | null>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const select = useRef(onSelect)
  useEffect(() => {
    select.current = onSelect
  }, [onSelect])

  /** Only the points with coordinates on file; the rest cannot be plotted. */
  const plotted = useMemo(
    () =>
      visits.filter(
        (v): v is MapPoint & { recipientLatitude: number; recipientLongitude: number } =>
          v.recipientLatitude !== null && v.recipientLongitude !== null,
      ),
    [visits],
  )
  const plottedSos = useMemo(
    () =>
      sos.filter(
        (s): s is MapSos & { latitude: number; longitude: number } =>
          s.latitude !== null && s.longitude !== null,
      ),
    [sos],
  )

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
    // A default view until the first fit, so the tiles are not drawn over a
    // zero sized world.
    instance.setView([39.5, -98.35], 4)
    return () => {
      instance.remove()
      map.current = null
      layer.current = null
    }
  }, [])

  useEffect(() => {
    const instance = map.current
    const group = layer.current
    if (!instance || !group) return
    group.clearLayers()

    for (const point of plotted) {
      const selected = point.visitId === selectedId
      const marker = L.circleMarker([point.recipientLatitude, point.recipientLongitude], {
        radius: selected ? 11 : 8,
        color: '#ffffff',
        weight: selected ? 3 : 2,
        fillColor: categoryColour[point.category],
        fillOpacity: 1,
      })
      marker.bindTooltip(`${point.recipientName} — ${point.status}`)
      marker.on('click', () => select.current(point.visitId))
      marker.addTo(group)
    }

    for (const alert of plottedSos) {
      L.circleMarker([alert.latitude, alert.longitude], {
        radius: 10,
        color: '#ffffff',
        weight: 2,
        fillColor: '#dc2626',
        fillOpacity: 1,
      })
        .bindTooltip(`SOS — ${alert.caregiverName ?? 'Caregiver'}`)
        .addTo(group)
    }

    const points: [number, number][] = [
      ...plotted.map((p) => [p.recipientLatitude, p.recipientLongitude] as [number, number]),
      ...plottedSos.map((s) => [s.latitude, s.longitude] as [number, number]),
    ]
    if (points.length > 0) {
      instance.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 14 })
    }
  }, [plotted, plottedSos, selectedId])

  return (
    <div className="relative">
      <div
        ref={host}
        role="img"
        aria-label={`${plotted.length} visit${plotted.length === 1 ? '' : 's'} on the map`}
        className="border-line z-0 h-[26rem] w-full rounded-xl border sm:h-[32rem]"
      />

      <div className="border-line bg-surface pointer-events-none absolute top-3 right-3 z-[1000] rounded-xl border p-3 shadow-sm">
        <p className="text-ink text-sm font-bold">Live Status</p>
        <ul className="mt-2 space-y-1.5 text-xs">
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-emerald-500" />
            <span className="text-ink-muted">Active</span>
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-amber-500" />
            <span className="text-ink-muted">Running late</span>
          </li>
          {plottedSos.length > 0 && (
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-red-600" />
              <span className="text-ink-muted">SOS</span>
            </li>
          )}
        </ul>
      </div>

      {/* A circle Leaflet paints into SVG no keyboard can reach; the same
          choices as real buttons. */}
      <ul className="sr-only">
        {plotted.map((point) => (
          <li key={point.visitId}>
            <button type="button" onClick={() => onSelect(point.visitId)}>
              {point.recipientName}, {point.status}
            </button>
          </li>
        ))}
      </ul>

      {plotted.length === 0 && (
        <p
          className={cn(
            'border-line bg-surface absolute inset-x-3 top-1/2 z-[1000] -translate-y-1/2 rounded-lg border p-3 text-center text-sm',
            'text-ink-subtle',
          )}
          role="status"
        >
          No visit has coordinates on file to plot right now.
        </p>
      )}
    </div>
  )
}
