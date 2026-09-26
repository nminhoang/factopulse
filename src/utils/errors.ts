/** Turns a raw database error into something a person can act on. */
export function friendlyDbError(message: string): string {
  if (/column|schema cache/i.test(message)) {
    return (
      'The database needs one update first. Run supabase/002_work_orders.sql in the ' +
      'Supabase SQL Editor, then try again.\n\n(' +
      message +
      ')'
    );
  }
  return message;
}
