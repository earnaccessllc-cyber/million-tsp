// Formatting for "when was this balance last priced".
//
// The balance carries two related fields: balance_last_confirmed is the market
// DAY the prices belong to, and balance_last_confirmed_at is the instant they
// were written. The UI used to have only the day, so it padded the label with a
// hardcoded "at 8:00pm ET" — wrong once the price update became a poll (the
// time varies with when the source publishes) and wrong for anyone outside
// Eastern. These render the real instant in the viewer's own timezone.

// YYYY-MM-DD in LOCAL time. Date fields here mean "which market day", so they
// must not be derived from toISOString(), which is UTC — for a US user that
// rolls over during the evening and stamps the balance with tomorrow's date.
export function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function timePart(ts) {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

// "Aug 25 at 9:00 PM CDT" — falls back to the day alone when no instant is
// stored (profiles predating the column), rather than inventing a time.
export function formatUpdatedAt(timestamp, dateOnly, { long = false } = {}) {
  const dateOpts = long
    ? { month: 'long', day: 'numeric', year: 'numeric' }
    : { month: 'short', day: 'numeric' };

  if (timestamp) {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      return `${d.toLocaleDateString('en-US', dateOpts)} at ${timePart(d)}`;
    }
  }

  if (!dateOnly) return null;
  // Parse as local midnight, not UTC — 'YYYY-MM-DD' alone is treated as UTC and
  // renders as the previous day for anyone west of Greenwich.
  const [y, m, d] = String(dateOnly).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', dateOpts);
}
