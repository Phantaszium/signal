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

const ACCENT = "#1d6a87";
const HIGH = "#c9561f";

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
  <tr><td style="padding:14px 0;border-top:1px solid #e9e3d8">
    ${highPriority ? `<div style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${HIGH}">Worth reading first</div>` : ""}
    <div style="font-size:11px;color:#8b95a5;margin-top:2px">${meta}</div>
    <a href="${link}" style="display:block;margin-top:4px;font-size:15px;font-weight:600;color:#15233f;text-decoration:none;line-height:1.35">${escapeHtml(pub.title)}</a>
    <div style="margin-top:8px;padding:8px 12px;border-left:2px solid ${tone};background:${highPriority ? "#fdf1e8" : "#e6f1f4"};font-size:13px;line-height:1.55;color:#15233f">
      <strong style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${tone}">Why this matters to your research</strong><br>${escapeHtml(item.whyThisMatters)}
    </div>
    ${pub.url ? `<div style="margin-top:6px;font-size:12px"><a href="${escapeHtml(pub.url)}" style="color:${ACCENT}">Original source</a></div>` : ""}
  </td></tr>`;
}

function shell(title: string, intro: string, body: string, site: string): string {
  return `<!doctype html><html><body style="margin:0;background:#fbf8f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e9e3d8;border-radius:16px;padding:24px">
    <tr><td style="font-size:13px;font-weight:700;color:#1d6a87;padding-bottom:10px">PaperPuffin</td></tr>
    <tr><td style="font-size:20px;font-weight:600;color:#15233f">${escapeHtml(title)}</td></tr>
    <tr><td style="padding-top:6px;font-size:13px;line-height:1.55;color:#5a6577">${intro}</td></tr>
    ${body}
    <tr><td style="padding-top:24px"><a href="${site}/home" style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 16px;border-radius:10px">Open PaperPuffin</a></td></tr>
    <tr><td style="padding-top:22px;font-size:11px;line-height:1.5;color:#8b95a5">Every paper is a real record PaperPuffin retrieved from PubMed or a preprint server. Explanations are AI readings of titles and abstracts, not the full text; check the source before relying on a claim. Change how often PaperPuffin emails you in <a href="${site}/settings" style="color:#8b95a5">Settings</a>.</td></tr>
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
    ? ` <strong>${unchecked.length} of your topics could not be fully checked</strong>; see Update status below.`
    : "";
  const intro = entries.length
    ? `${period}: ${entries.length} new paper${entries.length === 1 ? "" : "s"} for your research${high ? `, <strong style="color:${HIGH}">${high} worth reading first</strong>` : ""}.${caveat}`
    : unchecked.length
      ? `${period}: nothing to recommend from what PaperPuffin could search.${caveat} That is not the same as nothing being published.`
      : `${period}: no new papers cleared the bar for your topics. PaperPuffin only recommends papers it judged relevant to your research, so a quiet period is reported as quiet.`;

  const body = `
    ${shown.map((e) => entryHtml(e, topicNames.get(e.topicId) ?? "Topic", site)).join("")}
    ${entries.length > shown.length ? `<tr><td style="padding-top:10px;font-size:12px;color:#5a6577">${entries.length - shown.length} more in the app.</td></tr>` : ""}
    ${statusRows ? `<tr><td style="padding-top:22px;font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:#5a6577">Update status</td></tr>${statusRows}` : ""}`;

  const subject = entries.length
    ? `Your ${label.toLowerCase()}: ${entries.length} new paper${entries.length === 1 ? "" : "s"}${high ? ` (${high} worth reading first)` : ""}`
    : unchecked.length
      ? `Your ${label.toLowerCase()}: nothing found, but some searches were incomplete`
      : `Your ${label.toLowerCase()}: a quiet period`;

  return send(account.email, subject, shell(`Your ${label.toLowerCase()}`, intro, body, site));
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
      ? `Worth reading: ${first.slice(0, 90)}`
      : `${entries.length} new papers worth reading first`;
  const intro = `PaperPuffin found ${entries.length === 1 ? "a new paper" : `${entries.length} new papers`} you should read first: directly relevant to your research and significant for the field.`;
  const body = entries.map((e) => entryHtml(e, topicNames.get(e.topicId) ?? "Topic", site)).join("");
  return send(account.email, subject, shell("Worth reading first", intro, body, site));
}
