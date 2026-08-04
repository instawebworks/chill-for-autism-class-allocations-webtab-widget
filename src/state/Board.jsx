import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useWorkspace } from './Workspace.jsx'
import { useAllocations } from './Allocations.jsx'
import { programColours } from '../domain/programs.js'
import { evaluateAllocation } from '../domain/eligibility.js'
import AdmissionCard from '../components/AdmissionCard.jsx'
import { useNotice } from './Notice.jsx'

/**
 * Board interaction: which class dialog is open, and the drag that places a
 * student into one.
 *
 * ---------------------------------------------------------------------------
 * The gesture
 * ---------------------------------------------------------------------------
 *
 * Pick a card up from the waiting panel, drag it across the board, and rest it
 * over a class. Passing over a class does nothing — only *stopping* on one for
 * DWELL_MS springs its dialog open. The drop itself happens inside that dialog,
 * which is what makes the placement deliberate: you see the class's existing
 * roster and its remaining seats before you commit.
 *
 * This is the spring-loaded folder pattern from desktop file managers, and it
 * is chosen for the same reason: the drag has to cross a lot of targets to
 * reach its destination, so hovering cannot mean selecting. The dwell is what
 * separates "passing through" from "I mean this one".
 *
 * ---------------------------------------------------------------------------
 * Why dnd-kit rather than HTML5 drag events
 * ---------------------------------------------------------------------------
 *
 * The widget runs inside a CRM iframe. Native HTML5 drag-and-drop is unreliable
 * across frame boundaries, cannot be styled beyond a drag image, and gives no
 * usable hook for "held still over a target". dnd-kit works from pointer
 * events, so none of that applies, and it brings the two things that make a
 * drag feel solid: a single overlay element that moves under transform rather
 * than the list re-laying-out, and built-in auto-scroll for the board.
 *
 * ---------------------------------------------------------------------------
 * Keyboard
 * ---------------------------------------------------------------------------
 *
 * A dwell is meaningless without a pointer, and springing a dialog open mid-drag
 * would move focus and break the keyboard drag outright. So the keyboard path is
 * deliberately different rather than a broken imitation: Space picks a card up,
 * arrows move between classes, Space drops it straight onto one, and the dialog
 * opens afterwards to confirm what happened. Same pending change, no dwell.
 */

const DWELL_MS = 700

/**
 * Hoisted so the object identity is stable. Inline, it would be a new object on
 * every render and dnd-kit would rebuild its measuring configuration each time.
 */
const MEASURING = { droppable: { strategy: MeasuringStrategy.Always } }

export const DIALOG_DROP_ID = 'class-dialog-dropzone'
const CLASS_PREFIX = 'class:'
const ADMISSION_PREFIX = 'admission:'

export const classDroppableId = (classId) => `${CLASS_PREFIX}${classId}`
export const admissionDraggableId = (admissionId) => `${ADMISSION_PREFIX}${admissionId}`

const idAfter = (value, prefix) =>
  typeof value === 'string' && value.startsWith(prefix) ? value.slice(prefix.length) : null

const BoardContext = createContext(null)

