export interface PasswordResetCandidate {
  id: string;
  title: string;
  username: string;
  url?: string;
  urls?: string[];
  notes?: string;
  category?: string;
  tags?: string;
  favorite?: boolean;
}

export interface PasswordResetEditData extends PasswordResetCandidate {
  password: string;
}

export function shouldOpenPasswordResetForm(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message || '';
  return message.includes('authenticate data') || message.includes('unable to authenticate data');
}

export function buildPasswordResetEditData(entry: PasswordResetCandidate): PasswordResetEditData {
  return {
    ...entry,
    password: '',
  };
}
