"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { UserCheck, HelpCircle, LogOut, TrendingUp, Calendar, DollarSign, Tag, ShoppingBag } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"

export default function AgentDashboard() {
  const [isVerifying, setIsVerifying] = useState(true)
  const [agentData, setAgentData] = useState<{ fullname: string; email: string } | null>(null)
  const [couponStats, setCouponStats] = useState<any>({
    totalCoupons: 0,
    activeCoupons: 0,
    expiringSoon: 0,
    totalSavings: 0,
    usedToday: 0,
    usageData: [],
    recentCoupons: [],
  })
  const [salesSummary, setSalesSummary] = useState({
    orderCount: 0,
    revenue: 0,
    discountGiven: 0,
  })
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const router = useRouter()

  const fetchCouponStats = async () => {
    try {
      setIsLoadingStats(true)
      const response = await fetch("/api/agent/coupons", {
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error("Failed to fetch coupons")
      }

      const data = await response.json()

      if (data.success && data.coupons) {
        const coupons = data.coupons
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const active = coupons.filter((c: any) => c.status === "active").length
        const expiring = coupons.filter((c: any) => {
          const expDate = new Date(c.expiryDate)
          const daysUntilExpiry = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          return daysUntilExpiry > 0 && daysUntilExpiry <= 7
        }).length

        const totalSavings = coupons.reduce((sum: number, coupon: any) => {
          if (coupon.type === "percentage") {
            return sum + coupon.discount * coupon.usedCount
          } else {
            return sum + coupon.discount * coupon.usedCount
          }
        }, 0)

        const usageData = coupons.slice(0, 5).map((c: any) => ({
          name: c.code,
          count: c.usedCount,
        }))

        setCouponStats({
          totalCoupons: coupons.length,
          activeCoupons: active,
          expiringSoon: expiring,
          totalSavings: Math.round(totalSavings),
          usedToday: coupons.reduce((sum: number, c: any) => sum + (c.usedCount || 0), 0),
          usageData,
          recentCoupons: coupons.slice(0, 3),
        })
      }

      try {
        const salesRes = await fetch("/api/agent/coupon-sales", { credentials: "include" })
        const salesData = await salesRes.json()
        if (salesRes.ok && salesData.success && salesData.summary) {
          setSalesSummary(salesData.summary)
        }
      } catch {
        /* ignore */
      }
    } catch (error) {
      console.error("Error fetching coupon stats:", error)
    } finally {
      setIsLoadingStats(false)
    }
  }

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const response = await fetch("/api/auth/agent/agent-verify", {
          credentials: "include",
        })

        if (!response.ok) {
          throw new Error("Authentication failed")
        }

        const userData = await response.json()

        if (!userData.authenticated || userData.user?.role !== "agent") {
          sessionStorage.removeItem("agent_session")
          router.replace("/agent")
          return
        }

        sessionStorage.setItem("agent_session", "active")
        setAgentData({
          fullname: userData.user.fullname,
          email: userData.user.email,
        })
        setIsVerifying(false)

        fetchCouponStats()
      } catch (error) {
        sessionStorage.removeItem("agent_session")
        router.replace("/agent")
      }
    }

    verifyAuth()

    const intervalId = setInterval(
      () => {
        verifyAuth()
      },
      30 * 60 * 1000,
    )

    return () => clearInterval(intervalId)
  }, [router])

  const handleCouponManagementClick = () => {
    router.push("/agent/coupons")
  }

  const handleLogout = async () => {
    try {
      sessionStorage.removeItem("agent_session")

      await fetch("/api/auth/agent/agent-logout", {
        method: "POST",
        credentials: "include",
      })

      router.replace("/agent")
    } catch (error) {
      router.replace("/agent")
    }
  }

  const getFirstName = (fullname: string) => {
    return fullname.split(" ")[0]
  }

  const getGradientColor = (name: string) => {
    const colors = [
      "from-blue-500 to-purple-600",
      "from-green-500 to-teal-600",
      "from-orange-500 to-red-600",
      "from-pink-500 to-rose-600",
      "from-indigo-500 to-blue-600",
      "from-yellow-500 to-orange-600",
    ]
    const index = name.charCodeAt(0) % colors.length
    return colors[index]
  }

  const statCards = useMemo(
    () => [
      {
        label: "Total Coupons",
        value: couponStats.totalCoupons,
        icon: <Tag className="w-6 h-6" />,
        color: "#8B5A3C",
        bgColor: "#F5F1ED",
      },
      {
        label: "Active Coupons",
        value: couponStats.activeCoupons,
        icon: <TrendingUp className="w-6 h-6" />,
        color: "#22C55E",
        bgColor: "#F0FDF4",
      },
      {
        label: "Sales revenue (your coupon codes)",
        value: `₹${salesSummary.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
        icon: <DollarSign className="w-6 h-6" />,
        color: "#2563EB",
        bgColor: "#EFF6FF",
      },
      {
        label: "Paid orders (your coupon codes)",
        value: salesSummary.orderCount,
        icon: <ShoppingBag className="w-6 h-6" />,
        color: "#6D4530",
        bgColor: "#F5F1ED",
      },
    ],
    [couponStats.totalCoupons, couponStats.activeCoupons, salesSummary.revenue, salesSummary.orderCount],
  )

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-[#F5F1ED] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-white shadow-lg border-2 border-[#E5D5C5] flex items-center justify-center mx-auto mb-4 animate-pulse">
            <HelpCircle className="w-8 h-8 text-[#8B5A3C]" />
          </div>
          <p className="text-[#8B5A3C] font-medium">Verifying agent access...</p>
        </div>
      </div>
    )
  }

  const COLORS = ["#8B5A3C", "#6D4530", "#A67C52", "#C89968", "#D4A574"]

  return (
    <div className="min-h-screen bg-[#F5F1ED]">
     

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h2 className="text-3xl sm:text-4xl font-semibold text-[#6D4530] mb-2">Dashboard Overview</h2>
          <p className="text-[#8B5A3C]">Manage your coupon strategy and track performance metrics</p>
        </div>

        {/* Quick Action Card */}
        
        {/* Statistics Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat, index) => (
            <div
              key={index}
              className="bg-white rounded-lg border border-[#E5D5C5] p-6 shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: stat.bgColor }}
                >
                  <div style={{ color: stat.color }}>{stat.icon}</div>
                </div>
              </div>
              <p className="text-sm text-[#8B5A3C]/70 font-medium mb-2">{stat.label}</p>
              <p className="text-3xl font-bold text-[#6D4530]">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Usage Chart */}
          <div className="bg-white rounded-lg border border-[#E5D5C5] p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-[#6D4530] mb-6">Top Coupon Usage</h3>
            {isLoadingStats ? (
              <div className="h-64 flex items-center justify-center">
                <p className="text-[#8B5A3C]/50">Loading chart...</p>
              </div>
            ) : couponStats.usageData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={couponStats.usageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5D5C5" />
                  <XAxis dataKey="name" stroke="#8B5A3C" />
                  <YAxis stroke="#8B5A3C" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#F5F1ED",
                      border: "1px solid #E5D5C5",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#6D4530" }}
                  />
                  <Bar dataKey="count" fill="#8B5A3C" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <p className="text-[#8B5A3C]/50">No coupon data available</p>
              </div>
            )}
          </div>

          {/* Coupon Status Distribution */}
          <div className="bg-white rounded-lg border border-[#E5D5C5] p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-[#6D4530] mb-6">Coupon Status</h3>
            {isLoadingStats ? (
              <div className="h-64 flex items-center justify-center">
                <p className="text-[#8B5A3C]/50">Loading chart...</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Active", value: couponStats.activeCoupons },
                      { name: "Expiring Soon", value: couponStats.expiringSoon },
                      {
                        name: "Other",
                        value: Math.max(
                          0,
                          couponStats.totalCoupons - couponStats.activeCoupons - couponStats.expiringSoon,
                        ),
                      },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8B5A3C"
                    dataKey="value"
                  >
                    {COLORS.map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#F5F1ED",
                      border: "1px solid #E5D5C5",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#6D4530" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent Coupons Section */}
        <div className="bg-white rounded-lg border border-[#E5D5C5] p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-[#6D4530] mb-6">Recent Coupons</h3>
          {isLoadingStats ? (
            <div className="h-32 flex items-center justify-center">
              <p className="text-[#8B5A3C]/50">Loading coupons...</p>
            </div>
          ) : couponStats.recentCoupons.length > 0 ? (
            <div className="space-y-3">
              {couponStats.recentCoupons.map((coupon: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-4 bg-[#F5F1ED] rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#8B5A3C]/10 flex items-center justify-center">
                      <Tag className="w-5 h-5 text-[#8B5A3C]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#6D4530]">{coupon.code}</p>
                      <p className="text-sm text-[#8B5A3C]/70">
                        {coupon.type === "percentage" ? `${coupon.discount}%` : `₹${coupon.discount}`} discount
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#6D4530]">{coupon.usedCount || 0} uses</p>
                    <p className="text-xs text-[#8B5A3C]/70">Status: {coupon.status}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center">
              <p className="text-[#8B5A3C]/50">No recent coupons available</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
