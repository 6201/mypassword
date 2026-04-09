function findUsernameInput(root: ParentNode): HTMLInputElement | null {
  const candidates = Array.from(root.querySelectorAll('input')) as HTMLInputElement[];
  for (const input of candidates) {
    const type = (input.type || 'text').toLowerCase();
    const name = (input.name || '').toLowerCase();
    const autocomplete = (input.autocomplete || '').toLowerCase();
    if (
      type === 'text' ||
      type === 'email' ||
      name.includes('user') ||
      name.includes('email') ||
      autocomplete.includes('username')
    ) {
      return input;
    }
  }
  return null;
}

function findPasswordInput(root: ParentNode): HTMLInputElement | null {
  return (root.querySelector('input[type="password"]') as HTMLInputElement | null) || null;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

export function fillCredentialOnPage(credential: { username: string; password: string }): boolean {
  const root = document;
  const username = findUsernameInput(root);
  const password = findPasswordInput(root);

  if (!password) {
    return false;
  }

  if (username) {
    setInputValue(username, credential.username || '');
  }
  setInputValue(password, credential.password || '');
  return true;
}
