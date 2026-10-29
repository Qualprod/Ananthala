"use client"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { CustomerTestimonialVideos } from "@/components/sections/customer-testimonial-videos"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Volume2, VolumeX, ChevronLeft, ChevronRight } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { isHomepageCardVideoUrl } from "@/lib/homepage-card-media"
import { HOME_SHOP_PATH, isHomeShopHash, scrollToHomeShopSection } from "@/lib/home-shop-anchor"

// Session cache key for homepage cards (instant render on repeat visits)
const HOMEPAGE_CARDS_CACHE_KEY = "ananthala_homepage_cards_v1"

/**
 * Renders children only when the placeholder scrolls near the viewport.
 * Used to defer below-the-fold sections (and their network requests / videos)
 * so the hero video and above-the-fold content get full bandwidth first.
 */
function LazyMountOnVisible({
  children,
  minHeight = 400,
  rootMargin = "400px 0px",
}: {
  children: React.ReactNode
  minHeight?: number
  rootMargin?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isVisible) return
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [isVisible, rootMargin])

  if (isVisible) return <>{children}</>
  return <div ref={ref} style={{ minHeight }} aria-hidden="true" />
}

// Categories data
const categories = [
  {
    id: 1,
    title: "At Ananthala, we truly value our traditions specifically the ones that have taken care of us for generations.",
    image: "/Hero Banner 1.png",
  },
  {
    id: 2,
    title: "We look to mother nature for time proven solutions and make them more relevant for the current times.",
    image: "/Hero banner 3.png",
  },
  {
    id: 3,
    title: "Introducing our virgin cotton mattresses for all ages. Sleep in the lap of nature !",
    image: "/Hero Banner 2.png",
  },
]

interface HomepageCard {
  _id: string
  name: string
  tagline?: string
  backgroundUrl?: string
  position: "center" | "bottom-right" | "bottom-left"
  isActive?: boolean
  displayOrder?: number
}

function rangeLabelForCard(name: string) {
  const normalizedName = name.toLowerCase()
  if (normalizedName.includes("joy")) return "Kids range"
  if (normalizedName.includes("bliss")) return "Adult range"
  if (normalizedName.includes("grace")) return "Seniors range"
  return ""
}

function HomepageRangeProductCard({
  card,
  onNavigate,
}: {
  card: HomepageCard
  onNavigate: (productName: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const cardRef = useRef<HTMLButtonElement>(null)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const backgroundImage = card.backgroundUrl || "/placeholder.svg"
  const isPlaceholder = backgroundImage === "/placeholder.svg"
  const isVideo = !isPlaceholder && isHomepageCardVideoUrl(backgroundImage)
  const rangeLabel = card.tagline?.trim() || rangeLabelForCard(card.name)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: none), (pointer: coarse)")
    const updateTouchState = () => setIsTouchDevice(mediaQuery.matches)

    updateTouchState()
    mediaQuery.addEventListener("change", updateTouchState)

    return () => mediaQuery.removeEventListener("change", updateTouchState)
  }, [])

  useEffect(() => {
    if (!isVideo || !isTouchDevice) return
    const card = cardRef.current
    const video = videoRef.current
    if (!card || !video) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (!entry) return

        if (entry.isIntersecting) {
          void video.play().catch(() => {
            // Some browsers may still block playback; ignore and leave poster frame.
          })
        } else {
          video.pause()
        }
      },
      { threshold: 0.4 },
    )

    observer.observe(card)
    return () => observer.disconnect()
  }, [isVideo, isTouchDevice, backgroundImage])

  const handleVideoHoverStart = () => {
    if (isTouchDevice) return
    const video = videoRef.current
    if (!video) return
    void video.play().catch(() => {
      // Hover can end before play resolves; ignore expected aborts.
    })
  }

  const handleVideoHoverEnd = () => {
    if (isTouchDevice) return
    const v = videoRef.current
    if (!v) return
    v.pause()
    v.currentTime = 0
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        ref={cardRef}
        type="button"
        onClick={() => onNavigate(card.name)}
        onMouseEnter={isVideo ? handleVideoHoverStart : undefined}
        onMouseLeave={isVideo ? handleVideoHoverEnd : undefined}
        className="group relative w-full aspect-[7/10] overflow-hidden cursor-pointer bg-gray-100"
      >
        {isVideo ? (
          <video
            ref={videoRef}
            src={backgroundImage}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden
          />
        ) : (
          <img
            src={backgroundImage}
            alt={card.name}
            loading="lazy"
            decoding="async"
            className={`absolute inset-0 w-full h-full transition-transform duration-500 ${
              isPlaceholder ? "object-contain bg-white" : "object-cover group-hover:scale-105"
            }`}
          />
        )}
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-4 mb-4 border border-[#EED9C4] bg-[#EED9C4]/60 px-4 py-3 text-center backdrop-blur-sm">
            <div
              className="tracking-wider text-base md:text-lg font-bold uppercase text-foreground"
              style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300 }}
            >
              {card.name}
            </div>
            {rangeLabel && (
              <div
                className="mt-1 text-xs uppercase tracking-[0.25em] text-foreground/80"
                style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 400 }}
              >
                {rangeLabel}
              </div>
            )}
          </div>
        </div>
      </button>
    </div>
  )
}

