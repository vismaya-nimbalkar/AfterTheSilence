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

export function isEditorUser(user) {
  return getUserRole(user) === "editor";
}
