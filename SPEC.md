# Workout Buddy — Specification (v1)

A personal, phone-first, gamified calisthenics tracker. It tracks a fixed weekly
routine for the Fall 2026 season. Completing workouts levels up a pixel-art
character and decorates the character's apartment. The visuals, character and
UI style come from the "You Made Dinner!" achievement video
(`OnePoMan/Q-A-Together`, branch `claude/achievement-pop-up-video-ykwlqk`,
directory `achievement-video/`).

Status: draft for review. Values marked *(tunable)* are starting values,
expected to change after playtesting.

---

## 1. Scope

### 1.1 In scope (v1)
- Fixed weekly schedule, with targets editable in Settings.
- Logging sets/reps for strength days, and distance plus time for the run.
- An in-app stopwatch for personal-best timing.
- Streaks with make-ups and streak freezes.
- Five stats with Persona-style ranks.
- Achievements and tiered reward animations.
- Room and outfit unlocks.
- Soft-cap counters for Diet Dr Pepper and snacks.
- A weekly consistency heatmap and a personal-best board.
- A season that ends 2026-12-31, with a finale.
- Installable from the browser (PWA), works offline, and stores data only on the device.
- JSON export and import.
- Optional sound effects, muted by default.

### 1.2 Non-goals (v1)
- Accounts, authentication, or multi-device sync.
- Push notifications or reminders.
- GPS run tracking. Run distance and time are entered by hand or timed with the stopwatch.
- Custom exercises, or changing which exercise falls on which weekday.
- Nutrition or calorie tracking beyond the two counters.
- Health advice or recommendations of any kind.
- Social or sharing features.

---

## 2. Schedule

| Day | Session | Target | Stat |
|---|---|---|---|
| Mon | Push-ups | 30 reps | STRENGTH |
| Tue | Pull-ups | 30 reps | BACK |
| Wed | Squats | 60 reps | LEGS |
| Thu | Push-ups | 30 reps | STRENGTH |
| Fri | Pull-ups | 30 reps | BACK |
| Sat | Run | 1.0 mi | STAMINA |
| Sun | Rest | — | — |

- Weeks run from Monday to Sunday.
- Targets can be edited in Settings. A changed target applies from the current
  day onward. Past sessions keep the target they were logged against, because
  each session stores its target.
- **Season:**
  - Starts on the first launch date. Settings can change the start date.
  - Ends on 2026-12-31.
  - Weeks before the start date are excluded from every calculation.
- **Dates:** every day is shown with its calendar date as `SAT 10/3`
  (weekday, month/day), including the Today card, make-up chips, the log
  sheet, the heatmap and history.
- **Day rollover:** happens at 03:00 local time by default. Settings can change
  the hour. For example, a can logged at 01:00 counts toward the previous day.
  All dates are stored as local `YYYY-MM-DD` "logical days" after this offset
  is applied.

---

## 3. Logging

### 3.1 Strength sessions (push-ups, pull-ups, squats)
- The user adds sets one at a time, using a rep stepper and "+ Set". Sets can
  be edited or deleted until the week ends.
- **Completion fraction** = `min(1, totalReps / target)`.
- **Stopwatch (optional):**
  - The user starts it before the first set.
  - It stops automatically when `totalReps >= target`.
  - It can also be stopped by hand.
  - The time it records is the session's **completion time**.
- Logging stays open after the target is reached, so the total can go over it.
  Extra reps count toward personal bests, but stat points are capped at 100%
  completion.

### 3.2 Run (Saturday)
- The user enters distance (default 1.0 mi) and time (mm:ss). The time can also
  come from the stopwatch.
- **Completion fraction** = `min(1, distance / target)`.

### 3.3 Make-ups
- A missed session can be logged on any later day in the same week, Sunday
  included.
- Home shows outstanding sessions for the week as a "MAKE-UP" chip next to
  today's card.
- After the week ends (Sunday rollover), past sessions are read-only and can
  only be edited through import.

### 3.4 Extra workouts
- Not supported in v1. A session can only be logged against a scheduled slot in
  the current week.

---

## 4. Rules engine

