export const TRAVEL_STATUSES = {
  safe: { label: "Safe", color: "#2f9e68", textColor: "#ffffff" },
  caution: { label: "Increased caution", color: "#e8c547", textColor: "#211f16" },
  reconsider: { label: "Reconsider travel", color: "#ed8b35", textColor: "#211f16" },
  do_not_travel: { label: "Do not travel", color: "#d94a4a", textColor: "#ffffff" },
};

export const TRAVEL_STATUS_OPTIONS = Object.entries(TRAVEL_STATUSES).map(
  ([value, status]) => ({ value, ...status })
);

export function getTravelStatus(status) {
  return TRAVEL_STATUSES[status] || TRAVEL_STATUSES.caution;
}

export function getTravelMapId(country) {
  const id = country?.id == null ? "" : String(country.id);
  const name = country?.properties?.name || "unknown";

  return id ? `${id}:${name}` : `name:${name}`;
}

export function getTravelMapIds(country) {
  const ids = [getTravelMapId(country)];
  const legacyId = country?.id == null ? null : String(country.id);
  const name = country?.properties?.name;

  if (legacyId) ids.push(legacyId);
  if (name) ids.push(`name:${name}`);

  return ids;
}