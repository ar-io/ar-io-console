import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { ThemeMode } from '../store/useStore';

interface ThemeToggleProps {
  /** Show as segmented button group (default) or dropdown */
  variant?: 'segmented' | 'compact';
  /** Additional className for the container */
  className?: string;
}

/**
 * Theme toggle component for switching between light, dark, and system themes.
 */
export function ThemeToggle({ variant = 'segmented', className = '' }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
  };

  if (variant === 'compact') {
    // Compact: Single button that cycles through themes
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
    const Icon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;

    return (
      <button
        onClick={() => handleThemeChange(nextTheme)}
        className={`p-2 rounded-lg bg-surface border border-default hover:border-turbo-purple/50 transition-colors ${className}`}
        title={`Theme: ${theme} (click to change)`}
        aria-label={`Current theme: ${theme}. Click to switch.`}
      >
        <Icon className="w-4 h-4 text-link" />
      </button>
    );
  }

  // Segmented: Three-button group
  return (
    <div className={`inline-flex bg-surface rounded-lg p-1 border border-default ${className}`}>
      <button
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
          theme === 'light'
            ? 'bg-turbo-purple text-black'
            : 'text-link hover:text-fg-muted'
        }`}
        onClick={() => handleThemeChange('light')}
        aria-pressed={theme === 'light'}
        title="Light theme"
      >
        <Sun className="w-4 h-4" />
        <span className="hidden sm:inline">Light</span>
      </button>
      <button
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
          theme === 'system'
            ? 'bg-turbo-purple text-black'
            : 'text-link hover:text-fg-muted'
        }`}
        onClick={() => handleThemeChange('system')}
        aria-pressed={theme === 'system'}
        title="System theme (follows OS preference)"
      >
        <Monitor className="w-4 h-4" />
        <span className="hidden sm:inline">System</span>
      </button>
      <button
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
          theme === 'dark'
            ? 'bg-turbo-purple text-black'
            : 'text-link hover:text-fg-muted'
        }`}
        onClick={() => handleThemeChange('dark')}
        aria-pressed={theme === 'dark'}
        title="Dark theme"
      >
        <Moon className="w-4 h-4" />
        <span className="hidden sm:inline">Dark</span>
      </button>
    </div>
  );
}

export default ThemeToggle;
