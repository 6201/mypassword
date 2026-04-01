export const AppIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg32" x1="5" y1="4" x2="27" y2="28" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6366F1" />
        <stop offset="1" stopColor="#4338CA" />
      </linearGradient>
      <linearGradient id="ring32" x1="11" y1="8" x2="18" y2="15" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F8FAFC" />
        <stop offset="1" stopColor="#CBD5E1" />
      </linearGradient>
      <linearGradient id="k132" x1="15" y1="13" x2="24" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F8FAFC" />
        <stop offset="1" stopColor="#D1D5DB" />
      </linearGradient>
      <linearGradient id="k232" x1="13" y1="14" x2="21" y2="23" gradientUnits="userSpaceOnUse">
        <stop stopColor="#EEF2FF" />
        <stop offset="1" stopColor="#C7D2FE" />
      </linearGradient>
      <linearGradient id="k332" x1="16" y1="14" x2="22" y2="21" gradientUnits="userSpaceOnUse">
        <stop stopColor="#E2E8F0" />
        <stop offset="1" stopColor="#94A3B8" />
      </linearGradient>
    </defs>

    <rect x="2" y="2" width="28" height="28" rx="7" fill="url(#bg32)" />

    <g transform="translate(16 16) rotate(-16) translate(-16 -16)">
      <circle cx="14.8" cy="12" r="4.25" fill="none" stroke="url(#ring32)" strokeWidth="1.65" />
      <circle cx="14.8" cy="12" r="1.9" fill="none" stroke="#E5E7EB" strokeWidth="0.65" />

      <g>
        <circle cx="14.8" cy="12" r="1.9" fill="none" stroke="url(#k132)" strokeWidth="1.35" />
        <path d="M16.1 13.15L22.25 19.3L24.45 19.3L24.45 18.85L24.95 18.85L24.95 20L24.15 20.25L24.15 20.25L23.05 20.25L23.05 21.25L21.95 21.25L21.95 22.35L20.5 22.35C20.08 22.35 19.55 22.1 19.2 21.75L13.7 16.25L16.1 13.15Z" fill="url(#k132)" />
        <rect x="21.95" y="21.55" width="1.1" height="0.8" rx="0.2" fill="#CBD5E1" />
        <rect x="23.05" y="20.55" width="1.1" height="0.7" rx="0.2" fill="#CBD5E1" />
        <rect x="24.15" y="19.35" width="0.8" height="0.65" rx="0.18" fill="#CBD5E1" />
      </g>

      <g transform="translate(14.8 12) rotate(44) translate(-14.8 -12)">
        <circle cx="14.8" cy="12" r="1.45" fill="none" stroke="url(#k232)" strokeWidth="1.1" />
        <path d="M15.75 12.8L20.55 17.6L22.15 17.6L22.15 17.25L22.55 17.25L22.55 18.05L21.95 18.25L21.95 18.25L21.1 18.25L21.1 19.05L20.2 19.05L20.2 19.85L19.05 19.85C18.7 19.85 18.25 19.65 17.95 19.35L13.7 15.1L15.75 12.8Z" fill="url(#k232)" />
        <rect x="20.15" y="19.15" width="0.9" height="0.65" rx="0.18" fill="#A5B4FC" />
        <rect x="21.05" y="18.35" width="0.9" height="0.58" rx="0.18" fill="#A5B4FC" />
      </g>

      <g transform="translate(14.8 12) rotate(-56) translate(-14.8 -12)">
        <circle cx="14.8" cy="12" r="1.25" fill="none" stroke="url(#k332)" strokeWidth="0.95" />
        <path d="M15.6 12.7L19.65 16.75L20.95 16.75L20.95 16.45L21.3 16.45L21.3 17.1L20.8 17.28L20.8 17.28L20.1 17.28L20.1 17.95L19.35 17.95L19.35 18.6L18.4 18.6C18.1 18.6 17.72 18.42 17.45 18.15L13.9 14.6L15.6 12.7Z" fill="url(#k332)" />
        <rect x="19.3" y="17.75" width="0.72" height="0.5" rx="0.16" fill="#94A3B8" />
        <rect x="20.0" y="17.15" width="0.68" height="0.46" rx="0.15" fill="#94A3B8" />
      </g>
    </g>
  </svg>
);
