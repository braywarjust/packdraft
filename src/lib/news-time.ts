/** "12m ago", "5h ago", or a date for older news. Shared by the player popup (client) and the Players news view (server). */
export const newsAgo = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  return m < 60 ? `${Math.max(1, m)}m ago` : m < 48 * 60 ? `${Math.round(m / 60)}h ago` : new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
