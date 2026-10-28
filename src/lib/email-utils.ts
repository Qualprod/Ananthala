import fs from "fs"
import path from "path"

let cachedLogoBase64: string | null = null


export function getEmbeddedLogoDataUri(): string {
  // Return cached value if already loaded
  if (cachedLogoBase64) {
    return cachedLogoBase64
  }

  try {
    
    const logoPath = path.join(process.cwd(), "public", "logo.png")

    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath)
      const base64String = logoBuffer.toString("base64")
      cachedLogoBase64 = `data:image/png;base64,${base64String}`
      return cachedLogoBase64
    }
  } catch (error) {
    console.warn("Error reading logo file, falling back to URL:", error)
  }

  
  cachedLogoBase64 = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.ananthala.com/"}/logo.png`
  return cachedLogoBase64
}


export function getInlineSvgLogo(): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 60'%3E%3Ctext x='10' y='45' font-size='40' font-weight='bold' fill='%236d4530'%3EAnanthala%3C/text%3E%3C/svg%3E`
}
