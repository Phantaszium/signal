import "server-only";

import { Resend } from "resend";
import { env } from "@/lib/env";
import type { Account } from "@/lib/db/accounts";
import type { DigestRecord } from "@/lib/db/digests";
import { RELEVANCE_LABEL, SIGNIFICANCE_LABEL, relevanceClass } from "@/lib/developments";
import { FREQUENCY_LABEL, type DigestEntry } from "@/lib/digests/plan";

/**
 * Digest and alert emails. Both list stored developments only: every entry
 * links to its source, and the copy says plainly when nothing qualified.
 */

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function emailConfigured(): boolean {
  return Boolean(env.resendApiKey());
}

const ACCENT = "#14607a";
const HIGH = "#9a4a12";

function entryHtml(entry: DigestEntry, topicName: string, site: string): string {
  const { item, highPriority } = entry;
  const pub = item.publication;
  const link = `${site}/paper/${encodeURIComponent(pub.id)}`;
  const tone = highPriority ? HIGH : ACCENT;
  const meta = [
    escapeHtml(pub.source),
    escapeHtml(pub.publishedAt),
    escapeHtml(topicName),
    `${RELEVANCE_LABEL[relevanceClass(item.scores.researchRelevance)]} (${item.scores.researchRelevance})`,
    `${SIGNIFICANCE_LABEL[entry.significance]} significance`,
  ].join(" · ");
  return `
  <tr><td style="padding:14px 0;border-top:1px solid #e2e6ec">
    ${highPriority ? `<div style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${HIGH}">High priority</div>` : ""}
    <div style="font-size:11px;color:#8b95a5;margin-top:2px">${meta}</div>
    <a href="${link}" style="display:block;margin-top:4px;font-size:15px;font-weight:600;color:#0f172a;text-decoration:none;line-height:1.35">${escapeHtml(pub.title)}</a>
    <div style="margin-top:8px;padding:8px 12px;border-left:2px solid ${tone};background:${highPriority ? "#fdf5ee" : "#e7f1f4"};font-size:13px;line-height:1.55;color:#0f172a">
      <strong style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${tone}">Why it matters to you</strong><br>${escapeHtml(item.whyThisMatters)}
    </div>
    ${pub.url ? `<div style="margin-top:6px;font-size:12px"><a href="${escapeHtml(pub.url)}" style="color:${ACCENT}">Original source</a></div>` : ""}
  </td></tr>`;
}

function shell(title: string, intro: string, body: string, site: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e2e6ec;border-radius:8px;padding:24px">
    <tr><td style="font-size:20px;font-weight:600;color:#0f172a">${escapeHtml(title)}</td></tr>
    <tr><td style="padding-top:6px;font-size:13px;line-height:1.55;color:#5a6577">${intro}</td></tr>
    ${body}
    <tr><td style="padding-top:24px"><a href="${site}/" style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:9px 14px;border-radius:4px">Open Signal</a></td></tr>
    <tr><td style="padding-top:22px;font-size:11px;line-height:1.5;color:#8b95a5">Every item is a real record Signal retrieved and assessed. Explanations are AI assessments of titles and abstracts; check the source before relying on a claim. Change how often Signal emails you in <a href="${site}/settings" style="color:#8b95a5">Settings</a>.</td></tr>
  </table></td></tr></table></body></html>`;
}

async function send(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = env.resendApiKey();
  if (!apiKey) return false;
  const { error } = await new Resend(apiKey).emails.send({ from: env.emailFrom(), to, subject, html });
  if (error) throw new Error(`Resend: ${error.message}`);
  return true;
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Email a digest. Returns false when email is not configured. */
export async function sendDigestEmail(
  account: Account,
  digest: DigestRecord,
  entries: DigestEntry[],
  topicNames: Map<string, string>,
): Promise<boolean> {
  const site = env.siteUrl();
  const period = `${day(digest.periodStart)} – ${day(digest.periodEnd)}`;
  const label = FREQUENCY_LABEL[digest.frequency].label;
  const high = entries.filter((e) => e.highPriority).length;
  const shown = entries.slice(0, 10);

  const statusRows = digest.summary.topics
    .map(
      (t) =>
        `<tr><td style="padding:4px 0;font-size:12px;color:#5a6577"><strong style="color:#0f172a">${escapeHtml(t.name)}</strong> · ${escapeHtml(t.headline)}</td></tr>`,
    )
    .join("");

  const unchecked = digest.summary.topics.filter((t) => !["quiet", "developments"].includes(t.state));
  const caveat = unchecked.length
    ? ` <strong>${unchecked.length} of your topics could not be fully checked</strong>; see Monitoring status below.`
    : "";
  const intro = entries.length
    ? `${period}: ${entries.length} new development${entries.length === 1 ? "" : "s"} across your monitored topics${high ? `, <strong style="color:${HIGH}">${high} high priority</strong>` : ""}.${caveat}`
    : unchecked.length
      ? `${period}: no qualifying developments were found in what Signal could check.${caveat} That is not the same as nothing happening.`
      : `${period}: no qualifying developments were found across your monitored topics. Signal only reports records it judged relevant to your topics, so a quiet period is reported as quiet.`;

  const body = `
    ${shown.map((e) => entryHtml(e, topicNames.get(e.topicId) ?? "Topic", site)).join("")}
    ${entries.length > shown.length ? `<tr><td style="padding-top:10px;font-size:12px;color:#5a6577">${entries.length - shown.length} more in the app.</td></tr>` : ""}
    ${statusRows ? `<tr><td style="padding-top:22px;font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:#5a6577">Monitoring status</td></tr>${statusRows}` : ""}`;

  const subject = entries.length
    ? `Signal ${label.toLowerCase()}: ${entries.length} new development${entries.length === 1 ? "" : "s"}${high ? ` (${high} high priority)` : ""}`
    : unchecked.length
      ? `Signal ${label.toLowerCase()}: nothing found, but some checks were incomplete`
      : `Signal ${label.toLowerCase()}: nothing qualifying this period`;

  return send(account.email, subject, shell(`Your Signal ${label.toLowerCase()}`, intro, body, site));
}

/** Email an alert for high-priority developments. Returns false when email is not configured. */
export async function sendAlertEmail(
  account: Account,
  entries: DigestEntry[],
  topicNames: Map<string, string>,
): Promise<boolean> {
  const site = env.siteUrl();
  const first = entries[0].item.publication.title;
  const subject =
    entries.length === 1
      ? `Signal alert: ${first.slice(0, 90)}`
      : `Signal alert: ${entries.length} high-priority developments`;
  const intro = `Signal found ${entries.length === 1 ? "a development" : `${entries.length} developments`} it rates high priority for your monitored topics: directly relevant and significant.`;
  const body = entries.map((e) => entryHtml(e, topicNames.get(e.topicId) ?? "Topic", site)).join("");
  return send(account.email, subject, shell("High-priority development", intro, body, site));
}
