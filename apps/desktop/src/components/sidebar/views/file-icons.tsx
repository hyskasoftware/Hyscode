// ── Material-style File Icons ─────────────────────────────────────────────────
// SVG icons colored to match VS Code's material-icon-theme.

import React from 'react';

interface IconProps {
  className?: string;
}

// ── Base icon wrapper ─────────────────────────────────────────────────────────
function SvgIcon({ children, className = 'h-4 w-4' }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {children}
    </svg>
  );
}

// ── TypeScript ────────────────────────────────────────────────────────────────
function TypeScriptIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <rect x="2" y="2" width="20" height="20" rx="2" fill="#3178C6" />
      <path d="M14.5 17V12.5H17V11H10V12.5H12.5V17H14.5Z" fill="white" />
      <path d="M18 14.5C18 13.12 17.1 12.3 15.5 12.3C14.3 12.3 13.5 12.8 13.2 13.5L14.3 14C14.5 13.6 14.8 13.4 15.4 13.4C16 13.4 16.4 13.7 16.4 14.1C16.4 14.9 13.2 14.7 13.2 16.8C13.2 17.8 14 18.5 15.2 18.5C16.2 18.5 17 18 17.4 17.2L16.3 16.7C16.1 17.1 15.7 17.3 15.3 17.3C14.8 17.3 14.5 17.1 14.5 16.7C14.5 15.9 18 16.1 18 14.5Z" fill="white" />
    </SvgIcon>
  );
}

// ── JavaScript ────────────────────────────────────────────────────────────────
function JavaScriptIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <rect x="2" y="2" width="20" height="20" rx="2" fill="#F7DF1E" />
      <path d="M8 18L9.2 17.1C9.5 17.7 9.9 18.1 10.7 18.1C11.5 18.1 11.9 17.7 11.9 16.8V11H13.5V16.8C13.5 18.6 12.4 19.4 10.8 19.4C9.4 19.4 8.5 18.7 8 18Z" fill="#1A1A1A" />
      <path d="M14.5 17.8L15.7 16.9C16.1 17.6 16.7 18.1 17.7 18.1C18.5 18.1 19 17.7 19 17.1C19 16.4 18.5 16.2 17.6 15.8L17.1 15.6C15.7 15 14.8 14.2 14.8 12.6C14.8 11.2 15.9 10.2 17.5 10.2C18.6 10.2 19.5 10.6 20 11.5L18.9 12.5C18.6 12 18.2 11.7 17.5 11.7C16.8 11.7 16.4 12.1 16.4 12.6C16.4 13.2 16.8 13.4 17.6 13.8L18.1 14C19.7 14.7 20.6 15.4 20.6 17.1C20.6 18.9 19.2 19.8 17.7 19.8C16.2 19.8 15.2 19 14.5 17.8Z" fill="#1A1A1A" />
    </SvgIcon>
  );
}

// ── React (TSX/JSX) ──────────────────────────────────────────────────────────
function ReactIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <circle cx="12" cy="12" r="2.5" fill="#61DAFB" />
      <ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="#61DAFB" strokeWidth="1" fill="none" />
      <ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="#61DAFB" strokeWidth="1" fill="none" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="#61DAFB" strokeWidth="1" fill="none" transform="rotate(120 12 12)" />
    </SvgIcon>
  );
}

// ── JSON ──────────────────────────────────────────────────────────────────────
function JsonIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M5 3H7C8.1 3 9 3.9 9 5V8C9 9.1 9.9 10 11 10H12V12H11C9.9 12 9 12.9 9 14V17C9 18.1 8.1 19 7 19H5V17H7V14C7 12.9 7.9 12 9 12C7.9 12 7 11.1 7 10V7H5V5Z" fill="#F5C842" />
      <path d="M19 3H17C15.9 3 15 3.9 15 5V8C15 9.1 14.1 10 13 10H12V12H13C14.1 12 15 12.9 15 14V17C15 18.1 15.9 19 17 19H19V17H17V14C17 12.9 16.1 12 15 12C16.1 12 17 11.1 17 10V7H19V5Z" fill="#F5C842" />
    </SvgIcon>
  );
}

// ── Rust ───────────────────────────────────────────────────────────────────────
function RustIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="#DEA584" strokeWidth="1.5" />
      <path d="M12 6L13.5 9.5H10.5L12 6Z" fill="#DEA584" />
      <rect x="9" y="10" width="6" height="2" rx="1" fill="#DEA584" />
      <rect x="9" y="13" width="6" height="2" rx="1" fill="#DEA584" />
      <path d="M7 12H5M19 12H17M12 5V3M12 21V19" stroke="#DEA584" strokeWidth="1.5" strokeLinecap="round" />
    </SvgIcon>
  );
}

