/**
 * Content type detection and categorization utilities.
 * Used to determine appropriate rendering for different media types.
 */

export type ContentCategory = 'html' | 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'download';

/**
 * Categorize a MIME type into a rendering category.
 */
export function categorizeContentType(mimeType: string): ContentCategory {
  const type = mimeType.toLowerCase().split(';')[0].trim();

  // HTML and web content
  if (type.includes('text/html') || type.includes('application/xhtml')) {
    return 'html';
  }

  // Images
  if (type.startsWith('image/')) {
    return 'image';
  }

  // Video
  if (type.startsWith('video/')) {
    return 'video';
  }

  // Audio
  if (type.startsWith('audio/')) {
    return 'audio';
  }

  // PDF
  if (type === 'application/pdf') {
    return 'pdf';
  }

  // Text-based content that can be displayed
  if (
    type.startsWith('text/') ||
    type === 'application/json' ||
    type === 'application/xml' ||
    type === 'application/javascript' ||
    type === 'application/typescript'
  ) {
    return 'text';
  }

  // SVG can be displayed as image
  if (type === 'image/svg+xml') {
    return 'image';
  }

  // Everything else should be downloaded
  return 'download';
}

/**
 * Detect content type from a URL via HEAD request.
 * Falls back to extension-based detection if HEAD fails.
 */
export async function detectContentType(url: string): Promise<{
  contentType: string;
  category: ContentCategory;
}> {
  try {
    // Try HEAD request first (faster, no body download)
    const response = await fetch(url, {
      method: 'HEAD',
      // Short timeout for HEAD request
      signal: AbortSignal.timeout(5000),
    });

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    return {
      contentType,
      category: categorizeContentType(contentType),
    };
  } catch (error) {
    // HEAD failed, try to detect from URL extension
    console.warn('[ContentType] HEAD request failed, falling back to extension detection:', error);
    return detectFromExtension(url);
  }
}

/**
 * Detect content type from URL file extension.
 * Used as fallback when HEAD request fails.
 */
function detectFromExtension(url: string): {
  contentType: string;
  category: ContentCategory;
} {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const ext = pathname.split('.').pop()?.toLowerCase() || '';

    const extensionMap: Record<string, { contentType: string; category: ContentCategory }> = {
      // HTML
      html: { contentType: 'text/html', category: 'html' },
      htm: { contentType: 'text/html', category: 'html' },

      // Images
      jpg: { contentType: 'image/jpeg', category: 'image' },
      jpeg: { contentType: 'image/jpeg', category: 'image' },
      png: { contentType: 'image/png', category: 'image' },
      gif: { contentType: 'image/gif', category: 'image' },
      webp: { contentType: 'image/webp', category: 'image' },
      svg: { contentType: 'image/svg+xml', category: 'image' },
      ico: { contentType: 'image/x-icon', category: 'image' },
      avif: { contentType: 'image/avif', category: 'image' },

      // Video
      mp4: { contentType: 'video/mp4', category: 'video' },
      webm: { contentType: 'video/webm', category: 'video' },
      ogg: { contentType: 'video/ogg', category: 'video' },
      mov: { contentType: 'video/quicktime', category: 'video' },
      avi: { contentType: 'video/x-msvideo', category: 'video' },
      mkv: { contentType: 'video/x-matroska', category: 'video' },

      // Audio
      mp3: { contentType: 'audio/mpeg', category: 'audio' },
      wav: { contentType: 'audio/wav', category: 'audio' },
      flac: { contentType: 'audio/flac', category: 'audio' },
      aac: { contentType: 'audio/aac', category: 'audio' },
      m4a: { contentType: 'audio/mp4', category: 'audio' },

      // PDF
      pdf: { contentType: 'application/pdf', category: 'pdf' },

      // Text
      txt: { contentType: 'text/plain', category: 'text' },
      json: { contentType: 'application/json', category: 'text' },
      xml: { contentType: 'application/xml', category: 'text' },
      css: { contentType: 'text/css', category: 'text' },
      js: { contentType: 'application/javascript', category: 'text' },
      ts: { contentType: 'application/typescript', category: 'text' },
      md: { contentType: 'text/markdown', category: 'text' },
    };

    if (ext && extensionMap[ext]) {
      return extensionMap[ext];
    }
  } catch {
    // URL parsing failed
  }

  // Default: assume HTML for web browsing (most ArNS names are web apps)
  // This ensures existing behavior is preserved for manifest-based sites
  return {
    contentType: 'text/html',
    category: 'html',
  };
}

/**
 * Check if a content category can be embedded in an iframe.
 */
export function isIframeCompatible(category: ContentCategory): boolean {
  return category === 'html' || category === 'text' || category === 'image';
}
