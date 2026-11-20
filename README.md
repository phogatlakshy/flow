# SkillRelay

SkillRelay helps a lead turn an English or Korean work request into a calendar assignment. The demo uses 1,000 employee rows across five departments and 58 skills. The fixture clock starts at 09:00 KST on 24 November 2026.

## Run locally

Use Node.js 22.12 or later. Run these commands from this directory.

~~~sh
npm ci
npm run dev
~~~

Open the local address printed by Vite, normally [http://127.0.0.1:5173/](http://127.0.0.1:5173/). The app opens on the **Dashboard**. Use the sidebar (or **Ctrl K**) to reach **Employees**, **Automation**, **Assign Work**, **Team Calendar**, **Work Log**, **Analytics**, **Employee View**, and **Upload CSV**. The sun/moon button switches light and dark themes. The seeded example and manual intake work as soon as you open **Assign Work**.

## Connect Ollama

1. Start Ollama on the same machine. On Windows, launch it from the Start menu. On a system without a running Ollama service, run `ollama serve` in a separate terminal. [Ollama on Windows](https://docs.ollama.com/windows)
2. Install the default model with `ollama pull qwen3-vl:8b-instruct`, or choose a compatible local chat model already installed under **Settings**. To set a project default or a different loopback port, copy `.env.example` to `.env.local`, edit it, and restart Vite.
3. Confirm that the header shows **Ollama connected**, then choose **Extract with Ollama**. The proxy calls Ollama’s model list and chat endpoints. The app validates structured JSON and opens an editable draft. If extraction fails, the manual form keeps the original message. [Ollama chat](https://docs.ollama.com/api/chat) · [Structured outputs](https://docs.ollama.com/capabilities/structured-outputs)

The workspace calendar, roster, and scores stay in the browser. Ollama receives the request, reference clock and time zone, skill catalog, and extraction instructions. Vite’s loopback proxy supports both `npm run dev` and `npm run preview`.

## Walk through the dashboard fix

1. Open **Assign Work** (or choose **Open demo task** on the Dashboard). Choose **Open demo task** for the reviewed example fields, or choose **Extract with Ollama** to draft the task from the displayed message. Review the mandatory skill levels and confirm the task.
2. Choose **Compare candidates**. Gary Watkins has one usable hour and Tracy Juarez’s staging access requires verification. Kimberly Mcbride can reserve 09:00–12:00 and 13:00–14:00. Her plan leaves 14:00–15:00 free before the demo.
3. Choose **Review approval**, then **Confirm assignment**. Both work blocks appear in **Team calendar** and Kimberly’s **Employee view**. Use **Download calendar** to save an iCalendar file for both blocks.
4. In the employee view, request a review or suggest a different upper effort. In the team calendar, open the task and choose **Plan replacement**. **Settings → Reset workspace** restores the seeded demo. The original blocks stay visible until the replacement is approved.
5. To try a no-fit case before approval, set **Focus mode** to **One continuous block**. Open **Simulate alternatives** to check revised constraints without booking anything.

## Team operations

- **Employees** is the searchable staff directory; select a row to open the profile panel. **Automation** runs the schedule scan; the bell in the header lists open reviews and the latest findings. Scan findings include overlapping commitments, tight deadlines, pending reviews, workload thresholds, and skills with a single verified owner.
- **Work Log** filters assignments by task, person, status, or priority and exports the matching audit history as CSV. Calendar export is also available for the filtered work log. [iCalendar format](https://www.rfc-editor.org/rfc/rfc5545)
- **Upload CSV** (also under **Settings**) accepts commitments or verified skill and work-window updates for existing synthetic IDs in the selected team. Download the template for its column names and KST format. Preview validates every row before applying the file. Skills and working windows replace the specified employee’s previous values.
- **Analytics** replays the same seeded requests and staffing policy with SkillRelay and previous-owner-first. The replay defines deferred as partial capacity and blocked as zero booked minutes. It stays separate from the browser’s live demo calendar.

## Employee data

The app retains the names, departments, manager groups, source job titles, employment types, shifts, and statuses from [fake_employee.csv](fake_employee.csv). The source row key gives every employee a unique workspace ID even when the source employee ID repeats. The default Product Platform squad brings together eight active people from the source roster. The other teams use the source department and manager groups.

Planning roles align with department responsibilities. The directory shows the original role alongside the enriched profile. Skill levels, work examples, access windows, calendar entries, and assignment histories are synthetic demo records. For example, frontend profiles pair React and TypeScript with browser testing and accessibility, and Finance profiles pair Excel and Power Query with reconciliation, forecasting, or budgeting. Rows with leave or ended employment stay in the directory and are excluded from new assignments.

Shift labels map to 09:00–17:00, 12:00–20:00, and 22:00–06:00 KST. The demo policy includes an overnight break from 00:00 to 00:30. Choose **24 hours** on the calendar to see overnight commitments.

Use `npm run data:sync` to regenerate the app’s roster and the [enriched profile CSV](data/employee_profiles.csv). To import profile edits back into the app, filter the CSV to the selected `workspace_team` first. The original CSV stays as supplied. Prior fixture bookings use a separate browser storage key because their employee IDs belong to the earlier roster.

## Verify and build

~~~sh
npm test
npm run build
npm run preview
~~~

The tests cover scheduling, focus and access constraints, rotation, stale and duplicate approvals, no-fit simulations, intake validation, local CSV operations, and calendar export.

## Banner art

The workspace banner was generated with built-in ImageGen using the prompt below. [relay-track.png](public/relay-track.png)

> Generate ONLY a wide 3:2 raster 3D illustration asset for the right edge of a premium web dashboard hero, no text, no letters or words. Scene: a monumental sculptural relay track, three interlocking parallel U-shaped tubular rails sculpted as a smooth flowing forward bend, travelling from lower left foreground into upper right, embossed concentric lanes with elegant polished glossy lavender, violet and silver pale lilac surfaces. The biggest bend sits on the right center. A small warm peach-orange sphere rests on one lane near the upper right bend; a small off-white ball in lower left, tiny single star-glint near upper center. Immaculate product visualization, a recognizable abstract relay, crisp and high-end, rich purple directional soft light, polished highlights. Background is entirely solid very dark aubergine #211638 with only a subtle violet bloom immediately around the sculpture; left quarter is empty aubergine dark space so it can fade into a CSS hero. Camera tilted isometric. Close crop, thick practical physical solid forms. Muted restrained premium editorial, no excess elements, no text, no fake UI. Website decorative hero abstract. Color accent peach exactly one sphere, core art vibrant pastel-violet with high contrast over deep aubergine.
