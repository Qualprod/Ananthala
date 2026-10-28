/**
 * Pattern Transform Utilities
 * Handles canvas-based image pattern transformation and overlay
 * Supports various pattern types and blending modes
 */

import type { FabricPattern } from "@/data/fabric-patterns"

export interface PatternTransformOptions {
  pattern: FabricPattern
  baseColor?: string // Base color for pattern
}

/**
 * Create SVG pattern string based on pattern configuration
 */
function createSVGPattern(
  pattern: FabricPattern,
  patternId: string,
  width: number = 100,
  height: number = 100
): string {
  const scale = pattern.scale || 1
  const scaledWidth = width / scale
  const scaledHeight = height / scale
  const opacity = pattern.opacity || 0.6

  let patternElement = ""

  switch (pattern.type) {
    case "striped": {
      const stripeWidth = 8 * scale
      patternElement = `
        <defs>
          <pattern id="${patternId}" x="0" y="0" width="${stripeWidth * 2}" height="${scaledHeight}" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="${stripeWidth}" height="${scaledHeight}" fill="rgba(0,0,0,${opacity})" />
            <rect x="${stripeWidth}" y="0" width="${stripeWidth}" height="${scaledHeight}" fill="rgba(255,255,255,0)" />
          </pattern>
        </defs>
      `
      break
    }

    case "checkered": {
      const checkSize = 16 * scale
      patternElement = `
        <defs>
          <pattern id="${patternId}" x="0" y="0" width="${checkSize * 2}" height="${checkSize * 2}" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="${checkSize}" height="${checkSize}" fill="rgba(0,0,0,${opacity})" />
            <rect x="${checkSize}" y="0" width="${checkSize}" height="${checkSize}" fill="rgba(255,255,255,0)" />
            <rect x="0" y="${checkSize}" width="${checkSize}" height="${checkSize}" fill="rgba(255,255,255,0)" />
            <rect x="${checkSize}" y="${checkSize}" width="${checkSize}" height="${checkSize}" fill="rgba(0,0,0,${opacity})" />
          </pattern>
        </defs>
      `
      break
    }

    case "dotted": {
      const dotSize = 6 * scale
      const spacing = 14 * scale
      patternElement = `
        <defs>
          <pattern id="${patternId}" x="0" y="0" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse">
            <circle cx="${spacing / 2}" cy="${spacing / 2}" r="${dotSize}" fill="rgba(0,0,0,${opacity})" />
          </pattern>
        </defs>
      `
      break
    }

    case "floral": {
      const flowerSize = 20 * scale
      patternElement = `
        <defs>
          <pattern id="${patternId}" x="0" y="0" width="${flowerSize * 3}" height="${flowerSize * 3}" patternUnits="userSpaceOnUse">
            <circle cx="${flowerSize}" cy="${flowerSize}" r="${flowerSize * 0.3}" fill="rgba(200,100,100,${opacity})" />
            <circle cx="${flowerSize - flowerSize * 0.6}" cy="${flowerSize}" r="${flowerSize * 0.2}" fill="rgba(200,100,100,${opacity})" />
            <circle cx="${flowerSize + flowerSize * 0.6}" cy="${flowerSize}" r="${flowerSize * 0.2}" fill="rgba(200,100,100,${opacity})" />
            <circle cx="${flowerSize}" cy="${flowerSize - flowerSize * 0.6}" r="${flowerSize * 0.2}" fill="rgba(200,100,100,${opacity})" />
            <circle cx="${flowerSize}" cy="${flowerSize + flowerSize * 0.6}" r="${flowerSize * 0.2}" fill="rgba(200,100,100,${opacity})" />
          </pattern>
        </defs>
      `
      break
    }

    case "geometric": {
      const geoSize = 20 * scale
      patternElement = `
        <defs>
          <pattern id="${patternId}" x="0" y="0" width="${geoSize * 2}" height="${geoSize * 2}" patternUnits="userSpaceOnUse">
            <polygon points="${geoSize},0 ${geoSize * 2},${geoSize} ${geoSize},${geoSize * 2} 0,${geoSize}" fill="rgba(0,0,0,${opacity * 0.5})" />
            <polygon points="0,0 ${geoSize},${geoSize} 0,${geoSize * 2}" fill="rgba(0,0,0,${opacity})" />
          </pattern>
        </defs>
      `
      break
    }

    default:
      // Solid pattern - no pattern element needed
      return ""
  }

  return patternElement
}

/**
 * Apply pattern transformation to image using canvas
 */
export async function applyPatternTransform(
  imageUrl: string,
  options: PatternTransformOptions
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext("2d")

        if (!ctx) {
          resolve(imageUrl)
          return
        }

        // Draw original image
        ctx.drawImage(img, 0, 0)

        // Apply pattern overlay
        if (options.pattern.type !== "solid") {
          const patternId = `pattern-${Date.now()}`
          const svgPattern = createSVGPattern(
            options.pattern,
            patternId,
            canvas.width,
            canvas.height
          )

          if (svgPattern) {
            // Create SVG with pattern
            const svg = `
              <svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">
                ${svgPattern}
                <rect width="${canvas.width}" height="${canvas.height}" fill="url(#${patternId})" />
              </svg>
            `

            const svgBlob = new Blob([svg], { type: "image/svg+xml" })
            const svgUrl = URL.createObjectURL(svgBlob)
            const patternImg = new Image()
            patternImg.crossOrigin = "anonymous"
            patternImg.onload = () => {
              // Apply blend mode
              ctx.globalCompositeOperation = options.pattern.blendMode === "multiply"
                ? "multiply"
                : options.pattern.blendMode === "overlay"
                ? "screen"
                : options.pattern.blendMode === "soft-light"
                ? "soft-light"
                : options.pattern.blendMode === "hard-light"
                ? "hard-light"
                : "screen"

              ctx.globalAlpha = options.pattern.opacity
              ctx.drawImage(patternImg, 0, 0)

              URL.revokeObjectURL(svgUrl)
              resolve(canvas.toDataURL("image/png"))
            }
            patternImg.src = svgUrl
          } else {
            resolve(canvas.toDataURL("image/png"))
          }
        } else {
          resolve(canvas.toDataURL("image/png"))
        }
      } catch (error) {
        console.error("Pattern transform failed:", error)
        resolve(imageUrl)
      }
    }
    img.onerror = () => {
      resolve(imageUrl)
    }
    img.src = imageUrl
  })
}

/**
 * Apply both color and pattern transformation
 */
export async function applyColorAndPatternTransform(
  imageUrl: string,
  colorHex: string,
  colorIntensity: number,
  colorBlendMode: string,
  pattern: FabricPattern
): Promise<string> {
  // First apply color transform, then pattern
  const { applyColorTransform } = await import("@/lib/color-transform")

  const colorTransformed = await applyColorTransform(imageUrl, {
    hex: colorHex,
    intensity: colorIntensity,
    blendMode: colorBlendMode as any,
  })

  return applyPatternTransform(colorTransformed, { pattern })
}