export function BoardProvider({ children }) {
  const { classes, admissions } = useWorkspace()
  const { allocate, rosterFor } = useAllocations()
  const { notify, dismiss: dismissNotice } = useNotice()

  const [openClassId, setOpenClassId] = useState(null)
  const [activeAdmissionId, setActiveAdmissionId] = useState(null)
  const [pointerDrag, setPointerDrag] = useState(false)

  const dwellTimer = useRef(null)
  const dwellTarget = useRef(null)

  /**
   * Show a refusal, and take it away on its own.
   *
   * `sticky: false` overrides the default for a warning, which is to wait for
   * the user. A refused drop is a momentary thing the user immediately retries;
   * leaving it up would mean dismissing a banner after every mis-aimed drag.
   */
  const raiseNotice = useCallback((verdict) => notify({ ...verdict, sticky: false }), [notify])

  const cancelDwell = useCallback(() => {
    if (dwellTimer.current) clearTimeout(dwellTimer.current)
    dwellTimer.current = null
    dwellTarget.current = null
  }, [])

  // A drag can end with the component still mounted but the timer pending —
  // e.g. the user drops on nothing the instant before it fires.
  useEffect(() => cancelDwell, [cancelDwell])

  const sensors = useSensors(
    // Mouse and touch are separated rather than handled by one PointerSensor,
    // because they need opposite activation rules. A mouse should drag after a
    // few pixels of travel. A finger must not: the same gesture is how the
    // waiting list is scrolled, so touch requires a short hold first, which
    // leaves ordinary swipes scrolling as they should.
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )

  /**
   * While a dialog is open it is the only thing that can be dropped on.
   *
   * Without this the pills behind the backdrop keep colliding — they are still
   * laid out, and pointer collision has no notion of z-order — so the dwell
   * would re-fire for whatever sits underneath the dialog and the class could
   * change out from under the drop.
   */
  const collisionDetection = useCallback(
    (args) => {
      const containers = openClassId
        ? args.droppableContainers.filter((c) => c.id === DIALOG_DROP_ID)
        : args.droppableContainers.filter((c) => c.id !== DIALOG_DROP_ID)
      const scoped = { ...args, droppableContainers: containers }

      const hits = pointerWithin(scoped)
      if (hits.length > 0) return hits

      // No fallback while there is a pointer. Falling through to closestCenter
      // here would be actively wrong once a dialog is open: it is then the only
      // candidate, so "nearest" always resolves to it and releasing the card
      // anywhere on screen — including well away from the dialog, or on the
      // backdrop meaning to cancel — would allocate. With a pointer, not being
      // over anything has to mean exactly that. A keyboard drag has no pointer
      // at all, and nearest centre is the only workable answer there.
      return args.pointerCoordinates ? [] : closestCenter(scoped)
    },
    [openClassId],
  )

  const classById = useCallback((id) => classes.find((c) => c.id === id) ?? null, [classes])

  const onDragStart = useCallback(
    ({ active, activatorEvent }) => {
      cancelDwell()
      // A new attempt clears the last refusal; leaving it up would let the user
      // read a stale complaint as the verdict on the drag they are in.
      dismissNotice()
      setActiveAdmissionId(idAfter(active.id, ADMISSION_PREFIX))
      setPointerDrag(!(activatorEvent instanceof KeyboardEvent))
    },
    [cancelDwell, dismissNotice],
  )

  const onDragOver = useCallback(
    ({ over, activatorEvent }) => {
      const viaKeyboard = activatorEvent instanceof KeyboardEvent
      const classId = over ? idAfter(over.id, CLASS_PREFIX) : null

      // No dwell for keyboard, and none once a dialog has taken over.
      if (!classId || viaKeyboard) {
        cancelDwell()
        return
      }
      // Still over the same class: let the running timer finish rather than
      // restarting it on every jitter of the pointer.
      if (dwellTarget.current === classId) return

      cancelDwell()
      dwellTarget.current = classId
      dwellTimer.current = setTimeout(() => {
        setOpenClassId(classId)
        cancelDwell()
      }, DWELL_MS)
    },
    [cancelDwell],
  )

  const finishDrag = useCallback(() => {
    cancelDwell()
    setActiveAdmissionId(null)
    setPointerDrag(false)
  }, [cancelDwell])

  /**
   * The gate. Nothing is placed without passing it, and a refusal always says
   * why — the card returning on its own is indistinguishable from a fumbled
   * drop otherwise.
   */
  const tryAllocate = useCallback(
    (cls, admissionId) => {
      const admission = admissions.find((a) => a.id === admissionId) ?? null
      const verdict = evaluateAllocation({ cls, admission, roster: rosterFor(cls) })
      if (!verdict.ok) {
        raiseNotice(verdict)
        return false
      }
      allocate(cls, admissionId)
      return true
    },
    [admissions, allocate, raiseNotice, rosterFor],
  )

  const onDragEnd = useCallback(
    ({ active, over, activatorEvent }) => {
      const admissionId = idAfter(active.id, ADMISSION_PREFIX)
      const viaKeyboard = activatorEvent instanceof KeyboardEvent
      finishDrag()
      if (!over || !admissionId) return

      // The intended path: dropped inside the open class's dialog.
      if (over.id === DIALOG_DROP_ID && openClassId) {
        tryAllocate(classById(openClassId), admissionId)
        return
      }

      // Keyboard only: dropping straight onto a class. The dialog is opened
      // only on success — on a refusal the notice is the answer, and springing
      // a dialog open as well would bury it.
      const classId = idAfter(over.id, CLASS_PREFIX)
      if (classId && viaKeyboard) {
        if (tryAllocate(classById(classId), admissionId)) setOpenClassId(classId)
      }
    },
    [classById, finishDrag, openClassId, tryAllocate],
  )

  const colours = useMemo(() => programColours(classes), [classes])
  const activeAdmission = useMemo(
    () => admissions.find((a) => a.id === activeAdmissionId) ?? null,
    [admissions, activeAdmissionId],
  )

  const value = useMemo(
    () => ({
      openClassId,
      openClass: classById(openClassId),
      showClass: setOpenClassId,
      closeClass: () => setOpenClassId(null),
      isDragging: activeAdmissionId != null,
      activeAdmissionId,
      activeAdmission,
      /** Pointer drags spring dialogs open; keyboard drags do not. */
      dwellEnabled: pointerDrag,
      dwellMs: DWELL_MS,
    }),
    [openClassId, classById, activeAdmissionId, activeAdmission, pointerDrag],
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      /*
       * The dialog's drop zone does not exist when the drag begins — it is
       * created by the drag, when the dwell springs the dialog open. The default
       * strategy measures droppables once at drag start, so that zone would
       * never acquire a rectangle and the drop would silently do nothing.
       * Re-measuring on arrival is what makes it hittable.
       *
       * This only helps a target that mounts with its element. A target
       * registered while its element does not exist is measured as nothing and
       * never revisited, since the set of targets never changes — hence the
       * conditional mount in ScheduleBoard.
       */
      measuring={MEASURING}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={finishDrag}
    >
      <BoardContext.Provider value={value}>{children}</BoardContext.Provider>

      {/*
        One element, moved by transform, rendered above everything. The card in
        the list stays put and merely dims — moving the real card would force the
        panel to re-flow on every frame.
      */}
      <DragOverlay dropAnimation={null}>
        {activeAdmission ? (
          <div className="w-55 rotate-[-1.5deg] cursor-grabbing opacity-95 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.75)]">
            <AdmissionCard
              admission={activeAdmission}
              colour={colours.get(activeAdmission.Program_Name)}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

export function useBoard() {
  const ctx = useContext(BoardContext)
  if (!ctx) throw new Error('useBoard() must be used within <BoardProvider>')
  return ctx
}
