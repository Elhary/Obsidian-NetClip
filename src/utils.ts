
export function normalizeUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    
    // Remove common tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 
      'utm_term', 'utm_content', 'fbclid', 'gclid'
    ];
    
    trackingParams.forEach(param => {
      parsedUrl.searchParams.delete(param);
    });
    
    return parsedUrl.toString();
  } catch {
    return null;
  }
}


export function sanitizePath(path: string): string {
  return path
    .replace(/[\/\\:*?"<>|]/g, '_')  // Remove invalid filename characters
    .replace(/\s+/g, ' ')            // Normalize whitespace
    .trim();                         // Trim leading/trailing whitespace
}


export function getDomain(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname.replace(/^www\./, '');
  } catch {
    return 'Unknown Domain';
  }
}


export function resolveUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).toString();
  } catch {
    return relative;
  }
}


export function extractTitleFromHtml(html: string): string {
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim();
  }
  return 'Untitled';
}


export function isValidUrl(url: string): boolean {
  try {
      new URL(url);
      return true;
  } catch {
      return false;
  }
}


export function getFileExtension(url: string): string {
  const parsedUrl = new URL(url);
  const path = parsedUrl.pathname;
  const extension = path.split('.').pop();
  return extension ? extension.toLowerCase() : '';
}


export function addQueryParam(url: string, paramName: string, paramValue: string): string {
  const parsedUrl = new URL(url);
  parsedUrl.searchParams.append(paramName, paramValue);
  return parsedUrl.toString();
}