// ── Python ────────────────────────────────────────────────────────────────────
function PythonIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M11.9 2C7.4 2 7.8 3.8 7.8 3.8V5.7H12V6.5H5.8C5.8 6.5 2 6.1 2 11C2 15.9 5.3 15.7 5.3 15.7H7V13.5C7 13.5 6.9 10.2 10.3 10.2H13.6C13.6 10.2 16.6 10.3 16.6 7.4V4.2C16.6 4.2 17 2 11.9 2ZM9.8 3.5C10.3 3.5 10.7 3.9 10.7 4.4C10.7 4.9 10.3 5.3 9.8 5.3C9.3 5.3 8.9 4.9 8.9 4.4C8.9 3.9 9.3 3.5 9.8 3.5Z" fill="#3776AB" />
      <path d="M12.1 22C16.6 22 16.2 20.2 16.2 20.2V18.3H12V17.5H18.2C18.2 17.5 22 17.9 22 13C22 8.1 18.7 8.3 18.7 8.3H17V10.5C17 10.5 17.1 13.8 13.7 13.8H10.4C10.4 13.8 7.4 13.7 7.4 16.6V19.8C7.4 19.8 7 22 12.1 22ZM14.2 20.5C13.7 20.5 13.3 20.1 13.3 19.6C13.3 19.1 13.7 18.7 14.2 18.7C14.7 18.7 15.1 19.1 15.1 19.6C15.1 20.1 14.7 20.5 14.2 20.5Z" fill="#FFD43B" />
    </SvgIcon>
  );
}

// ── HTML ──────────────────────────────────────────────────────────────────────
function HtmlIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M4 2L5.5 20L12 22L18.5 20L20 2H4Z" fill="#E44D26" />
      <path d="M12 4V20L17 18.5L18.3 4H12Z" fill="#F16529" />
      <path d="M8 7H16L15.8 9H8.2L8.4 11H15.6L15 17L12 18L9 17L8.8 14H10.5L10.6 15.5L12 16L13.4 15.5L13.6 12H8L7.5 7Z" fill="white" />
    </SvgIcon>
  );
}

// ── CSS ───────────────────────────────────────────────────────────────────────
function CssIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M4 2L5.5 20L12 22L18.5 20L20 2H4Z" fill="#1572B6" />
      <path d="M12 4V20L17 18.5L18.3 4H12Z" fill="#33A9DC" />
      <path d="M16 7H8L8.2 9H15.8L15 17L12 18L9 17L8.8 14H10.5L10.6 15.5L12 16L13.4 15.5L13.6 12H8.4L8 7Z" fill="white" />
    </SvgIcon>
  );
}

// ── Markdown ──────────────────────────────────────────────────────────────────
function MarkdownIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="#519ABA" strokeWidth="1.5" />
      <path d="M5 15V9H7L9 11.5L11 9H13V15H11V11.5L9 14L7 11.5V15H5Z" fill="#519ABA" />
      <path d="M17 15L14 12H16V9H18V12H20L17 15Z" fill="#519ABA" />
    </SvgIcon>
  );
}

// ── Git ───────────────────────────────────────────────────────────────────────
function GitIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M21.6 11.2L12.8 2.4C12.4 2 11.6 2 11.2 2.4L9 4.6L11.7 7.3C12.2 7.1 12.8 7.2 13.2 7.6C13.7 8.1 13.7 8.7 13.4 9.2L16 11.8C16.5 11.5 17.2 11.6 17.6 12C18.1 12.5 18.1 13.3 17.6 13.8C17.1 14.3 16.3 14.3 15.8 13.8C15.4 13.4 15.3 12.7 15.6 12.2L13.2 9.8V15C13.4 15.1 13.6 15.3 13.7 15.5C14.2 16 14.2 16.8 13.7 17.3C13.2 17.8 12.4 17.8 11.9 17.3C11.4 16.8 11.4 16 11.9 15.5C12.1 15.3 12.3 15.2 12.5 15.1V9.6C12.3 9.5 12.1 9.4 11.9 9.2C11.5 8.8 11.4 8.1 11.7 7.6L9 4.9L2.4 11.5C2 11.9 2 12.7 2.4 13.1L11.2 21.9C11.6 22.3 12.4 22.3 12.8 21.9L21.6 13.1C22 12.7 22 11.9 21.6 11.2Z" fill="#F05033" />
    </SvgIcon>
  );
}

