import fs from 'fs';
import path from 'path';

function getCssBlock(css: string, selector: string): string {
  const escapedSelector = selector.replace('.', '\\.');
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`));
  return match?.[0] || '';
}

describe('shared modal styles', () => {
  test('allows modal overlays and content to scroll when viewport height is limited', () => {
    const cssPath = path.resolve(__dirname, '../styles/index.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    const overlayBlock = getCssBlock(css, '.modal-overlay');
    const contentBlock = getCssBlock(css, '.modal-content');

    expect(overlayBlock).toContain('overflow-y: auto;');
    expect(overlayBlock).toContain('padding: 1.5rem;');
    expect(contentBlock).toContain('max-height: calc(100vh - 3rem);');
    expect(contentBlock).toContain('overflow-y: auto;');
  });

  test('allows lock overlay and card to remain usable on short viewports', () => {
    const cssPath = path.resolve(__dirname, '../styles/index.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    const overlayBlock = getCssBlock(css, '.lock-overlay');
    const cardBlock = getCssBlock(css, '.lock-card');

    expect(overlayBlock).toContain('overflow-y: auto;');
    expect(overlayBlock).toContain('padding: 1.5rem;');
    expect(cardBlock).toContain('max-height: calc(100vh - 3rem);');
    expect(cardBlock).toContain('overflow-y: auto;');
  });

  test('applies thin scrollbar styling to scrollable modal and lock surfaces', () => {
    const cssPath = path.resolve(__dirname, '../styles/index.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    const contentBlock = getCssBlock(css, '.modal-content');
    const cardBlock = getCssBlock(css, '.lock-card');

    expect(contentBlock).toContain('scrollbar-width: thin;');
    expect(contentBlock).toContain('scrollbar-color: #d1d5db transparent;');
    expect(cardBlock).toContain('scrollbar-width: thin;');
    expect(cardBlock).toContain('scrollbar-color: #d1d5db transparent;');
  });
});
