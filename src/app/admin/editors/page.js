"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/src/lib/supabase/client";
import {
  canManageStaffAccounts,
  EDITOR_PERMISSION_DEFAULTS,
} from "@/src/lib/admin/permissions";
import { useConfirmDialog } from "@/src/components/Admin/ConfirmDialog";
import BackLink from "@/src/components/BackLink";
import PasswordRequirements from "@/src/components/Auth/PasswordRequirements";
import {
  generateCompliantPassword,
  getPasswordPolicyError,
} from "@/src/lib/auth/passwordPolicy";

const permissionOptions = [
  { key: "posts", label: "Posts", description: "Create and manage assigned blog posts." },
  { key: "travel", label: "Travel", description: "Manage travel countries and travel settings." },
  { key: "shop", label: "Shop", description: "Manage products, promotions, orders, and shop settings." },
];

export default function EditorsPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [requiringSecurityId, setRequiringSecurityId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const { confirm, dialog } = useConfirmDialog();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState("editor");
  const [newPermissions, setNewPermissions] = useState({ ...EDITOR_PERMISSION_DEFAULTS });
  const [permissionDrafts, setPermissionDrafts] = useState({});
  const [savingPermissionsId, setSavingPermissionsId] = useState(null);
  const [editingProfile, setEditingProfile] = useState(null);
  const [savingProfileId, setSavingProfileId] = useState(null);

  const [editors, setEditors] = useState([]);
  const createAccountPanelRef = useRef(null);
  const accountTypeDropdownRef = useRef(null);
  const [createAccountPanelHeight, setCreateAccountPanelHeight] = useState(null);
  const [accountTypeDropdownOpen, setAccountTypeDropdownOpen] = useState(false);

  useEffect(() => {
    if (loading || !isAdmin) return;

    const panel = createAccountPanelRef.current;
    if (!panel) return;

    const updatePanelHeight = () => {
      setCreateAccountPanelHeight(panel.getBoundingClientRect().height);
    };
    updatePanelHeight();

    const resizeObserver = new ResizeObserver(updatePanelHeight);
    resizeObserver.observe(panel);

    return () => resizeObserver.disconnect();
  }, [loading, isAdmin]);

  useEffect(() => {
    if (!accountTypeDropdownOpen) return;

    const closeOnOutsideClick = (event) => {
      if (!accountTypeDropdownRef.current?.contains(event.target)) {
        setAccountTypeDropdownOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setAccountTypeDropdownOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountTypeDropdownOpen]);

  useEffect(() => {
    let mounted = true;

    const loadEditors = async () => {
      try {
        const response = await fetch("/api/admin/editors", {
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Could not load team accounts.");
        }

        if (mounted) {
          setEditors(result.editors || []);
          setPermissionDrafts((current) => ({
            ...Object.fromEntries(
              (result.editors || []).map((editor) => [
                editor.id,
                current[editor.id] || editor.permissions || { ...EDITOR_PERMISSION_DEFAULTS },
              ])
            ),
          }));
        }
      } catch (err) {
        console.error(err);
        if (mounted) {
          setError(err?.message || "Could not load team accounts.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const load = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!user || userError) {
          router.replace("/forbidden");
          return;
        }

        const adminAccess = canManageStaffAccounts(user);
        if (mounted) setIsAdmin(adminAccess);

        if (!adminAccess) {
          router.replace("/forbidden");
          return;
        }

        await loadEditors();
      } catch (err) {
        console.error(err);
        if (mounted) setError(err?.message || "Could not load team accounts.");
      }
    };

    const refreshEditors = () => {
      if (document.visibilityState === "visible") {
        loadEditors();
      }
    };

    load();
    window.addEventListener("focus", refreshEditors);
    const refreshInterval = window.setInterval(refreshEditors, 5000);

    return () => {
      mounted = false;
      window.removeEventListener("focus", refreshEditors);
      window.clearInterval(refreshInterval);
    };
  }, [router, supabase]);

  const handleCreateEditor = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    const passwordPolicyError = getPasswordPolicyError(password);
    if (passwordPolicyError) {
      setError(passwordPolicyError);
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/admin/editors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          name,
          accountType,
          ...(accountType === "editor" ? { permissions: newPermissions } : {}),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not create editor account.");
      }

      setMessage(`${accountType === "admin" ? "Administrator" : "Editor"} account created successfully.`);
      setEmail("");
      setPassword("");
      setShowPassword(false);
      setName("");
      setAccountType("editor");
      setNewPermissions({ ...EDITOR_PERMISSION_DEFAULTS });

      setEditors((currentEditors) => [result.editor, ...currentEditors]);
      setPermissionDrafts((current) => ({
        ...current,
        [result.editor.id]: result.editor.permissions,
      }));
    } catch (err) {
      console.error(err);
      setError(err?.message || "Could not create editor account.");
    } finally {
      setSaving(false);
    }
  };

  const updatePermissionDraft = (editorId, permission, enabled) => {
    setPermissionDrafts((current) => ({
      ...current,
      [editorId]: {
        ...(current[editorId] || { ...EDITOR_PERMISSION_DEFAULTS }),
        [permission]: enabled,
      },
    }));
  };

  const handleGeneratePassword = () => {
    try {
      setPassword(generateCompliantPassword());
      setShowPassword(true);
      setError("");
    } catch (generationError) {
      console.error("Could not generate a secure password:", generationError);
      setError(generationError?.message || "Could not generate a secure password.");
    }
  };

  const handleSaveProfile = async (event, editor) => {
    event.preventDefault();
    const name = editingProfile?.name.trim();
    const email = editingProfile?.email.trim();
    if (!name || !email) {
      setError("Please enter both a name and email address.");
      return;
    }

    setSavingProfileId(editor.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/editors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editor.id,
          profile: { name, email },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update account details.");

      setEditors((current) => current.map((item) =>
        item.id === editor.id ? { ...item, ...result.editor } : item
      ));
      setEditingProfile(null);
      setMessage(`Name and email updated for ${result.editor.email}.`);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Could not update account details.");
    } finally {
      setSavingProfileId(null);
    }
  };

  const handleSavePermissions = async (editor) => {
    const permissions = permissionDrafts[editor.id] || editor.permissions || EDITOR_PERMISSION_DEFAULTS;
    setSavingPermissionsId(editor.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/editors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editor.id, permissions }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update editor permissions.");

      setEditors((current) => current.map((item) =>
        item.id === editor.id ? { ...item, permissions: result.permissions } : item
      ));
      setPermissionDrafts((current) => ({
        ...current,
        [editor.id]: result.permissions,
      }));
      setMessage(`Permissions updated for ${editor.email}.`);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Could not update editor permissions.");
    } finally {
      setSavingPermissionsId(null);
    }
  };

  const handleDeleteEditor = async (editor) => {
    if (!editor?.id || !editor.canDelete || !await confirm({
      title: `Delete ${editor.accountType === "admin" ? "administrator" : "editor"} account?`,
      message: `The account for ${editor.email} will be permanently deleted.`,
      confirmLabel: "Delete account",
    })) {
      return;
    }

    setDeletingId(editor.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/editors", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: editor.id }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not delete editor account.");
      }

      setEditors((currentEditors) =>
        currentEditors.filter((item) => item.id !== editor.id)
      );
      setMessage(`${editor.accountType === "admin" ? "Administrator" : "Editor"} account deleted.`);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Could not delete editor account.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleRequireSecurity = async (editor) => {
    if (!editor?.id) {
      return;
    }

    const requiresMFA = !editor.mfaEnabled;

    if (!await confirm({
      title: requiresMFA ? "Require password and 2FA?" : "Require password change?",
      message: requiresMFA
        ? `${editor.email} will need to change their password and enable 2FA.`
        : `${editor.email} will need to change their password before continuing.`,
      confirmLabel: "Continue",
      danger: false,
    })) {
      return;
    }

    setRequiringSecurityId(editor.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/editors", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: editor.id, requiresMFA }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not require security setup.");
      }

      setMessage(
        requiresMFA
          ? `${editor.email} must now change their password and enable 2FA before accessing the admin panel.`
          : `${editor.email} must now change their password before accessing the admin panel. 2FA is already enabled.`
      );
    } catch (err) {
      console.error(err);
      setError(err?.message || "Could not require security setup.");
    } finally {
      setRequiringSecurityId(null);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="opacity-60">Loading editor management...</p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">Access denied.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-16 sm:px-10">{dialog}
      <div className="mx-auto max-w-5xl">
        <BackLink href="/admin">Back to Dashboard</BackLink>

        <h1 className="mt-8 text-4xl font-bold">Team Accounts</h1>
        <p className="mt-2 opacity-60">
          Give editors scoped permissions or create administrators with full site access.
        </p>

        {error && (
          <div className="mt-6 rounded-lg border border-red-500/30 p-4 text-red-600">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-green-700">
            {message}
          </div>
        )}

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <form ref={createAccountPanelRef} onSubmit={handleCreateEditor} className="self-start rounded-2xl border border-dark/20 p-6">
            <h2 className="text-2xl font-semibold">Create account</h2>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Editor name"
                  className="w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="account@example.com"
                  className="w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3 outline-none"
                />
              </div>

              <div ref={accountTypeDropdownRef} className="relative">
                <label className="mb-2 block text-sm font-medium">Account type</label>
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={accountTypeDropdownOpen}
                  onClick={() => setAccountTypeDropdownOpen((open) => !open)}
                  className="flex w-full items-center justify-between rounded-lg border border-dark/20 bg-transparent px-4 py-3 text-left outline-none transition-colors hover:bg-dark/5 focus-visible:ring-2 focus-visible:ring-dark/40"
                >
                  <span>{accountType === "admin" ? "Administrator" : "Editor"}</span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="none"
                    className={`h-4 w-4 transition-transform ${accountTypeDropdownOpen ? "rotate-180" : ""}`}
                  >
                    <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {accountTypeDropdownOpen && (
                  <div role="menu" className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border border-dark/20 bg-light p-1 shadow-lg">
                    {[
                      { value: "editor", label: "Editor" },
                      { value: "admin", label: "Administrator" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={accountType === option.value}
                        onClick={() => {
                          setAccountType(option.value);
                          setAccountTypeDropdownOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-dark/5 focus-visible:bg-dark/5 focus-visible:outline-none ${
                          accountType === option.value ? "font-medium" : ""
                        }`}
                      >
                        {option.label}
                        {accountType === option.value && <span aria-hidden="true">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-sm font-medium">Password</label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-sm font-medium underline underline-offset-4"
                  >
                    Generate password
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={15}
                    required
                    placeholder="At least 15 characters"
                    className="w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3 pr-12 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 opacity-60 hover:opacity-100"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <PasswordRequirements password={password} />
              </div>

              {accountType === "editor" && <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Editor permissions</legend>
                {permissionOptions.map(({ key, label, description }) => (
                  <label key={key} className="flex items-start gap-3 rounded-lg border border-dark/10 p-3">
                    <input
                      type="checkbox"
                      checked={newPermissions[key]}
                      onChange={(event) => setNewPermissions((current) => ({
                        ...current,
                        [key]: event.target.checked,
                      }))}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="block text-xs opacity-60">{description}</span>
                    </span>
                  </label>
                ))}
              </fieldset>}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-dark px-5 py-3 font-medium text-light disabled:opacity-50"
              >
                {saving
                  ? "Creating..."
                  : `Create ${accountType === "admin" ? "administrator" : "editor"} account`}
              </button>
            </div>
          </form>

          <div
            className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-dark/20 p-6"
            style={createAccountPanelHeight ? { height: `${createAccountPanelHeight}px` } : undefined}
          >
            <h2 className="text-2xl font-semibold">Existing accounts</h2>

            <div className="mt-6 min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
              {editors.length === 0 ? (
                <p className="text-sm opacity-60">No editor or administrator accounts yet.</p>
              ) : (
                editors.map((editor) => (
                  <div key={editor.id} className="rounded-xl border border-dark/20 p-4">
                    <div className="flex flex-col gap-4">
                      <div>
                        {editingProfile?.id === editor.id ? (
                          <form onSubmit={(event) => handleSaveProfile(event, editor)} className="space-y-3">
                            <div>
                              <label htmlFor={`account-name-${editor.id}`} className="mb-1 block text-sm font-medium">
                                Name
                              </label>
                              <input
                                id={`account-name-${editor.id}`}
                                value={editingProfile.name}
                                onChange={(event) => setEditingProfile((current) => ({
                                  ...current,
                                  name: event.target.value,
                                }))}
                                required
                                className="w-full rounded-lg border border-dark/20 bg-transparent px-3 py-2 outline-none"
                              />
                            </div>
                            <div>
                              <label htmlFor={`account-email-${editor.id}`} className="mb-1 block text-sm font-medium">
                                Email
                              </label>
                              <input
                                id={`account-email-${editor.id}`}
                                type="email"
                                value={editingProfile.email}
                                onChange={(event) => setEditingProfile((current) => ({
                                  ...current,
                                  email: event.target.value,
                                }))}
                                required
                                className="w-full rounded-lg border border-dark/20 bg-transparent px-3 py-2 outline-none"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={savingProfileId === editor.id}
                                className="rounded-lg bg-dark px-4 py-2 text-sm font-medium text-light disabled:opacity-50"
                              >
                                {savingProfileId === editor.id ? "Saving..." : "Save details"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingProfile(null)}
                                disabled={savingProfileId === editor.id}
                                className="rounded-lg border border-dark/20 px-4 py-2 text-sm font-medium disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <p className="font-medium">{editor.name || editor.email}</p>
                            <p className="mt-1 text-sm opacity-60">{editor.email}</p>
                            <button
                              type="button"
                              onClick={() => setEditingProfile({
                                id: editor.id,
                                name: editor.name || "",
                                email: editor.email || "",
                              })}
                              className="mt-2 text-sm font-medium underline underline-offset-4"
                            >
                              Edit name and email
                            </button>
                          </>
                        )}
                        <p className="mt-1 text-xs font-medium">
                          {editor.accountType === "admin" ? "Administrator" : "Editor"}
                        </p>
                        <p className="mt-2 text-xs text-green-700">
                          {editor.mfaEnabled
                            ? "2FA enabled"
                            : "2FA not enabled"}
                        </p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {editor.accountType !== "admin" && <button
                          type="button"
                          onClick={() => handleRequireSecurity(editor)}
                          disabled={
                            requiringSecurityId === editor.id ||
                            editor.securitySetupRequired
                          }
                          className="min-h-11 w-full rounded-lg border border-amber-600/30 px-4 py-2 text-center text-sm font-medium leading-5 text-amber-800 transition-colors hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {editor.securitySetupRequired
                            ? "Security request pending"
                            : requiringSecurityId === editor.id
                            ? "Requiring..."
                            : editor.mfaEnabled
                            ? "Require password change"
                            : "Require password + 2FA"}
                        </button>}
                        {editor.canDelete && <button
                          type="button"
                          onClick={() => handleDeleteEditor(editor)}
                          disabled={deletingId === editor.id}
                          className="min-h-11 w-full rounded-lg border border-red-500/30 px-4 py-2 text-center text-sm font-medium leading-5 text-red-700 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                        >
                          {deletingId === editor.id
                            ? "Deleting..."
                            : `Delete ${editor.accountType === "admin" ? "administrator" : "editor"}`}
                        </button>}
                      </div>
                    </div>
                    {editor.accountType === "admin" ? (
                      <p className="mt-4 rounded-lg bg-dark/5 p-3 text-sm opacity-70">
                        Full administrator access. Only the primary administrator can manage team accounts.
                      </p>
                    ) : <fieldset className="mt-5 space-y-2">
                      <legend className="text-sm font-medium">Permissions</legend>
                      {permissionOptions.map(({ key, label, description }) => (
                        <label key={key} className="flex items-start gap-3 rounded-lg border border-dark/10 p-3">
                          <input
                            type="checkbox"
                            checked={(permissionDrafts[editor.id] || editor.permissions || EDITOR_PERMISSION_DEFAULTS)[key]}
                            onChange={(event) => updatePermissionDraft(editor.id, key, event.target.checked)}
                            className="mt-1"
                          />
                          <span>
                            <span className="block text-sm font-medium">{label}</span>
                            <span className="block text-xs opacity-60">{description}</span>
                          </span>
                        </label>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleSavePermissions(editor)}
                        disabled={savingPermissionsId === editor.id}
                        className="mt-2 rounded-lg border border-dark/20 px-4 py-2 text-sm font-medium disabled:opacity-50"
                      >
                        {savingPermissionsId === editor.id ? "Saving..." : "Save permissions"}
                      </button>
                    </fieldset>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
