import { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  Check,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { Combobox } from '@headlessui/react';
import BaseModal from './BaseModal';
import LinkSolanaWalletModal from './LinkSolanaWalletModal';
import { useOwnedArNSNames } from '../../hooks/useOwnedArNSNames';
import { useLinkedSolanaWallet } from '../../hooks/useLinkedSolanaWallet';
import { sanitizeUndername, hasInvalidCharacters } from '../../utils/undernames';
import ArNSGetNameLinks from '../ArNSGetNameLinks';

interface AssignDomainModalProps {
  onClose: () => void;
  manifestId: string;
  existingArnsName?: string;
  existingUndername?: string;
  onSuccess: (arnsName: string, undername?: string, transactionId?: string) => void;
  /** Context to prefill the register search with — see ArNSGetNameLinks. */
  suggestedName?: string;
}

export default function AssignDomainModal({
  onClose,
  manifestId,
  existingArnsName,
  existingUndername,
  onSuccess,
  suggestedName,
}: AssignDomainModalProps) {
  const { names, loading, fetchError, loadingDetails, fetchOwnedNames, fetchNameDetails, updateArNSRecord } = useOwnedArNSNames();
  const { isSolanaConnected, needsLinking, showLinkModal, setShowLinkModal, promptReconnect } = useLinkedSolanaWallet();

  const [selectedArnsName, setSelectedArnsName] = useState(existingArnsName || '');
  const [selectedUndername, setSelectedUndername] = useState(existingUndername || '');
  const [undernameMode, setUndernameMode] = useState<'none' | 'new' | 'existing'>(
    existingUndername
      ? names.find((n) => n.name === existingArnsName)?.undernames?.includes(existingUndername)
        ? 'existing'
        : 'new'
      : 'none'
  );
  const [nameQuery, setNameQuery] = useState('');
  // Client-side filter over the already-fetched list. useMemo so a re-render
  // (or a keystroke) never re-walks the array needlessly, and never refetches:
  // typing here costs no RPC at all.
  const filteredNames = useMemo(() => {
    if (!nameQuery) return names;
    const q = nameQuery.toLowerCase();
    return names.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        n.displayName.toLowerCase().includes(q),
    );
  }, [names, nameQuery]);

  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState<string>();

  // TTL settings
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ttlMode, setTTLMode] = useState<'existing' | 'custom'>('existing');
  const [customTTLInput, setCustomTTLInput] = useState<string>('600');

  // Auto-fetch names when modal opens
  useEffect(() => {
    if (names.length === 0 && !loading && !fetchError) {
      fetchOwnedNames();
    }
  }, [names.length, loading, fetchError, fetchOwnedNames]);

  // Auto-update undername mode based on selection
  useEffect(() => {
    if (undernameMode === 'none') {
      setSelectedUndername('');
    }
  }, [undernameMode]);

  // Computed values
  const selectedNameRecord = names.find((name) => name.name === selectedArnsName);
  const displayName = selectedNameRecord?.displayName || selectedArnsName;
  const isExistingUndername = selectedUndername && selectedNameRecord?.undernames?.includes(selectedUndername);
  const isNewUndername = selectedUndername && !isExistingUndername;

  // Get current TTL (either for undername or base name)
  const currentTTL =
    selectedUndername && selectedNameRecord?.undernameTTLs?.[selectedUndername]
      ? selectedNameRecord.undernameTTLs[selectedUndername]
      : selectedNameRecord?.ttl || 600;

  // Format TTL for display
  const formatTTL = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  // Update customTTLInput when current TTL changes
  useEffect(() => {
    if (currentTTL && ttlMode === 'existing') {
      setCustomTTLInput(currentTTL.toString());
    }
  }, [currentTTL, ttlMode]);

  const handleAssignDomain = async () => {
    if (!selectedArnsName) {
      setError('Please select an ArNS name');
      return;
    }

    // Validate and sanitize TTL input before proceeding
    let validatedTTL: number | undefined;
    if (ttlMode === 'custom') {
      const trimmedInput = customTTLInput.trim();
      if (trimmedInput === '') {
        setError('Please enter a TTL value');
        return;
      }

      const parsedTTL = parseInt(trimmedInput, 10);
      if (isNaN(parsedTTL)) {
        setError('TTL must be a valid number');
        return;
      }

      if (parsedTTL < 60 || parsedTTL > 86400) {
        setError('TTL must be between 60 seconds (1 minute) and 86400 seconds (24 hours)');
        return;
      }

      validatedTTL = parsedTTL;
    }
    // If ttlMode === 'existing', validatedTTL remains undefined (uses existing TTL)

    setIsAssigning(true);
    setError(undefined);

    try {
      const result = await updateArNSRecord(selectedArnsName, manifestId, selectedUndername || undefined, validatedTTL);

      if (result.success) {
        onSuccess(selectedArnsName, selectedUndername || undefined, result.transactionId);
      } else {
        setError(result.error || 'Domain assignment failed');
      }
    } catch (error) {
      console.error('Domain assignment error:', error);
      setError(error instanceof Error ? error.message : 'Domain assignment failed');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <>
    <BaseModal onClose={onClose} showCloseButton={false}>
      <div className="w-[90vw] sm:w-[600px] max-w-[90vw] h-[85vh] sm:h-[600px] max-h-[90vh] flex flex-col text-foreground mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-foreground">
                {existingArnsName ? 'Change Domain' : 'Assign Domain'}
              </h3>
              <p className="text-sm text-foreground/80">
                {existingArnsName
                  ? 'Update the domain assignment for this deployment'
                  : 'Connect your deployment to an ArNS domain'}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-card rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Deployment Context */}
          <div className="bg-card rounded-2xl p-4">
            <div className="text-sm text-foreground/80 mb-2">Deployment to assign:</div>
            <div className="font-mono text-sm text-foreground break-all">{manifestId}</div>
          </div>

          {/* Streamlined ArNS Selection - No checkbox needed */}
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-foreground/80">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading your ArNS names...
              </div>
            ) : names.length === 0 ? (
              <div className="bg-card border border-border/20 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-foreground/60 flex-shrink-0 mt-0.5" />
                  <div>
                    {/*
                      An empty `names` array means two different things, and
                      saying the wrong one sends people off to buy a name they
                      may already own. useOwnedArNSNames bails with `return []`
                      when there is no ArNS address (no error, no loading), so
                      with no Solana wallet linked the list is empty simply
                      because nobody ever looked. `needsLinking` is exactly that
                      case: getArNSAddress() is falsy iff neither a primary
                      Solana session nor a linked address exists.
                    */}
                    {needsLinking ? (
                      <>
                        <div className="text-sm font-medium text-foreground mb-1">
                          Link a wallet to see your names
                        </div>
                        <div className="text-sm text-foreground/80 mb-3">
                          ArNS names are managed on Solana, so the console can't
                          tell which names you own until a Solana wallet is
                          linked.
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-medium text-foreground mb-1">No names yet</div>
                        <div className="text-sm text-foreground/80 mb-3">
                          Register an ArNS name right here in the console, then come
                          back to assign it.
                        </div>
                      </>
                    )}
                    <div className="flex items-center gap-2">
                      <ArNSGetNameLinks suggestedName={suggestedName} variant="empty" />
                      {/* Refresh can only ever return [] without an address, so
                          it is offered only once a lookup is actually possible.
                          The Link Wallet action stays in the footer banner
                          rather than being duplicated here. */}
                      {!needsLinking && (
                        <button
                          onClick={() => fetchOwnedNames(true)}
                          className="px-3 py-1.5 border border-border/20 text-foreground/80 rounded-full text-xs hover:bg-card transition-colors flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Refresh
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* ArNS Name Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-foreground">Select name:</label>
                    <button
                      onClick={() => fetchOwnedNames(true)}
                      disabled={loading}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-foreground hover:text-foreground/80 transition-colors disabled:opacity-50"
                      title="Refresh ArNS names"
                    >
                      <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>

                  {/*
                    Combobox, not Listbox — this mirrors the pre-flight picker in
                    ArNSAssociationPanel so choosing a name feels identical
                    whether you do it before deploying or after. Filtering is
                    purely client-side over the already-loaded `names` array, so
                    typing costs ZERO network calls; the only on-demand fetch is
                    fetchNameDetails() on an actual selection, which is unchanged.
                  */}
                  <Combobox
                    value={selectedArnsName}
                    onChange={async (name: string) => {
                      setSelectedArnsName(name);
                      // Clear the query so the list is whole again next open.
                      setNameQuery('');
                      // Clear undername when switching names
                      setSelectedUndername('');
                      setUndernameMode('none');
                      // Fetch ANT details on-demand when name is selected
                      if (name) {
                        await fetchNameDetails(name);
                      }
                    }}
                    disabled={loading}
                  >
                    <div className="relative">
                      <div className="relative w-full">
                        <Combobox.Input
                          className="w-full px-3 py-2 bg-card border border-border/20 rounded-2xl text-foreground focus:border-primary disabled:opacity-50 pr-10"
                          displayValue={(name: string) => {
                            if (!name) return '';
                            const found = names.find((n) => n.name === name);
                            return found?.displayName !== found?.name
                              ? `${found?.displayName} (${name})`
                              : name;
                          }}
                          onChange={(e) => setNameQuery(e.target.value)}
                          placeholder="Type to search or click to browse..."
                        />
                        <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                          {loadingDetails[selectedArnsName] ? (
                            <Loader2 className="h-4 w-4 text-foreground/80 animate-spin" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-foreground/80" aria-hidden="true" />
                          )}
                        </Combobox.Button>
                      </div>
                      <Combobox.Options className="absolute z-[9999] mt-1 max-h-60 w-full overflow-auto rounded-2xl bg-card border border-border/20 shadow-lg focus:outline-none">
                        {filteredNames.length === 0 && nameQuery !== '' ? (
                          <div className="relative cursor-default select-none py-3 px-4 text-sm text-foreground/80">
                            No names found matching &quot;{nameQuery}&quot;
                          </div>
                        ) : (
                          <>
                            {!nameQuery && (
                              <Combobox.Option
                                value=""
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-3 pr-9 ${
                                    active ? 'bg-card text-foreground' : 'text-foreground/80'
                                  }`
                                }
                              >
                                <span className="block truncate">Choose a name...</span>
                              </Combobox.Option>
                            )}
                            {filteredNames.map((name) => (
                              <Combobox.Option
                                key={name.name}
                                value={name.name}
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2 pl-3 pr-9 ${
                                    active ? 'bg-card text-foreground' : 'text-foreground'
                                  }`
                                }
                              >
                                {({ selected }) => (
                                  <>
                                    <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                      {name.displayName !== name.name
                                        ? `${name.displayName} (${name.name})`
                                        : name.displayName}
                                    </span>
                                    {selected && (
                                      <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-primary">
                                        <Check className="h-4 w-4" aria-hidden="true" />
                                      </span>
                                    )}
                                  </>
                                )}
                              </Combobox.Option>
                            ))}
                          </>
                        )}
                      </Combobox.Options>
                    </div>
                  </Combobox>

                  {/* Already own names but want a new one for this deployment —
                      the case the empty state above never reaches. */}
                  <ArNSGetNameLinks suggestedName={suggestedName} variant="inline" />
                </div>

                {/* Compact Undername Selection - Only show after ArNS name is selected */}
                {selectedArnsName && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Undername:</label>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <button
                        onClick={() => setUndernameMode('none')}
                        disabled={!selectedArnsName}
                        className={`py-2 px-3 rounded-2xl text-sm transition-colors border ${
                          undernameMode === 'none'
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border/20 text-foreground/80 hover:bg-card disabled:opacity-50'
                        }`}
                      >
                        None
                      </button>
                      <button
                        onClick={() => setUndernameMode('new')}
                        disabled={!selectedArnsName}
                        className={`py-2 px-3 rounded-2xl text-sm transition-colors border ${
                          undernameMode === 'new'
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border/20 text-foreground/80 hover:bg-card disabled:opacity-50'
                        }`}
                      >
                        New
                      </button>
                      <button
                        onClick={() => setUndernameMode('existing')}
                        disabled={!selectedArnsName || !selectedNameRecord?.undernames?.length}
                        className={`py-2 px-3 rounded-2xl text-sm transition-colors border ${
                          undernameMode === 'existing'
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border/20 text-foreground/80 hover:bg-card disabled:opacity-50'
                        }`}
                      >
                        Existing
                      </button>
                    </div>

                    {/* Conditional Content Based on Mode */}
                    {undernameMode === 'existing' && selectedNameRecord?.undernames && (
                      <div className="space-y-2">
                        <div className="text-xs text-foreground/80 mb-2">Select existing undername:</div>
                        <div className="flex flex-wrap gap-2">
                          {selectedNameRecord.undernames.map((undername) => (
                            <button
                              key={undername}
                              onClick={() => setSelectedUndername(undername)}
                              className={`px-3 py-1.5 rounded-2xl text-sm transition-colors border ${
                                selectedUndername === undername
                                  ? 'bg-primary text-white border-primary'
                                  : 'bg-card border-border/20 text-foreground hover:border-primary/50'
                              }`}
                            >
                              {undername}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {undernameMode === 'new' && (
                      <div>
                        <input
                          type="text"
                          value={selectedUndername || ''}
                          onChange={(e) => {
                            // Allow free typing - no sanitization on change
                            setSelectedUndername(e.target.value);
                          }}
                          onBlur={(e) => {
                            // Sanitize when user leaves the field
                            const sanitized = sanitizeUndername(e.target.value);
                            if (sanitized !== e.target.value) {
                              setSelectedUndername(sanitized);
                            }
                          }}
                          placeholder="my_blog, docs, app..."
                          className={`w-full px-3 py-2 bg-card border rounded-2xl text-foreground text-sm transition-colors ${
                            selectedUndername && hasInvalidCharacters(selectedUndername)
                              ? 'border-warning'
                              : 'border-border/20'
                          }`}
                        />
                        <p className="text-xs mt-1">
                          {selectedUndername ? (
                            hasInvalidCharacters(selectedUndername) ? (
                              <span className="text-warning">
                                Will be sanitized to: {sanitizeUndername(selectedUndername)}_{selectedArnsName}.ar.io
                              </span>
                            ) : (
                              <span className="text-foreground/80">
                                Will create: {selectedUndername}_{selectedArnsName}.ar.io
                              </span>
                            )
                          ) : (
                            <span className="text-foreground/80">
                              Lowercase letters, numbers, hyphens, and underscores. Cannot start/end with - or _.
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Preview */}
                {selectedArnsName && (
                  <div className="bg-card/50 rounded-2xl p-4">
                    <div className="text-sm font-medium text-foreground mb-2">Preview:</div>
                    <div className="flex items-center gap-2 mb-2">
                      <a
                        href={`https://${selectedUndername ? selectedUndername + '_' : ''}${selectedArnsName}.ar.io`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-mono text-foreground hover:underline flex items-center gap-1"
                      >
                        {selectedUndername ? selectedUndername + '_' : ''}
                        {displayName}.ar.io
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    {/* Status indicators */}
                    {isNewUndername && <div className="text-xs text-success">New undername - will be created</div>}
                    {isExistingUndername && (
                      <div className="text-xs text-foreground/80">Existing undername - will be updated</div>
                    )}
                    {!selectedUndername && selectedNameRecord?.currentTarget && (
                      <div className="text-xs text-foreground/80">
                        Currently points to: {selectedNameRecord.currentTarget.substring(0, 6)}...
                      </div>
                    )}
                  </div>
                )}

                {/* Advanced Settings */}
                {selectedArnsName && (
                  <div className="border-t border-primary/20 pt-4">
                    <button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors w-full"
                    >
                      <ChevronRight className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
                      Advanced Settings
                    </button>

                    {showAdvanced && (
                      <div className="mt-4 space-y-4 bg-card/30 rounded-2xl p-4 border border-primary/10">
                        <div>
                          <div className="text-sm font-medium text-foreground mb-3">TTL (Time to Live)</div>

                          {/* TTL Mode Selection */}
                          <div className="space-y-3">
                            <label className="flex items-start gap-3 cursor-pointer group">
                              <input
                                type="radio"
                                name="ttl-mode"
                                checked={ttlMode === 'existing'}
                                onChange={() => setTTLMode('existing')}
                                className="mt-0.5 w-4 h-4 bg-card border-2 border-border/20 rounded-full checked:bg-card checked:border-primary transition-colors"
                              />
                              <div className="flex-1">
                                <div className="text-sm text-foreground group-hover:text-foreground/80 transition-colors">
                                  Keep existing TTL
                                </div>
                                <div className="text-xs text-foreground/80 mt-0.5">
                                  Preserve current setting ({formatTTL(currentTTL)} / {currentTTL} seconds)
                                </div>
                              </div>
                            </label>

                            <label className="flex items-start gap-3 cursor-pointer group">
                              <input
                                type="radio"
                                name="ttl-mode"
                                checked={ttlMode === 'custom'}
                                onChange={() => setTTLMode('custom')}
                                className="mt-0.5 w-4 h-4 bg-card border-2 border-border/20 rounded-full checked:bg-card checked:border-primary transition-colors"
                              />
                              <div className="flex-1">
                                <div className="text-sm text-foreground group-hover:text-foreground/80 transition-colors">
                                  Set custom TTL
                                </div>
                                {ttlMode === 'custom' && (
                                  <div className="mt-3 space-y-2">
                                    <div className="flex gap-2">
                                      <input
                                        type="number"
                                        min="60"
                                        max="86400"
                                        value={customTTLInput}
                                        onChange={(e) => setCustomTTLInput(e.target.value)}
                                        className="flex-1 px-3 py-2 bg-card border border-border/20 rounded-2xl text-foreground text-sm focus:border-primary"
                                        placeholder="600"
                                      />
                                      <span className="px-3 py-2 bg-card/50 border border-border/20 rounded-2xl text-foreground/80 text-sm flex items-center">
                                        seconds
                                      </span>
                                    </div>

                                    {/* Quick Select Buttons */}
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setCustomTTLInput('300')}
                                        className="px-3 py-1.5 bg-card border border-border/20 rounded text-xs text-foreground/80 hover:border-primary hover:text-foreground transition-colors"
                                      >
                                        5 min
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setCustomTTLInput('600')}
                                        className="px-3 py-1.5 bg-card border border-border/20 rounded text-xs text-foreground/80 hover:border-primary hover:text-foreground transition-colors"
                                      >
                                        10 min
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setCustomTTLInput('900')}
                                        className="px-3 py-1.5 bg-card border border-border/20 rounded text-xs text-foreground/80 hover:border-primary hover:text-foreground transition-colors"
                                      >
                                        15 min
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setCustomTTLInput('3600')}
                                        className="px-3 py-1.5 bg-card border border-border/20 rounded text-xs text-foreground/80 hover:border-primary hover:text-foreground transition-colors"
                                      >
                                        1 hour
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </label>
                          </div>

                          {/* Help Text */}
                          <div className="mt-3 text-xs text-foreground/80 bg-primary/5 rounded p-3 border border-primary/20">
                            <div className="font-medium text-foreground mb-1">What is TTL?</div>
                            TTL controls how long ar.io gateways cache your content before checking for updates. Lower
                            values (5-10 min) are better for frequently updated content, while higher values (1 hour+)
                            work well for static sites and reduce network requests.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-error/10 border border-error/20 rounded-2xl p-4">
              <div className="text-error text-sm">{error}</div>
            </div>
          )}

          {/* Solana wallet status banners are in the sticky footer below */}
        </div>

        {/* Fixed Actions Footer */}
        <div className="flex-shrink-0 border-t border-border/20">
          {/* Wallet status banner pinned above the buttons */}
          {needsLinking && (
            <div className="px-4 sm:px-6 pt-4 pb-2">
              <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl p-3">
                <div className="text-sm text-foreground/80">
                  Link a Solana wallet to assign domains
                </div>
                <button
                  onClick={() => setShowLinkModal(true)}
                  className="px-3 py-1.5 bg-primary text-white rounded-full text-xs font-medium hover:bg-primary/90 transition-colors"
                >
                  Link Wallet
                </button>
              </div>
            </div>
          )}
          {!needsLinking && !isSolanaConnected && (
            <div className="px-4 sm:px-6 pt-4 pb-2">
              <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl p-3">
                <div className="text-sm text-foreground/80">
                  Solana wallet session expired
                </div>
                <button
                  onClick={promptReconnect}
                  className="px-3 py-1.5 bg-primary text-white rounded-full text-xs font-medium hover:bg-primary/90 transition-colors"
                >
                  Reconnect
                </button>
              </div>
            </div>
          )}
          <div className="flex justify-between items-center p-4 sm:p-6">
            <button
              onClick={onClose}
              disabled={isAssigning}
              className="text-sm text-foreground/80 hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              onClick={handleAssignDomain}
              disabled={
                !selectedArnsName ||
                isAssigning ||
                !isSolanaConnected ||
                (undernameMode === 'new' && !selectedUndername) ||
                (undernameMode === 'existing' && !selectedUndername)
              }
              className="px-6 py-3 rounded-full bg-primary text-white font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isAssigning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Assigning Domain...
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4" />
                  {existingArnsName ? 'Update Domain' : 'Assign Domain'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

    </BaseModal>
    {showLinkModal && (
      <LinkSolanaWalletModal
        onClose={() => setShowLinkModal(false)}
        isReconnect={!needsLinking}
      />
    )}
    </>
  );
}
