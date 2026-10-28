import { readFileSync } from 'fs'
import { join } from 'path'

let cachedBase64Logo: string | null = null

/**
 * Get logo as base64 data URI for embedding in emails
 * This works in ALL email clients - no external URL needed
 */
export function getBase64Logo(): string {
  if (cachedBase64Logo) {
    return cachedBase64Logo
  }

  try {
    const logoPath = join(process.cwd(), 'public', 'logo.png')
    const logoBuffer = readFileSync(logoPath)
    const base64String = logoBuffer.toString('base64')
    cachedBase64Logo = `data:image/png;base64,${base64String}`
    return cachedBase64Logo
  } catch (error) {
    console.error('Failed to load base64 logo:', error)
    // Return a transparent PNG as fallback
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  }
}

/**
 * Get logo URL for use in emails (with fallbacks)
 * Method 1: Base64 embedded (works everywhere)
 * Method 2: Absolute URL (backup)
 */
export function getEmailLogoUrl(useBase64: boolean = true): string {
  if (useBase64) {
    return getBase64Logo()
  }

  // Fallback to absolute URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ananthala.com'
  return `${appUrl.replace(/\/$/, '')}/logo.png`
}

/**
 * Get HTML image tag for embedding logo in email
 */
export function getEmailLogoImage(
  width: number = 200,
  height: number = 'auto',
  useBase64: boolean = true
): string {
  const logoUrl = getEmailLogoUrl(useBase64)
  const heightAttr = typeof height === 'number' ? `${height}` : height

  return `
    <img 
      src="${logoUrl}" 
      alt="Ananthala Logo" 
      style="display: block; margin: 0 auto 16px; max-width: 100%; width: ${width}px; height: ${heightAttr}; border: none; outline: none;"
      width="${width}"
    />
  `.trim()
}

/**
 * Get optimized logo HTML for email headers
 * Responsive and works in all email clients
 */
export function getEmailLogoHeader(useBase64: boolean = true): string {
  const logoUrl = getEmailLogoUrl(useBase64)

  return `
    <div style="text-align: center; padding: 24px 0; background: linear-gradient(135deg, #6d4530 0%, #8b5a3c 100%);">
      <img 
        src="${logoUrl}" 
        alt="Ananthala" 
        style="display: block; margin: 0 auto; max-width: 180px; width: 100%; height: auto; border: none;"
        width="180"
      />
    </div>
  `.trim()
}

/**
 * Clear the cached logo (useful for testing)
 */
export function clearLogoCache(): void {
  cachedBase64Logo = null
}
