import { env } from '../config/env';
import { FileDownloadError } from '../common/errors';
import { logger } from '../common/logger';

export class MediaService {
  /**
   * Downloads file from URL after checking security policies.
   */
  async downloadFile(
    fileUrl: string,
    expectedMimeType: string
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    try {
      const url = new URL(fileUrl);

      // 1. Enforce HTTPS (unless in development and localhost is used)
      if (url.protocol !== 'https:' && env.NODE_ENV === 'production') {
        throw new FileDownloadError('URL must use HTTPS protocol in production');
      }

      // 2. Validate domain against ALLOWED_FILE_DOMAINS
      const hostname = url.hostname;
      const isAllowedDomain = env.ALLOWED_FILE_DOMAINS.some((domain) => {
        // Support exact match or subdomain wildcard match
        return hostname === domain || hostname.endsWith(`.${domain}`);
      });

      if (!isAllowedDomain) {
        throw new FileDownloadError(`File domain '${hostname}' is not in the allowed list`, {
          hostname,
          allowedDomains: env.ALLOWED_FILE_DOMAINS,
        });
      }

      // 3. Perform a HEAD request to check size and MIME type before downloading (performance and protection)
      let headMimeType = '';
      let contentLength = 0;
      try {
        const headResponse = await fetch(fileUrl, { method: 'HEAD' });
        if (headResponse.ok) {
          headMimeType = headResponse.headers.get('content-type') || '';
          contentLength = parseInt(headResponse.headers.get('content-length') || '0', 10);
        }
      } catch (headErr) {
        logger.warn({ headErr, fileUrl }, 'HEAD request failed, falling back to GET request validation');
      }

      const maxBytes = env.MAX_FILE_SIZE_MB * 1024 * 1024;
      if (contentLength > maxBytes) {
        throw new FileDownloadError(`File size (${(contentLength / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed size of ${env.MAX_FILE_SIZE_MB} MB`);
      }

      // 4. Download file
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new FileDownloadError(`HTTP error! status: ${response.status} downloading file`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 5. Validate downloaded size
      if (buffer.length > maxBytes) {
        throw new FileDownloadError(`Downloaded file size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds limit of ${env.MAX_FILE_SIZE_MB} MB`);
      }

      // 6. Validate MIME type
      const mimeType = headMimeType || response.headers.get('content-type') || expectedMimeType;
      
      const allowedMimes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
        'application/vnd.ms-excel', // XLS
        'text/csv',
        'text/plain',
      ];

      // Clean MIME type (remove charset=utf-8 etc.)
      const cleanMime = mimeType.split(';')[0].trim().toLowerCase();
      
      if (!allowedMimes.includes(cleanMime)) {
        throw new FileDownloadError(`Unsupported MIME type: '${mimeType}'. Allowed: PDF, XLSX, CSV, TXT`);
      }

      return { buffer, mimeType: cleanMime };
    } catch (err: any) {
      if (err instanceof FileDownloadError) {
        throw err;
      }
      logger.error({ err, fileUrl }, 'Failed to download file');
      throw new FileDownloadError(`Failed to download report file: ${err.message}`);
    }
  }
}

export const mediaService = new MediaService();
