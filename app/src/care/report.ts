/**
 * A one-page report for the child's therapist or teacher (plan Phase 6): the
 * last two weeks, what works for this child, goals, sessions, and — if the
 * parent chooses — the journal. Made on the device as a PDF (shared through
 * the phone's share sheet) or, on the web, through the browser's print
 * dialog ("Save as PDF").
 */
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { CareNote, CareProgress, JOURNAL_TAGS, JournalEntry } from "../shared/api";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function buildReportHtml({
  childName,
  progress,
  journal,
  notes,
}: {
  childName: string;
  progress: CareProgress;
  journal: JournalEntry[] | null; // null = the parent chose not to include it
  notes: CareNote[];
}): string {
  const days = progress.daily;
  const minutes = days.reduce((s, d) => s + d.minutes, 0);
  const answers = days.reduce((s, d) => s + d.answers, 0);
  const correct = days.reduce((s, d) => s + (d.accuracy_percent !== null ? (d.accuracy_percent * d.answers) / 100 : 0), 0);
  const breaks = days.reduce((s, d) => s + d.breaks, 0);
  const activeDays = days.filter((d) => d.minutes > 0 || d.answers > 0).length;
  const range = `${new Date(`${days[0].day}T12:00:00`).toLocaleDateString()} – ${new Date(`${days[days.length - 1].day}T12:00:00`).toLocaleDateString()}`;

  const recent = (journal ?? []).filter((e) => e.day >= days[0].day);
  const sleeps = recent.map((e) => e.sleep_hours).filter((v): v is number => v !== null);
  const tagCounts = new Map<string, number>();
  recent.forEach((e) => e.tags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)));

  const row = (cells: string[]) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(childName)} — AURA report</title>
<style>
  body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #1d1d1f; margin: 32px; font-size: 12.5px; line-height: 1.45; }
  h1 { font-size: 22px; margin: 0 0 2px; } h2 { font-size: 14px; margin: 22px 0 6px; border-bottom: 1px solid #d2d2d7; padding-bottom: 3px; }
  .muted { color: #6e6e73; } .tiles { display: flex; gap: 10px; margin-top: 12px; }
  .tile { flex: 1; border: 1px solid #d2d2d7; border-radius: 10px; padding: 8px 10px; } .tile b { display: block; font-size: 18px; }
  table { border-collapse: collapse; width: 100%; } td, th { text-align: left; padding: 4px 6px; border-bottom: 1px solid #ececf0; vertical-align: top; }
  th { font-weight: 600; color: #6e6e73; font-size: 11px; } .ok { color: #248a3d; font-weight: 600; }
</style></head><body>
<h1>${esc(childName)} — learning report</h1>
<div class="muted">${esc(range)} · made with AURA on ${new Date().toLocaleDateString()}</div>
<div class="tiles">
  <div class="tile"><b>${Math.round(minutes)}</b>minutes learning</div>
  <div class="tile"><b>${activeDays}</b>days with learning</div>
  <div class="tile"><b>${answers ? Math.round((100 * correct) / answers) + "%" : "–"}</b>answers right</div>
  <div class="tile"><b>${breaks}</b>breaks asked for</div>
</div>

<h2>What works for ${esc(childName)}</h2>
<table><tr><th>Question</th><th>Finding</th><th>Evidence</th></tr>
${progress.what_works.map((w) => row([esc(w.question), w.confirmed ? `<span class="ok">✓ ${esc(w.answer)}</span>` : esc(w.answer), esc(w.detail)])).join("")}
</table>
<p class="muted">AURA varies these on purpose within each child's own sessions and states a finding only once one option is clearly better for this child.</p>

<h2>Goals</h2>
${
  progress.goals.length
    ? `<table><tr><th>Goal</th><th>Status</th><th>Progress</th></tr>${progress.goals
        .map((g) => row([esc(g.statement), g.status === "met" ? '<span class="ok">Met</span>' : g.status === "paused" ? "Paused" : "In progress", `${g.sessions_in_a_row} of ${g.target_sessions} sessions in a row${g.recent_accuracies.length ? ` (recent: ${g.recent_accuracies.slice(-4).join("%, ")}%)` : ""}`]))
        .join("")}</table>`
    : '<p class="muted">No goals set.</p>'
}

<h2>Recent sessions</h2>
${
  progress.sessions.length
    ? `<table><tr><th>When</th><th>Minutes</th><th>Right</th><th>Breaks</th><th>Practised</th></tr>${progress.sessions
        .slice(0, 10)
        .map((s) => row([new Date(s.started_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }), `${Math.round(s.minutes)}`, s.accuracy_percent !== null ? `${s.accuracy_percent}%` : "–", `${s.breaks}`, esc(s.topics.join(", "))]))
        .join("")}</table>`
    : '<p class="muted">No sessions yet.</p>'
}

${
  journal
    ? `<h2>Family journal</h2>
<p>${recent.length} day${recent.length === 1 ? "" : "s"} logged.${sleeps.length ? ` Average sleep ${(sleeps.reduce((a, b) => a + b, 0) / sleeps.length).toFixed(1)} h.` : ""}${
        tagCounts.size ? ` Noted: ${[...tagCounts.entries()].map(([t, n]) => `${esc(JOURNAL_TAGS.find((x) => x.code === t)?.label ?? t)} (${n})`).join(", ")}.` : ""
      }</p>${progress.sleep_insight ? `<p>${esc(progress.sleep_insight.text)}</p>` : ""}`
    : ""
}

${notes.length ? `<h2>Notes</h2>${notes.slice(0, 6).map((n) => `<p><b>${esc(n.author_name)}</b> <span class="muted">${new Date(n.created_at).toLocaleDateString()}</span><br>${esc(n.text)}</p>`).join("")}` : ""}

<p class="muted" style="margin-top:24px">Figures come from ${esc(childName)}'s own practice in AURA and are estimates to support conversation with professionals — not a diagnosis or assessment.</p>
</body></html>`;
}

/** Opens the share sheet with the PDF (phones) or the print dialog (web). */
export async function shareReport(html: string): Promise<void> {
  if (Platform.OS === "web") {
    // expo-print on the web ignores `html` and prints the current page, so
    // load the report into a hidden frame and print that instead.
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
    frame.srcdoc = html;
    await new Promise<void>((resolve) => {
      frame.onload = () => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        setTimeout(() => {
          frame.remove();
          resolve();
        }, 1000);
      };
      document.body.appendChild(frame);
    });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Share report" });
  } else {
    await Print.printAsync({ uri });
  }
}
