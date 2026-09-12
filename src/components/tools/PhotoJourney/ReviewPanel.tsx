import { memo, useMemo, useState } from "react";
import Inspector from "./Inspector";
import { matchesReview, REVIEW_FILTERS, reviewCounts, type ReviewFilter, type ReviewItem } from "./review";
import type { PlacementChoice } from "./track";
import type { JourneyRecording } from "./types";

function ReviewPanel({ items, filter, onFilter, recordings, choices, offsets, onChoose, onSetOffset, onRecordings }: {
  items: ReviewItem[];
  filter: ReviewFilter;
  onFilter: (filter: ReviewFilter) => void;
  recordings: JourneyRecording[];
  choices: Record<string, PlacementChoice>;
  offsets: Record<string, number>;
  onChoose: (id: string, choice: PlacementChoice | undefined) => void;
  onSetOffset: (id: string, minutes: number | undefined) => void;
  onRecordings: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const counts = useMemo(() => reviewCounts(items), [items]);
  const queue = useMemo(() => items.filter((item) => matchesReview(item, filter)), [items, filter]);
  const selected = queue.find((item) => item.photo.id === selectedId) ?? queue[0];
  const position = selected ? queue.indexOf(selected) : -1;
  const advance = () => setSelectedId((queue[position + 1] ?? queue[position - 1])?.photo.id);
  return <section className="pj-review" aria-label="Photo review">
    <div className="pj-review-toolbar">
      <label>Show <select aria-label="Review filter" value={filter} onChange={(event) => { onFilter(event.target.value as ReviewFilter); setSelectedId(undefined); }}>
        {REVIEW_FILTERS.map(([value, label]) => <option key={value} value={value}>{label} ({counts[value]})</option>)}
      </select></label>
      <span role="status">{queue.length ? `${position + 1} of ${queue.length} photos` : "No photos in this filter"}</span>
      <div className="pj-bar-actions">
        <button className="pj-pill" disabled={position <= 0} onClick={() => setSelectedId(queue[position - 1].photo.id)}>Previous</button>
        <button className="pj-pill" disabled={position < 0 || position >= queue.length - 1} onClick={advance}>Next</button>
      </div>
    </div>
    <p className="pj-editor-note">Choose a location source to review a conflict. Your choice is kept for this session. Unlocated photos and unresolved times remain in the queue until resolved.</p>
    {selected ? <div className="pj-workspace">
      <section className="pj-panel" aria-label="Photos in review queue">
        <ol className="pj-review-list">
          {queue.map((item) => <li key={item.photo.id}>
            <button className="pj-review-photo" aria-current={item.photo.id === selected.photo.id ? "step" : undefined} onClick={() => setSelectedId(item.photo.id)}>
              <img src={item.photo.thumbnailUrl} alt="" loading="lazy" />
              <span><strong>{item.photo.name}</strong><small>{[
                item.placement?.ambiguous ? "Overlapping recordings" : item.conflict ? "Location conflict" : undefined,
                item.difference && item.placement?.discrepancyM !== undefined ? `${Math.round(item.placement.discrepancyM).toLocaleString("en")} m GPS difference` : undefined,
                item.unlocated ? "Unlocated" : undefined,
                item.time ? "Time unresolved" : undefined,
                choices[item.photo.id] && !item.conflict ? "Location reviewed" : undefined,
              ].filter(Boolean).join(" · ") || (item.inferred ? "Position from recording" : "Camera GPS")}</small></span>
            </button>
          </li>)}
        </ol>
      </section>
      <div>
        {(selected.placement?.ambiguous || selected.placement?.choiceUnavailable) && <button className="pj-pill" onClick={onRecordings}>Review recordings</button>}
        <Inspector photo={selected.photo} placement={selected.placement} index={selected.index} recordings={recordings}
          choice={choices[selected.photo.id]} offsetMinutes={offsets[selected.photo.id]}
          onChoosePlacement={(id, choice) => { onChoose(id, choice); if (choice && (filter === "conflicts" || filter === "needs-review")) advance(); }}
          onSetOffset={(id, minutes) => { onSetOffset(id, minutes); if (minutes !== undefined && filter === "time") advance(); }} />
      </div>
    </div> : <div className="pj-review-empty" role="status">
      <strong>{filter === "needs-review" || filter === "conflicts" ? "Nothing left to review here" : "No matching photos"}</strong>
      <p>Choose another filter or day to browse the rest of your journey.</p>
    </div>}
  </section>;
}
export default memo(ReviewPanel);
