import { parseOnePasswordCSV, OnePasswordEntry, parseOnePassword1PIF } from '../onepassword-importer';

describe('OnePassword Importer', () => {
  describe('parseOnePasswordCSV', () => {
    test('解析标准 1Password CSV 格式', () => {
      const csv = `title,url,username,password,tags
"GitHub","https://github.com","user@example.com","password123","work,git"
"Google","https://google.com","gmail@example.com","gmailpass456","personal"
`;
      const result = parseOnePasswordCSV(csv);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('GitHub');
      expect(result[0].url).toBe('https://github.com');
      expect(result[0].username).toBe('user@example.com');
      expect(result[0].password).toBe('password123');
      expect(result[0].tags).toBe('work,git');
    });

    test('解析带备注的条目', () => {
      const csv = `title,username,password,notes
"App","myuser","mypass","Some notes here"
`;
      const result = parseOnePasswordCSV(csv);

      expect(result).toHaveLength(1);
      expect(result[0].notes).toBe('Some notes here');
    });

    test('处理空 CSV', () => {
      const csv = '';
      const result = parseOnePasswordCSV(csv);
      expect(result).toHaveLength(0);
    });

    test('处理只有表头的 CSV', () => {
      const csv = 'title,url,username,password';
      const result = parseOnePasswordCSV(csv);
      expect(result).toHaveLength(0);
    });

    test('处理标题中的逗号', () => {
      const csv = `title,username,password
"My Site, Inc.","user","pass"
`;
      const result = parseOnePasswordCSV(csv);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('My Site, Inc.');
    });

    test('处理引号和转义', () => {
      const csv = `title,username,password
"Site ""Special""","user","pass"
`;
      const result = parseOnePasswordCSV(csv);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Site "Special"');
    });
  });

  describe('parseOnePassword1PIF', () => {
    test('解析 1PIF 格式', () => {
      const pifData = [
        {
          location: 'https://github.com',
          label: 'GitHub Account',
          secureContent: {
            passwordField: 'password',
            PINField: '',
            passwordValues: ['password123'],
            PINValues: []
          }
        }
      ];

      const result = parseOnePassword1PIF(JSON.stringify(pifData));

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('GitHub Account');
      expect(result[0].url).toBe('https://github.com');
      expect(result[0].password).toBe('password123');
    });

    test('解析带用户名的 1PIF', () => {
      const pifData = [
        {
          location: 'https://google.com',
          label: 'Google',
          secureContent: {
            passwordField: 'username',
            PINField: 'password',
            passwordValues: ['user@email.com', 'googlepass']
          }
        }
      ];

      const result = parseOnePassword1PIF(JSON.stringify(pifData));

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('user@email.com');
      expect(result[0].password).toBe('googlepass');
    });

    test('处理空 1PIF', () => {
      const result = parseOnePassword1PIF('[]');
      expect(result).toHaveLength(0);
    });

    test('处理无效 JSON', () => {
      expect(() => parseOnePassword1PIF('invalid json')).toThrow();
    });
  });
});
