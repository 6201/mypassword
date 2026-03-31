export interface OnePasswordEntry {
  title: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  tags?: string;
  category?: string;
}

/**
 * 解析 1Password 导出的 CSV 文件
 */
export function parseOnePasswordCSV(csv: string): OnePasswordEntry[] {
  if (!csv.trim()) {
    return [];
  }

  const lines = parseCSVLines(csv);
  if (lines.length < 2) {
    return [];
  }

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const entries: OnePasswordEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const values = parseCSVLine(lines[i]);
    const entry: Record<string, string> = {};

    headers.forEach((header, index) => {
      if (values[index] !== undefined) {
        entry[header] = values[index];
      }
    });

    entries.push({
      title: entry.title || 'Unnamed',
      username: entry.username || '',
      password: entry.password || '',
      url: entry.url || '',
      notes: entry.notes || '',
      tags: entry.tags || '',
      category: entry.category || 'Imported'
    });
  }

  return entries;
}

/**
 * 解析 CSV 行为数组，处理引号和转义
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // 转义引号
        current += '"';
        i++;
      } else if (char === '"') {
        // 结束引号
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  result.push(current);
  return result;
}

/**
 * 将 CSV 解析为行数组，处理多行引号内容
 */
function parseCSVLines(csv: string): string[] {
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if (char === '\n' && !inQuotes) {
      lines.push(currentLine.trim());
      currentLine = '';
    } else if (char !== '\r') {
      currentLine += char;
    }
  }

  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  return lines;
}

/**
 * 解析 1Password 1PIF 格式
 */
export function parseOnePassword1PIF(pifContent: string): OnePasswordEntry[] {
  let data: any[];

  try {
    data = JSON.parse(pifContent);
  } catch (e) {
    throw new Error('Invalid 1PIF JSON format');
  }

  if (!Array.isArray(data)) {
    return [];
  }

  const entries: OnePasswordEntry[] = [];

  for (const item of data) {
    const entry: OnePasswordEntry = {
      title: item.label || item.title || 'Unnamed',
      username: '',
      password: '',
      url: item.location || item.url || '',
      category: 'Imported'
    };

    // 解析 secureContent
    if (item.secureContent) {
      const { passwordField, PINField, passwordValues = [], PINValues = [] } = item.secureContent;

      // 尝试从不同字段获取用户名和密码
      if (passwordField === 'username' && passwordValues.length >= 2) {
        entry.username = passwordValues[0];
        entry.password = passwordValues[1];
      } else if (passwordField === 'password' && passwordValues.length >= 1) {
        entry.password = passwordValues[0];
      } else if (passwordValues.length >= 1) {
        entry.password = passwordValues[0];
      }

      // 处理 PIN 字段（有时用作密码）
      if (PINField === 'password' && PINValues.length >= 1 && !entry.password) {
        entry.password = PINValues[0];
      }
    }

    // 处理自定义字段
    if (item.customFields) {
      for (const field of item.customFields) {
        if (field.name === 'username' && !entry.username) {
          entry.username = field.value;
        }
        if (field.name === 'password' && !entry.password) {
          entry.password = field.value;
        }
        if (field.name === 'notes' || field.name === 'notesPlain') {
          entry.notes = field.value;
        }
      }
    }

    entries.push(entry);
  }

  return entries;
}