All progress state is **derived**. The stored data is only:
- logs
- counter entries
- settings
- "seen" flags, so animations don't replay

Pure functions turn logs into the streak, stats, personal bests and
achievements. Editing a log therefore recalculates everything consistently.
This module is the main target for unit tests.

### 4.1 Streak
- The **streak** is the number of consecutive scheduled sessions that were
  completed (fraction = 1), in schedule order, ending at the most recent
  resolved session.
- A session in the current week that hasn't been done yet is **pending**.
  Pending sessions do not break the streak.
- A session is **missed** only when its week ends without it reaching
  fraction 1.
- Rest days never count and never break the streak.
- **Streak freezes:**
  - Each perfect week earns 1 freeze. At most 2 can be banked *(tunable)*.
  - At week end, banked freezes are applied automatically to that week's missed
    sessions, oldest first.
  - A frozen session keeps the streak alive but does not add to it.
- The longest streak is tracked as its own personal best.
- The last season week (Dec 28–31) is finalised when the season ends, not on
  the following Sunday.

### 4.2 Perfect week
- All 6 scheduled sessions in a Monday–Sunday week reach fraction 1 by the end
  of that week. Make-ups count.
- Weeks with fewer than 6 in-season slots (the first and last season weeks)
  cannot be perfect.
- The freeze is banked as soon as the week becomes perfect.

### 4.3 Stats and ranks

| Stat | Source | Points |
|---|---|---|
| STRENGTH | push-up sessions | 10 x fraction (floored) |
| BACK | pull-up sessions | 10 x fraction (floored) |
| LEGS | squat session | 20 x fraction (floored) |
| STAMINA | run session | 20 x fraction (floored) |
| DISCIPLINE | each day both counters stay at or under their caps | 3 |

- Squats and the run happen once a week, so each counts double. That gives all
  four exercise stats the same weekly maximum (20).
- Each personal best set earns +5 to the stat of that session *(tunable)*.
- **DISCIPLINE:**
  - A day qualifies only if it has at least one counter entry, or the user
    explicitly confirmed zero with "Nothing today".
  - Days with no data earn nothing. A day that went over the cap also earns
    nothing.
  - Qualification is decided at day rollover.
  - Caps are not snapshotted: changing a cap re-scores past days.
- Global personal bests (longest streak, perfect weeks in a row) earn no bonus.
- **Rank thresholds** (cumulative points, ranks 1–10) *(tunable)*:
  `0, 15, 35, 60, 90, 125, 165, 205, 245, 285`.
  A perfect 13-week season gives about 260 points per stat before personal-best
  bonuses, which lands around rank 9. Rank 10 needs personal bests as well.

### 4.4 Personal bests

| Exercise | Personal bests tracked |
|---|---|
| Push-ups, pull-ups, squats | Fastest completion time (stopwatch sessions that reached the target only); most reps in a single set |
| Run | Fastest time for distance >= target. Pace is also stored. |
| Global | Longest streak; most perfect weeks in a row |

- The first logged value of each personal best sets a baseline. It counts as a
  personal best for the bonus, but it does not trigger the PB animation.
- Time and pace records are kept per target, so changing a target starts a new
  baseline. Runs are compared by pace (seconds per mile), so a longer run at a
  faster pace counts. A tie is not a record.
- Records are ordered by the day the session was logged.

### 4.5 Achievements (initial set)

| ID | Name | Condition | Tier |
|---|---|---|---|
| `first_session` | FIRST REP | First completed session | T2 |
| `first_<exercise>` | (per exercise) | First completed session of each exercise | T1 |
| `pb_<metric>` | NEW RECORD | Any personal best beaten (not the baseline) | T2 |
| `streak_6/12/24/48` | ON A ROLL / ... | Streak reaches 6, 12, 24, 48 | T2 |
| `perfect_week` | PERFECT WEEK | Each perfect week (repeatable) | T3 |
| `rank_<stat>_<n>` | RANK UP | Any stat reaches a new rank | T2 rank-up bar |
| `cap_7` | IRON WILL | 7 days in a row qualifying for DISCIPLINE | T2 |
| `mile_improve_30` | SPEED DEMON | Run pace 30 s/mi faster than the first run | T2 |
| `season_complete` | FALL 2026 CLEAR | Season ends, shown with a summary | T4 |

