import { buildPasswordResetEditData, shouldOpenPasswordResetForm } from '../edit-recovery';

describe('edit recovery helpers', () => {
  test('opens password reset mode for decrypt authentication failures', () => {
    const error = new Error("Error invoking remote method 'get-password-secret': Error: Unsupported state or unable to authenticate data");

    expect(shouldOpenPasswordResetForm(error)).toBe(true);
  });

  test('does not open password reset mode for unrelated errors', () => {
    expect(shouldOpenPasswordResetForm(new Error('ENTRY_NOT_FOUND'))).toBe(false);
  });

  test('builds edit form data with a blank password for reset mode', () => {
    expect(buildPasswordResetEditData({
      id: '406',
      title: 'Broken Entry',
      username: 'broken@example.com',
      url: 'https://example.com',
      notes: 'note',
      category: 'Work',
      tags: 'tag',
      favorite: true,
    })).toEqual({
      id: '406',
      title: 'Broken Entry',
      username: 'broken@example.com',
      password: '',
      url: 'https://example.com',
      notes: 'note',
      category: 'Work',
      tags: 'tag',
      favorite: true,
    });
  });
});
