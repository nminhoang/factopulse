// What is stored inside a machine's QR label, and how to read it back.
// Format: innocon:eq:<machine id>  (for example  innocon:eq:12)

const PREFIX = 'innocon:eq:';

export function machineCode(id: string | number): string {
  return PREFIX + String(id).trim();
}

/** Returns the machine id from a scanned QR text, or null if it is not an InnoCon machine label. */
export function parseMachineCode(scanned: string): string | null {
  const text = scanned.trim();
  if (text.toLowerCase().indexOf(PREFIX) !== 0) return null;
  const id = text.slice(PREFIX.length).trim();
  return id.length > 0 ? id : null;
}