Repeatable achievements store how many times they were earned. Each one-time
achievement stores the date it was earned and a `seen` flag.

---

## 5. Rewards and animation tiers

| Tier | Trigger | Length | Contents |
|---|---|---|---|
| T1 | Session completed | ~1.5 s, not blocking | Ransom-note toast ("PUSH-UPS CLEAR!"), +points tick, sound |
| T2 | Personal best, milestone, rank-up | ~4 s, tap to skip | "ACHIEVEMENT UNLOCKED" banner with burst badge, shine sweep; rank-up uses the PROFICIENCY-style bar ("STRENGTH RANK 2 > 3 UP!") |
| T3 | Perfect week | ~10 s, tap to skip | Shard wipe, character cut-in, ray burst, banner, stat-up bars for the week, freeze-earned callout |
| T4 | Season finale | ~25–30 s, tap to skip | Full sequence based on the video's structure, then a season summary card |

- **Queueing:** one action can trigger several events. They are grouped and
  played in this order:
  1. the highest tier first
  2. then rank-ups, in stat order
  3. then remaining T2 items, each shortened to its banner only

  At most 3 animations play in a row. Anything after that is collapsed into a
  "+N more" card that links to the achievements list.
- An animation that is skipped or interrupted (app closed, for example) is
  marked seen only after it has been displayed or skipped. Unseen animations
  replay on the next app open.
- Settings has a "Reduce motion" option, which follows `prefers-reduced-motion`
  by default. It replaces every tier with a static card.
- *(As built in M4)*
  - Several T1 firsts in one batch merge into a single toast ("4 FIRSTS!").
  - Several ranks of one stat merge into one bar (e.g. RANK 1 > 3).
  - Record banners show the metric and the new value on two lines.
  - Blocking items dim the screen with a smooth CSS dim (a dithered scrim
    made the DOM text underneath look glitchy). Tap, Escape, Enter or Space
    skips; toasts never block taps.
  - The overlay spans the app column (max 560 px) at the same integer pixel
    scale as the room, and announces each reward to screen readers.
  - *(M6)* T3 is 10 s: shard wipe, character cut-in (current outfit), ray
    burst, banner, the week's points per stat, freeze callout. T4 is 22 s:
    title card, shards, the character over rays with the banner, final
    ranks, season numbers, star iris, then a SEASON SUMMARY card (also shown
    on Stats once the season is over). The summary card does not count
    toward the three-in-a-row cap.

---

## 6. Room and character progression

### 6.1 Character
- Reuses the video character: brown hair and red glasses, now in workout
  clothes: a teal zip-up track jacket with sleeves pushed to the elbows, a
  pink sports tank at the neckline, dark joggers with a side stripe,
  drawstring and ankle cuffs, and white sneakers with pink accents.
- The head and torso are ASCII sprites. The arms and legs are drawn as jointed
  lines, as in `character.py`.

| Expression | When |
|---|---|
| idle + blink | Default |
| happy | After a completion, for the rest of that day |
| side-eye | A counter is over its cap |
| relax (on the couch or at the table) | Sunday |
| look | Pending make-ups exist |
| sideeye | (new expression) heavy lids, eyes on the camera, one-sided mouth |

- Face priority: over a cap > completed a session today > make-ups pending >
  rest day (smile) > idle. Pose is seated on Sunday and outside the season.
- Idle animation runs at 12 fps: blink every 4.2 s (double blink every third
  cycle), breathing, a small hop when happy, and the window's neon sign
  flickering.

### 6.2 Unlocks (*tunable* mapping)

| Unlock | Condition | Type |
|---|---|---|
| Pull-up bar in the hall doorway (a doorway was added behind the character) | BACK rank 2 | Room |
| Yoga mat | LEGS rank 2 | Room |
| Dumbbells on the floor | STRENGTH rank 3 | Room |
| Neon running shoes (replace the white sneakers) | STAMINA rank 2 | Outfit |
| Headband | First perfect week | Outfit |
| Ponytail hairstyle | Streak 12 (HOT STREAK) | Hair (toggle) |
| Trophy shelf (shows top personal bests) | First personal best | Room |
| Calendar on the fridge (shows the streak number) | Streak 6 | Room |
| Window plant grows (3 stages) | DISCIPLINE ranks 3 / 6 / 9 | Room |
| Poster swaps to a medal | Season complete | Room |

