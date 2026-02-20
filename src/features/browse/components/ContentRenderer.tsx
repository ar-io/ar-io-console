/**
 * ContentRenderer - Renders content appropriately based on content type.
 *
 * Supports:
 * - HTML: iframe (default behavior)
 * - Images: <img> tag
 * - Video: <video> player with controls
 * - Audio: <audio> player with controls
 * - PDF: Download/open buttons
 * - Text: iframe or preformatted display
 * - Other: Download button
 */

import { memo, useState, useCallback, useMemo } from 'react';
import { Download, ExternalLink, FileText, Music, AlertCircle, Loader2 } from 'lucide-react';
import type { ContentCategory } from '../utils/contentTypeUtils';

/**
 * Get appropriate file extension for a content category.
 */
function getExtensionForCategory(category: ContentCategory): string {
  switch (category) {
    case 'pdf': return '.pdf';
    case 'image': return '.png';
    case 'video': return '.mp4';
    case 'audio': return '.mp3';
    default: return '';
  }
}

/**
 * Generate a download filename from identifier and category.
 * If identifier already has an extension, use it as-is.
 */
function getDownloadFilename(identifier: string, category: ContentCategory): string {
  // Check if identifier already has a file extension
  const hasExtension = /\.\w{2,4}$/.test(identifier);
  if (hasExtension) {
    return identifier;
  }

  // Add appropriate extension based on category
  const extension = getExtensionForCategory(category);
  return `${identifier}${extension}`;
}

interface ContentRendererProps {
  url: string;
  category: ContentCategory;
  identifier: string;
  className?: string;
  isHidden?: boolean;
}

