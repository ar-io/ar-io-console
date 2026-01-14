import { useTheme } from '../hooks/useTheme';

export default function TurboLogo() {
  const { resolvedTheme } = useTheme();

  // Use light logo (white) on dark backgrounds, dark logo (black) on light backgrounds
  const logoSrc = resolvedTheme === 'dark' ? '/turbo-logo-light.png' : '/turbo-logo-dark.png';

  return (
    <img src={logoSrc} alt="Turbo" className="h-8" />
  );
}