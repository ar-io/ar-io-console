import { useState, useCallback, useMemo } from 'react';
import {
  Upload,
  AlertCircle,
  ExternalLink,
  Receipt,
  Globe,
  Shield,
  Infinity as InfinityIcon,
  X,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  File,
  Key,
  BookOpen,
  Code,
  ArrowRight,
  RefreshCw,
  MoreVertical,
  Copy,
  CheckCircle,
} from 'lucide-react';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { useStore } from '../../store/useStore';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useFreeUploadLimit, isFileFree, formatFreeLimit } from '../../hooks/useFreeUploadLimit';
import { useUploadStatus } from '../../hooks/useUploadStatus';
import { getArweaveUrl } from '../../utils';
import CopyButton from '../CopyButton';
import ReceiptModal from '../modals/ReceiptModal';
import SeedPhraseModal from '../modals/SeedPhraseModal';

// Get appropriate icon for file type (returns component class)
function getFileIconClass(type: string) {
  if (type.startsWith('image/')) return FileImage;
  if (type.startsWith('video/')) return FileVideo;
  if (type.startsWith('audio/')) return FileAudio;
  if (type.startsWith('text/') || type.includes('document') || type.includes('pdf')) return FileText;
  return File;
}

// Get contextual file icon JSX based on content type or file name
const getFileIcon = (contentType?: string, fileName?: string) => {
  const type = contentType?.toLowerCase() || '';
  const ext = fileName?.split('.').pop()?.toLowerCase() || '';

  // Images
  if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext)) {
    return <FileImage className="w-4 h-4 text-link flex-shrink-0" />;
  }

  // Videos
  if (type.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
    return <FileVideo className="w-4 h-4 text-link flex-shrink-0" />;
  }

  // Audio
  if (type.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext)) {
    return <FileAudio className="w-4 h-4 text-link flex-shrink-0" />;
  }

  // Code files
  if (['application/javascript', 'application/json', 'text/css', 'text/html', 'application/xml', 'text/xml'].includes(type) ||
      ['js', 'ts', 'jsx', 'tsx', 'css', 'html', 'json', 'xml', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'sh', 'yml', 'yaml', 'toml', 'md'].includes(ext)) {
    return <Code className="w-4 h-4 text-link flex-shrink-0" />;
  }

  // Text/Documents
  if (type.startsWith('text/') || ['txt', 'pdf', 'doc', 'docx', 'rtf'].includes(ext)) {
    return <FileText className="w-4 h-4 text-link flex-shrink-0" />;
  }

  // Default file icon
  return <File className="w-4 h-4 text-link flex-shrink-0" />;
};