- Unlocks appear automatically and cannot be removed or rearranged in v1.
- *(As built in M6)* Each reward that grants an unlock says so ("NEW:
  HEADBAND") on its banner or rank-up bar and in its announcement. Stats lists
  every unlock with its condition. The trophy shelf holds one trophy per
  record metric (up to 4).
- Exception: the ponytail is a hairstyle option. When it unlocks the
  character switches to it, and Settings gains a HAIR: DOWN / PONYTAIL toggle.
  It needs a redrawn head sprite (back hair gathered, a tie, the tail
  swinging slightly with the idle animation).

### 6.3 Counter props
- Each Diet Dr Pepper logged that day shows as a pixel can on the kitchen
  counter.
- Each snack shows as a wrapper.
- Both reset at rollover.
- *(As built in M5)* Cans stand in a 4-3-2-1 pyramid on the counter and
  wrappers lie on the tablecloth (chips, candy and granola colours in turn).
  Up to 10 of each are drawn; the counter shows the true total.

---

## 7. Soft-cap counters

| Counter | Unit | Default cap |
|---|---|---|
| Diet Dr Pepper | can | 2 |
| Snacks | item | 3 |

- Home has +/− buttons for each counter. A long press opens a small history of
  that day's entries. Each entry stores a timestamp, so undo works.
  *(As built in M5)* Tapping the counter name or value also opens it, so it
  works without a long press and from the keyboard. UNDO LAST removes the
  latest entry.
- Caps are editable in Settings, from 0 to 20.
- **Going over the cap:**
  - The counter turns red and the character side-eyes.
  - There is no other effect. Streaks, points and unlocks are never affected.
  - The only consequence is losing that day's DISCIPLINE points.
- A "Nothing today" button records an explicit zero for both counters
  (see 4.3).
- The data model supports any number of counters. The v1 UI shows these two.

---

## 8. Screens

The layout is phone-first and portrait. Navigation is a bottom tab bar:
**Home / Stats / Settings**. Logging opens as a full-screen sheet from Home.

### 8.1 Home
- **Top:** the room scene in a canvas, showing the character and unlocks.
- **Below the room:**
  - Today's card, for example "THU 10/8 • TODAY / 30 PUSH-UPS" with a progress bar and a
    "LOG" button. On Sunday it reads "REST DAY".
  - Make-up chips, if any.
  - The streak counter, plus the number of banked freezes.
  - The two counters, with "Nothing today".

### 8.2 Log sheet
- **Strength:**
  - A big rep stepper, the list of sets, and the stopwatch.
  - A large "DONE" button, active once at least one set is entered.
- **Run:** inputs for distance and time, plus the stopwatch.
- Saving triggers the reward queue.

### 8.3 Stats
- **Heatmap:**
  - Weeks as columns and Mon–Sun as rows, for the whole season.
  - *(As built in M5)* One-hue teal ramp (dark → bright on the dark card),
    checked as an ordinal ramp: monotone lightness, visible steps, and the
    lightest step clears the surface. Upcoming days are dashed outlines,
    today has a gold outline, and every cell has a text label. The full
    session list sits below in a collapsible ALL SESSIONS section as the
    table view.
  - Shading is in 4 steps from 0 to 100% completion.
  - Sundays are greyed out. Frozen sessions show a freeze icon.
  - Tapping a cell shows that day's sessions and counters.
- **Stat bars:** five rank bars showing current points and the next threshold.
- **Personal-best board:** every personal best with its date and the previous
  value.
- **Achievements list:** earned and locked achievements. Locked ones show their
  condition.

### 8.4 Settings
- Targets per exercise.
- Caps.
- Season start date.
- Rollover hour.
- Sound on/off (default off).
- Reduce motion.
- Export JSON and import JSON. Import replaces all data after a confirmation.
- Reset all data, with a typed confirmation.

---

## 9. Visual and audio style

### 9.1 Rendering
- **Integer pixel scale.** Pick the largest integer `S` that gives a native
  width of at least 180 px (`S = max(1, floor(viewportWidth / 180))`). Then
  `nativeW = floor(viewportWidth / S)` and `nativeH = floor(viewportHeight / S)`.
  - A 390 px wide phone gets `S=2`, a 195 px native width.
- Canvases are drawn at native size, then scaled up by CSS with
  `image-rendering: pixelated`.
- *(As built in M3)* `S` is chosen in **device** pixels
  (`floor(containerWidth × devicePixelRatio / 180)`), and the native width is
  capped at the 240 px art width. This keeps pixels square and even on
  fractional DPRs such as 2.625, and shows the whole room on desktop.
- *(As built in M3)* Drawing uses a small software rasterizer (PIL-style
  rect/line/ellipse/polygon on a `Uint32Array`) rather than canvas 2D paths,
  which antialias. The static scene is pre-lit once; each frame only the
  character's 60x80 box is redrawn (about 0.3 ms per frame on desktop).
- **Room art:**
  - Authored at 240x160 native pixels, a portrait-friendly crop of the video
    apartment: window, table, kitchen corner and fridge.
  - Cropped horizontally to the native width and centred on the character.
- **Overlay canvas:** reward animations play on a full-screen overlay canvas at
  native resolution.
- **Sprite format:** ported from the Python code. ASCII rows plus a palette map
  are turned into `ImageBitmap`s and cached. Ordered (Bayer 4x4) dithering for
  gradients is ported from `gfx.py`.

### 9.2 Palette
Use the colours from `achievement-video/gfx.py` without changes, declared once
as named tokens:
- **UI:** `red e8102a`, `red_d 9c0718`, `black 0c0a12`, `white f8f4f0`,
  `gold ffc93c`, `ink 24122e`
- **Character:** hair, skin, glasses, top, pants and socks, exactly as defined
  there

### 9.3 Typography
- **Canvas text:** the 5x7 bitmap font from `font.py`, ported, plus the
  ransom-note tile renderer from `ui.py`.
- **DOM text:** a pixel webfont released under the SIL Open Font License,
  bundled locally with no CDN at runtime. The specific font is picked during
  implementation, and its license is checked before it is added.

### 9.4 UI chrome
DOM panels use P5-style tilted black and red slabs, built with CSS
`clip-path`, with white ink outlines. Tap targets are at least 44 px.

### 9.5 Audio
- Web Audio sound effects synthesised in code, with no sample files: tick,
  stab, chime, rank-up, ding.
- Their character follows `audio.py`.
- Off by default. Audio starts only after a user gesture.
- No background music in v1.
- *(As built in M6)* Cues are pure data per reward (`src/audio/cues.ts`),
  timed against the fx timelines, and played by a small Web Audio synth:
  square ticks (one per banner letter, on the video's Gmaj9 arpeggio), blips,
  bells, detuned-saw brass stabs, noise whooshes, a sub "slam", and a glint.
  Skipping fades the item's sound out. Reduce motion plays one soft chime.

---

## 10. Data model

*(As built in M6)* `schemaVersion` is 2: `settings.hair` (`auto` | `down` |
`ponytail`) was added, and v1 saves and exports migrate automatically.

Stored in `localStorage` under the single key `workout-buddy`, as versioned
JSON. Every read and write is wrapped in try/catch. If storage is unavailable,
the app still runs for the session and shows a persistent "data won't be saved"
banner.

```ts
type LogicalDay = string;            // "YYYY-MM-DD" after rollover offset
type Exercise = "pushups" | "pullups" | "squats" | "run";

interface SaveFile {
  schemaVersion: 1;
  createdAt: string;                 // ISO timestamp
  settings: Settings;
  sessions: SessionLog[];
  counters: CounterEntry[];
  confirmedZeroDays: LogicalDay[];   // "Nothing today"
  seen: Record<string, number>;      // achievementId -> times shown
}

interface Settings {
  seasonStart: LogicalDay;
  seasonEnd: LogicalDay;             // "2026-12-31"
  rolloverHour: number;              // 0–23, default 3
  targets: Record<Exercise, number>; // reps, or miles for run
  caps: Record<string, number>;      // counterId -> cap
  sound: boolean;
  reduceMotion: "system" | "on" | "off";
}

interface SessionLog {
  id: string;
  slot: LogicalDay;                  // the scheduled day this session fulfils
  loggedOn: LogicalDay;              // differs from slot for make-ups
  exercise: Exercise;
  target: number;                    // snapshot at log time
  sets?: number[];                   // strength
  distance?: number;                 // run, miles
  durationSec?: number;              // stopwatch completion time or run time
  updatedAt: string;
}

interface CounterEntry {
  id: string;
  counterId: "dr_pepper" | "snacks" | string;
  day: LogicalDay;
  at: string;                        // ISO timestamp
  delta: 1 | -1;
}
```

- **Migrations:** `migrate(raw) -> SaveFile` runs on load and on import. It
  steps through schema versions in order. If it finds an unknown future
  version, the import is refused and a message is shown.
- **Export:** a `workout-buddy-YYYY-MM-DD.json` download of the `SaveFile`.

---

## 11. Technical stack

- **App:** Vite + React + TypeScript (matches `Q-A-Together`).
- **PWA:**
  - A web app manifest and icons, in the same pattern as Q-A-Together's
    `public/`.
  - A service worker that precaches the build so the app works offline.
- **Rendering:** two `<canvas>` elements, the room and the overlay, driven by
  one `requestAnimationFrame` loop. The loop is paused when the tab is hidden.
- **Animation timing:** each tier has a timeline module, like `timeline.py`,
  with event times in seconds as the single source of truth. Its beat grid is
  120 BPM.
- **Tests:** Vitest for the rules engine (streak, freezes, make-ups, stats,
  personal bests, achievements, rollover, migrations).
- **Deploy:**
  - A static build, so it can be hosted anywhere.
  - Default target is Vercel, like Q-A-Together. No server functions.
  - Data never leaves the device.

### 11.1 Proposed layout
```
src/
  app/            React shell, routing, screens (Home, Log, Stats, Settings)
  domain/         schedule, rules engine (pure), achievements table, types
  storage/        load/save, migrations, export/import
  pixel/          canvas setup, scaling, sprite loader, palette, font, dither
  pixel/sprites/  character, room, props, unlocks (ASCII sprite data)
  fx/             reward timelines and renderers (T1–T4), ransom text, rays, shards
  audio/          Web Audio SFX
tests/            Vitest specs for domain/ and storage/
```

---

## 12. Milestones

1. **Skeleton:** *(done)*
   - Vite/React/TS app, PWA manifest and service worker, storage with
     migrations.
   - Schedule and rollover logic.
   - Home, Log and Settings with DOM-only UI.
   - Pulled forward: the two counters (+/−, "Nothing today") and export/import.
     Still deferred: counter long-press history (M5) and the DOM pixel font
     (system fonts until then).
2. **Rules engine:** *(done)*
   - Streak, freezes, make-ups, stats, ranks, personal bests and achievements,
     with full Vitest coverage.
3. **Pixel renderer:** *(done)*
   - Scaling, sprite pipeline, palette and font.
   - Port the character and build the 240x160 room.
   - Idle animation and expressions.
4. **Rewards:** *(done)* T1 toast, T2 banner and rank-up bar, the reward queue, reduce
   motion.
5. **Counters and stats:** *(done)*
   - Counters with cans and wrappers in the room.
   - The heatmap, personal-best board and achievements list.
6. **Polish:** *(done)*
   - T3 perfect-week sequence.
   - Room and outfit unlocks.
   - Sound effects.
   - Export/import.
   - T4 season finale and summary.

---

## 13. Open items

- Pick the DOM pixel font and verify its license (9.3).
- Tune rank thresholds, points and the freeze cap after 2–3 weeks of real use.
- Decide whether pending make-ups get a gentle nudge on Home after Friday.
