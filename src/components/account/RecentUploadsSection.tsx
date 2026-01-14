import { useState } from 'react';
import { Upload, ExternalLink, Receipt, FileImage, FileVideo, FileAudio, FileText, File, Code } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getArweaveUrl } from '../../utils';
import { useUploadStatus } from '../../hooks/useUploadStatus';
import CopyButton from '../CopyButton';
import ReceiptModal from '../modals/ReceiptModal';
import { useNavigate } from 'react-router-dom';

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

export default function RecentUploadsSection() {
  const { uploadHistory } = useStore();
  const [showReceiptModal, setShowReceiptModal] = useState<string | null>(null);
  const [showAllUploads, setShowAllUploads] = useState(false);
  const { uploadStatuses, getStatusColor, getStatusIcon } = useUploadStatus();
  const navigate = useNavigate();

  const recentUploads = uploadHistory.slice(0, 5); // Show latest 5
  const displayUploads = showAllUploads ? uploadHistory : recentUploads;

  if (uploadHistory.length === 0) {
    return (
      <div className="bg-surface/50 rounded-lg p-6 text-center border border-default">
        <Upload className="w-12 h-12 text-link mx-auto mb-4" />
        <h3 className="font-medium text-fg-muted mb-2">No Uploads Yet</h3>
        <p className="text-sm text-link mb-4">Upload your first files to get started</p>
        <button
          onClick={() => navigate('/upload')}
          className="px-4 py-2 bg-fg-muted text-canvas rounded-lg hover:bg-fg-muted/90 transition-colors"
        >
          Upload Files
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg border border-default">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-default">
        <h3 className="font-bold text-fg-muted flex items-center gap-2">
          <Upload className="w-5 h-5 text-fg-muted" />
          Recent Uploads ({uploadHistory.length})
        </h3>
        <div className="flex items-center gap-2">
          {uploadHistory.length > 5 && (
            <button
              onClick={() => setShowAllUploads(!showAllUploads)}
              className="text-xs text-link hover:text-fg-muted transition-colors"
            >
              {showAllUploads ? 'Show Less' : 'Show All'}
            </button>
          )}
          <button
            onClick={() => navigate('/upload')}
            className="text-xs text-fg-muted hover:text-fg-muted/80 transition-colors"
          >
            View Full Page →
          </button>
        </div>
      </div>

      {/* Upload List */}
      <div className="space-y-4 max-h-64 overflow-y-auto px-4 pb-4">
        {displayUploads.map((upload, index) => {
          const status = uploadStatuses[upload.id];

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

                  {/* Actions */}
                  <div className="flex items-center gap-1">
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
                </div>

                {/* Row 2: File Name */}
                {upload.fileName && (
                  <div className="text-sm text-fg-muted truncate flex items-center" title={upload.fileName}>
                    {getFileIcon(upload.contentType, upload.fileName)}
                    <span className="truncate">{upload.fileName}</span>
                  </div>
                )}

                {/* Row 3: Upload timestamp */}
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

      {/* Receipt Modal */}
      {showReceiptModal && (
        <ReceiptModal
          onClose={() => setShowReceiptModal(null)}
          receipt={uploadHistory.find(u => u.id === showReceiptModal)?.receipt}
          uploadId={showReceiptModal}
          initialStatus={uploadStatuses[showReceiptModal]}
        />
      )}
    </div>
  );
}