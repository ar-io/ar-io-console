import { useState } from 'react';
import { Globe, Search, CheckCircle, XCircle, Shield, Zap, ExternalLink } from 'lucide-react';
import { getARIO } from '../../utils';

export default function ArNSPanel() {
  const [nameSearch, setNameSearch] = useState('');
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<boolean | null>(null);
  // The name `availability` actually describes — captured at check time so the
  // result banner can never be mislabeled by later keystrokes.
  const [checkedName, setCheckedName] = useState('');
  const [checkError, setCheckError] = useState<string | null>(null);

  const hasInvalidHyphens = /^-|-$/.test(nameSearch);

  const checkAvailability = async () => {
    // Read the current input directly (no debounce): the check is button-
    // triggered, so a debounced value would just let a stale/empty name be
    // checked and then mislabeled with the current text.
    const name = nameSearch;
    if (!name || hasInvalidHyphens) return;

    setChecking(true);
    setAvailability(null);
    setCheckError(null);
    try {
      const ario = getARIO();

      // A returned record means the name is registered → taken.
      // getArNSRecord THROWS "ArNS record not found: <name>" when no record
      // exists (i.e. available). Any *other* thrown error is a gateway/transport
      // failure — we must not report that as "available" (the old behavior),
      // which could send a user to register a name that's actually taken.
      await ario.getArNSRecord({ name });
      setCheckedName(name);
      setAvailability(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/record not found/i.test(message)) {
        setCheckedName(name);
        setAvailability(true);
      } else {
        console.error('ArNS availability check failed:', error);
        setCheckError('Could not check availability right now. Please try again.');
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="px-4 sm:px-6">
      {/* Inline Header with Description */}
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 bg-primary/20 rounded-2xl flex items-center justify-center flex-shrink-0 mt-1">
          <Globe className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-2xl font-extrabold font-heading text-foreground mb-1">Search Domains</h3>
          <p className="text-sm text-foreground/80">
            Search available ArNS names and check registration costs
          </p>
        </div>
      </div>

      {/* Main Content Container with Gradient */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl border border-primary/30 p-4 sm:p-6 mb-4 sm:mb-6">

      {/* Name Search */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium">Search for a name</label>
          <a
            href="https://arns.ar.io"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:opacity-80 transition-colors font-medium"
          >
            <ExternalLink className="w-3 h-3" />
            arns.ar.io
          </a>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="field flex items-center border border-border/20 rounded-2xl bg-card focus-within:border-primary transition-colors">
              <input
                type="text"
                value={nameSearch}
                onChange={(e) => {
                  const cleaned = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                  setNameSearch(cleaned);
                  setAvailability(null);
                  setCheckError(null);
                }}
                className="flex-1 p-3 bg-transparent text-foreground font-mono min-w-0"
                placeholder="my-awesome-app"
              />
              <div className="px-3 text-sm text-foreground/80 font-mono border-l border-border/20 flex-shrink-0">
                .ar.io
              </div>
            </div>
          </div>
          <button
            onClick={checkAvailability}
            disabled={!nameSearch || checking || hasInvalidHyphens}
            className="w-full sm:w-auto px-6 py-3 rounded-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" />
            {checking ? 'Checking...' : 'Check'}
          </button>
        </div>

        {hasInvalidHyphens && (
          <p className="mt-2 text-xs text-warning">
            ArNS names cannot start or end with a hyphen.
          </p>
        )}

        {/* Transport/gateway error — distinct from a definitive availability result */}
        {checkError && (
          <div className="mt-4 p-4 rounded-2xl border border-error/20 bg-error/10 text-center">
            <div className="flex items-center justify-center gap-2">
              <XCircle className="w-5 h-5 text-error" />
              <span className="font-semibold text-error">{checkError}</span>
            </div>
          </div>
        )}

        {/* Single consolidated availability display */}
        {availability !== null && checkedName && (
          <div className={`mt-4 p-4 rounded-2xl border text-center ${
            availability
              ? 'bg-card border-primary/30'
              : 'bg-error/10 border-error/20'
          }`}>
            {availability ? (
              <>
                <div className="flex items-center justify-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-foreground">"{checkedName}.ar.io" is available!</span>
                </div>
                <p className="text-sm text-foreground/80 mb-4">
                  Complete your registration on the official ArNS app
                </p>
                <a
                  href={`https://arns.ar.io/#/register/${checkedName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-full hover:bg-primary/90 transition-colors"
                >
                  <Globe className="w-5 h-5" />
                  Register on ArNS App
                </a>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <XCircle className="w-5 h-5 text-error" />
                  <span className="font-semibold text-error">"{checkedName}.ar.io" is already taken</span>
                </div>
                <p className="text-sm text-foreground/80">Try a different name</p>
              </>
            )}
          </div>
        )}
      </div>

      </div>

      {/* ArNS Features */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-card rounded-2xl p-4 border border-border/20">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-extrabold font-heading text-foreground mb-1 text-sm">Human-Readable Names</h4>
              <p className="text-xs text-foreground/80">
                Replace complex transaction IDs with memorable domain names for your apps.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-4 border border-border/20">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary/15 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-extrabold font-heading text-foreground mb-1 text-sm">Permanent Ownership</h4>
              <p className="text-xs text-foreground/80">
                Domain ownership is permanently recorded on the Arweave blockchain.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-4 border border-border/20">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary/15 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-extrabold font-heading text-foreground mb-1 text-sm">Global Propagation</h4>
              <p className="text-xs text-foreground/80">
                Instant propagation across the entire ar.io network worldwide.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-4 border border-border/20">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary/15 rounded-2xl flex items-center justify-center flex-shrink-0">
              <ExternalLink className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-extrabold font-heading text-foreground mb-1 text-sm">Update Anytime</h4>
              <p className="text-xs text-foreground/80">
                Change where your domain points without losing ownership.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ArNS App Integration */}
      <div className="bg-card rounded-2xl p-6 border border-border/20">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h4 className="text-lg font-extrabold font-heading text-foreground mb-2">Ready to Register?</h4>
            <p className="text-sm text-foreground/80 mb-4">
              For the complete ArNS experience including domain registration, management, and advanced features,
              visit the full ArNS application.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="https://arns.ar.io"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-full hover:bg-primary/90 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open ArNS App
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
