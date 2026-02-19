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

import { memo } from 'react';
import { Download, ExternalLink, FileText, Music } from 'lucide-react';
import type { ContentCategory } from '../utils/contentTypeUtils';

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

  // HTML and text content - use iframe (default behavior)
  if (category === 'html' || category === 'text') {
    return (
      <iframe
        src={url}
        className={`${baseClassName} border-0 bg-white`}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
        title={`Content for ${identifier}`}
      />
    );
  }

  // Images - use img tag
  if (category === 'image') {
    return (
      <div className={`${baseClassName} flex items-center justify-center bg-[#1a1a1a] overflow-auto`}>
        <img
          src={url}
          alt={`Image: ${identifier}`}
          className="max-w-full max-h-full object-contain"
          loading="eager"
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
        >
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  // Audio - use audio player with visual
  if (category === 'audio') {
    return (
      <div className={`${baseClassName} flex flex-col items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 gap-6`}>
        <div className="w-32 h-32 bg-primary/20 rounded-2xl flex items-center justify-center">
          <Music className="w-16 h-16 text-primary" />
        </div>
        <div className="text-center">
          <div className="text-lg font-medium text-foreground mb-2">{identifier}</div>
          <div className="text-sm text-foreground/60 mb-4">Audio File</div>
        </div>
        <audio
          src={url}
          controls
          autoPlay={false}
          className="w-full max-w-md"
          title={`Audio: ${identifier}`}
        >
          Your browser does not support the audio tag.
        </audio>
      </div>
    );
  }

  // PDF - show download/open options
  if (category === 'pdf') {
    return (
      <div className={`${baseClassName} flex flex-col items-center justify-center bg-card gap-6`}>
        <div className="w-24 h-24 bg-red-100 rounded-2xl flex items-center justify-center">
          <FileText className="w-12 h-12 text-red-600" />
        </div>
        <div className="text-center">
          <div className="text-xl font-semibold text-foreground mb-2">{identifier}</div>
          <div className="text-sm text-foreground/60 mb-6">PDF Document</div>
        </div>
        <div className="flex gap-3">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-full font-medium hover:opacity-90 transition-opacity"
          >
            <ExternalLink className="w-4 h-4" />
            Open in New Tab
          </a>
          <a
            href={url}
            download
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-card border border-border/20 text-foreground rounded-full font-medium hover:bg-card/80 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </a>
        </div>
      </div>
    );
  }

  // Download fallback for unknown/binary content
  return (
    <div className={`${baseClassName} flex flex-col items-center justify-center bg-card gap-6`}>
      <div className="w-24 h-24 bg-foreground/10 rounded-2xl flex items-center justify-center">
        <Download className="w-12 h-12 text-foreground/60" />
      </div>
      <div className="text-center">
        <div className="text-xl font-semibold text-foreground mb-2">{identifier}</div>
        <div className="text-sm text-foreground/60 mb-6">This file type cannot be previewed in the browser</div>
      </div>
      <div className="flex gap-3">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-full font-medium hover:opacity-90 transition-opacity"
        >
          <ExternalLink className="w-4 h-4" />
          Open in New Tab
        </a>
        <a
          href={url}
          download
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-card border border-border/20 text-foreground rounded-full font-medium hover:bg-card/80 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download
        </a>
      </div>
    </div>
  );
});
