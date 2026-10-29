"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
  MessageSquare,
  ChevronDown,
  BookOpen,
  Tag,
  Image,
  Palette,
  Menu as MenuIcon,
  CreditCard,
  MessageCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface AuthenticatedAdmin {
  id: string
  fullname: string
  email: string
  role: string
}

const menuItems = [
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Products",
    href: "/admin/products",
    icon: Package,
  }, 
  {
    label: "Review Videos",
    href: "/admin/review-videos",
    icon: MessageSquare,
  },
  {
    label: "Homepage Cards",
    href: "/admin/homepage-cards",
    icon: Image,
  },
  {
    label: "Navigation Menu",
    href: "/admin/navigation-menu",
    icon: MenuIcon,
  },
  {
    label: "User Management",
    href: "/admin/users",
    icon: Users,
  },
  {
    label: "Agent Management",
    href: "/admin/agents",
    icon: Users,
  },
  {
    label: "Order Management",
    href: "/admin/orders",
    icon: ShoppingCart,
  },
  {
    label: "WhatsApp Inbox",
    href: "/admin/whatsapp",
    icon: MessageCircle,
  },
  {
    label: "Payments",
    href: "/admin/payments",
    icon: CreditCard,
  },
  {
    label: "Coupon Management",
    href: "/admin/coupons",
    icon: Tag,
  },
  {
    label: "Agent coupon sales",
    href: "/admin/agent-coupon-sales",
    icon: Users,
  },
  {
    label: "Fabrics Management",
    href: "/admin/fabrics",
    icon: Palette,
  },
  {
    label: "Enquiry & Queries",
    icon: MessageSquare,
    subItems: [
      {
        label: "Dealer Enquiries",
        href: "/admin/enquiries/dealer",
      },
      {
        label: "Contact Us",
        href: "/admin/enquiries/contact",
      },
    ],
  },
  {
    label: "Policies Management",
    icon: BookOpen,
    subItems: [
      {
        label: "Privacy Policy",
        href: "/admin/policies/privacy",
      },
      {
        label: "Terms Policy",
        href: "/admin/policies/terms",
      },
      {
        label: "Refund Policy",
        href: "/admin/policies/refund",
      },
      {
        label: "Shipping Policy",
        href: "/admin/policies/shipping",
      },
    ],
  },
  
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [admin, setAdmin] = useState<AuthenticatedAdmin | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/admin/admin-verify", {
          credentials: "include",
        })
        const data = await response.json()

        if (data.authenticated && data.user && data.user.role === "admin") {
          setAdmin(data.user)
        } else {
          sessionStorage.removeItem("admin_session")
          router.push("/admin")
        }
      } catch (error) {
        console.error("Auth check failed:", error)
        sessionStorage.removeItem("admin_session")
        router.push("/admin")
      } finally {
        setIsLoading(false)
      }
    }

    // Only check auth if not on login page
    if (pathname !== "/admin") {
      checkAuth()
    } else {
      setIsLoading(false)
    }
  }, [router, pathname])

  useEffect(() => {
    if (pathname.startsWith("/admin/enquiries")) {
      setOpenDropdown("Enquiry & Queries")
    }
    if (pathname.startsWith("/admin/policies")) {
      setOpenDropdown("Policies Management")
    }
  }, [pathname])

  const handleLogout = async () => {
    try {
      sessionStorage.removeItem("admin_session")
      await fetch("/api/auth/admin/admin-logout", {
        method: "POST",
        credentials: "include",
      })
      setAdmin(null)
      router.push("/admin")
      router.refresh()
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }

  const getFirstName = (fullname: string) => {
    return fullname.split(" ")[0]
  }

  const getGradientColor = (name: string) => {
    const firstLetter = name.charAt(0).toUpperCase()
    const colors = [
      "from-purple-500 to-pink-500",
      "from-blue-500 to-cyan-500",
      "from-green-500 to-emerald-500",
      "from-orange-500 to-red-500",
      "from-indigo-500 to-purple-500",
      "from-teal-500 to-green-500",
    ]
    const index = firstLetter.charCodeAt(0) % colors.length
    return colors[index]
  }

  const toggleDropdown = (label: string) => {
    setOpenDropdown(openDropdown === label ? null : label)
  }

  const renderMenuItem = (item: any, isMobile = false) => {
    const Icon = item.icon

    if (item.subItems) {
      const isOpen = openDropdown === item.label
      const hasActiveSubItem = item.subItems.some((sub: any) => pathname === sub.href)

      return (
        <div key={item.label}>
          <button
            onClick={() => toggleDropdown(item.label)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-lg transition-all duration-200 ${
              hasActiveSubItem || isOpen
                ? "bg-[#8B5A3C] text-white"
                : "text-foreground hover:bg-[#8B5A3C]/10 hover:text-foreground"
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
          </button>
          {isOpen && (
            <div className="mt-1 ml-4 space-y-1">
              {item.subItems.map((subItem: any) => {
                const isActive = pathname === subItem.href
                return (
                  <Link
                    key={subItem.href}
                    href={subItem.href}
                    onClick={() => isMobile && setIsSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg text-lg transition-all duration-200 ${
                      isActive
                        ? "bg-[#8B5A3C]/20 text-foreground font-medium"
                        : "text-foreground hover:bg-[#8B5A3C]/10 hover:text-foreground"
                    }`}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-current" />
                    <span>{subItem.label}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )
    }

    const isActive = pathname === item.href
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => isMobile && setIsSidebarOpen(false)}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg text-lg transition-all duration-200 ${
          isActive ? "bg-[#8B5A3C] text-white" : "text-foreground hover:bg-[#8B5A3C]/10 hover:text-foreground"
        }`}
      >
        <Icon className="h-5 w-5" />
        <span className="font-medium">{item.label}</span>
      </Link>
    )
  }

  if (isLoading && pathname !== "/admin") {
    return (
      <div className="min-h-screen bg-[#F5F1ED] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-white shadow-lg border-2 border-[#E5D5C5] flex items-center justify-center mx-auto mb-4 animate-pulse p-2">
            <img src="/logo.png" alt="Ananthala" className="w-full h-full object-contain" />
          </div>
          <p className="text-foreground font-medium">Verifying admin access...</p>
        </div>
      </div>
    )
  }

  if (!admin || pathname === "/admin") {
    return children
  }

  return (
    <div className="min-h-screen bg-[#F5F1ED] text-foreground">
      <div>
        {/* Header */}
        <header className="bg-white border-b sticky top-0 z-40" style={{ borderColor: "#D9CFC7" }}>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative flex items-center justify-between h-20">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden text-foreground hover:bg-[#8B5A3C]/10"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                >
                  {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </Button>
                <Link
                  href="/admin/dashboard"
                  className="text-foreground text-2xl font-normal tracking-wide hover:text-foreground transition-colors"
                >
                  Ananthala Admin
                </Link>
              </div>
              <Link
                href="/"
                className="absolute left-1/2 -translate-x-1/2 flex h-20 items-center justify-center overflow-hidden"
                aria-label="Go to Ananthala homepage"
              >
                <img src="/logo.png" alt="Ananthala" className="h-28 w-auto object-contain" />
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-foreground hover:bg-[#8B5A3C]/10 transition-colors relative"
                  >
                    <div
                      className={`w-10 h-10 rounded-full bg-gradient-to-br ${getGradientColor(admin.fullname)} flex items-center justify-center text-white font-semibold cursor-pointer`}
                    >
                      {getFirstName(admin.fullname).charAt(0).toUpperCase()}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5 text-base text-foreground">
                    <div className="font-semibold">{getFirstName(admin.fullname)}</div>
                    <div className="text-sm text-foreground/70 truncate">{admin.email}</div>
                  </div>
                  <DropdownMenuItem asChild className="text-foreground cursor-pointer">
                    <Link href="/admin/dashboard">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="text-foreground cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <div className="flex">
          <aside
            className="hidden lg:block w-64 bg-white border-r min-h-[calc(100vh-5rem)] sticky top-20"
            style={{ borderColor: "#D9CFC7" }}
          >
            <nav className="p-4 space-y-1">
              {menuItems.map((item) => renderMenuItem(item, false))}
            </nav>
          </aside>

          {isSidebarOpen && (
            <>
              <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
              <aside
                className="fixed left-0 top-20 bottom-0 w-64 bg-white border-r z-50 lg:hidden animate-in slide-in-from-left duration-300"
                style={{ borderColor: "#D9CFC7" }}
              >
                <nav className="p-4 space-y-1">
                  {menuItems.map((item) => renderMenuItem(item, true))}
                </nav>
              </aside>
            </>
          )}

          <main className="flex-1 p-4 sm:p-6 lg:p-8 text-foreground">{children}</main>
        </div>
      </div>
    </div>
  )
}