export default function Home() {
  const router = useRouter()
  const [isMuted, setIsMuted] = useState(true)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [homepageCards, setHomepageCards] = useState<HomepageCard[]>([])
  const [cardsLoading, setCardsLoading] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)

  // React does not render the `muted` attribute in server HTML, so browsers can
  // block autoplay until hydration. Force muted + play as soon as we mount so the
  // hero video starts immediately and reliably (including iOS/Safari).
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = true
    video.defaultMuted = true
    video.setAttribute("muted", "")
    const tryPlay = () => {
      void video.play().catch(() => {
        // Autoplay can still be blocked (e.g. low-power mode); poster/background stays visible.
      })
    }
    if (video.readyState >= 2) {
      tryPlay()
    } else {
      video.addEventListener("loadeddata", tryPlay, { once: true })
      tryPlay()
    }
    return () => video.removeEventListener("loadeddata", tryPlay)
  }, [])

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const goToNext = () => {
    setCurrentSlide((prev) => (prev + 1) % categories.length)
  }

  const goToPrevious = () => {
    setCurrentSlide((prev) => (prev - 1 + categories.length) % categories.length)
  }

  const goToSlide = (index: number) => {
    setCurrentSlide(index)
  }

  // Auto-advance slides every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % categories.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Show cached cards instantly (repeat visits in the same session), then refresh in background
    let hasCachedCards = false
    try {
      const cached = window.sessionStorage.getItem(HOMEPAGE_CARDS_CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setHomepageCards(parsed)
          setCardsLoading(false)
          hasCachedCards = true
        }
      }
    } catch {
      // Storage unavailable (private mode etc.) — fall back to network only
    }

    const fetchHomepageCards = async () => {
      try {
        const response = await fetch("/api/admin/homepage-cards")
        const data = await response.json()

        if (data.success) {
          const activeCards = data.data
            .filter((card: HomepageCard) => card.isActive)
            .sort((a: HomepageCard, b: HomepageCard) => {
              const aIsJoy = a.name.trim().toLowerCase() === "joy"
              const bIsJoy = b.name.trim().toLowerCase() === "joy"
              if (aIsJoy && !bIsJoy) return -1
              if (!aIsJoy && bIsJoy) return 1
              return (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
            })

          setHomepageCards(activeCards)
          try {
            window.sessionStorage.setItem(HOMEPAGE_CARDS_CACHE_KEY, JSON.stringify(activeCards))
          } catch {
            // ignore storage errors
          }
        }
      } catch (error) {
        console.error("Error fetching homepage cards:", error)
        if (!hasCachedCards) setHomepageCards([])
      } finally {
        setCardsLoading(false)
      }
    }

    fetchHomepageCards()
  }, [])

  useEffect(() => {
    const scrollToShopFromHash = () => {
      if (!isHomeShopHash(window.location.hash)) return
      window.setTimeout(() => {
        scrollToHomeShopSection("smooth")
      }, 100)
    }

    scrollToShopFromHash()
    window.addEventListener("hashchange", scrollToShopFromHash)
    return () => window.removeEventListener("hashchange", scrollToShopFromHash)
  }, [])

  const getCategoryPath = (productName: string) => {
    const name = productName.toLowerCase()
    // Map product names to category pages (matching second section redirects)
    if (name === "joy") return "/category/joy"
    if (name === "bliss") return "/category/bliss"
    if (name === "grace") return "/category/grace"
    if (
      name.includes("essentials") ||
      name.includes("pillow") ||
      name.includes("bedsheet") ||
      name.includes("bedding") ||
      name.includes("more")
    ) {
      return "/category/essentials"
    }
    return "/category/bliss"
  }

  const onNavigate = (productName: string) => {
    const path = getCategoryPath(productName)
    const targetPath = path.includes("#") ? path : `${path}#shop`
    router.push(targetPath)
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main>
        {/* Hero Section */}
        <section className="relative min-h-[720px] md:min-h-[840px] flex items-end">
          {/* Background Video */}
          <div className="absolute inset-0 z-0 bg-[#3B2A20]">
            <video
              ref={videoRef}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              className="w-full h-full object-cover"
            >
              <source src="/herosection.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-black/20" />
          </div>

          {/* Unmute Button - Bottom Right Corner */}
          <button
            onClick={toggleMute}
            className="absolute bottom-8 right-8 z-20 bg-white/90 hover:bg-white rounded-full p-3 shadow-lg transition-all duration-200 hover:scale-110"
            aria-label={isMuted ? "Unmute video" : "Mute video"}
          >
            {isMuted ? <VolumeX className="h-5 w-5 text-[#8B5A3C]" /> : <Volume2 className="h-5 w-5 text-[#8B5A3C]" />}
          </button>

          {/* Action Buttons - Lower Left Corner */}
          <div className="relative z-10 flex flex-col sm:flex-row gap-4 pb-8 lg:pb-12 pl-4 sm:pl-6 lg:pl-8">
            <Button
              className="bg-[#EED9C4] hover:bg-[#D9BB9B] text-foreground px-8 py-6 text-lg rounded-md shadow-lg transition-all duration-200 hover:scale-105 w-full sm:w-auto min-w-[160px] flex items-center justify-center"
              style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300 }}
              onClick={(e) => {
                const element = document.getElementById("shop")
                if (element) {
                  element.scrollIntoView({ behavior: "smooth" })
                  window.history.pushState({}, "", "/#shop")
                }
              }}
            >
              Shop
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-2 border-white/90 text-white hover:bg-white/10 hover:border-white px-8 py-6 text-lg bg-transparent backdrop-blur-sm rounded-md shadow-lg transition-all duration-200 hover:scale-105 w-full sm:w-auto min-w-[160px]"
              style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300 }}
            >
              <Link href="/#comfort" className="flex items-center justify-center">
                Learn More
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* Experience The Difference Section */}
        <div className="py-14 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto text-center px-4">
            <h2 className="mb-4 text-4xl font-medium text-foreground">
              Experience Infinity, Experience Ananthala
            </h2>
          </div>
        </div>

        {/* Category Slider Section */}
        <section className="relative w-full overflow-hidden">
          <div className="relative w-full h-[420px] md:h-auto md:aspect-video">
            {categories.map((category, index) => (
              <div
                key={category.id}
                className="absolute inset-0 transition-opacity duration-500"
                style={{
                  opacity: currentSlide === index ? 1 : 0,
                  pointerEvents: currentSlide === index ? "auto" : "none",
                }}
              >
                {/* next/image serves resized WebP/AVIF instead of the full-size PNG and lazy-loads it */}
                <Image
                  src={category.image || "/placeholder.svg"}
                  alt={category.title}
                  fill
                  sizes="100vw"
                  quality={75}
                  className={`w-full h-full transition-transform duration-7000 ease-out ${
                    category.image ? "object-cover object-top" : "object-contain bg-white"
                  } ${
                    currentSlide === index ? "scale-105" : "scale-100"
                  }`}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: "rgba(0, 0, 0, 0.5)",
                  }}
                />
                <div
                  className={`absolute inset-0 flex flex-col items-center justify-center text-center px-4 transition-all duration-700 ease-out ${
                    currentSlide === index ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                >
                  <h2
                    className={`text-2xl md:text-3xl lg:text-4xl mb-6 text-white leading-tight max-w-4xl transition-all duration-700 ease-out ${
                      currentSlide === index ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
                    }`}
                    style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 400, transitionDelay: "120ms" }}
                  >
                    {category.title}
                  </h2>
                  <button
                    onClick={(e) => {
                      const element = document.getElementById("shop")
                      if (element) {
                        element.scrollIntoView({ behavior: "smooth" })
                        window.history.pushState({}, "", "/#shop")
                      }
                    }}
                    className={`px-8 py-3 bg-white/95 hover:bg-white text-foreground text-sm tracking-[0.3em] uppercase font-sans shadow-lg transition-all duration-300 hover:scale-105 absolute bottom-10 md:static ${
                      currentSlide === index ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
                    }`}
                    style={{ fontWeight: 400, transitionDelay: "320ms" }}
                  >
                    SHOP
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 md:w-12 md:h-12 bg-white/80 hover:bg-white rounded-full flex items-center justify-center transition-colors"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" style={{ color: "#6B563F" }} />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 md:w-12 md:h-12 bg-white/80 hover:bg-white rounded-full flex items-center justify-center transition-colors"
            aria-label="Next slide"
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6" style={{ color: "#6B563F" }} />
          </button>

          {/* Dots Indicator */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
            {categories.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className="w-2 h-2 rounded-full transition-all"
                style={{
                  backgroundColor: currentSlide === index ? "#F9F8F6" : "rgba(249, 248, 246, 0.5)",
                  width: currentSlide === index ? "24px" : "8px",
                }}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </section>

        {/* Products Section */}
        <section id="shop" className="py-14 md:py-24 px-4 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="mb-4 text-4xl font-medium text-foreground">Find your perfect Ananthala product</h2>
              <p className="max-w-2xl mx-auto text-xl font-medium text-foreground">
                Each of our products are expertly crafted, custom made to suit your needs while ensuring you stay close
                to nature and stay well
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {cardsLoading && homepageCards.length === 0
                ? Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={`card-skeleton-${index}`}
                      className="w-full aspect-[7/10] bg-[#F5F1ED] animate-pulse"
                      aria-hidden="true"
                    />
                  ))
                : homepageCards.map((card) => (
                    <HomepageRangeProductCard key={card._id || card.name} card={card} onNavigate={onNavigate} />
                  ))}
            </div>
          </div>
        </section>

        {/* Comfort Section */}
        <section id="comfort" className="py-14 md:py-24 px-4 bg-stone-50">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1">
                <p className="text-3xl font-medium mb-2 text-foreground">Our Crafted Heritage</p>

                <ul className="mt-3 space-y-3 mb-8 list-disc pl-6 text-lg text-foreground/90 font-medium">
                  <li>Rooted in the early 20th century, our journey is shaped by a deep bond with nature and generations of craftsmanship.</li>
                  <li>We create refined, nature-led products that elevate everyday living through purity, simplicity, and enduring design.</li>
                  <li>Using the finest cotton and responsibly sourced timber, untouched by synthetics, we honour both material and method.</li>
                  <li>Each piece reflects quiet precision - crafted to last, and to restore balance to body and mind.</li>
                  <li>Guided by a responsibility to the land, we create with care for both present and future.</li>
                  <li>This is our legacy - where heritage, nature, and understated luxury come together.</li>
                </ul>
                <button
                  onClick={() => router.push("/about")}
                  className="bg-[#EED9C4] text-foreground font-medium text-lg px-8 py-3 hover:bg-[#D9BB9B] transition-colors"
                >
                  More
                </button>
              </div>
              <div className="order-1 lg:order-2">
                <div className="relative aspect-[4/3] overflow-hidden max-w-xl mx-auto lg:ml-auto">
                  <Image
                    src="/Bullock Cart Theme.png"
                    alt="Comfort"
                    fill
                    sizes="(min-width: 1024px) 576px, 100vw"
                    quality={75}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Customer Testimonials - Real Videos from Database (mounted only when scrolled near) */}
        <LazyMountOnVisible minHeight={400}>
          <CustomerTestimonialVideos />
        </LazyMountOnVisible>
      </main>
      <Footer />
    </div>
  )
}
