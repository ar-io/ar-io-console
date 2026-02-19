import { useState } from 'react';

interface VerificationBlockedModalProps {
  identifier: string;
  errorMessage?: string;
  failedCount: number;
  totalCount: number;
  onGoBack: () => void;
  onRetry: () => void;
  onProceedAnyway: () => void;
}

export function VerificationBlockedModal({
  identifier,
  errorMessage,
  failedCount,
  totalCount,
  onGoBack,
  onRetry,
  onProceedAnyway,
}: VerificationBlockedModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [showConfirmProceed, setShowConfirmProceed] = useState(false);

  const handleProceedClick = () => {
    if (!showConfirmProceed) {
      setShowConfirmProceed(true);
    } else if (acknowledged) {
      onProceedAnyway();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4">
      <div className="bg-background border border-red-200 rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-red-50 px-6 py-4 border-b border-red-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600 rounded-xl">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Verification Failed</h2>
              <p className="text-sm text-red-600">Content integrity could not be verified</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          <div className="text-foreground">
            <p className="mb-3">
              The content for <span className="font-mono text-primary">{identifier}</span> failed cryptographic verification.
            </p>
            <p className="text-sm text-foreground/60">
              This could mean the content was tampered with by a malicious gateway, or there was a network error during verification.
            </p>
          </div>

          {/* Stats */}
          <div className="bg-card rounded-xl p-4 border border-border/20">
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-foreground/60">Resources Checked:</span>
                <span className="text-foreground font-mono">{totalCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground/60">Failed Verification:</span>
                <span className="text-red-600 font-mono">{failedCount}</span>
              </div>
              {errorMessage && (
                <div className="pt-2 border-t border-border/20">
                  <span className="text-foreground/60 text-xs">Error: </span>
                  <span className="text-red-600 text-xs font-mono">{errorMessage}</span>
                </div>
              )}
            </div>
          </div>

          {/* Security Warning */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div className="text-sm">
                <div className="font-semibold text-red-600 mb-1">Security Risk</div>
                <div className="text-foreground">
                  Viewing unverified content may expose you to:
                </div>
                <ul className="mt-2 text-foreground/60 space-y-1 list-disc list-inside">
                  <li>Phishing attacks disguised as legitimate apps</li>
                  <li>Malicious code that could steal your wallet keys</li>
                  <li>Fake transaction signing requests</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Proceed Anyway Section */}
          {showConfirmProceed && (
            <div className="bg-card border border-border/30 rounded-xl p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-1 w-4 h-4 text-red-600 rounded focus:ring-red-600 accent-red-600"
                />
                <span className="text-sm text-foreground">
                  I understand the risks. I acknowledge that this content failed verification and may be malicious.
                  I will not sign any transactions or connect my wallet on this page.
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-card border-t border-border/20">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onGoBack}
              className="flex-1 px-4 py-2.5 bg-primary text-white rounded-full hover:opacity-90 transition-opacity font-medium"
            >
              Go Back to Safety
            </button>
            <button
              onClick={onRetry}
              className="flex-1 px-4 py-2.5 border border-border/30 text-foreground rounded-full hover:bg-card/80 transition-colors font-medium"
            >
              Retry with Different Gateway
            </button>
          </div>

          <div className="mt-3 pt-3 border-t border-border/20">
            <button
              onClick={handleProceedClick}
              disabled={showConfirmProceed && !acknowledged}
              className={`w-full px-4 py-2 text-sm rounded-full transition-colors ${
                showConfirmProceed && !acknowledged
                  ? 'text-foreground/40 bg-card cursor-not-allowed'
                  : 'text-red-600 hover:bg-red-50 border border-red-200'
              }`}
            >
              {showConfirmProceed
                ? acknowledged
                  ? 'Confirm: View Unverified Content'
                  : 'Please acknowledge the risks above'
                : 'Proceed Anyway (Not Recommended)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
