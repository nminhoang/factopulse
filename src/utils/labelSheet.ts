import { encodeQr, qrToSvg } from './qr';
import { machineCode } from './machineCode';

export interface LabelInfo {
  id: string | number;
  name: string;
  location?: string | null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Printable sheet of machine labels (8 per US Letter page, 2 columns).
 * Each label: QR code on the left, machine name and location on the right.
 */
export function buildLabelSheetHtml(labels: LabelInfo[]): string {
  const cells = labels
    .map((label) => {
      const svg = qrToSvg(encodeQr(machineCode(label.id)), 2);
      return `
      <div class="label">
        <div class="qr">${svg}</div>
        <div class="info">
          <div class="brand">FactoPulse</div>
          <div class="name">${escapeHtml(label.name || 'Machine')}</div>
          ${label.location ? `<div class="loc">${escapeHtml(label.location)}</div>` : ''}
          <div class="hint">Scan to start or finish work</div>
        </div>
      </div>`;
    })
    .join('\n');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: letter; margin: 0.4in; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; margin: 0; }
  .sheet { display: flex; flex-wrap: wrap; }
  .label {
    box-sizing: border-box;
    width: 3.55in; height: 2.4in;
    margin: 0 0.15in 0.15in 0;
    border: 1.5px solid #0B3B66; border-radius: 0.12in;
    padding: 0.14in;
    display: flex; align-items: center;
    page-break-inside: avoid;
  }
  .label:nth-child(2n) { margin-right: 0; }
  .qr { width: 1.9in; height: 1.9in; flex: none; }
  .qr svg { width: 100%; height: 100%; }
  .info { margin-left: 0.16in; flex: 1; min-width: 0; }
  .brand { font-size: 8pt; color: #F97316; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
  .name { font-size: 16pt; font-weight: 800; color: #0B3B66; margin: 4px 0; word-break: break-word; }
  .loc { font-size: 10pt; color: #475569; }
  .hint { font-size: 8.5pt; color: #64748B; margin-top: 8px; }
</style>
</head>
<body><div class="sheet">${cells}</div></body>
</html>`;
}
