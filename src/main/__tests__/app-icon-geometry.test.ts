import fs from 'fs';
import path from 'path';

describe('AppIcon geometry', () => {
  const iconPath = path.resolve(__dirname, '../../../resources/AppIcon.tsx');
  const source = fs.readFileSync(iconPath, 'utf8');

  it('keeps dual ring structure for key head', () => {
    expect(source).toContain('<circle cx="14.8" cy="12" r="4.25"');
    expect(source).toContain('<circle cx="14.8" cy="12" r="1.9"');
  });

  it('keeps three metallic key layers', () => {
    expect(source).toContain('stroke="url(#k132)"');
    expect(source).toContain('stroke="url(#k232)"');
    expect(source).toContain('stroke="url(#k332)"');
  });

  it('uses stepped-tooth silhouette markers on primary key layer', () => {
    expect(source).toContain('L24.45 18.85');
    expect(source).toContain('L24.15 20.25');
    expect(source).toContain('L23.05 20.25');
    expect(source).toContain('L23.05 21.25');
    expect(source).toContain('L21.95 21.25');
    expect(source).toContain('L21.95 22.35');
  });
});