export default function TryItNowPanel() {
  const { address, uploadHistory, isHotWallet, hotWalletSeedExported, addUploadResults } = useStore();
  const freeLimit = useFreeUploadLimit();
  const { uploadFile } = useFileUpload();
  const { uploadStatuses, getStatusColor, getStatusIcon, checkUploadStatus, statusChecking, formatFileSize } = useUploadStatus();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState<string | null>(null);
  const [showAllUploads, setShowAllUploads] = useState(false);
  const [showSeedPhraseModal, setShowSeedPhraseModal] = useState(false);
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set());
  const [lastUploadedFile, setLastUploadedFile] = useState<{ id: string; fileName: string; dataCaches?: string[] } | null>(null);

  // Check if file is previewable (image)
  const isPreviewable = useMemo(() => {
    return selectedFile?.type.startsWith('image/') ?? false;
  }, [selectedFile]);

  const handleFileSelect = useCallback(
    (file: File) => {
      setError(null);
      setSuccessMessage(null);

      // Revoke previous preview URL to prevent memory leaks
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }

      // Validate file size against free limit
      if (!isFileFree(file.size, freeLimit)) {
        setError(
          `File too large. Free uploads are limited to ${formatFreeLimit(freeLimit)}. Try a smaller file.`
        );
        return;
      }

      setSelectedFile(file);

      // Create preview URL for images
      if (file.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(file));
      }
    },
    [freeLimit, previewUrl]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    const fileName = selectedFile.name;
    setError(null);
    setSuccessMessage(null);
    setIsUploading(true);

    try {
      const result = await uploadFile(selectedFile);

      // Save to upload history
      if (result && address) {
        // Override owner with current address since SDK returns Arweave-format public key
        // for Ethereum signers, not the Ethereum address
        const resultWithCorrectOwner = {
          ...result,
          owner: address,
        };
        addUploadResults([resultWithCorrectOwner]);
        setLastUploadedFile({ id: result.id, fileName, dataCaches: result.dataCaches });
        setSuccessMessage(`"${fileName}" uploaded successfully!`);
      }

      // Clear selection and revoke preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setSelectedFile(null);

      // Trigger balance refresh (though free uploads won't change balance)
      window.dispatchEvent(new CustomEvent('refresh-balance'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, uploadFile, addUploadResults, previewUrl]);

  const clearSelection = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setSelectedFile(null);
    setError(null);
  }, [previewUrl]);

  // Filter upload history for this address (hot wallet)
  // Use case-insensitive comparison for Ethereum addresses
  const userUploads = uploadHistory.filter(
    (u) => u.owner?.toLowerCase() === address?.toLowerCase()
  );
  const recentUploads = userUploads.slice(0, 5);
  const displayUploads = showAllUploads ? userUploads : recentUploads;

  const FileIcon = selectedFile ? getFileIconClass(selectedFile.type) : File;

  return (
    <div className="px-4 sm:px-6">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 bg-turbo-red/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
          <Upload className="w-5 h-5 text-turbo-red" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-fg-muted mb-1">Try It Out</h3>
          <p className="text-sm text-link">
            Upload a file for free. It will be stored permanently and accessible to anyone with the link.
          </p>
        </div>
      </div>

      {/* What You Should Know - Key Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-default">
          <InfinityIcon className="w-5 h-5 text-turbo-red flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-fg-muted">Permanent</p>
            <p className="text-xs text-link">Stored forever, can't be deleted</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-default">
          <Globe className="w-5 h-5 text-turbo-red flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-fg-muted">Public</p>
            <p className="text-xs text-link">Anyone with the link can view</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-default">
          <Shield className="w-5 h-5 text-turbo-red flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-fg-muted">Verifiable</p>
            <p className="text-xs text-link">Tamper-proof and authentic</p>
          </div>
        </div>
      </div>

      {/* Temporary Wallet Notice - Only show for hot wallet users who haven't exported */}
      {isHotWallet && !hotWalletSeedExported && (
        <div className="bg-surface rounded-lg border border-default p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Key className="w-5 h-5 text-fg-muted flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-fg-muted">
                  We created a temporary wallet for you. This gives you cryptographic proof of ownership for anything you upload.
                </p>
                <p className="text-xs text-link mt-1">
                  Save your recovery phrase to keep access, or import it into any Ethereum wallet.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSeedPhraseModal(true)}
              className="px-4 py-2 bg-fg-muted text-canvas font-semibold rounded-lg hover:bg-fg-muted/90 transition-colors whitespace-nowrap flex-shrink-0"
            >
              Save Recovery Phrase
            </button>
          </div>
        </div>
      )}

      {/* Upload Area - Only show if bundler supports free uploads */}
      {freeLimit > 0 ? (
        <div className="bg-gradient-to-br from-turbo-red/5 to-turbo-red/3 rounded-xl border border-turbo-red/20 p-6 mb-6">
          {!selectedFile ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                dragOver
                  ? 'border-turbo-red bg-turbo-red/10'
                  : 'border-link/30 hover:border-turbo-red/50'
              }`}
            >
              <div className="mb-4">
                <Upload className="w-12 h-12 text-turbo-red mx-auto mb-2" />
                <p className="text-lg font-medium mb-2">
                  Drop a file here or click to browse
                </p>
                <p className="text-sm text-link">
                  Files under {formatFreeLimit(freeLimit)} are <span className="text-turbo-green font-semibold">FREE</span>
                </p>
              </div>
              <input
                type="file"
                onChange={handleInputChange}
                className="hidden"
                id="try-file-upload"
              />
              <label
                htmlFor="try-file-upload"
                className="inline-block px-4 py-2 rounded bg-fg-muted text-canvas font-medium cursor-pointer hover:bg-fg-muted/90 transition-colors"
              >
                Select File
              </label>
            </div>
          ) : (
          <div className="space-y-4">
            {/* File Preview / Info */}
            <div className="bg-surface rounded-lg p-4">
              <div className="flex items-start gap-4">
                {/* Preview or Icon */}
                <div className="flex-shrink-0">
                  {isPreviewable && previewUrl ? (
                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-canvas border border-default">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-canvas border border-default flex items-center justify-center">
                      <FileIcon className="w-8 h-8 text-link" />
                    </div>
                  )}
                </div>

                {/* File Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-fg-muted font-medium truncate mb-1">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-link mb-1">{formatFileSize(selectedFile.size)}</p>
                  <p className="text-xs text-link/70">{selectedFile.type || 'Unknown type'}</p>
                </div>

                {/* Remove Button */}
                <button
                  onClick={clearSelection}
                  className="p-1.5 text-link hover:text-fg-muted hover:bg-canvas rounded transition-colors"
                  title="Remove file"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Upload Button - RED */}
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full py-4 px-6 rounded-lg bg-turbo-red text-white font-bold text-lg hover:bg-turbo-red/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Upload File
                </>
              )}
            </button>

            {/* Reminder about permanence and terms */}
            <p className="text-xs text-center text-link">
              Once uploaded, this file will be publicly accessible and cannot be removed.
              By uploading, you agree to our{' '}
              <a
                href="https://ardrive.io/tos-and-privacy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-turbo-red hover:text-turbo-red/80 transition-colors underline"
              >
                Terms of Service
              </a>.
            </p>
          </div>
        )}

          {/* Success Message */}
          {successMessage && lastUploadedFile && (
            <div className="mt-4 bg-turbo-green/10 border border-turbo-green/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-turbo-green text-sm mb-3">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{successMessage}</span>
              </div>
              <a
                href={getArweaveUrl(lastUploadedFile.id, lastUploadedFile.dataCaches)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-turbo-green text-white font-medium rounded-lg hover:bg-turbo-green/90 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                View Your File
              </a>
              <p className="text-xs text-link mt-2">
                Your file is now permanently stored and accessible at this link.
              </p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Bundler doesn't support free uploads */
        <div className="bg-surface rounded-xl border border-default p-8 mb-6 text-center">
          <div className="w-12 h-12 bg-link/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Upload className="w-6 h-6 text-link" />
          </div>
          <h4 className="text-lg font-semibold text-fg-muted mb-2">Free Uploads Not Available</h4>
          <p className="text-sm text-link max-w-md mx-auto">
            The current bundler doesn't support free uploads. Connect a wallet to purchase credits,
            or try a different gateway that offers free uploads.
          </p>
        </div>
      )}

      {/* Recent Uploads */}
      {userUploads.length > 0 && (
        <div className="bg-surface rounded-lg border border-default">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-default">
            <h3 className="font-bold text-fg-muted flex items-center gap-2">
              <Upload className="w-5 h-5 text-fg-muted" />
              Your Uploads ({userUploads.length})
            </h3>
            {userUploads.length > 5 && (
              <button
                onClick={() => setShowAllUploads(!showAllUploads)}
                className="text-xs text-link hover:text-fg-muted transition-colors"
              >
                {showAllUploads ? 'Show Less' : 'Show All'}
              </button>
            )}
          </div>

          {/* Upload List */}
          <div className="space-y-4 max-h-80 overflow-y-auto px-4 pb-4">
            {displayUploads.map((upload, index) => {
              const status = uploadStatuses[upload.id];
              const isChecking = statusChecking[upload.id];

              return (
                <div key={index} className="bg-surface border border-default rounded-lg p-4">
                  <div className="space-y-2">
                    {/* Row 1: Transaction ID + Actions */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="font-mono text-sm text-fg-muted">
                          {upload.id.substring(0, 6)}...
                        </div>
                      </div>

                      {/* Desktop: Show all actions */}
                      <div className="hidden sm:flex items-center gap-1">
                        {/* Status Icon */}
                        {status && (
                          <div className="p-1.5" title={`Status: ${status.status}`}>
                            <span className="text-xs">{getStatusIcon(status.status, status.info)}</span>
                          </div>
                        )}
                        <CopyButton textToCopy={upload.id} />
                        <button
                          onClick={() => setShowReceiptModal(upload.id)}
                          className="p-1.5 text-link hover:text-fg-muted transition-colors"
                          title="View Receipt"
                        >
                          <Receipt className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => checkUploadStatus(upload.id)}
                          disabled={isChecking}
                          className="p-1.5 text-link hover:text-fg-muted transition-colors disabled:opacity-50"
                          title="Check Status"
                        >
                          <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                        </button>
                        <a
                          href={getArweaveUrl(upload.id, upload.dataCaches)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-link hover:text-fg-muted transition-colors"
                          title="View File"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>

                      {/* Mobile: Status icon + 3-dot menu */}
                      <div className="sm:hidden flex items-center gap-1">
                        {status && (
                          <div className="p-1.5" title={`Status: ${status.status}`}>
                            <span className="text-xs">{getStatusIcon(status.status, status.info)}</span>
                          </div>
                        )}
                        <Popover className="relative">
                          <PopoverButton className="p-1.5 text-link hover:text-fg-muted transition-colors">
                            <MoreVertical className="w-4 h-4" />
                          </PopoverButton>
                          <PopoverPanel
                            anchor="bottom end"
                            className="w-40 bg-surface border border-default rounded-lg shadow-lg z-[200] py-1 mt-1"
                          >
                            {({ close }) => (
                              <>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(upload.id);
                                    setCopiedItems(prev => new Set([...prev, upload.id]));
                                    setTimeout(() => {
                                      close();
                                      setTimeout(() => {
                                        setCopiedItems(prev => {
                                          const newSet = new Set(prev);
                                          newSet.delete(upload.id);
                                          return newSet;
                                        });
                                      }, 500);
                                    }, 1000);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-link hover:bg-canvas transition-colors flex items-center gap-2"
                                >
                                  {copiedItems.has(upload.id) ? (
                                    <>
                                      <CheckCircle className="w-4 h-4 text-green-500" />
                                      Copied!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-4 h-4" />
                                      Copy Tx ID
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => {
                                    setShowReceiptModal(upload.id);
                                    close();
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-link hover:bg-canvas transition-colors flex items-center gap-2"
                                >
                                  <Receipt className="w-4 h-4" />
                                  View Receipt
                                </button>
                                <button
                                  onClick={() => {
                                    checkUploadStatus(upload.id);
                                    close();
                                  }}
                                  disabled={isChecking}
                                  className="w-full px-4 py-2 text-left text-sm text-link hover:bg-canvas transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                  <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                                  Check Status
                                </button>
                                <a
                                  href={getArweaveUrl(upload.id, upload.dataCaches)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => close()}
                                  className="w-full px-4 py-2 text-left text-sm text-link hover:bg-canvas transition-colors flex items-center gap-2"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  View File
                                </a>
                              </>
                            )}
                          </PopoverPanel>
                        </Popover>
                      </div>
                    </div>

                    {/* Row 2: File Name */}
                    {upload.fileName && (
                      <div className="text-sm text-fg-muted truncate flex items-center" title={upload.fileName}>
                        {getFileIcon(upload.contentType, upload.fileName)}
                        <span className="truncate">{upload.fileName}</span>
                      </div>
                    )}

                    {/* Row 3: Content Type + File Size */}
                    <div className="flex items-center gap-2 text-sm text-link">
                      <span>{upload.contentType || 'Unknown Type'}</span>
                      <span>•</span>
                      <span>{upload.fileSize ? formatFileSize(upload.fileSize) : 'Unknown Size'}</span>
                    </div>

                    {/* Row 4: Timestamp */}
                    {upload.timestamp && (
                      <div className="text-sm text-link">
                        {new Date(upload.timestamp).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Learn More CTAs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
        <a
          href="https://docs.ar.io/learn/"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-4 p-4 bg-surface rounded-lg border border-default hover:border-fg-muted/30 transition-colors"
        >
          <div className="w-10 h-10 bg-turbo-purple/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-turbo-purple" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-fg-muted group-hover:text-fg-muted">
              What is the AR.IO Network?
            </p>
            <p className="text-xs text-link">Learn about the permanent cloud - decentralized storage and hosting that lasts forever</p>
          </div>
          <ArrowRight className="w-4 h-4 text-link group-hover:text-fg-muted group-hover:translate-x-1 transition-all" />
        </a>

        <a
          href="https://docs.ar.io/build/turbo-sdk/"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-4 p-4 bg-surface rounded-lg border border-default hover:border-fg-muted/30 transition-colors"
        >
          <div className="w-10 h-10 bg-turbo-purple/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Code className="w-5 h-5 text-turbo-purple" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-fg-muted group-hover:text-fg-muted">
              Build with Turbo SDK
            </p>
            <p className="text-xs text-link">Add permanent uploads to your app, or deploy and host it on the permaweb</p>
          </div>
          <ArrowRight className="w-4 h-4 text-link group-hover:text-fg-muted group-hover:translate-x-1 transition-all" />
        </a>
      </div>

      {/* Receipt Modal */}
      {showReceiptModal && (
        <ReceiptModal
          onClose={() => setShowReceiptModal(null)}
          receipt={userUploads.find((u) => u.id === showReceiptModal)?.receipt}
          uploadId={showReceiptModal}
          initialStatus={uploadStatuses[showReceiptModal]}
        />
      )}

      {/* Seed Phrase Modal */}
      {showSeedPhraseModal && (
        <SeedPhraseModal onClose={() => setShowSeedPhraseModal(false)} />
      )}
    </div>
  );
}
