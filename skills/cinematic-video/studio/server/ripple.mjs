// Times rounded to the microsecond, so float noise never reaches plan.json.
function round(seconds) {
  return Math.round(seconds * 1e6) / 1e6
}

// A shot's new duration at a gate (D6): the shots after it slide by the
// difference and the film's length changes with them. A cue belongs to the
// shot with start <= time < end. Cues after the edited shot move by exactly
// the difference; its own cues stay put and are flagged for Claude to
// realign, as is the score, which no rule can recut. Only the time of a cue
// changes: audio_tools reads the plan's rows by position.
export function ripple(shots, plan, shotId, duration, { hasScore }) {
  const index = shots.findIndex(shot => shot.id === shotId)
  const start = round(shots.slice(0, index).reduce((sum, shot) => sum + shot.duration, 0))
  const end = round(start + shots[index].duration)
  const delta = round(duration - shots[index].duration)

  const moved = []
  const realign = []
  const newPlan =
    plan === null
      ? null
      : plan.map((cue, row) => {
          const time = cue[1]
          if (time >= end) {
            moved.push(`audio/plan.json[${row}].time`)
            return cue.with(1, round(time + delta))
          }
          if (time >= start) realign.push(`realign:audio/plan.json[${row}]`)
          return cue
        })

  return {
    shots: shots.map(shot => (shot.id === shotId ? { ...shot, duration } : shot)),
    plan: newPlan,
    changes: [`shots[${shotId}].duration`, ...moved, ...realign, ...(hasScore ? ['music-recut'] : [])],
  }
}
