import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import Image from "next/image"
import Link from "next/link"
import { Heart, Eye, Award, Leaf, ChevronRight } from "lucide-react"

const values = [
  {
    icon: Eye,
    title: "Transparency",
    description:
      "We believein being honest about our materials, processes and pricing. No hidden costs and no compromises.",
  },
  {
    icon: Award,
    title: "Quality Excellence",
    description:
      "Every mattress undergoes rigorous testing and quality control to ensure it meets our exceptionally high standards.",
  },
  {
    icon: Heart,
    title: "Customer First",
    description:
      "Your comfort and satisfaction are at the heart of everything we do. We listen, adapt, and continuously improve to serve you better.",
  },
  {
    icon: Leaf,
    title: "Sustainability",
    description:
      "We source eco-friendly materials and use sustainable manufacturing processes to ensure we stay close to nature and help nature preserve its strengths.",
  },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        {/* Fixed Breadcrumb */}
        <div className="fixed top-20 left-0 right-0 z-40 bg-white">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="py-2">
              <ol className="flex items-center gap-2 text-base">
                <li>
                  <Link href="/" className="text-foreground hover:text-[#6D4530] transition-colors">
                    Home
                  </Link>
                </li>
                <li>
                  <ChevronRight className="w-4 h-4 text-foreground/50" />
                </li>
                <li className="text-foreground font-medium">About Us</li>
              </ol>
            </nav>
          </div>
        </div>
        {/* Spacer to prevent content from going under fixed breadcrumb */}
        <div className="h-[49px]"></div>
        {/* Hero Section */}
        <section className="relative h-[75vh] bg-[#EED9C4] overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <Image
              src="/about ananthala.png"
              alt="About Ananthala"
              fill
              className="object-cover object-[center_25%] transition-transform duration-700 hover:scale-110"
            />
          </div>
          <div className="absolute inset-0 bg-black/50"></div>
          <div className="relative h-full flex items-center justify-center px-4">
            <div className="text-center text-white max-w-3xl">
              <h1 className="mb-6 text-5xl font-bold text-white">About Ananthala</h1>
              <p className="text-white font-bold text-lg">
                Rejuvenating the best of heritage to craft great products with care, precision, and a commitment to
                bringing out your best selves.
              </p>
            </div>
          </div>
        </section>

        {/* Brand Story */}
        <section className="py-14 md:py-24 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            {/* TITLE SECTION */}
            <div className="mb-8 md:mb-12 text-center">
              <p className="text-foreground text-4xl font-semibold mb-2">Our Journey</p>
              <h2 className="text-lg text-foreground">The Ananthala Story</h2>
            </div>
            
            {/* IMAGE AND TEXT GRID */}
            <div className="space-y-10">
              <div className="grid md:grid-cols-2 gap-12 items-start">
                <div className="relative w-full h-[420px] sm:h-[480px] md:h-[560px] lg:h-[640px] overflow-hidden rounded-lg group bg-white">
                  <Image
                    src="/Ananthala Story.png"
                    alt="Ananthala Story"
                    fill
                    className="object-contain object-center shadow-md transition-transform duration-700"
                  />
                </div>
                <div className="space-y-10 text-foreground">
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold">A Legacy Rooted in Nature</h3>
                    <p className="text-lg font-medium">
                      There are stories that are told, and there are those that are lived--quietly, over generations.
                    </p>
                    <p className="text-lg font-medium">
                      Ours began in the early 20th century, amidst fields of cotton and stretches of timber, where the
                      rhythm of the land shaped our way of life. What started as cultivation evolved into trade in 1959,
                      when we brought the finest milling technologies from Manchester to refine what nature had so
                      generously given us.
                    </p>
                    <p className="text-lg font-medium">
                      Today, in our fourth generation, this legacy continues--not as tradition alone, but as a philosophy
                      of living.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-semibold">The Art of Rest</h3>
                    <p className="text-lg font-medium">
                      We believe that true luxury is not excess, but restoration.
                    </p>
                    <p className="text-lg font-medium">
                      Sleep, to us, is more than a necessity--it is a ritual of renewal. A moment where the body unwinds,
                      the mind softens, and one awakens restored. In a world that moves relentlessly forward, we seek to
                      bring you back--to stillness, to simplicity, to nature.
                    </p>
                    <p className="text-lg font-medium">Because nature, in its quiet wisdom, knows best.</p>
                  </div>
                </div>
              </div>
              <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-[#EED9C4] text-foreground">
                <div className="space-y-3 py-6 lg:py-0 lg:pr-6">
                  <h3 className="text-2xl font-semibold">Materials in Their Purest Form</h3>
                  <p className="text-lg font-medium">
                    At the heart of our craft lies an uncompromising respect for natural materials.
                  </p>
                  <p className="text-lg font-medium">
                    We work with the finest cotton and timber--materials that have thrived in our tropical landscape for
                    generations. Free from chemical interventions, our creations are untouched by foam, latex, or
                    synthetics. Instead, we use carefully selected Naati virgin cotton, grown locally and chosen for its
                    inherent strength, breathability, and comfort.
                  </p>
                  <p className="text-lg font-medium">
                    Each fibre, each layer, is guided by both tradition and research--coming together to create a
                    balance that feels instinctively right.
                  </p>
                </div>
                <div className="space-y-3 py-6 lg:py-0 lg:px-6">
                  <h3 className="text-2xl font-semibold">Crafted with Quiet Precision</h3>
                  <p className="text-lg font-medium">Luxury reveals itself in the details.</p>
                  <p className="text-lg font-medium">
                    The fabrics that envelop our mattresses are inspired by classic Belgian weaves--subtle stripes,
                    checks, and textures that speak of understated elegance. Made from 100% pure cotton, they allow the
                    material to breathe, just as nature intended.
                  </p>
                  <p className="text-lg font-medium">
                    Beneath, solid wood frames--crafted from locally sourced timber--provide a foundation of strength
                    and longevity. Each piece is shaped by the hands of craftsmen who have inherited not just skill, but
                    a philosophy: to create with integrity, and to craft for a lifetime.
                  </p>
                </div>
                <div className="space-y-3 py-6 lg:py-0 lg:pl-6">
                  <h3 className="text-2xl font-semibold">A Return to What Matters</h3>
                  <p className="text-lg font-medium">
                    In every product we offer is an invitation--to slow down, to reconnect, and to rediscover the simple
                    luxury of living well.
                  </p>
                  <p className="text-lg font-medium">This is not just about sleep.</p>
                  <p className="text-lg font-medium">
                    It is about returning to nature, and in doing so, returning to yourself.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mission & Vision (With Dark Overlay Background) */}
        <section className="relative py-10 md:py-12 px-4 bg-[#F5F1ED] overflow-hidden">
          <div className="relative max-w-7xl mx-auto text-foreground pb-8">
            <div className="text-center mb-8">
              <p className="text-foreground text-4xl font-semibold mb-2">What We Stand For</p>
              <p className="text-foreground font-medium text-lg max-w-2xl mx-auto">
                At Ananthala, every step we take is guided by our purpose and the future we strive to build.
              </p>
            </div>
            <div className="flex justify-center mb-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-6xl w-full">
                {/* Mission */}
                <div className="relative overflow-hidden bg-white px-14 pt-14 pb-16 border border-[#EED9C4]/60 rounded-2xl transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-xl cursor-pointer">
                  <Image
                    src="/Vision and Mission Background.png"
                    alt="Mission Background"
                    fill
                    className="object-cover opacity-60"
                  />
                  <div className="absolute inset-0 bg-black/55"></div>
                  <div className="relative z-10 flex items-center gap-3 mb-4 text-white">
                    <div className="w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center">
                      <Heart className="w-5 h-5" />
                    </div>
                    <h3 className="text-2xl font-semibold text-white">Our Mission</h3>
                  </div>
                  <p className="relative z-10 text-lg font-medium text-white leading-relaxed">
                    To craft refined, nature-rooted products that restore and elevate everyday living--drawing from
                    generations of Indian craftsmanship, the purity of natural materials, and an uncompromising
                    commitment to holistic well-being.
                  </p>
                </div>

              {/* Vision */}
                <div className="relative overflow-hidden bg-white px-14 pt-14 pb-16 border border-[#EED9C4]/60 rounded-2xl transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-xl cursor-pointer">
                  <Image
                    src="/vision.png"
                    alt="Vision Background"
                    fill
                    className="object-cover opacity-60"
                  />
                  <div className="absolute inset-0 bg-black/55"></div>
                  <div className="relative z-10 flex items-center gap-3 mb-4 text-white">
                    <div className="w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center">
                      <Eye className="w-5 h-5" />
                    </div>
                    <h3 className="text-2xl font-semibold text-white">Our Vision</h3>
                  </div>
                  <p className="relative z-10 text-lg font-medium text-white leading-relaxed">
                    To be a distinguished symbol of Indian heritage luxury--where timeless craftsmanship, natural
                    living, and quiet sophistication come together to redefine how the world rests, lives, and reconnects
                    with nature.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-14 md:py-24 px-4 bg-white">
          <div className="max-w-[1400px] mx-auto">
            <div className="text-center mb-16">
              <p className="text-foreground text-4xl font-semibold mb-2">What Drives Us</p>
              
              <p className="text-foreground font-medium text-lg max-w-2xl mx-auto">
                These principles guide every decision we make and define who we are as a company.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0">
              {values.map((value, index) => {
                const Icon = value.icon
                const isHighlighted = index === 1 || index === 3

                return (
                  <div
                    key={index}
                    className={`
                      text-center p-6 transition-all duration-500 ease-in-out
                      hover:scale-105 hover:shadow-xl hover:-translate-y-2
                      ${
                        isHighlighted
                          ? "bg-[#EED9C4] text-foreground "
                          : "bg-[#F5F1ED] hover:bg-[#FEF7E7] text-foreground"
                      }
                    `}
                  >
                    <div
                      className={`
                        inline-flex items-center justify-center w-12 h-12 mb-4 rounded-full
                        transition-all duration-300 ease-in-out
                        group-hover:scale-110 hover:scale-110 hover:rotate-6
                        ${isHighlighted ? "bg-white text-[#EED9C4]" : "bg-[#EED9C4] text-foreground"}
                      `}
                    >
                      <Icon className="w-6 h-6 transition-transform duration-300 group-hover:scale-110" />
                    </div>
                    <h3 className="mb-3 text-xl font-semibold transition-colors duration-300">{value.title}</h3>
                    <p className="text-lg font-medium leading-relaxed transition-colors duration-300">{value.description}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Commitment Section */}
        <section className="py-14 md:py-24 px-4 bg-[#F5F1ED]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="mb-6 text-3xl font-semibold text-foreground">Our Commitment to Sustainability</h2>
              <p className="text-foreground font-semibold text-lg max-w-2xl mx-auto">
                At Ananthala, we honour the land that sustains us, knowing that in preserving it, we protect the legacy
                of life for generations to come.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Materials Card */}
              <div className="relative rounded-lg overflow-hidden shadow-sm min-h-[250px] group">
                <Image
                  src="/Sustainability - Materials BG.png"
                  alt="Materials"
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/55"></div>
                <div className="relative z-10 p-8 h-full flex flex-col">
                  <h3 className="text-xl font-semibold text-white mb-4 text-center">Materials</h3>
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-lg font-semibold text-white text-center">
                      We begin with what nature provides--pure, enduring, and honest. Our cotton is locally grown, our
                      timber responsibly sourced, each chosen for its inherent strength, breathability, and harmony with
                      our environment. Free from synthetics and unnecessary processing, our materials remain as close to
                      their natural state as possible--gentle on both the body and the earth.
                    </p>
                  </div>
                </div>
              </div>
              {/* Craft Card */}
              <div className="relative rounded-lg overflow-hidden shadow-sm min-h-[250px] group">
                <Image
                  src="/Sustaibaility - Craft BG.png"
                  alt="Craft"
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/55"></div>
                <div className="relative z-10 p-8 h-full flex flex-col">
                  <h3 className="text-xl font-semibold text-white mb-4 text-center">Craft</h3>
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-lg font-semibold text-white text-center">
                      Our approach to making is guided by restraint and respect. We minimise intervention, allowing
                      natural materials to retain their integrity, while our craftsmen shape each piece with precision
                      and care. Rooted in generations of knowledge, our craft is not about excess, but about creating
                      with intention--where every detail serves a purpose, and nothing is superfluous.
                    </p>
                  </div>
                </div>
              </div>
              {/* Responsibility Card */}
              <div className="relative rounded-lg overflow-hidden shadow-sm min-h-[250px] group">
                <Image
                  src="/Sustainability - Repsonsibility BG.png"
                  alt="Responsibility"
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/55"></div>
                <div className="relative z-10 p-8 h-full flex flex-col">
                  <h3 className="text-xl font-semibold text-white mb-4 text-center">Responsibility</h3>
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-lg font-semibold text-white text-center">
                      Our responsibility extends beyond what we create, to how we create it. We work in close harmony
                      with local ecosystems and communities, ensuring that our processes honour the land that sustains
                      us. By choosing longevity over disposability and purity over convenience, we seek to preserve a
                      balance that endures.
                    </p>
                  </div>
                </div>
              </div>
              {/* Legacy Card */}
              <div className="relative rounded-lg overflow-hidden shadow-sm min-h-[320px] md:min-h-[250px] group">
                <Image
                  src="/Sustainability - Legacy BG.png"
                  alt="Legacy"
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/55"></div>
                <div className="relative z-10 p-8 h-full flex flex-col">
                  <h3 className="text-xl font-semibold text-white mb-4 text-center">Legacy</h3>
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-lg font-semibold text-white text-center">
                      For us, sustainability is not a statement--it is a legacy. In caring for the earth today, we
                      safeguard the quiet continuity of life for generations to come, ensuring that what we build
                      remains as timeless as the values we uphold.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}


