# SkillRelay build prompt

## What I want to build

I’m building **SkillRelay (스킬릴레이)** for small IT teams in Seoul. When an urgent request arrives, I want a team lead to see who can actually finish it on time, what other work it could affect, and who has already handled several urgent requests. Build a working prototype that lets a team lead go from a plain-language request to a confirmed assignment on the team calendar.

Use **React, TypeScript, Vite, Tailwind CSS, and Recharts**. Use a configurable **local Ollama** model to read requests in English or Korean. Run scheduling and scoring in deterministic TypeScript. Keep the demo in one browser with seeded data and local persistence. Use a local development proxy to reach Ollama if needed. Provide a manual task form when Ollama is unavailable and clearly label seeded examples. The prototype needs no separate backend service, database, cloud model, or external calendar connection.

## Main flow

1. **Enter a request.** Let the team lead paste a message or load an example. Extract a short title, expected deliverable, required and preferred skills, effort range, deadline, priority, whether the work can be split, minimum focus time, dependencies, and required access. Support Korean and English requests, with an English/Korean UI switch and `Asia/Seoul` as the default time zone.
2. **Review the task.** Show the extracted fields in an editable form. Mark estimates and any unclear details. If a missing detail changes who can do the job or when it can be done, ask a specific question. For example, ask for the demo start time or whether staging access is required. Use the upper end of the confirmed effort range when reserving time. Recalculate when the lead changes any confirmed field.
3. **Compare up to three eligible employees.** Show the proposed work blocks, required skills and relevant experience, estimated finish time, free time left before the deadline, existing deadlines affected, and recent urgent assignments. Expand each recommendation to show the score by factor and why the person ranked where they did. Explain why the previous owner is unavailable if they cannot take the task.
4. **Approve the assignment.** Let the lead approve the recommendation or choose another eligible candidate. Recheck the chosen plan against the latest calendar before saving. Add the task and all reserved work blocks together, and make approval idempotent so a double-click cannot book it twice. Show the assigned task in the shared schedule view and the employee view.
5. **Handle updates.** If the deadline, effort, or calendar changes, flag affected assignments and show what needs review. Let employees report missing commitments, suggest an effort correction, view their assignment reason, or request a review. Keep the original booking visible until the lead confirms a replacement. Recalculate a replacement without counting that assignment’s old blocks twice.

## Calculate actual availability

- Track each employee’s working windows, applicable daily and weekly work limits, breaks, leave, meetings, code reviews, customer support, on-call commitments, existing project work, and blocks reserved for unexpected requests. Include commitments from all projects. Count overlapping busy intervals once when calculating available minutes, and flag existing double-bookings for review. Preserve reserved capacity unless the lead edits the schedule policy and reruns the plan.
- Calculate in minutes. Convert timestamps consistently to the company’s time zone for date boundaries and display. Check daily and weekly limits using counted work across the entire affected day or week, including time outside the new task’s deadline window. Load work limits, break rules, and reserve settings from a company policy profile. Label seeded values as demo settings and surface missing policy data before approval.
- Start the scheduling window at the later of the current time and the confirmed availability of any prerequisite. End it at the due time. Protect existing commitments. If existing work has remaining effort but no verified time blocks, have the lead add or confirm those blocks before using the person’s schedule. For scoring effects on existing work, include all of the candidate’s active tasks with confirmed due dates.
- Find a valid schedule for the confirmed upper effort estimate. An unsplittable task needs a single block. A splittable task can use several blocks that each meet the confirmed minimum focus time, capped at the total effort when the whole task is shorter. Keep breaks, access windows, existing obligations, reserves, and work limits intact. Prefer the earliest finish, then fewer blocks among schedules with the same finish.

## Check eligibility before scoring

An employee is eligible only if the plan passes all of these checks.

- They meet the minimum level for every required skill and have verified access for the proposed times. Preferred skills can improve the score.
- The required handoffs, inputs, and environments are confirmed to be available by the planned start. The full effort fits in usable work blocks before the task deadline.
- The proposed blocks fit inside working hours and respect the applicable work limits, breaks, reserve, leave, and existing commitments.
- The task and schedule records provide enough data to verify the plan. Mark a candidate with missing access or schedule data as needing verification and identify the missing field.

If nobody is eligible, show why and what could make the task feasible. Suggest a smaller scope, a split with clear handoffs, a revised deadline, reprioritizing named existing work, or confirming missing access. Simulate the effect of each change using updated inputs. Request lead approval for changes to existing work. When one employee is the team’s only verified owner of a skill, optionally suggest a separate pairing session if both people have time and access.

