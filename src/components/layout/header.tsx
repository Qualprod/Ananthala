"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { ShoppingCart, User, Menu, X, Search, LogOut, LayoutDashboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart } from "@/contexts/cart-context"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SearchDropdown } from "@/components/search/search-dropdown"
import { DEFAULT_NAVIGATION_MENU_ITEMS } from "@/lib/navigation-menu-defaults"
import {
  HOME_SHOP_PATH,
  isHomeShopHref,
  normalizeHomeShopHref,
  scrollToHomeShopSection,
} from "@/lib/home-shop-anchor"

  
interface NavigationMenuItem {
  _id?: string
  label: string
  href: string
  isActive?: boolean
  displayOrder?: number
}

const handleShopClick = (e: React.MouseEvent<HTMLAnchorElement>, router: ReturnType<typeof useRouter>, pathname: string) => {
  e.preventDefault()

  if (pathname === "/" || pathname === "") {
    scrollToHomeShopSection("smooth")
    window.history.pushState({}, "", HOME_SHOP_PATH)
    return
  }

  router.push(HOME_SHOP_PATH)
}

interface AuthenticatedUser {
  id: string
  fullname: string
  email: string
}

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const { cartItems } = useCart()
  const [user, setUser] = useState<AuthenticatedUser | null>(null)
  const [menuItems, setMenuItems] = useState<NavigationMenuItem[]>(DEFAULT_NAVIGATION_MENU_ITEMS)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/verify")
        const data = await response.json()
        if (data.success && data.user) {
          setUser(data.user)
        }
      } catch (error) {
        console.error("Auth check failed:", error)
      }
    }
    checkAuth()
  }, [])

  useEffect(() => {
    const fetchMenuItems = async () => {
      try {
        const response = await fetch("/api/navigation-menu")
        const data = await response.json()
        if (data.success && Array.isArray(data.data)) {
          const activeItems = data.data
            .filter((item: NavigationMenuItem) => item.isActive !== false)
            .sort((a: NavigationMenuItem, b: NavigationMenuItem) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
          if (activeItems.length > 0) {
            setMenuItems(activeItems)
          }
        }
      } catch (error) {
        console.error("Failed to load navigation menu:", error)
      }
    }
    fetchMenuItems()
  }, [])

  const getFirstName = (fullname: string) => {
    return fullname.split(" ")[0]
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      setUser(null)
      router.push("/")
      router.refresh()
    } catch (error) {
      console.error("Logout failed:", error)
    }
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

  const handleSearchIconClick = () => {
    setIsSearchOpen(!isSearchOpen)
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const resolveMenuHref = (href: string) => {
    if (href === "/my-account") {
      return user ? "/customer/dashboard" : "/login"
    }
    return normalizeHomeShopHref(href)
  }

  return (
    <>
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm" style={{ borderColor: "#D9CFC7" }}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-4 -ml-3 sm:-ml-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-foreground hover:bg-[#F5EFE8] transition-all duration-300 p-0 h-14 w-14 rounded-lg font-black flex items-center justify-center group outline-none focus:outline-none focus-visible:ring-0 focus:ring-0"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? (
                  <X className="h-14 w-14 stroke-[3] group-hover:scale-110 transition-transform duration-300 text-foreground" />
                ) : (
                  <Menu className="h-14 w-14 stroke-[3] group-hover:scale-110 transition-transform duration-300 text-foreground" />
                )}
                <span className="sr-only">Menu</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-foreground hover:bg-[#F5EFE8] transition-all duration-300 relative p-0 h-14 w-14 rounded-lg font-black group flex items-center justify-center outline-none focus:outline-none focus-visible:ring-0 focus:ring-0"
                onClick={handleSearchIconClick}
              >
                <Search className="h-12 w-12 stroke-[2.5] group-hover:scale-110 transition-transform duration-300 text-foreground" />
                <span className="sr-only">Search</span>
              </Button>
            </div>

            <div className="absolute left-1/2 transform -translate-x-1/2">
              <Link href="/" className="flex items-center group overflow-hidden h-20">
                <img
                  src="/logoananthala.png"
                  alt="Ananthala Logo"
                  className="h-20 md:h-28 w-auto object-contain"
                />
              </Link>
            </div>

            <div className="flex items-center gap-4 -mr-3 sm:-mr-2">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-[#F5EFE8] transition-all duration-300 relative p-1 h-14 w-14 group outline-none focus:outline-none focus-visible:ring-0 focus:ring-0 rounded-lg"
                    >
                      <div
                        className={`w-12 h-12 rounded-full bg-gradient-to-br ${getGradientColor(
                          user.fullname,
                        )} flex items-center justify-center text-white font-black text-lg shadow-md border-2 border-white group-hover:scale-110 transition-transform duration-300`}
                      >
                        {getFirstName(user.fullname).charAt(0).toUpperCase()}
                      </div>
                      <span className="sr-only">User menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5 text-sm text-[#6D4530]">
                      <div className="font-bold">{getFirstName(user.fullname)}</div>
                      <div className="text-xs text-[#8B5A3C]/70 truncate">{user.email}</div>
                    </div>
                    <DropdownMenuItem asChild className="text-[#6D4530] cursor-pointer font-semibold">
                      <Link href="/customer/dashboard">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout} className="text-[#6D4530] cursor-pointer font-semibold">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Logout</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link href="/login">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-foreground hover:bg-[#F5EFE8] transition-all duration-300 p-0 h-14 w-14 rounded-lg font-black flex items-center justify-center group outline-none focus:outline-none focus-visible:ring-0 focus:ring-0"
                  >
                    <User className="h-12 w-12 stroke-[2.5] group-hover:scale-110 transition-transform duration-300 text-foreground" />
                    <span className="sr-only">User account</span>
                  </Button>
                </Link>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="text-foreground hover:bg-[#F5EFE8] transition-all duration-300 relative p-0 h-16 w-16 rounded-lg font-black group flex items-center justify-center outline-none focus:outline-none focus-visible:ring-0 focus:ring-0"
                onClick={() => router.push("/cart")}
              >
                <ShoppingCart className="h-14 w-14 stroke-[2.5] group-hover:scale-110 transition-transform duration-300 text-foreground" />
                {cartItems.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-br from-[#8B5A3C] to-[#6D4530] text-white text-xs font-black rounded-full min-w-[1.5rem] h-6 flex items-center justify-center px-0.5 border-2 border-white shadow-lg animate-pulse">
                    {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                )}
                <span className="sr-only">Shopping cart</span>
              </Button>
            </div>
          </div>
        </div>

      <SearchDropdown
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSearch={handleSearch}
      />

        {isMenuOpen && (
          <div
            className="fixed left-0 top-16 bottom-0 w-56 bg-white border-r shadow-lg animate-in slide-in-from-left duration-300 overflow-y-auto z-40"
            style={{ borderColor: "#D9CFC7" }}
          >
            <nav className="p-4">
              <div className="flex items-center justify-center px-2 py-5">
                <Link
                  href="/"
                  onClick={() => setIsMenuOpen(false)}
                  className="inline-flex items-center justify-center"
                >
                  <img
                    src="/logoananthala.png"
                    alt="Ananthala"
                    className="h-28 w-auto max-w-full object-contain"
                  />
                </Link>
              </div>
              <ul className="space-y-1">
                {menuItems.map((item, index) => (
                  <li key={index}>
                    <Link
                      href={resolveMenuHref(item.href)}
                      className="block py-2.5 px-4 text-foreground text-base font-medium uppercase tracking-wide hover:text-[#8B5A3C] transition-all duration-300 rounded-md"
                      onClick={(e) => {
                        setIsMenuOpen(false)
                        if (isHomeShopHref(item.href)) {
                          handleShopClick(e, router, pathname)
                        }
                      }}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        )}
      </header>

      {isSearchOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30"
          onClick={() => {
            setIsSearchOpen(false)
          }}
        />
      )}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30"
          onClick={() => {
            setIsMenuOpen(false)
          }}
        />
      )}

    </>
  )
}
