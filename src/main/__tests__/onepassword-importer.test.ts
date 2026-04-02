import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseOnePasswordCSV, parseOnePassword1PIF, parseOnePassword1PUX } from '../onepassword-importer';
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'onepassword-importer-'));
}

function createZipArchive(outputPath: string, entries: Array<{ name: string; content: string }>): void {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, 'utf8');
    const dataBuffer = Buffer.from(entry.content, 'utf8');

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(dataBuffer.length, 18);
    localHeader.writeUInt32LE(dataBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuffer, dataBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(dataBuffer.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + dataBuffer.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  const archive = Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
  fs.writeFileSync(outputPath, archive);
}


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

  describe('parseOnePassword1PUX', () => {
    test('解析 1PUX 登录条目并跳过非登录条目', async () => {
      const tempDir = createTempDir();

      try {
        const filePath = path.join(tempDir, 'sample.1pux');
        const payload = {
          items: [
            {
              category: 'login',
              title: 'GitHub',
              overview: {
                urls: [{ href: 'https://github.com' }],
                tags: ['work', 'git']
              },
              details: {
                notesPlain: 'dev account',
                fields: [
                  { designation: 'username', value: 'dev@example.com' },
                  { designation: 'password', value: 'gh-secret' }
                ]
              }
            },
            {
              category: 'secure-note',
              title: 'Only Note',
              notes: 'do not import as login'
            }
          ]
        };

        createZipArchive(filePath, [{ name: 'export.data', content: JSON.stringify(payload) }]);

        const result = await parseOnePassword1PUX(filePath);
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('GitHub');
        expect(result[0].username).toBe('dev@example.com');
        expect(result[0].password).toBe('gh-secret');
        expect(result[0].url).toBe('https://github.com');
        expect(result[0].notes).toBe('dev account');
        expect(result[0].tags).toBe('work,git');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('支持 data/export.data 路径', async () => {
      const tempDir = createTempDir();

      try {
        const filePath = path.join(tempDir, 'sample.1pux');
        const payload = {
          items: [
            {
              category: 'login',
              title: 'Google',
              fields: [
                { name: 'username', value: 'gmail@example.com' },
                { name: 'password', value: 'gmail-secret' }
              ]
            }
          ]
        };

        createZipArchive(filePath, [{ name: 'data/export.data', content: JSON.stringify(payload) }]);

        const result = await parseOnePassword1PUX(filePath);
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Google');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('缺少导出数据文件时报错', async () => {
      const tempDir = createTempDir();

      try {
        const filePath = path.join(tempDir, 'missing-data.1pux');
        createZipArchive(filePath, [{ name: 'note.txt', content: 'hello' }]);

        await expect(parseOnePassword1PUX(filePath)).rejects.toThrow('1PUX 中未找到导出数据文件');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('损坏压缩包时报错', async () => {
      const tempDir = createTempDir();

      try {
        const filePath = path.join(tempDir, 'broken.1pux');
        fs.writeFileSync(filePath, Buffer.from('not-a-zip', 'utf8'));

        await expect(parseOnePassword1PUX(filePath)).rejects.toThrow('无效的 1PUX 压缩包');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('JSON 无效时报错', async () => {
      const tempDir = createTempDir();

      try {
        const filePath = path.join(tempDir, 'invalid-json.1pux');
        createZipArchive(filePath, [{ name: 'export.data', content: '{invalid json}' }]);

        await expect(parseOnePassword1PUX(filePath)).rejects.toThrow('1PUX 导出数据 JSON 格式无效');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('压缩包大小超过限制时报错', async () => {
      const tempDir = createTempDir();

      try {
        const filePath = path.join(tempDir, 'archive-too-large.1pux');
        createZipArchive(filePath, [{ name: 'export.data', content: '[]' }]);

        await expect(parseOnePassword1PUX(filePath, { maxArchiveBytes: 10 })).rejects.toThrow('1PUX 文件过大');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('导出数据大小超过限制时报错', async () => {
      const tempDir = createTempDir();

      try {
        const filePath = path.join(tempDir, 'json-too-large.1pux');
        createZipArchive(filePath, [{ name: 'export.data', content: 'x'.repeat(200) }]);

        await expect(parseOnePassword1PUX(filePath, { maxJsonBytes: 16 })).rejects.toThrow('1PUX 导出数据过大');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('解压总大小超过限制时报错', async () => {
      const tempDir = createTempDir();

      try {
        const filePath = path.join(tempDir, 'unzipped-too-large.1pux');
        createZipArchive(filePath, [{ name: 'export.data', content: '[]' }]);

        await expect(parseOnePassword1PUX(filePath, { maxUncompressedBytes: 1 })).rejects.toThrow('1PUX 解压数据过大');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('条目数量超过限制时报错', async () => {
      const tempDir = createTempDir();

      try {
        const filePath = path.join(tempDir, 'items-too-many.1pux');
        const payload = {
          items: [
            {
              category: 'login',
              title: 'A',
              fields: [{ name: 'password', value: 'a-pass' }]
            },
            {
              category: 'login',
              title: 'B',
              fields: [{ name: 'password', value: 'b-pass' }]
            }
          ]
        };

        createZipArchive(filePath, [{ name: 'export.data', content: JSON.stringify(payload) }]);

        await expect(parseOnePassword1PUX(filePath, { maxItems: 1 })).rejects.toThrow('1PUX 条目数量超过限制');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