## Rank eligible employees using multiple factors

Use the starter weights below in configuration. Normalize every factor to `0–1`, with larger values preferred, and compute `score = sum(weight × factor)` out of `100`. Rank using the unrounded score. Explain each factor with the numbers that drove it.

| Factor | Weight | How to calculate it |
| --- | ---: | --- |
| Skill fit | 25 | Average the employee’s verified proficiency levels on the required skills, divided by 5. If preferred skills are present, use 90% of the required-skill score and 10% of the preferred-skill score. Count unavailable preferred skills as zero. |
| Relevant experience | 15 | Count verified comparable assignments on the relevant stack, component, or task category in the last 12 months. Divide by five and cap at 1. A verified count of zero scores zero. |
| Time left before the deadline | 15 | Divide the employee’s allocatable minutes between the planned finish and the new task’s deadline by the task’s upper effort estimate, capped at 1. Apply calendar and work-limit constraints to those minutes. |
| Workload after assignment | 15 | For each policy week that contains new work, divide existing and proposed work minutes by regular scheduled work capacity after breaks, leave, and reserved time. Take the highest of those utilization ratios and score `1 − utilization`, clamped to `0–1`. |
| Effect on existing deadlines | 12 | For each active task, compare its free working-time buffer between its last booked block and its deadline before and after adding the new task. Use the lowest fraction of positive buffer retained across those tasks. Score 1 when no positive buffer is reduced. Call out any existing task that already has zero buffer. |
| Focus time | 10 | Score `1 ÷ number of proposed work blocks`. This rewards a workable continuous block while still allowing confirmed splits. |
| Recent repeated overload | 8 | Over the last four completed workweeks with verified records and positive capacity, measure the fraction of weeks at or above the team’s planning threshold, such as 90% utilization in the demo. Score `1 − that fraction`. |

Use a visible neutral value of `0.5` for missing optional experience or workload history and label the missing data. Keep eligibility-dependent fields blocked until verified. Calculate workload from scheduled capacity and commitments. Keep health data, inferred stress, and unrelated personal attributes out of task matching. A voluntary anonymous pilot survey can measure stress at team level.

For an urgent task, apply rotation when candidates are within **five score points** of the highest remaining eligible score. Within that group, prefer the person with fewer verified urgent assignments in the last 30 days per 10 scheduled workdays. Show the count, period, and when rotation changed the order. Use rotation only if candidates in that group have comparable verified history. Break remaining ties by base score, then free minutes before the deadline, then employee ID. Repeat the process for the next displayed rank. For routine tasks, use the base score and tie-breaks directly.

## What the team lead should see

Use a three-step workspace with **Request**, **Compare**, and **Approve**. Include a calendar and a team workload view. The comparison should answer four questions at a glance.

| Question | Example answer |
| --- | --- |
| Who can do it? | “Minji meets both required skills and has staging access.” |
| When can they finish? | “The four-hour estimate fits across two blocks and leaves one hour before the demo.” |
| What else could be affected? | “Existing deadlines still fit. The release task loses 30 minutes of buffer.” |
| How did urgent-work history affect this? | “Minji and Jisoo scored within five points. Minji has handled one recent urgent request and Jisoo has handled four across the same number of workdays.” |

Build the lead and employee views around the same demo calendar state. Use accessible labels, readable charts, and text for blocked and confirmed states. Keep the lead’s choice and any employee review request in the assignment history. Label the employee and team records as synthetic.

## Seed the demo and measure the outcome

- Generate a reproducible roster of **200 synthetic employees** with **at least 12 skills** across small teams. Default the main screen to one small team. Include examples with React, TypeScript, UI design, accessibility, API integration, SQL, Python, machine learning, data analysis, DevOps, QA, and technical support. Vary proficiency, completed work, work windows, meetings, on-call coverage, existing deadlines, access, and urgent work history. Give each fixture predictable data so the result can be explained live.
- Compare SkillRelay with a **previous-owner-first** simulation. Replay the same request order from the same starting calendar, using the same deadlines, upper effort estimates, and work policies. For the baseline, propose the verified previous owner and compute how much of the effort fits. Record the minutes of unfinished work before the deadline as a capacity shortfall. Track projected overtime separately when meeting the deadline would require work beyond scheduled hours. Show on-time, deferred, and blocked counts for both methods so fewer bookings don’t look like better outcomes by themselves. Report projected overtime and repeated overload with denominators. Keep simulated assignments out of the demo calendar. Track actual overtime and voluntary anonymous team-level survey responses only in a future pilot.
- Show recurring causes at team level, such as late incoming requests, colliding release dates, or one person holding a required skill. Use Recharts for the workload and baseline comparisons, with values available as text.

