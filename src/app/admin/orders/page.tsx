"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Search, Filter, Eye, Download, MoreVertical, Truck, CheckCircle, Clock, Package, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { IndianRupee, Loader2 } from "lucide-react"
import { OrderLineItem } from "@/components/orders/order-line-item"
import { OrderItemsPreview } from "@/components/orders/order-items-preview"
import type { OrderLineItemData } from "@/lib/order-item"

interface OrderItem extends OrderLineItemData {
  size?: string
}

interface TimelineEvent {
  status: string
  timestamp: string
  description: string
}

interface Order {
  _id: string
  orderId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  orderStatus: string
  paymentStatus: string
  totalAmount: number
  items: OrderItem[]
  createdAt: string
  orderTimeline: TimelineEvent[]
  shippingAddress?: {
    houseNumber?: string
    crossStreet?: string
    locality?: string
    landmark?: string
    fullAddress: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  billingAddress?: {
    firstName?: string
    lastName?: string
    houseNumber?: string
    crossStreet?: string
    locality?: string
    landmark?: string
    fullAddress?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
  }
  trackingNumber?: string
  trackingUrl?: string
  shippingProvider?: string
}

interface Stats {
  totalOrders: number
  processedOrders: number
  deliveredOrders: number
  inTransitOrders: number
  totalRevenue: number
}

export default function OrderManagementPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isStatusUpdateModalOpen, setIsStatusUpdateModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [newStatus, setNewStatus] = useState("")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [trackingUrl, setTrackingUrl] = useState("")
  const [shippingProvider, setShippingProvider] = useState("")
  const [updateNotes, setUpdateNotes] = useState("")
  const [updateMessage, setUpdateMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    fetchOrders()
  }, [filterStatus, page])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterStatus !== "all") params.append("status", filterStatus)
      if (searchQuery) params.append("search", searchQuery)
      params.append("page", page.toString())

      const response = await fetch(`/api/admin/orders?${params}`, {
        credentials: "include",
      })
      const data = await response.json()
      setOrders(data.orders || [])
      setStats(data.stats)
    } catch (error) {
      console.error("Failed to fetch orders:", error)
    } finally {
      setLoading(false)
    }
  }

  const isTrackingNumberRequired = (status: string) => {
    return ["shipped", "in-transit", "delivered"].includes(status)
  }

  const handleUpdateStatus = async () => {
    if (!selectedOrder || !newStatus) return

    // Validate tracking number is required for shipping statuses
    if (isTrackingNumberRequired(newStatus) && !trackingNumber.trim()) {
      setUpdateMessage({ type: "error", text: "Tracking number is required for this status." })
      return
    }

    try {
      setUpdatingOrderId(selectedOrder._id)
      const response = await fetch(`/api/admin/orders/${selectedOrder._id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderStatus: newStatus,
          trackingNumber: trackingNumber || undefined,
          trackingUrl: trackingUrl || undefined,
          shippingProvider: shippingProvider || undefined,
          notes: updateNotes || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update order status")
      }

      const data = await response.json()
      setUpdateMessage({ type: "success", text: "Order status updated successfully!" })
      
      // Update the selected order
      setSelectedOrder(data.order)
      
      // Refresh orders list
      await fetchOrders()
      
      // Reset form
      setNewStatus("")
      setTrackingNumber("")
      setTrackingUrl("")
      setShippingProvider("")
      setUpdateNotes("")
      
      // Close status update modal after a short delay
      setTimeout(() => {
        setIsStatusUpdateModalOpen(false)
        setUpdateMessage(null)
      }, 1500)
    } catch (error) {
      console.error("Failed to update order:", error)
      setUpdateMessage({ type: "error", text: "Failed to update order status. Please try again." })
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const openStatusUpdateModal = (order: Order) => {
    setSelectedOrder(order)
    setNewStatus(order.orderStatus || "pending")
    setTrackingNumber("")
    setUpdateNotes("")
    setUpdateMessage(null)
    setIsStatusUpdateModalOpen(true)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchOrders()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "bg-green-100 text-green-700"
      case "in-transit":
        return "bg-blue-100 text-blue-700"
      case "processing":
        return "bg-yellow-100 text-yellow-700"
      case "shipped":
        return "bg-purple-100 text-purple-700"
      case "pending":
        return "bg-gray-100 text-gray-700"
      case "payment_failed":
        return "bg-red-100 text-red-700"
      case "cancelled":
        return "bg-orange-100 text-orange-700"
      default:
        return "bg-red-100 text-red-700"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return <CheckCircle className="w-4 h-4" />
      case "in-transit":
        return <Truck className="w-4 h-4" />
      case "processing":
        return <Package className="w-4 h-4" />
      case "shipped":
        return <Truck className="w-4 h-4" />
      case "payment_failed":
        return <AlertCircle className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const statCards = [
    {
      label: "Total Orders",
      value: stats?.totalOrders || 0,
      color: "bg-blue-50 border-blue-200",
      icon: Package,
      textColor: "text-blue-700",
    },
    {
      label: "Processing",
      value: stats?.processedOrders || 0,
      color: "bg-yellow-50 border-yellow-200",
      icon: Package,
      textColor: "text-yellow-700",
    },
    {
      label: "In Transit",
      value: stats?.inTransitOrders || 0,
      color: "bg-purple-50 border-purple-200",
      icon: Truck,
      textColor: "text-purple-700",
    },
    {
      label: "Delivered",
      value: stats?.deliveredOrders || 0,
      color: "bg-green-50 border-green-200",
      icon: CheckCircle,
      textColor: "text-green-700",
    },
  ]

  const formatAddressLines = (address?: {
    houseNumber?: string
    crossStreet?: string
    locality?: string
    landmark?: string
    fullAddress?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
  }) => {
    if (!address) return []
    const line1 = [address.houseNumber, address.crossStreet].filter(Boolean).join(", ")
    const line2 = [address.locality, address.landmark].filter(Boolean).join(", ")
    const line3 = [address.city, address.state, address.zipCode, address.country].filter(Boolean).join(", ")
    const fallback = [address.fullAddress, [address.city, address.state].filter(Boolean).join(", "), address.zipCode, address.country]
      .filter(Boolean)
      .join(", ")
    return [line1, line2, line3].filter(Boolean).length > 0 ? [line1, line2, line3].filter(Boolean) : fallback ? [fallback] : []
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-2xl font-semibold text-foreground">Order Management</h1>
          <p className="text-foreground/70 mt-1">Track and manage all customer orders</p>
        </div>
        <Button className="bg-[#8B5A3C] hover:bg-[#6D4530] text-white">
          <Download className="w-4 h-4 mr-2" />
          Export Orders
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className={`${stat.color} border rounded-lg p-6 transition-all hover:shadow-md`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-foreground/70 text-sm font-medium">{stat.label}</p>
                  <p className={`text-2xl font-bold mt-2 ${stat.textColor}`}>{stat.value}</p>
                </div>
                <Icon className={`w-8 h-8 ${stat.textColor}/30`} />
              </div>
            </div>
          )
        })}

        {stats && (
          <div className="bg-gradient-to-r from-[#8B5A3C] to-[#6D4530] rounded-lg p-6 text-white border border-[#8B5A3C]">
            <p className="text-white/70 text-sm font-medium">Total Revenue</p>
            <div className="flex items-center gap-2 mt-2">
              <IndianRupee className="w-6 h-6" />
              <p className="text-2xl font-bold">
                {stats.totalRevenue.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 space-y-4" style={{ borderColor: "#D9CFC7" }}>
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/50 w-4 h-4" />
            <Input
              placeholder="Search by order ID or customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="in-transit">In Transit</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" className="bg-[#8B5A3C] hover:bg-[#6D4530] text-white w-full sm:w-auto">
            Search
          </Button>
        </form>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#D9CFC7" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F5F1ED]">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Order ID</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Customer</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Items</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Total</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Date</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "#D9CFC7" }}>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-foreground/70">
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-foreground/70">
                    No orders found
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const status = order.orderStatus || "pending"
                  return (
                    <tr key={order._id} className="hover:bg-[#F5F1ED]/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-mono text-sm text-foreground">{order.orderId}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-foreground">{order.customerName}</div>
                          <div className="text-xs text-foreground/70">{order.customerEmail}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-foreground">
                        {Array.isArray(order.items) && order.items.length > 0 ? (
                          <OrderItemsPreview items={order.items} />
                        ) : (
                          <span className="text-foreground/70">0 items</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-foreground flex items-center gap-1">
                          <IndianRupee className="w-4 h-4" />
                          {order.totalAmount.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div
                          className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium w-fit ${getStatusColor(status)}`}
                        >
                          {getStatusIcon(status)}
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-foreground">
                        {new Date(order.createdAt).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedOrder(order)
                                setIsDetailModalOpen(true)
                              }}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openStatusUpdateModal(order)}>
                              <Truck className="w-4 h-4 mr-2" />
                              Update Status
                            </DropdownMenuItem>
                            
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: "#D9CFC7" }}>
          <div className="text-sm text-foreground/70">
            Showing {orders.length > 0 ? (page - 1) * 10 + 1 : 0} - {Math.min(page * 10, stats?.totalOrders || 0)} of{" "}
            {stats?.totalOrders || 0} orders
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled>
              Page {page}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={orders.length < 10}>
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Order Details Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Order Details</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Order Header */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-[#F5F1ED] rounded-lg">
                <div>
                  <p className="text-xs text-foreground/70 font-medium">Order ID</p>
                  <p className="text-lg font-semibold text-foreground">{selectedOrder.orderId}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground/70 font-medium">Order Date</p>
                  <p className="text-lg font-semibold text-foreground">
                    {new Date(selectedOrder.createdAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
              </div>

              {/* Customer Information */}
              <div>
                <h3 className="font-semibold text-foreground mb-3">Customer Information</h3>
                <div className="space-y-2 text-sm">
                  <p className="text-foreground">
                    <span className="font-medium">Name:</span> {selectedOrder.customerName}
                  </p>
                  <p className="text-foreground">
                    <span className="font-medium">Email:</span> {selectedOrder.customerEmail}
                  </p>
                  <p className="text-foreground">
                    <span className="font-medium">Phone:</span> {selectedOrder.customerPhone}
                  </p>
                </div>
              </div>

              {(selectedOrder.shippingAddress || selectedOrder.billingAddress) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedOrder.shippingAddress && (
                    <div className="p-4 bg-[#F5F1ED] rounded-lg">
                      <h3 className="font-semibold text-foreground mb-2">Shipping Address</h3>
                      <div className="text-sm text-foreground/90 space-y-1">
                        {formatAddressLines(selectedOrder.shippingAddress).map((line, idx) => (
                          <p key={`shipping-line-${idx}`}>{line}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedOrder.billingAddress && (
                    <div className="p-4 bg-[#F5F1ED] rounded-lg">
                      <h3 className="font-semibold text-foreground mb-2">Billing Address</h3>
                      {(selectedOrder.billingAddress.firstName || selectedOrder.billingAddress.lastName) && (
                        <p className="text-sm text-foreground/90 mb-1">
                          {[selectedOrder.billingAddress.firstName, selectedOrder.billingAddress.lastName].filter(Boolean).join(" ")}
                        </p>
                      )}
                      <div className="text-sm text-foreground/90 space-y-1">
                        {formatAddressLines(selectedOrder.billingAddress).map((line, idx) => (
                          <p key={`billing-line-${idx}`}>{line}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Order Items */}
              <div>
                <h3 className="font-semibold text-foreground mb-3">Order Items</h3>
                <div className="space-y-3">
                  {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 ? (
                    selectedOrder.items.map((item, index) => (
                      <div
                        key={index}
                        className="p-4 border rounded-lg hover:bg-[#F9F7F4] transition-colors"
                        style={{ borderColor: "#D9CFC7" }}
                      >
                        <OrderLineItem item={item} thumbnailSize="md" />
                      </div>
                    ))
                  ) : (
                    <p className="text-foreground/70">No items in this order</p>
                  )}
                </div>
              </div>

              {/* Order Timeline */}
              <div>
                <h3 className="font-semibold text-foreground mb-3">Order Journey</h3>
                <div className="space-y-3">
                  {Array.isArray(selectedOrder.orderTimeline) && selectedOrder.orderTimeline.length > 0 ? (
                    selectedOrder.orderTimeline.map((event, index) => (
                      <div key={index} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-4 h-4 rounded-full bg-[#8B5A3C] mt-1" />
                          {index < selectedOrder.orderTimeline!.length - 1 && (
                            <div className="w-0.5 h-12 bg-[#D9CFC7]" />
                          )}
                        </div>
                        <div className="flex-1 pt-1">
                          <p className="font-medium text-foreground">{event.status}</p>
                          <p className="text-sm text-foreground/70">{event.description}</p>
                          <p className="text-xs text-foreground/50">
                            {new Date(event.timestamp).toLocaleString("en-IN")}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-foreground/70">No timeline events yet</p>
                  )}
                </div>
              </div>

              {/* Order Summary */}
              <div className="p-4 bg-[#F5F1ED] rounded-lg space-y-2">
                <div className="flex justify-between text-foreground">
                  <span>Subtotal:</span>
                  <span className="flex items-center gap-1">
                    <IndianRupee className="w-4 h-4" />
                    {Array.isArray(selectedOrder.items)
                      ? selectedOrder.items
                          .reduce((sum, item) => sum + item.price * item.quantity, 0)
                          .toLocaleString("en-IN")
                      : "0.00"}
                  </span>
                </div>
                <div className="flex justify-between text-foreground">
                  <span>Shipping:</span>
                  <span className="flex items-center gap-1">
                    <IndianRupee className="w-4 h-4" />
                    0.00
                  </span>
                </div>
                <div
                  className="border-t pt-2 flex justify-between font-semibold text-foreground"
                  style={{ borderColor: "#D9CFC7" }}
                >
                  <span>Total:</span>
                  <span className="flex items-center gap-1">
                    <IndianRupee className="w-4 h-4" />
                    {selectedOrder.totalAmount
                      ? selectedOrder.totalAmount.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : "0.00"}
                  </span>
                </div>
              </div>

              {/* Order Status Badge */}
              <div className="flex items-center justify-between p-4 bg-[#F5F1ED] rounded-lg">
                <div>
                  <p className="text-xs text-foreground/70 font-medium">Current Status</p>
                  <p
                    className={`text-lg font-semibold mt-1 flex items-center gap-2 ${getStatusColor(
                      selectedOrder.orderStatus || "pending",
                    )
                      .replace("px-", "")
                      .replace("py-", "")}`}
                  >
                    {getStatusIcon(selectedOrder.orderStatus || "pending")}
                    {(selectedOrder.orderStatus || "pending").charAt(0).toUpperCase() +
                      (selectedOrder.orderStatus || "pending").slice(1)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Status Update Modal */}
      <Dialog open={isStatusUpdateModalOpen} onOpenChange={setIsStatusUpdateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Update Order Status</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              {/* Order ID Display */}
              <div className="p-3 bg-[#F5F1ED] rounded-lg">
                <p className="text-xs text-foreground/70 font-medium">Order ID</p>
                <p className="font-mono text-sm font-semibold text-foreground">{selectedOrder.orderId}</p>
              </div>

              {/* Current Status Display */}
              <div className="p-3 bg-[#F5F1ED] rounded-lg">
                <p className="text-xs text-foreground/70 font-medium">Current Status</p>
                <div className={`text-sm font-semibold mt-1 flex items-center gap-2 w-fit px-2 py-1 rounded ${getStatusColor(selectedOrder.orderStatus || "pending")}`}>
                  {getStatusIcon(selectedOrder.orderStatus || "pending")}
                  {(selectedOrder.orderStatus || "pending").charAt(0).toUpperCase() + (selectedOrder.orderStatus || "pending").slice(1)}
                </div>
              </div>

              {/* Status Update Alert */}
              {updateMessage && (
                <Alert className={updateMessage.type === "success" ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}>
                  <AlertCircle className={`h-4 w-4 ${updateMessage.type === "success" ? "text-green-600" : "text-red-600"}`} />
                  <AlertDescription className={updateMessage.type === "success" ? "text-green-700" : "text-red-700"}>
                    {updateMessage.text}
                  </AlertDescription>
                </Alert>
              )}

              {/* New Status Select */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">New Status</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select new status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="order_received">Order Received</SelectItem>
                    <SelectItem value="order_processing">Order Processing</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="in-transit">In Transit</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tracking Number Input */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-foreground">
                    Tracking Number {isTrackingNumberRequired(newStatus) ? <span className="text-red-500">*</span> : <span className="text-foreground/50">(Optional)</span>}
                  </label>
                </div>
                {isTrackingNumberRequired(newStatus) && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-xs text-blue-700">
                      <span className="font-semibold">Required:</span> Tracking number is mandatory for shipping status updates.
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      <span className="font-semibold">Tip:</span> Enter your ShipRocket tracking number. Customers will receive a link:
                    </p>
                    <p className="text-xs text-blue-600 mt-1 break-words font-mono">
                      shiprocket.co/tracking/[TRACKING_NUMBER]
                    </p>
                  </div>
                )}
                <Input
                  placeholder={isTrackingNumberRequired(newStatus) ? "Enter ShipRocket tracking number (required)" : "Enter tracking number (optional)"}
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className={`w-full ${isTrackingNumberRequired(newStatus) && !trackingNumber ? "border-red-300 focus:ring-red-200" : ""}`}
                  required={isTrackingNumberRequired(newStatus)}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Shipping Provider</label>
                  <Input placeholder="Shiprocket, Delhivery..." value={shippingProvider} onChange={(e) => setShippingProvider(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Tracking URL</label>
                  <Input type="url" placeholder="https://..." value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} />
                </div>
              </div>

              <div className="rounded-md border border-[#D9CFC7] bg-muted/30 p-3 text-sm text-foreground">
                WhatsApp preview: <span className="font-medium">{newStatus.replaceAll("_", " ").replace("-", " ")}</span> update for {selectedOrder.customerName}, including tracking details when available.
              </div>

              {/* Update Notes Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Notes (Optional)</label>
                <textarea
                  placeholder="Add any notes about this status update..."
                  value={updateNotes}
                  onChange={(e) => setUpdateNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm border-[#D9CFC7] focus:outline-none focus:ring-2 focus:ring-[#8B5A3C]/20"
                  rows={3}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsStatusUpdateModalOpen(false)}
                  disabled={updatingOrderId === selectedOrder._id}
                  className="border-[#D9CFC7]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateStatus}
                  disabled={!newStatus || updatingOrderId === selectedOrder._id || (isTrackingNumberRequired(newStatus) && !trackingNumber.trim())}
                  className="bg-[#8B5A3C] hover:bg-[#6D4530] text-white"
                >
                  {updatingOrderId === selectedOrder._id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Status"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
