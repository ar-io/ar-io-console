import { useState, useEffect } from 'react';
import { Eye, EyeOff, Copy, Check, AlertTriangle } from 'lucide-react';
import BaseModal from './BaseModal';
import { useHotWallet } from '../../hooks/useHotWallet';

interface SeedPhraseModalProps {
  onClose: () => void;
  onExported?: () => void;
}

export default function SeedPhraseModal({ onClose, onExported }: SeedPhraseModalProps) {
  const { getSeedPhrase, confirmSeedExported } = useHotWallet();
  const [words, setWords] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [allRevealed, setAllRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSeedPhrase()
      .then(setWords)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to get seed phrase');
      })
      .finally(() => setLoading(false));
  }, [getSeedPhrase]);

  const toggleWord = (index: number) => {
    setRevealed((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const revealAll = () => {
    const all: Record<number, boolean> = {};
    words.forEach((_, i) => {
      all[i] = true;
    });
    setRevealed(all);
    setAllRevealed(true);
  };

  const hideAll = () => {
    setRevealed({});
    setAllRevealed(false);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(words.join(' '));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API failed
    }
  };

  const handleConfirm = () => {
    confirmSeedExported();
    onExported?.();
    onClose();
  };

  if (loading) {
    return (
      <BaseModal onClose={onClose}>
        <div className="w-[500px] p-6 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-fg-muted border-t-transparent rounded-full" />
        </div>
      </BaseModal>
    );
  }

  if (error) {
    return (
      <BaseModal onClose={onClose}>
        <div className="w-[500px] p-6">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-fg-muted mb-2">Error</h2>
            <p className="text-sm text-link mb-6">{error}</p>
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-lg bg-fg-muted text-canvas font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      </BaseModal>
    );
  }

  return (
    <BaseModal onClose={onClose} showCloseButton={false}>
      <div className="w-[500px] p-6">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-fg-muted mb-2">Recovery Phrase</h2>
          <p className="text-sm text-link">
            Write down these 12 words in order. You'll need them to restore your wallet.
          </p>
        </div>

        {/* Warning */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-alert-danger flex-shrink-0 mt-0.5" />
            <p className="text-sm text-alert-danger">
              Never share your recovery phrase. Anyone with these words can access your wallet and
              funds.
            </p>
          </div>
        </div>

        {/* Word Grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {words.map((word, index) => (
            <button
              key={index}
              onClick={() => toggleWord(index)}
              className="flex items-center gap-2 p-3 bg-surface rounded-lg border border-default hover:border-fg-muted/30 transition-colors text-left"
            >
              <span className="text-xs text-link w-5">{index + 1}.</span>
              <span
                className={`font-mono text-sm flex-1 ${
                  revealed[index]
                    ? 'text-fg-muted'
                    : 'text-transparent bg-fg-muted/20 rounded select-none'
                }`}
              >
                {revealed[index] ? word : '\u2022\u2022\u2022\u2022\u2022\u2022'}
              </span>
            </button>
          ))}
        </div>

        {/* Actions Row */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={allRevealed ? hideAll : revealAll}
            className="flex items-center gap-2 text-sm text-link hover:text-fg-muted transition-colors"
          >
            {allRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {allRevealed ? 'Hide All' : 'Reveal All'}
          </button>

          <button
            onClick={copyToClipboard}
            className="flex items-center gap-2 text-sm text-link hover:text-fg-muted transition-colors"
          >
            {copied ? (
              <Check className="w-4 h-4 text-turbo-green" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
        </div>

        {/* Confirmation Checkbox */}
        <label className="flex items-start gap-3 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-default bg-canvas accent-white"
          />
          <span className="text-sm text-link">
            I have saved my recovery phrase or imported it into a wallet
          </span>
        </label>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-lg border border-default text-link hover:bg-surface hover:text-fg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!confirmed}
            className="flex-1 py-3 px-4 rounded-lg bg-fg-muted text-canvas font-semibold hover:bg-fg-muted/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Done
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
