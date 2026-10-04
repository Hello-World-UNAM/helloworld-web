import { emailShell } from './selection-legacy-templates.ts';

export interface SelectionNotice {
  subject: string;
  heading: string;
  eyebrow: string;
  tone: 'success' | 'notice';
  paragraphs: string[];
  detail?: { label: string; text: string };
  action?: { label: string; url: string; description: string };
  closing?: string;
}

function escape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderSelectionNotice(notice: SelectionNotice): { subject: string; text: string; html: string } {
  const green = notice.tone === 'success';
  const panel = notice.detail || notice.action ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;background:${green ? '#d1fae5' : '#f0e6ff'};border:4px solid #000;margin:28px 0;">
      <tr><td class="mail-panel" style="padding:28px 24px;text-align:center;overflow-wrap:break-word;word-wrap:break-word;">
        ${notice.detail ? `<p style="font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#6225e6;margin:0 0 10px;">${escape(notice.detail.label)}</p><p style="font-size:17px;font-weight:800;line-height:1.5;margin:0 0 18px;">${escape(notice.detail.text)}</p>` : ''}
        ${notice.action ? `<p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 18px;">${escape(notice.action.description)}</p><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width:100%;margin:0 auto;"><tr><td bgcolor="#6225e6" style="background:#6225e6;border:3px solid #000;"><a class="mail-button" href="${escape(notice.action.url)}" style="max-width:100%;box-sizing:border-box;overflow-wrap:break-word;display:inline-block;padding:14px 20px;color:#fff;text-decoration:none;font-size:14px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">${escape(notice.action.label)}</a></td></tr></table>` : ''}
      </td></tr>
    </table>` : '';
  const footer = ['Club Hello World · FES Aragón, UNAM', 'Si tienes dudas, responde a este correo.'];
  return {
    subject: notice.subject,
    text: [notice.heading, ...notice.paragraphs,
      ...(notice.detail ? [`${notice.detail.label}: ${notice.detail.text}`] : []),
      ...(notice.action ? [notice.action.description, `${notice.action.label}:\n${notice.action.url}`] : []),
      ...(notice.closing ? [notice.closing] : []), ...footer].join('\n\n'),
    html: emailShell({ title: notice.subject, eyebrow: notice.eyebrow, eyebrowBg: green ? '#d1fae5' : '#fef3c7', inner: `
      <h1 style="font-size:30px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;line-height:1.1;margin:0 0 24px;color:#000;">${escape(notice.heading)}</h1>
      ${notice.paragraphs.map(p => `<p style="font-size:16px;line-height:1.75;color:#333;margin:0 0 18px;">${escape(p)}</p>`).join('')}
      ${panel}
      ${notice.closing ? `<p style="font-size:14px;line-height:1.7;border-left:4px solid #6225e6;background:#f9f3ff;padding:14px 16px;margin:24px 0 0;">${escape(notice.closing)}</p>` : ''}
    ` }),
  };
}
