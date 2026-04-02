import React, { useEffect, useRef, useState } from 'react';

interface PasswordItem {
  id: number;
  title: string;
  username: string;
  url?: string;
  category?: string;
  favorite?: boolean;
}

interface Props {
  passwords: PasswordItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

function getItemToken(title: string): string {
  const text = (title || '').trim();
  if (!text) {
    return '#';
  }

  const firstChar = Array.from(text)[0];
  if (/^[\u4E00-\u9FFF]$/.test(firstChar)) {
    return firstChar;
  }

  const alphaNumeric = (text.match(/[A-Za-z0-9]/g) || []).slice(0, 2).join('').toUpperCase();
  if (alphaNumeric) {
    return alphaNumeric;
  }

  return firstChar.toUpperCase();
}

const PasswordList: React.FC<Props> = ({ passwords, selectedId, onSelect }) => {
  const [faviconMap, setFaviconMap] = useState<Record<number, string | null>>({});
  const [failedFaviconMap, setFailedFaviconMap] = useState<Record<number, boolean>>({});
  const urlSnapshotRef = useRef<Record<number, string>>({});

  useEffect(() => {
    const nextSnapshot: Record<number, string> = {};
    const staleIds = new Set<number>();

    for (const password of passwords) {
      const normalizedUrl = (password.url || '').trim();
      nextSnapshot[password.id] = normalizedUrl;

      if (urlSnapshotRef.current[password.id] !== undefined && urlSnapshotRef.current[password.id] !== normalizedUrl) {
        staleIds.add(password.id);
      }
    }

    for (const existingId of Object.keys(urlSnapshotRef.current)) {
      const id = Number(existingId);
      if (!passwords.some(password => password.id === id)) {
        staleIds.add(id);
      }
    }

    if (staleIds.size > 0) {
      setFaviconMap(prev => {
        const next = { ...prev };
        let changed = false;
        for (const id of staleIds) {
          if (next[id] !== undefined) {
            delete next[id];
            changed = true;
          }
        }
        return changed ? next : prev;
      });

      setFailedFaviconMap(prev => {
        const next = { ...prev };
        let changed = false;
        for (const id of staleIds) {
          if (next[id] !== undefined) {
            delete next[id];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }

    urlSnapshotRef.current = nextSnapshot;
  }, [passwords]);

  useEffect(() => {
    let disposed = false;

    const loadFavicons = async (): Promise<void> => {
      const tasks = passwords.map(async password => {
        const normalizedUrl = (password.url || '').trim();
        if (!normalizedUrl || faviconMap[password.id] !== undefined || failedFaviconMap[password.id]) {
          return null;
        }

        try {
          const favicon = await window.electronAPI.resolveFavicon(normalizedUrl);
          return [password.id, favicon] as const;
        } catch {
          return [password.id, null] as const;
        }
      });

      const results = (await Promise.all(tasks)).filter(Boolean) as Array<readonly [number, string | null]>;
      if (!results.length || disposed) {
        return;
      }

      setFaviconMap(prev => {
        const next = { ...prev };
        for (const [id, iconPath] of results) {
          next[id] = iconPath;
        }
        return next;
      });
    };

    loadFavicons();

    return () => {
      disposed = true;
    };
  }, [passwords, faviconMap, failedFaviconMap]);

  if (passwords.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 text-sm text-gray-400">
        暂无匹配记录
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
      <div className="flex min-w-0 flex-col gap-2">
        {passwords.map(password => {
          const isSelected = password.id === selectedId;
          const token = getItemToken(password.title);
          const faviconUrl = faviconMap[password.id] || null;
          const showFavicon = Boolean(faviconUrl) && !failedFaviconMap[password.id];

          return (
            <button
              key={password.id}
              type="button"
              onClick={() => onSelect(password.id)}
              className={[
                'w-full min-w-0 rounded-xl border px-3 py-2.5 text-left transition-colors',
                isSelected
                  ? 'border-primary-300 bg-primary-50/70'
                  : 'border-gray-200 bg-white hover:border-primary-200 hover:bg-primary-50/40'
              ].join(' ')}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-100 text-xs font-semibold text-primary-700">
                  {showFavicon ? (
                    <img
                      src={faviconUrl!}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={() => {
                        setFailedFaviconMap(prev => {
                          if (prev[password.id]) {
                            return prev;
                          }
                          return { ...prev, [password.id]: true };
                        });
                      }}
                    />
                  ) : (
                    <span>{token}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
                      {password.title}
                    </h3>
                    {Boolean(password.favorite) && (
                      <svg className="h-4 w-4 shrink-0 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    )}
                  </div>

                  <p className="mt-0.5 truncate text-xs text-gray-500">{password.username}</p>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                  {password.category || 'Default'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
export default PasswordList;
