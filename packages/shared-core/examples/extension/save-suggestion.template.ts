type SaveSuggestionPayload = {
  url: string;
  title: string;
  username: string;
  password: string;
};

function guessTitle(): string {
  return document.title || location.hostname || 'New Login';
}

function readSubmittedCredential(form: HTMLFormElement): { username: string; password: string } | null {
  const passwordInput = form.querySelector('input[type="password"]') as HTMLInputElement | null;
  if (!passwordInput || !passwordInput.value) {
    return null;
  }

  const userInput =
    (form.querySelector('input[type="email"]') as HTMLInputElement | null) ||
    (form.querySelector('input[name*="user" i]') as HTMLInputElement | null) ||
    (form.querySelector('input[name*="email" i]') as HTMLInputElement | null) ||
    null;

  return {
    username: userInput?.value || '',
    password: passwordInput.value,
  };
}

function emitSaveSuggestion(payload: SaveSuggestionPayload): void {
  chrome.runtime.sendMessage({ type: 'vault.suggest-save', payload });
}

export function installSaveSuggestionWatcher(): void {
  document.addEventListener(
    'submit',
    event => {
      const form = event.target as HTMLFormElement | null;
      if (!form) {
        return;
      }

      const credential = readSubmittedCredential(form);
      if (!credential) {
        return;
      }

      emitSaveSuggestion({
        url: location.href,
        title: guessTitle(),
        username: credential.username,
        password: credential.password,
      });
    },
    true
  );
}
