import { useDraggable } from '@dnd-kit/core'
import AdmissionCard from './AdmissionCard.jsx'
import { admissionDraggableId } from '../state/Board.jsx'
import { lookupName } from '../domain/classes.js'

/**
 * A waiting-list card, made draggable.
 *
 * The drag wrapper is kept separate from the card itself so the card stays a
 * plain view that can also be rendered inside the drag overlay — a component
 * cannot sensibly be both the thing being dragged and the preview of itself.
 *
 * While dragging, the original stays in place and merely fades. Removing it
 * would re-flow the queue under the pointer, and the card is not gone yet: the
 * drag can still be cancelled.
 */
export default function DraggableAdmissionCard({ admission, colour, preference, preferenceTitle }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: admissionDraggableId(admission.id),
  })

  const student = lookupName(admission.Student_Name) ?? 'this student'

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      // No `touch-action: none` here on purpose: the touch sensor's hold delay
      // already distinguishes a drag from a swipe, and suppressing touch
      // gestures outright would make the queue unscrollable on a tablet, since
      // the cards cover it.
      className={`rounded-lg outline-none ${
        isDragging ? 'cursor-grabbing opacity-35' : 'cursor-grab'
      }`}
      aria-roledescription="draggable admission"
      aria-label={`${student}, ${admission.Name}. Press space to pick up, then use the arrow keys to choose a class.`}
    >
      <AdmissionCard
        admission={admission}
        colour={colour}
        preference={preference}
        preferenceTitle={preferenceTitle}
      />
    </div>
  )
}
