import { Github, Linkedin } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const version = import.meta.env.PACKAGE_VERSION || '1.0.0';

  return (
    <footer className="mt-auto bg-lavender">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8">
        {/* Separator line */}
        <div className="border-t border-foreground/20 pt-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            {/* Left side: Copyright and version */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-foreground/80">
                © {currentYear} ar.io
              </span>
              <span className="text-foreground/30">•</span>
              <a
                href="https://github.com/ar-io/ar-io-console"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-foreground/60 hover:text-foreground transition-colors"
                title="View source code on GitHub"
              >
                v{version}
              </a>
            </div>

            {/* Right side: Social Icons */}
            <nav className="flex items-center gap-4">
              <a
                href="https://x.com/ar_io_network"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground/60 hover:text-foreground transition-colors"
                aria-label="X (Twitter)"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a
                href="https://www.linkedin.com/company/ar-io-network/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground/60 hover:text-foreground transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </a>
              <a
                href="https://github.com/ar-io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground/60 hover:text-foreground transition-colors"
                aria-label="GitHub"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="https://discord.com/invite/HGG52EtTc2"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground/60 hover:text-foreground transition-colors"
                aria-label="Discord"
              >
                <img src="https://ar.io/icons/discord-icon.svg" alt="Discord" className="w-5 h-5 opacity-60 hover:opacity-100 transition-opacity" />
              </a>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