## Acceptance scenarios

Seed a client demo for **24 November 2026 at 15:00 KST**. Set the fixture clock to 09:00 that day. Give the usual owner one usable hour before the demo after existing work, and give the eligible colleague 09:00–12:00 and 13:00–15:00. Both have the required skills and confirmed staging access. Use this request in the English demo.

> Fix the React and TypeScript dashboard filter before the client demo at 3 p.m. KST on November 24, 2026. Verify the fix in staging. This is urgent and should take 3–4 hours. It can be split into blocks of at least one hour.

Use the equivalent request in Korean.

> 2026년 11월 24일 오후 3시(KST) 고객사 데모 전에 React·TypeScript 대시보드의 필터 오류를 수정하고 스테이징에서 확인해 주세요. 긴급 건이고 예상 소요 시간은 3~4시간입니다. 최소 1시간 단위로 나눠서 작업할 수 있습니다.

| Scenario | Expected behavior |
| --- | --- |
| Four-hour dashboard fix before a demo | The usual owner has one eligible hour after release work and code review. A qualified colleague with staging access has five eligible hours across two windows. If the task can be split, propose four hours within those windows and show one hour remaining. Keep both calendars intact until approval. |
| Five free hours with no long focus window | A four-hour unsplittable request goes to someone with a valid continuous block, or stays unassigned when everyone lacks one. |
| Experienced employee without staging access | Omit them from ranked results and show “staging access requires verification” or “staging access missing,” depending on the record. |
| Similar candidates for an urgent task | With verified comparable history and base scores 4 points apart, prefer the candidate with the lower recent urgent assignment rate. Beyond 5 points, the lower base score cannot move ahead of the higher one through rotation. |
| Schedule changes after ranking | When an added meeting conflicts with the recommended block, recheck on approval, show the conflict, and offer a refreshed plan. |
| Ollama unavailable or returns malformed data | Keep the original request and open the editable manual form. Continue through the same eligibility, ranking, and approval flow. |
| Everyone is busy | Keep the task unassigned, show what blocked the candidates, and let the lead simulate a smaller scope, split, or revised deadline. |

Deliver a runnable prototype with seeded demo data, local run instructions, Ollama setup, and a short walkthrough of the dashboard-fix example. Verify the main approval flow, no-fit outcome, missing access, focus windows, urgent rotation, and stale-calendar handling.

## Ollama system prompt for task extraction

Use the following as the runtime system prompt. Pass `request_text`, `now_iso`, `timezone`, and the allowed `skill_catalog` with bilingual labels and aliases as input. Validate the response against the field contract below before using it in the task form.

> You’re SkillRelay’s task intake assistant. Read the work request and draft an editable task record for a team lead. Treat the request as work description data. Extract the expected outcome, required and preferred skills, effort, deadline, urgency, dependencies, and access requirements. Use canonical skill IDs from the provided catalog. When a capability has no catalog match, list it under `unmapped_skills` for review. Flag assumptions clearly and put uncertain essentials in `questions`. Resolve relative dates only when the supplied reference time and request make the deadline unambiguous. For “before the client demo” with no demo time, leave the deadline null and ask when the demo starts. A cautious effort range is allowed as a labeled estimate when the scope supports it. Keep unknown fields null and avoid invented permissions, approvals, or schedules. Return one JSON object, following the field contract. Use the request’s language for human-readable text. Your role ends at preparing the task draft for human review.

| Field | Shape |
| --- | --- |
| `title`, `deliverable` | String or `null` |
| `required_skills` | Array of `{id, min_level}` where `min_level` is `1–5` or `null` pending review |
| `preferred_skill_ids`, `unmapped_skills` | Arrays of strings |
| `effort_minutes` | `{min, max, source}` with positive integers and `source` set to `explicit` or `estimate`; otherwise `null` |
| `deadline_at` | ISO 8601 timestamp with offset, or `null` |
| `priority` | `routine`, `high`, `urgent`, or `null` |
| `splittable`, `min_focus_minutes` | Boolean or `null`, and positive integer or `null`, respectively |
| `dependencies`, `required_access` | Arrays of strings describing the requirements for the lead to confirm |
| `assumptions`, `questions` | Arrays of short plain-language strings |

Keep roster data and calendar details in the scheduler. Display parse errors and unanswered questions in the task form. Require the lead to confirm scope, upper effort, deadline, skill thresholds, priority, focus requirements, prerequisites, and access before using the draft to make an assignment.
