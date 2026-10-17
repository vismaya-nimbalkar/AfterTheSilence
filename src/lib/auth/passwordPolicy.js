export const PASSWORD_MIN_LENGTH = 15;

export function getPasswordRequirements(password) {
  return [
    {
      label: `At least ${PASSWORD_MIN_LENGTH} characters`,
      met: password.length >= PASSWORD_MIN_LENGTH,
    },
    {
      label: "A lowercase letter",
      met: /[a-z]/.test(password),
    },
    {
      label: "An uppercase letter",
      met: /[A-Z]/.test(password),
    },
    {
      label: "A number",
      met: /[0-9]/.test(password),
    },
    {
      label: "A symbol",
      met: /[^A-Za-z0-9]/.test(password),
    },
  ];
}

export function getPasswordPolicyError(password) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
  }

  const unmetRequirement = getPasswordRequirements(password).find(
    (requirement) => !requirement.met
  );

  return unmetRequirement
    ? `Password must include ${unmetRequirement.label.toLowerCase()}.`
    : "";
}

export function generateCompliantPassword(length = 20) {
  if (!Number.isInteger(length) || length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password length must be at least ${PASSWORD_MIN_LENGTH}.`);
  }

  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure random password generation is not available in this browser.");
  }

  const groups = [
    "abcdefghijklmnopqrstuvwxyz",
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "0123456789",
    "!@#$%^&*()-_=+[]{};:,.?/",
  ];
  const characters = groups.map((group) => group[getSecureIndex(group.length)]);
  const allCharacters = groups.join("");

  while (characters.length < length) {
    characters.push(allCharacters[getSecureIndex(allCharacters.length)]);
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = getSecureIndex(index + 1);
    [characters[index], characters[swapIndex]] = [
      characters[swapIndex],
      characters[index],
    ];
  }

  return characters.join("");
}

function getSecureIndex(max) {
  const range = 0x100000000;
  const limit = range - (range % max);
  const value = new Uint32Array(1);

  do {
    globalThis.crypto.getRandomValues(value);
  } while (value[0] >= limit);

  return value[0] % max;
}
