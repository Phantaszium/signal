import "server-only";

import { Resend } from "resend";
import { env } from "@/lib/env";
import type { Account } from "@/lib/db/accounts";
import { getItemState, itemsForBriefing, type BriefingRecord } from "@/lib/db/briefings";
import { rankBriefing } from "@/lib/ranking/scoring";
import type { ScoredPublication } from "@/lib/types";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function itemHtml(item: ScoredPublication, site: string, emphasis: boolean): string {
  const pub = item.publication;
  const link = `${site}/paper/${encodeURIComponent(pub.id)}`;
  return `
  <tr><td style="padding:14px 0;border-top:1px solid #e2e6ec">
    <div style="font-size:11px;color:#8b95a5">${escapeHtml(pub.source)} · ${escapeHtml(pub.publishedAt)} · Signal ${item.signalScore}</div>
    <a href="${link}" style="display:block;margin-top:4px;font-size:${emphasis ? 17 : 15}px;font-weight:600;color:#0f172a;text-decoration:none;line-height:1.35">${escapeHtml(pub.title)}</a>
    <div style="margin-top:8px;padding:8px 12px;border-left:2px solid ${emphasis ? "#9a4a12" : "#14607a"};background:${emphasis ? "#fdf5ee" : "#e7f1f4"};font-size:13px;line-height:1.55;color:#0f172a">
      <strong style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${emphasis ? "#9a4a12" : "#14607a"}">Why this matters to you</strong><br>${escapeHtml(item.whyThisMatters)}
    </div>
  </td></tr>`;
}

function section(title: string, items: ScoredPublication[], site: string, emphasis = false) {
  if (!items.length) return "";
  return `
  <tr><td style="padding-top:22px;font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:${emphasis ? "#9a4a12" : "#5a6577"}">${title}</td></tr>
  ${items.map((i) => itemHtml(i, site, emphasis)).join("")}`;
}

/**
 * Email one ready briefing. Returns false when email is not configured, so
 * the caller does not mark the briefing as sent.
 */
export async function sendBriefingEmail(
  account: Account,
  briefing: BriefingRecord,
): Promise<boolean> {
  const apiKey = env.resendApiKey();
  if (!apiKey) return false;

  const [items, state] = await Promise.all([
    itemsForBriefing(account.id, briefing.id),
    getItemState(account.id),
  ]);
  const ranked = rankBriefing(items, account.weights, new Set(state.dismissedIds));
  const site = env.siteUrl();
  const scanned = briefing.funnel.scanned.toLocaleString("en-US");
  const notable = ranked.notable.slice(0, 5);

  const subject = ranked.high.length
    ? `Signal: ${ranked.high.length} worth reading today — ${ranked.high[0].publication.title.slice(0, 70)}`
    : `Signal: nothing urgent today (${ranked.relevant.length} relevant)`;

  const html = `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e2e6ec;border-radius:8px;padding:24px">
    <tr><td style="font-size:20px;font-weight:600;color:#0f172a">Your Signal briefing</td></tr>
    <tr><td style="padding-top:6px;font-size:13px;color:#5a6577">${scanned} records read → ${ranked.relevant.length} likely relevant → <strong style="color:#9a4a12">${ranked.high.length} worth reading</strong></td></tr>
    ${ranked.high.length ? "" : `<tr><td style="padding-top:18px;font-size:14px;color:#0f172a">Nothing crossed the bar for "read today". The items below are worth knowing about.</td></tr>`}
    ${section("Read these", ranked.high, site, true)}
    ${section("Worth knowing about", notable, site)}
    <tr><td style="padding-top:24px"><a href="${site}/" style="display:inline-block;background:#14607a;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:9px 14px;border-radius:4px">Open the full briefing</a></td></tr>
    <tr><td style="padding-top:22px;font-size:11px;line-height:1.5;color:#8b95a5">Rankings and explanations are AI assessments of titles and abstracts; check the source before relying on a claim. Turn this email off in <a href="${site}/settings" style="color:#8b95a5">Settings</a>.</td></tr>
  </table></td></tr></table></body></html>`;

  const { error } = await new Resend(apiKey).emails.send({
    from: env.emailFrom(),
    to: account.email,
    subject,
    html,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
  return true;
}