// ── SVG icon ─────────────────────────────────────────────────────────────────
function SvgFileIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M4 4C4 2.9 4.9 2 6 2H14L20 8V20C20 21.1 19.1 22 18 22H6C4.9 22 4 21.1 4 20V4Z" fill="#FFB300" />
      <path d="M14 2L20 8H14V2Z" fill="#FF8F00" />
      <path d="M8 13L10 11L12 15L14 12L16 14" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </SvgIcon>
  );
}

// ── Image ────────────────────────────────────────────────────────────────────
function ImageIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" fill="#26A69A" />
      <circle cx="8.5" cy="8.5" r="2" fill="white" opacity="0.7" />
      <path d="M3 16L8 11L13 16L16 13L21 18V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V16Z" fill="white" opacity="0.5" />
    </SvgIcon>
  );
}

// ── YAML/TOML (config) ──────────────────────────────────────────────────────
function ConfigIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M4 4C4 2.9 4.9 2 6 2H14L20 8V20C20 21.1 19.1 22 18 22H6C4.9 22 4 21.1 4 20V4Z" fill="#8E8E93" />
      <path d="M14 2L20 8H14V2Z" fill="#636366" />
      <path d="M8 12H16M8 15H14M8 18H12" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
    </SvgIcon>
  );
}

// ── SQL ───────────────────────────────────────────────────────────────────────
function SqlIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <ellipse cx="12" cy="6" rx="8" ry="3" fill="#00897B" />
      <path d="M4 6V18C4 19.7 7.6 21 12 21C16.4 21 20 19.7 20 18V6" fill="none" stroke="#00897B" strokeWidth="1.5" />
      <ellipse cx="12" cy="12" rx="8" ry="3" fill="none" stroke="#00897B" strokeWidth="1" />
      <ellipse cx="12" cy="18" rx="8" ry="3" fill="none" stroke="#00897B" strokeWidth="1" />
    </SvgIcon>
  );
}

// ── Shell/Bash ──────────────────────────────────────────────────────────────
function ShellIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <rect x="2" y="3" width="20" height="18" rx="2" fill="#4CAF50" />
      <path d="M6 8L10 12L6 16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 16H18" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </SvgIcon>
  );
}

// ── Lock/lockfile ───────────────────────────────────────────────────────────
function LockIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M4 4C4 2.9 4.9 2 6 2H14L20 8V20C20 21.1 19.1 22 18 22H6C4.9 22 4 21.1 4 20V4Z" fill="#78909C" />
      <path d="M14 2L20 8H14V2Z" fill="#546E7A" />
      <rect x="9" y="12" width="6" height="5" rx="1" fill="white" />
      <path d="M10 12V10C10 8.9 10.9 8 12 8C13.1 8 14 8.9 14 10V12" fill="none" stroke="white" strokeWidth="1.5" />
    </SvgIcon>
  );
}

// ── Generic file ─────────────────────────────────────────────────────────────
function GenericFileIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M4 4C4 2.9 4.9 2 6 2H14L20 8V20C20 21.1 19.1 22 18 22H6C4.9 22 4 21.1 4 20V4Z" fill="#90A4AE" />
      <path d="M14 2L20 8H14V2Z" fill="#78909C" />
    </SvgIcon>
  );
}

// ── Folder icons ────────────────────────────────────────────────────────────
export function FolderIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M2 6C2 4.9 2.9 4 4 4H9L11 6H20C21.1 6 22 6.9 22 8V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6Z" fill="#90A4AE" />
      <path d="M2 10H22V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V10Z" fill="#B0BEC5" />
    </SvgIcon>
  );
}

export function FolderOpenIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M2 6C2 4.9 2.9 4 4 4H9L11 6H20C21.1 6 22 6.9 22 8V9H4V6Z" fill="#90A4AE" />
      <path d="M1 10H21L19 20H3L1 10Z" fill="#B0BEC5" />
    </SvgIcon>
  );
}

// Special folder icons
function SrcFolderIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M2 6C2 4.9 2.9 4 4 4H9L11 6H20C21.1 6 22 6.9 22 8V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6Z" fill="#42A5F5" />
      <path d="M2 10H22V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V10Z" fill="#64B5F6" />
    </SvgIcon>
  );
}

function NodeModulesFolderIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M2 6C2 4.9 2.9 4 4 4H9L11 6H20C21.1 6 22 6.9 22 8V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6Z" fill="#689F38" />
      <path d="M2 10H22V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V10Z" fill="#7CB342" />
    </SvgIcon>
  );
}

function GitFolderIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M2 6C2 4.9 2.9 4 4 4H9L11 6H20C21.1 6 22 6.9 22 8V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6Z" fill="#F05033" />
      <path d="M2 10H22V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V10Z" fill="#F4511E" />
    </SvgIcon>
  );
}

function DistFolderIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M2 6C2 4.9 2.9 4 4 4H9L11 6H20C21.1 6 22 6.9 22 8V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6Z" fill="#FFA726" />
      <path d="M2 10H22V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V10Z" fill="#FFB74D" />
    </SvgIcon>
  );
}

function TestFolderIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M2 6C2 4.9 2.9 4 4 4H9L11 6H20C21.1 6 22 6.9 22 8V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6Z" fill="#AB47BC" />
      <path d="M2 10H22V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V10Z" fill="#BA68C8" />
    </SvgIcon>
  );
}

// ── Mapping tables ──────────────────────────────────────────────────────────

const SPECIAL_FILES: Record<string, React.FC<IconProps>> = {
  'package.json': JsonIcon,
  'tsconfig.json': TypeScriptIcon,
  'tsconfig.base.json': TypeScriptIcon,
  '.gitignore': GitIcon,
  '.gitattributes': GitIcon,
  'cargo.toml': RustIcon,
  'cargo.lock': LockIcon,
  'pnpm-lock.yaml': LockIcon,
  'package-lock.json': LockIcon,
  'yarn.lock': LockIcon,
  'dockerfile': ShellIcon,
  'docker-compose.yml': ConfigIcon,
  'docker-compose.yaml': ConfigIcon,
  '.eslintrc': ConfigIcon,
  '.eslintrc.json': ConfigIcon,
  '.prettierrc': ConfigIcon,
  'vite.config.ts': TypeScriptIcon,
  'vite.config.js': JavaScriptIcon,
  'tailwind.config.ts': TypeScriptIcon,
  'tailwind.config.js': JavaScriptIcon,
};

const EXT_ICONS: Record<string, React.FC<IconProps>> = {
  ts: TypeScriptIcon,
  tsx: ReactIcon,
  js: JavaScriptIcon,
  jsx: ReactIcon,
  json: JsonIcon,
  rs: RustIcon,
  py: PythonIcon,
  html: HtmlIcon,
  css: CssIcon,
  scss: CssIcon,
  less: CssIcon,
  md: MarkdownIcon,
  mdx: MarkdownIcon,
  svg: SvgFileIcon,
  png: ImageIcon,
  jpg: ImageIcon,
  jpeg: ImageIcon,
  gif: ImageIcon,
  webp: ImageIcon,
  ico: ImageIcon,
  bmp: ImageIcon,
  yaml: ConfigIcon,
  yml: ConfigIcon,
  toml: ConfigIcon,
  ini: ConfigIcon,
  env: ConfigIcon,
  sql: SqlIcon,
  sh: ShellIcon,
  bash: ShellIcon,
  zsh: ShellIcon,
  ps1: ShellIcon,
  bat: ShellIcon,
  cmd: ShellIcon,
  lock: LockIcon,
};

const SPECIAL_FOLDERS: Record<string, React.FC<IconProps>> = {
  src: SrcFolderIcon,
  'src-tauri': RustIcon,
  node_modules: NodeModulesFolderIcon,
  '.git': GitFolderIcon,
  dist: DistFolderIcon,
  build: DistFolderIcon,
  out: DistFolderIcon,
  test: TestFolderIcon,
  tests: TestFolderIcon,
  __tests__: TestFolderIcon,
  spec: TestFolderIcon,
  docs: SrcFolderIcon,
  packages: SrcFolderIcon,
  apps: SrcFolderIcon,
  components: SrcFolderIcon,
  lib: SrcFolderIcon,
  utils: SrcFolderIcon,
  hooks: SrcFolderIcon,
  stores: SrcFolderIcon,
  styles: CssIcon,
  public: DistFolderIcon,
  assets: ImageIcon,
  icons: ImageIcon,
  migrations: SqlIcon,
};

// ── Public API ──────────────────────────────────────────────────────────────

export function getFileIcon(name: string): React.FC<IconProps> {
  const lower = name.toLowerCase();

  // Check special file names first
  if (SPECIAL_FILES[lower]) return SPECIAL_FILES[lower];

  // Check extension
  const ext = lower.split('.').pop() ?? '';
  if (EXT_ICONS[ext]) return EXT_ICONS[ext];

  return GenericFileIcon;
}

export function getFolderIcon(name: string, isOpen: boolean): React.FC<IconProps> {
  const lower = name.toLowerCase();
  if (SPECIAL_FOLDERS[lower]) return SPECIAL_FOLDERS[lower];
  return isOpen ? FolderOpenIcon : FolderIcon;
}
