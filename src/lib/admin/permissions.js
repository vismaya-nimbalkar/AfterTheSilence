export function getUserRole(user) {
  if (!user) {
    return "guest";
  }

  const appRole = user.app_metadata?.role;

  if (appRole === "admin" || appRole === "editor") {
    return appRole;
  }

  const metadataRole = user.user_metadata?.role;

  if (metadataRole === "admin" || metadataRole === "editor") {
    return metadataRole;
  }

  return "admin";
}

export function isAdminUser(user) {
  return getUserRole(user) === "admin";
}

export function canManageStaffAccounts(user) {
  return isAdminUser(user) && user?.app_metadata?.delegated_admin !== true;
}

export function isEditorUser(user) {
  return getUserRole(user) === "editor";
}

export const EDITOR_PERMISSION_DEFAULTS = {
  posts: true,
  travel: false,
  shop: false,
};

export function getEditorPermissions(user) {
  const storedPermissions = user?.app_metadata?.editor_permissions;

  return Object.fromEntries(
    Object.entries(EDITOR_PERMISSION_DEFAULTS).map(([permission, defaultValue]) => [
      permission,
      typeof storedPermissions?.[permission] === "boolean"
        ? storedPermissions[permission]
        : defaultValue,
    ])
  );
}

export function hasEditorPermission(user, permission) {
  if (getUserRole(user) === "admin") return true;
  if (getUserRole(user) !== "editor" || !(permission in EDITOR_PERMISSION_DEFAULTS)) {
    return false;
  }

  return getEditorPermissions(user)[permission];
}
