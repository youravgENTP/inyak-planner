import { useEffect, useState } from 'react'

import { fetchLectures } from '../../domain/lectures/api'
import { parseLectureSchedule } from '../../domain/lectures/schedule'
import { getTimetables } from '../../domain/saved-timetables/api'
import { loadActiveTimetableId } from '../../domain/saved-timetables/storage'
import type { SavedTimetable } from '../../domain/saved-timetables/types'
import { createStudyOsTimetableExport } from '../../domain/studyos-export/createStudyOsTimetableExport'

function safeFilename(value: string): string {
  return (
    value.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '-') ||
    'timetable'
  )
}

function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function StudyOsTimetableExport() {
  const [timetables, setTimetables] = useState<SavedTimetable[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const loaded = await getTimetables()
        if (cancelled) return
        const activeId = loadActiveTimetableId()
        setTimetables(loaded)
        setSelectedId(
          loaded.some((timetable) => timetable.id === activeId)
            ? activeId ?? ''
            : loaded[0]?.id ?? '',
        )
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : '시간표 목록을 불러오지 못했습니다.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleExport() {
    const timetable = timetables.find((item) => item.id === selectedId)
    if (timetable === undefined) return

    setExporting(true)
    setError(null)
    try {
      const lectures = await fetchLectures({
        academicYear: timetable.academicYear,
        semester: timetable.semester,
      })
      const payload = createStudyOsTimetableExport({
        timetable,
        lectures,
        parseSchedule: parseLectureSchedule,
      })
      downloadJson(
        payload,
        `studyos-${timetable.academicYear}-${timetable.semester}-${safeFilename(timetable.name)}.json`,
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'StudyOS JSON을 만들지 못했습니다.')
    } finally {
      setExporting(false)
    }
  }

  const selected = timetables.find((item) => item.id === selectedId)

  return (
    <div className="account-studyos-export">
      {loading ? (
        <p className="account-studyos-note">시간표를 불러오는 중입니다.</p>
      ) : timetables.length === 0 ? (
        <p className="account-studyos-note">내보낼 저장 시간표가 없습니다.</p>
      ) : (
        <>
          <label htmlFor="studyos-timetable">내보낼 시간표</label>

          <div className="account-studyos-export-controls">
            <select
              id="studyos-timetable"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              disabled={exporting}
            >
              {timetables.map((timetable) => (
                <option key={timetable.id} value={timetable.id}>
                  {timetable.academicYear}-{timetable.semester} ·{' '}
                  {timetable.name}
                </option>
              ))}
            </select>

            <button
              className="secondary-button"
              type="button"
              disabled={exporting || selected === undefined}
              onClick={() => void handleExport()}
            >
              {exporting ? 'JSON 생성 중...' : 'StudyOS JSON 다운로드'}
            </button>
          </div>

          {selected && (
            <p className="account-studyos-note">
              선택된 {selected.lectureIds.length}개 강의의 시간 정보만
              포함합니다. 전체 과목 데이터베이스는 내보내지 않습니다.
            </p>
          )}
        </>
      )}

      {error !== null && (
        <p
          className="account-academic-message account-academic-message--error"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  )
}