export const ContentRenderer = memo(function ContentRenderer({
  url,
  category,
  identifier,
  className = '',
  isHidden = false,
}: ContentRendererProps) {
  const baseClassName = `w-full h-full ${className} ${isHidden ? 'invisible absolute' : ''}`;
  const [mediaError, setMediaError] = useState(false);

  const handleMediaError = useCallback(() => {
    setMediaError(true);
  }, []);

  // Generate proper download filename based on identifier and content type
  const downloadFilename = useMemo(
    () => getDownloadFilename(identifier, category),
    [identifier, category]
  );

  // Track download state
  const [isDownloading, setIsDownloading] = useState(false);

  // Check if URL is a proxy URL (handled by service worker) or external gateway URL
  const isProxyUrl = url.startsWith('/ar-proxy/');

  // Generate download URL with query param for service worker to add Content-Disposition
  // Only used for proxy URLs
  const downloadUrl = useMemo(() => {
    if (!isProxyUrl) return url;
    const baseUrl = url.split('?')[0]; // Remove any existing query params
    return `${baseUrl}?download=${encodeURIComponent(downloadFilename)}`;
  }, [url, downloadFilename, isProxyUrl]);

  // Handle download - for external URLs, fetch and trigger download via JavaScript
  const handleDownload = useCallback(async (e: React.MouseEvent) => {
    // For proxy URLs, let the link work normally (service worker handles it)
    if (isProxyUrl) return;

    // For external URLs, prevent navigation and download via fetch
    e.preventDefault();
    setIsDownloading(true);

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Create temporary link and trigger download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = downloadFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up blob URL
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: open in new tab
      window.open(url, '_blank');
    } finally {
      setIsDownloading(false);
    }
  }, [url, downloadFilename, isProxyUrl]);

  // If media failed to load, show download fallback
  if (mediaError && (category === 'image' || category === 'video' || category === 'audio')) {
    return (
      <div className={`${baseClassName} flex flex-col items-center justify-center bg-card gap-6 p-6`}>
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-foreground/10 rounded-2xl flex items-center justify-center">
          <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-foreground/60" />
        </div>
        <div className="text-center px-4">
          <div className="text-lg sm:text-xl font-semibold text-foreground mb-2 break-all">{identifier}</div>
          <div className="text-sm text-foreground/60">Unable to load {category}. Try opening directly.</div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto px-4 sm:px-0">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-primary text-white rounded-full font-medium hover:opacity-90 transition-opacity"
          >
            <ExternalLink className="w-4 h-4" />
            Open in New Tab
          </a>
          <a
            href={downloadUrl}
            onClick={handleDownload}
            className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-card border border-border/20 text-foreground rounded-full font-medium hover:bg-card/80 transition-colors disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isDownloading ? 'Downloading...' : 'Download'}
          </a>
        </div>
      </div>
    );
  }

  // HTML and text content - use iframe (default behavior)
  // SECURITY NOTE: allow-same-origin is REQUIRED for service worker interception.
  // Without it, the sandboxed iframe gets an opaque origin and our SW cannot
  // intercept /ar-proxy/ requests to verify content. This is secure because:
  // 1. All content is cryptographically verified before serving
  // 2. The /ar-proxy/ path is isolated from main app storage/cookies
  if (category === 'html' || category === 'text') {
    return (
      <iframe
        src={url}
        className={`${baseClassName} block border-0 bg-white`}
        style={{ margin: 0, padding: 0 }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
        title={`Content for ${identifier}`}
      />
    );
  }

  // Images - use img tag
  if (category === 'image') {
    return (
      <div className={`${baseClassName} flex items-center justify-center bg-foreground/5 overflow-auto`}>
        <img
          src={url}
          alt={`Image: ${identifier}`}
          className="max-w-full max-h-full object-contain"
          loading="eager"
          onError={handleMediaError}
        />
      </div>
    );
  }

  // Video - use video player
  if (category === 'video') {
    return (
      <div className={`${baseClassName} flex items-center justify-center bg-black`}>
        <video
          src={url}
          controls
          autoPlay={false}
          className="max-w-full max-h-full"
          title={`Video: ${identifier}`}
          onError={handleMediaError}
        >
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  // Audio - use audio player with visual
  if (category === 'audio') {
    return (
      <div className={`${baseClassName} flex flex-col items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 gap-6 p-6`}>
        <div className="w-24 h-24 sm:w-32 sm:h-32 bg-primary/20 rounded-2xl flex items-center justify-center">
          <Music className="w-12 h-12 sm:w-16 sm:h-16 text-primary" />
        </div>
        <div className="text-center px-4">
          <div className="text-base sm:text-lg font-medium text-foreground mb-2 break-all">{identifier}</div>
          <div className="text-sm text-foreground/60">Audio File</div>
        </div>
        <audio
          src={url}
          controls
          autoPlay={false}
          className="w-full max-w-md px-4 sm:px-0"
          title={`Audio: ${identifier}`}
          onError={handleMediaError}
        >
          Your browser does not support the audio tag.
        </audio>
      </div>
    );
  }

  // PDF - show download/open options
  if (category === 'pdf') {
    return (
      <div className={`${baseClassName} flex flex-col items-center justify-center bg-card gap-6 p-6`}>
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-primary/10 rounded-2xl flex items-center justify-center">
          <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
        </div>
        <div className="text-center px-4">
          <div className="text-lg sm:text-xl font-semibold text-foreground mb-2 break-all">{identifier}</div>
          <div className="text-sm text-foreground/60">PDF Document</div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto px-4 sm:px-0">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-primary text-white rounded-full font-medium hover:opacity-90 transition-opacity"
          >
            <ExternalLink className="w-4 h-4" />
            Open in New Tab
          </a>
          <a
            href={downloadUrl}
            onClick={handleDownload}
            className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-card border border-border/20 text-foreground rounded-full font-medium hover:bg-card/80 transition-colors"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isDownloading ? 'Downloading...' : 'Download'}
          </a>
        </div>
      </div>
    );
  }

  // Download fallback for unknown/binary content
  return (
    <div className={`${baseClassName} flex flex-col items-center justify-center bg-card gap-6 p-6`}>
      <div className="w-20 h-20 sm:w-24 sm:h-24 bg-foreground/10 rounded-2xl flex items-center justify-center">
        <Download className="w-10 h-10 sm:w-12 sm:h-12 text-foreground/60" />
      </div>
      <div className="text-center px-4">
        <div className="text-lg sm:text-xl font-semibold text-foreground mb-2 break-all">{identifier}</div>
        <div className="text-sm text-foreground/60">This file type cannot be previewed in the browser</div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto px-4 sm:px-0">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-primary text-white rounded-full font-medium hover:opacity-90 transition-opacity"
        >
          <ExternalLink className="w-4 h-4" />
          Open in New Tab
        </a>
        <a
          href={downloadUrl}
          onClick={handleDownload}
          className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-card border border-border/20 text-foreground rounded-full font-medium hover:bg-card/80 transition-colors"
        >
          {isDownloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {isDownloading ? 'Downloading...' : 'Download'}
        </a>
      </div>
    </div>
  );
});
