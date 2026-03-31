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
        <path d="M16.1 13.15L22.9 19.95C23.32 20.37 23.32 21.03 22.9 21.45L22 22.35C21.58 22.77 20.92 22.77 20.5 22.35L13.7 15.55L16.1 13.15Z" fill="url(#k132)" />
        <rect x="20.35" y="20.75" width="1.35" height="2.45" rx="0.3" fill="#CBD5E1" />
        <rect x="21.45" y="19.75" width="1.2" height="2.05" rx="0.3" fill="#CBD5E1" />
        <rect x="22.35" y="18.85" width="1.05" height="1.6" rx="0.25" fill="#CBD5E1" />
      </g>

      <g transform="translate(14.8 12) rotate(44) translate(-14.8 -12)">
        <circle cx="14.8" cy="12" r="1.45" fill="none" stroke="url(#k232)" strokeWidth="1.1" />
        <path d="M15.75 12.8L21.1 18.15C21.45 18.5 21.45 19.1 21.1 19.45L20.35 20.2C20 20.55 19.4 20.55 19.05 20.2L13.7 14.85L15.75 12.8Z" fill="url(#k232)" />
        <rect x="19.05" y="18.9" width="1.1" height="2" rx="0.25" fill="#A5B4FC" />
        <rect x="19.95" y="18.1" width="1" height="1.65" rx="0.25" fill="#A5B4FC" />
      </g>

      <g transform="translate(14.8 12) rotate(-56) translate(-14.8 -12)">
        <circle cx="14.8" cy="12" r="1.25" fill="none" stroke="url(#k332)" strokeWidth="0.95" />
        <path d="M15.6 12.7L20.1 17.2C20.4 17.5 20.4 18 20.1 18.3L19.5 18.9C19.2 19.2 18.7 19.2 18.4 18.9L13.9 14.4L15.6 12.7Z" fill="url(#k332)" />
        <rect x="18.45" y="17.55" width="0.95" height="1.55" rx="0.22" fill="#94A3B8" />
        <rect x="19.2" y="16.95" width="0.85" height="1.2" rx="0.2" fill="#94A3B8" />
      </g>
    </g>
  </svg>
);
