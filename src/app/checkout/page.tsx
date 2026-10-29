"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import Image from "next/image"
import { IndianRupee, ShoppingCart, ChevronRight, MapPin, Check, AlertCircle, Building2, ShieldCheck, Package, CreditCard } from "lucide-react"
import { useCart } from "@/contexts/cart-context"
import { getAllStates, getCitiesForState } from "@/lib/indian-states-cities"
import { useToast } from "@/hooks/use-toast"
import { CountryCodeSelect } from "@/components/ui/country-code-select"
import { DEFAULT_COUNTRY_CODE } from "@/lib/country-codes"
import { splitPhoneNumber, withCountryCode } from "@/lib/phone"

interface SavedAddress {
  _id: string
  label: string
  houseNumber: string
  crossStreet: string
  locality: string
  landmark?: string
  city: string
  state: string
  pincode: string
  country: string
  isDefault?: boolean
}

interface UserProfile {
  fullname: string
  email: string
  phone: string
  addresses: SavedAddress[]
}

interface AvailableCoupon {
  code: string
  type: "percentage" | "fixed"
  discount: number
  maxDiscount: number | null
  minPurchase: number
  expiryDate: string
}

declare global {
  interface Window {
    Razorpay?: any
  }
}

const ORDER_PROCESSING_STEPS = [
  { icon: CreditCard, label: "Payment received" },
  { icon: ShieldCheck, label: "Verifying payment securely" },
  { icon: Package, label: "Confirming your order" },
]

/**
 * Full-screen overlay shown from the moment Razorpay reports a successful payment
 * until the order-success page has loaded. It also hides the brief "cart empty"
 * state that would otherwise flash after the cart is cleared.
 */
function OrderProcessingOverlay() {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveStep((prev) => (prev < ORDER_PROCESSING_STEPS.length - 1 ? prev + 1 : prev))
    }, 1400)

    // Prevent background scrolling while the overlay is visible
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      window.clearInterval(interval)
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#F5F1ED]/95 backdrop-blur-sm px-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-[#E5D5C5] px-8 py-10 text-center">
        {/* Animated spinner with icon */}
        <div className="relative mx-auto mb-8 h-28 w-28">
          <div className="absolute inset-0 rounded-full border-[6px] border-[#EED9C4]" />
          <div className="absolute inset-0 rounded-full border-[6px] border-transparent border-t-[#6D4530] border-r-[#8B5A3C] animate-spin" />
          <div
            className="absolute inset-3 rounded-full border-4 border-transparent border-b-[#D9BB9B] animate-spin"
            style={{ animationDirection: "reverse", animationDuration: "1.6s" }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F5F1ED] animate-pulse">
              <ShoppingCart className="h-7 w-7 text-[#6D4530]" />
            </div>
          </div>
        </div>

        <h2 className="text-2xl md:text-3xl font-serif text-[#6D4530] mb-2">Placing your order</h2>
        <p className="text-sm md:text-base text-[#8B5A3C] mb-8">
          Please don&apos;t close or refresh this page. This will only take a moment.
        </p>

        {/* Progress steps */}
        <ul className="space-y-3 text-left">
          {ORDER_PROCESSING_STEPS.map((step, index) => {
            const isDone = index < activeStep
            const isActive = index === activeStep
            const StepIcon = step.icon
            return (
              <li
                key={step.label}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-500 ${
                  isActive
                    ? "bg-[#F5F1ED] border border-[#D9BB9B]"
                    : isDone
                      ? "bg-white border border-[#E5D5C5]"
                      : "bg-white border border-transparent opacity-50"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-500 ${
                    isDone ? "bg-green-600 text-white" : isActive ? "bg-[#6D4530] text-white" : "bg-[#EED9C4] text-[#6D4530]"
                  }`}
                >
                  {isDone ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                </span>
                <span className={`text-sm md:text-base ${isActive ? "font-semibold text-[#6D4530]" : "text-[#8B5A3C]"}`}>
                  {step.label}
                </span>
                {isActive && (
                  <span className="ml-auto flex gap-1" aria-hidden="true">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#6D4530] animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#6D4530] animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#6D4530] animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                )}
              </li>
            )
          })}
        </ul>

        <p className="mt-8 flex items-center justify-center gap-2 text-xs text-[#B8A396]">
          <ShieldCheck className="h-4 w-4" />
          Secured by Razorpay
        </p>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  const router = useRouter()
  const { cartItems, clearCart, appliedCoupons, setAppliedCoupon, clearCoupon } = useCart()
  const [isProcessing, setIsProcessing] = useState(false)
  // True from successful Razorpay payment until we navigate to the success page
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [isAuthChecking, setIsAuthChecking] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [allStates, setAllStates] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [couponCode, setCouponCode] = useState("")
  const [couponError, setCouponError] = useState("")
  const [availableCoupons, setAvailableCoupons] = useState<AvailableCoupon[]>([])
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE)
  const { toast } = useToast()
  
  // Saved address states
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [useNewAddress, setUseNewAddress] = useState(false)
  const [saveNewAddress, setSaveNewAddress] = useState(false)
  const [addressLabel, setAddressLabel] = useState("Home")
  
  // Billing address states
  const [billingDifferent, setBillingDifferent] = useState(false)
  const [billingAllStates, setBillingAllStates] = useState<string[]>([])
  
  // GST states
  const [hasGST, setHasGST] = useState(false)
  const [gstNumber, setGstNumber] = useState("")
  const [companyName, setCompanyName] = useState("")
  
  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    houseNumber: "",
    crossStreet: "",
    landmark: "",
    locality: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "India",
    paymentMethod: "razorpay",
  })

  const [billingData, setBillingData] = useState({
    firstName: "",
    lastName: "",
    houseNumber: "",
    crossStreet: "",
    landmark: "",
    locality: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "India",
  })

  const buildFullAddress = ({
    houseNumber,
    crossStreet,
    locality,
    landmark,
  }: {
    houseNumber: string
    crossStreet: string
    locality: string
    landmark?: string
  }) =>
    [houseNumber, crossStreet, locality, landmark]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(", ")

  const loadRazorpayScript = () =>
    new Promise<boolean>((resolve) => {
      if (typeof window === "undefined") {
        resolve(false)
        return
      }
      if (window.Razorpay) {
        resolve(true)
        return
      }
      const script = document.createElement("script")
      script.src = "https://checkout.razorpay.com/v1/checkout.js"
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })

useEffect(() => {
    const ensureAuthenticated = async () => {
      try {
        const response = await fetch("/api/auth/verify", {
          credentials: "include",
        })
        const data = await response.json()
        if (!data?.success) {
          setIsAuthChecking(false)
          router.replace("/login?redirect=/checkout")
          return
        }
        // User is authenticated
        setIsAuthenticated(true)
        setIsAuthChecking(false)
        
        // Fetch user profile with saved addresses
        fetchUserProfile()
      } catch (error) {
        console.error("[Checkout] Auth check error:", error)
        setIsAuthChecking(false)
        router.replace("/login?redirect=/checkout")
      }
    }

    ensureAuthenticated()
    // Prefetch the success page so the redirect after payment is instant
    router.prefetch("/checkout/success")
  }, [router])

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch("/api/coupons/available")
        const data = await response.json()
        if (!cancelled && data.success && Array.isArray(data.coupons)) {
          setAvailableCoupons(data.coupons)
        }
      } catch {
        if (!cancelled) setAvailableCoupons([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  // Fetch user profile and saved addresses
  const fetchUserProfile = async () => {
    try {
      const response = await fetch("/api/customer/profile", {
        credentials: "include",
      })
      const data = await response.json()
      if (data.success && data.user) {
        setUserProfile(data.user)
        
        // Pre-fill name, email, phone from profile
        const nameParts = data.user.fullname?.split(" ") || []
        const splitPhone = splitPhoneNumber(data.user.phone || "", DEFAULT_COUNTRY_CODE)
        setCountryCode(splitPhone.countryCode)
        setFormData(prev => ({
          ...prev,
          firstName: nameParts[0] || "",
          lastName: nameParts.slice(1).join(" ") || "",
          email: data.user.email || "",
          phone: splitPhone.localNumber,
        }))
        
        // If user has saved addresses, select the default one or first one
        if (data.user.addresses && data.user.addresses.length > 0) {
          const defaultAddr = data.user.addresses.find((a: SavedAddress) => a.isDefault) || data.user.addresses[0]
          if (defaultAddr) {
            setSelectedAddressId(defaultAddr._id)
            applySelectedAddress(defaultAddr)
          }
        } else {
          setUseNewAddress(true)
        }
      }
    } catch (error) {
      console.error("Error fetching user profile:", error)
    }
  }

  // Apply selected address to form
  const applySelectedAddress = async (address: SavedAddress) => {
    const fullAddress = buildFullAddress({
      houseNumber: address.houseNumber,
      crossStreet: address.crossStreet,
      locality: address.locality,
      landmark: address.landmark,
    })
    
    setFormData(prev => ({
      ...prev,
      houseNumber: address.houseNumber || "",
      crossStreet: address.crossStreet || "",
      landmark: address.landmark || "",
      locality: address.locality || "",
      address: fullAddress,
      city: address.city,
      state: address.state,
      zipCode: address.pincode,
      country: address.country || "India",
    }))
    
    // Update billing states if needed
    setBillingAllStates(await getAllStates())
  }

  // Handle saved address selection
  const handleAddressSelection = (addressId: string) => {
    if (addressId === "new") {
      setUseNewAddress(true)
      setSelectedAddressId(null)
      setFormData(prev => ({
        ...prev,
        houseNumber: "",
        crossStreet: "",
        landmark: "",
        locality: "",
        address: "",
        city: "",
        state: "",
        zipCode: "",
      }))
    } else {
      setUseNewAddress(false)
      setSelectedAddressId(addressId)
      const selectedAddr = userProfile?.addresses.find(a => a._id === addressId)
      if (selectedAddr) {
        applySelectedAddress(selectedAddr)
      }
    }
  }

  // Load states data from package
  useEffect(() => {
    const loadStates = async () => {
      try {
        const states = await getAllStates()
        setAllStates(states)
      } catch (error) {
        console.error("Error loading states data:", error)
      }
    }
    loadStates()
  }, [])

// Load billing states
  useEffect(() => {
    const loadBillingStates = async () => {
      try {
        const states = await getAllStates()
        setBillingAllStates(states)
      } catch (error) {
        console.error("Error loading billing states:", error)
      }
    }
    if (billingDifferent) {
      loadBillingStates()
    }
  }, [billingDifferent])

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )
  
  // Calculate total quantity of all items
  const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  
  // Check if address is properly filled
  const isAddressComplete =
    formData.houseNumber.trim() &&
    formData.crossStreet.trim() &&
    formData.locality.trim() &&
    formData.state &&
    formData.city &&
    formData.zipCode &&
    /^\d{6}$/.test(formData.zipCode)
  
  // Shipping is FREE for all orders
  const shipping = 0
  
  // Calculate total discount from all applied coupons
  const totalDiscount = appliedCoupons.reduce((sum, coupon) => sum + coupon.discountAmount, 0)
  const total = subtotal - totalDiscount + shipping

  const applyCoupon = async (codeOverride?: string) => {
    const entered = (codeOverride ?? couponCode).trim()
    if (!entered) {
      setCouponError("Please enter a coupon code")
      return
    }

    if (appliedCoupons.length >= 1) {
      setCouponError("Only one coupon can be applied per order")
      return
    }

    if (cartItems.length === 0) {
      setCouponError("Your cart is empty")
      return
    }

    const normalized = entered.toUpperCase()
    if (appliedCoupons.find((c) => c.code === normalized)) {
      setCouponError("This coupon is already applied")
      return
    }

    try {
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: entered,
          subtotal: subtotal,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setAppliedCoupon({
          code: normalized,
          discountAmount: data.coupon.discountAmount,
          type: data.coupon.type,
          discount: data.coupon.discount,
        })
        setCouponCode("")
        setCouponError("")
      } else {
        setCouponError(data.error || "Invalid coupon code")
      }
    } catch (error) {
      console.error("Error validating coupon:", error)
      setCouponError("Error validating coupon. Please try again.")
    }
  }

  const removeCoupon = (couponCode: string) => {
    clearCoupon(couponCode)
  }

const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
      // Reset city when state changes
      ...(name === "state" && { city: "" }),
    })
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: "" }))
    }
  }

  const handleBillingInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setBillingData({
      ...billingData,
      [name]: value,
      ...(name === "state" && { city: "" }),
    })
    // Clear field error when user starts typing
    const billingFieldName = `billing_${name}`
    if (fieldErrors[billingFieldName]) {
      setFieldErrors(prev => ({ ...prev, [billingFieldName]: "" }))
    }
  }

  // Validate GST number format (Indian GST)
  const validateGSTNumber = (gst: string) => {
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
    return gstRegex.test(gst.toUpperCase())
  }

  // Validate all required fields
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    
    // Required shipping fields
    if (!formData.firstName.trim()) errors.firstName = "First name is required"
    // lastName is optional - no validation required
    if (!formData.email.trim()) errors.email = "Email is required"
    else if (!/^\S+@\S+\.\S+$/.test(formData.email)) errors.email = "Invalid email format"
    if (!formData.phone.trim()) errors.phone = "Phone number is required"
    else if (!/^\d{6,15}$/.test(formData.phone.replace(/\D/g, ""))) errors.phone = "Invalid phone number"
    if (!formData.houseNumber.trim()) errors.houseNumber = "House number is required"
    if (!formData.crossStreet.trim()) errors.crossStreet = "Street is required"
    if (!formData.locality.trim()) errors.locality = "Area / Locality is required"
    if (!formData.state) errors.state = "State is required"
    if (!formData.city) errors.city = "City is required"
    if (!formData.zipCode.trim()) errors.zipCode = "ZIP code is required"
    else if (!/^\d{6}$/.test(formData.zipCode)) errors.zipCode = "ZIP code must be 6 digits"
    if (!formData.country.trim()) errors.country = "Country is required"
    
    // Billing address validation if different
    if (billingDifferent) {
      if (!billingData.firstName.trim()) errors.billing_firstName = "First name is required"
      // billing lastName is optional - no validation required
      if (!billingData.houseNumber.trim()) errors.billing_houseNumber = "House number is required"
      if (!billingData.crossStreet.trim()) errors.billing_crossStreet = "Street is required"
      if (!billingData.locality.trim()) errors.billing_locality = "Area / Locality is required"
      if (!billingData.state) errors.billing_state = "State is required"
      if (!billingData.city) errors.billing_city = "City is required"
      if (!billingData.zipCode.trim()) errors.billing_zipCode = "ZIP code is required"
      else if (!/^\d{6}$/.test(billingData.zipCode)) errors.billing_zipCode = "ZIP code must be 6 digits"
      if (!billingData.country.trim()) errors.billing_country = "Country is required"
    }
    
    // GST validation if provided
    if (hasGST) {
      if (!gstNumber.trim()) errors.gstNumber = "GST number is required"
      else if (!validateGSTNumber(gstNumber)) errors.gstNumber = "Invalid GST number format"
      if (!companyName.trim()) errors.companyName = "Company name is required for GST"
    }
    
    setFieldErrors(errors)
    
    if (Object.keys(errors).length > 0) {
      // Focus on first error field
      const firstErrorField = Object.keys(errors)[0]
      const element = document.querySelector(`[name="${firstErrorField.replace('billing_', '')}"]`)
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" })
      }
      
      toast({
        title: "Please fill all required fields",
        description: "Some mandatory fields are missing or invalid.",
        variant: "destructive",
      })
      return false
    }
    
    return true
  }

  const saveAddressForFutureOrders = async (fullPhone: string) => {
    const profileResponse = await fetch("/api/customer/profile", {
      credentials: "include",
    })
    const profileData = await profileResponse.json()
    if (!profileResponse.ok || !profileData?.success || !profileData?.user) {
      throw new Error(profileData?.message || "Failed to load profile before saving address.")
    }

    const existingAddresses = Array.isArray(profileData.user.addresses) ? profileData.user.addresses : []
    const normalizedAddressLabel = addressLabel?.trim() || "Home"
    const newAddressData = {
      label: normalizedAddressLabel,
      houseNumber: formData.houseNumber,
      crossStreet: formData.crossStreet,
      locality: formData.locality,
      landmark: formData.landmark || "",
      city: formData.city,
      state: formData.state,
      pincode: formData.zipCode,
      country: formData.country || "India",
      isDefault: existingAddresses.length === 0,
    }

    const saveAddressResponse = await fetch("/api/customer/profile", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: fullPhone,
        addresses: [...existingAddresses, newAddressData],
      }),
    })

    const saveAddressData = await saveAddressResponse.json()
    if (!saveAddressResponse.ok || !saveAddressData?.success) {
      throw new Error(saveAddressData?.message || "Failed to save address.")
    }

    if (saveAddressData?.user) {
      setUserProfile(saveAddressData.user)
    }
  }

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (cartItems.length === 0) {
      setErrorMessage("Your cart is empty. Add items before checkout.")
      toast({
        title: "Cart is empty",
        description: "Please add products to your cart before paying.",
        variant: "destructive",
      })
      return
    }
    
    // Validate form before processing
    if (!validateForm()) {
      return
    }
    
    setIsProcessing(true)
    setErrorMessage(null)

    try {
      const scriptLoaded = await loadRazorpayScript()
      if (!scriptLoaded) {
        throw new Error("Razorpay SDK failed to load. Please try again.")
      }
      if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
        throw new Error("Razorpay key is missing. Please configure NEXT_PUBLIC_RAZORPAY_KEY_ID.")
      }

      const orderResponse = await fetch("/api/payments/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Math.round(total * 100),
          currency: "INR",
          receipt: `order_${Date.now()}`,
          notes: {
            customer: `${formData.firstName} ${formData.lastName}`.trim(),
            email: formData.email,
          },
        }),
      })

      const orderData = await orderResponse.json()
      if (!orderResponse.ok || !orderData?.order?.id) {
        throw new Error(orderData?.message || "Failed to create payment order.")
      }

    const fullPhone = withCountryCode(`${countryCode}${formData.phone}`, countryCode)

    const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: "Ananthala",
        description: "Order Payment",
        image: "/logo.png",
        order_id: orderData.order.id,
        prefill: {
          name: `${formData.firstName} ${formData.lastName}`.trim(),
          email: formData.email,
          contact: fullPhone,
        },
        notes: {
          address: buildFullAddress({
            houseNumber: formData.houseNumber,
            crossStreet: formData.crossStreet,
            locality: formData.locality,
            landmark: formData.landmark,
          }),
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
        },
        handler: async (response: any) => {
          // Payment succeeded in Razorpay — show the order-processing overlay immediately
          setIsPlacingOrder(true)
          try {
            // Save new address if user selected that option
            if (useNewAddress && saveNewAddress) {
              try {
                await saveAddressForFutureOrders(fullPhone)
                toast({
                  title: "Address Saved",
                  description: `${addressLabel} address has been saved for future orders.`,
                })
              } catch (addressError) {
                console.error("[v0] Error saving address:", addressError)
                toast({
                  title: "Address not saved",
                  description: "Your order will continue, but we could not save this address for future orders.",
                  variant: "destructive",
                })
              }
            }

            const verifyResponse = await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                customer: {
                  firstName: formData.firstName,
                  lastName: formData.lastName,
                  email: formData.email,
                  phone: fullPhone,
                },
shippingAddress: {
                  houseNumber: formData.houseNumber,
                  crossStreet: formData.crossStreet,
                  locality: formData.locality,
                  landmark: formData.landmark,
                  address: buildFullAddress({
                    houseNumber: formData.houseNumber,
                    crossStreet: formData.crossStreet,
                    locality: formData.locality,
                    landmark: formData.landmark,
                  }),
                  city: formData.city,
                  state: formData.state,
                  zipCode: formData.zipCode,
                  country: formData.country,
                },
                billingAddress: billingDifferent ? {
                  firstName: billingData.firstName,
                  lastName: billingData.lastName,
                  houseNumber: billingData.houseNumber,
                  crossStreet: billingData.crossStreet,
                  locality: billingData.locality,
                  landmark: billingData.landmark,
                  address: buildFullAddress({
                    houseNumber: billingData.houseNumber,
                    crossStreet: billingData.crossStreet,
                    locality: billingData.locality,
                    landmark: billingData.landmark,
                  }),
                  city: billingData.city,
                  state: billingData.state,
                  zipCode: billingData.zipCode,
                  country: billingData.country,
                } : null,
                gstDetails: hasGST ? {
                  gstNumber: gstNumber.toUpperCase(),
                  companyName: companyName,
                } : null,
                items: cartItems.map((item) => ({
                  id: item.id,
                  productId: item.productId,
                  name: item.name,
                  image: item.image,
                  slug: item.slug,
                  quantity: item.quantity,
                  price: item.price,
                  size: item.size,
                  fabric: item.fabric,
                  productColor: item.productColor,
                  productColorHex: item.productColorHex,
                  complementaryItems: item.complementaryItems && item.complementaryItems.length > 0 
                    ? item.complementaryItems.map((comp) => ({
                        id: comp.id,
                        name: comp.name,
                      }))
                    : undefined,
                })),
                subtotal,
                shippingCost: shipping,
      discount: totalDiscount,
      appliedCoupons: appliedCoupons.map((c) => c.code).join(", "),
                totalAmount: total,
                paymentMethod: formData.paymentMethod,
              }),
            })

            const verifyData = await verifyResponse.json()
            if (!verifyResponse.ok || !verifyData?.success) {
              throw new Error(verifyData?.message || "Payment verification failed.")
            }

            const orderId = verifyData.orderId
            // Navigate first; the overlay stays visible (isPlacingOrder) so the
            // "cart empty" view never flashes while the cart is being cleared.
            router.push(`/checkout/success?orderId=${encodeURIComponent(orderId)}`)
            clearCart()
          } catch (error: any) {
            setIsPlacingOrder(false)
            setErrorMessage(error?.message || "Payment verification failed.")
            setIsProcessing(false)
          }
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false)
          },
        },
        theme: { color: "#EED9C4" },
      }

      const razorpay = new window.Razorpay(options)
      razorpay.on("payment.failed", (response: any) => {
        setErrorMessage(response?.error?.description || "Payment failed. Please try again.")
        setIsProcessing(false)
      })
      razorpay.open()
    } catch (error: any) {
      setErrorMessage(error?.message || "Payment failed. Please try again.")
      setIsProcessing(false)
    }
  }

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#F5F1ED] font-roboto flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin">
              <div className="w-12 h-12 border-4 border-[#D9CFC7] border-t-[#8B5A3C] rounded-full"></div>
            </div>
            <p className="mt-4 text-[#6D4530] text-lg">Verifying your session...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  // After successful payment: keep showing the processing screen until the
  // success page takes over (prevents the "Your Cart is Empty" flash).
  if (isPlacingOrder) {
    return (
      <div className="min-h-screen bg-[#F5F1ED]">
        <OrderProcessingOverlay />
      </div>
    )
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="pt-16 min-h-[60vh] flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <h1 className="text-3xl font-serif text-foreground mb-4">
              Your Cart is Empty
            </h1>
            <p className="text-foreground mb-8">
              Please add items to your cart before checkout.
            </p>
            <button
              onClick={() => router.push("/#shop")}
              className="px-8 py-3 text-foreground hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "#EED9C4" }}
            >
              Continue Shopping
            </button>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div
        className="fixed top-20 left-0 right-0 z-40 bg-white border-b"
        style={{ borderColor: "#D9CFC7" }}
      >
        <div className="max-w-7xl mx-auto px-4">
          <nav className="py-2">
            <ol className="flex items-center gap-2 text-base">
              <li>
                <Link href="/" className="text-foreground hover:opacity-80 transition-opacity">
                  Home
                </Link>
              </li>
              <li>
                <ChevronRight className="w-4 h-4 text-foreground/50" />
              </li>
              <li>
                <Link href="/#shop" className="text-foreground hover:opacity-80 transition-opacity">
                  Products
                </Link>
              </li>
              <li>
                <ChevronRight className="w-4 h-4 text-foreground/50" />
              </li>
              <li>
                <Link href="/cart" className="text-foreground hover:opacity-80 transition-opacity">
                  Cart
                </Link>
              </li>
              <li>
                <ChevronRight className="w-4 h-4 text-foreground/50" />
              </li>
              <li className="text-foreground">Checkout</li>
            </ol>
          </nav>
        </div>
      </div>
      <div className="h-[49px]"></div>
      <main className="pt-6">
        <div className="max-w-7xl mx-auto px-4 py-12">
          

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Checkout Form */}
            <div className="lg:col-span-2">
              <form onSubmit={handleSubmit} className="space-y-8">
{/* Contact Information */}
                <div>
                  <h2 className="text-xl md:text-2xl font-serif text-black mb-6">
                    Contact Information
                  </h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-black mb-2 text-lg font-medium">
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          className={`w-full px-4 py-3 border text-black text-lg ${fieldErrors.firstName ? "border-red-500 bg-red-50" : ""}`}
                          style={{ borderColor: fieldErrors.firstName ? undefined : "#D9CFC7" }}
                        />
                        {fieldErrors.firstName && (
                          <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" /> {fieldErrors.firstName}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-black mb-2 text-lg font-medium">
                          Last Name <span className="text-foreground/50 text-sm">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          className={`w-full px-4 py-3 border text-black text-lg ${fieldErrors.lastName ? "border-red-500 bg-red-50" : ""}`}
                          style={{ borderColor: fieldErrors.lastName ? undefined : "#D9CFC7" }}
                          placeholder="Enter last name (optional)"
                        />
                        {fieldErrors.lastName && (
                          <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" /> {fieldErrors.lastName}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-black mb-2 text-lg font-medium">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 border text-black text-lg ${fieldErrors.email ? "border-red-500 bg-red-50" : ""}`}
                        style={{ borderColor: fieldErrors.email ? undefined : "#D9CFC7" }}
                      />
                      {fieldErrors.email && (
                        <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" /> {fieldErrors.email}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-black mb-2 text-lg font-medium">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <CountryCodeSelect
                          id="checkout-country-code"
                          value={countryCode}
                          onChange={setCountryCode}
                          className="w-44 px-3 py-3 border text-black text-sm"
                        />
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          placeholder="Phone number"
                          className={`w-full px-4 py-3 border text-black text-lg ${fieldErrors.phone ? "border-red-500 bg-red-50" : ""}`}
                          style={{ borderColor: fieldErrors.phone ? undefined : "#D9CFC7" }}
                        />
                      </div>
                      {fieldErrors.phone && (
                        <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" /> {fieldErrors.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Shipping Information */}
                <div>
                  <h2 className="text-xl md:text-2xl font-serif text-black mb-6">
                    Shipping Address
                  </h2>
                  
                  {/* Saved Addresses */}
                  {userProfile?.addresses && userProfile.addresses.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-black font-medium flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-[#8B5A3C]" />
                          Your Saved Addresses ({userProfile.addresses.length}/3)
                        </p>
                      </div>
                      <div className={`grid grid-cols-1 ${userProfile.addresses.length >= 2 ? 'md:grid-cols-2' : ''} ${userProfile.addresses.length === 3 ? 'lg:grid-cols-3' : ''} gap-3`}>
                        {userProfile.addresses.map((addr, idx) => (
                          <div
                            key={addr._id}
                            onClick={() => {
                              handleAddressSelection(addr._id)
                              setUseNewAddress(false)
                            }}
                            className={`p-4 border rounded-lg cursor-pointer transition-all overflow-hidden ${
                              selectedAddressId === addr._id && !useNewAddress
                                ? "border-[#8B5A3C] bg-[#F5F1ED] ring-2 ring-[#8B5A3C] shadow-md"
                                : "border-[#D9CFC7] hover:border-[#8B5A3C] hover:shadow-sm"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                                    addr.label === "Home" ? "bg-blue-100 text-blue-700" :
                                    addr.label === "Office" ? "bg-purple-100 text-purple-700" :
                                    "bg-gray-100 text-gray-700"
                                  }`}>
                                    {addr.label}
                                  </span>
                                  {addr.isDefault && (
                                    <span className="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
                                      Default
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm font-medium text-black">
                                  {addr.houseNumber}, {addr.crossStreet}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {addr.locality}{addr.landmark ? `, ${addr.landmark}` : ""}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {addr.city}, {addr.state} {addr.pincode}
                                </p>
                              </div>
                              {selectedAddressId === addr._id && !useNewAddress && (
                                <div className="shrink-0">
                                  <Check className="w-5 h-5 text-[#8B5A3C] shrink-0" />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        
                        {/* Add New Address Option - Always show if less than 3 addresses */}
                        {userProfile.addresses.length < 3 && (
                          <div
                            onClick={() => handleAddressSelection("new")}
                            className={`p-4 border rounded-lg cursor-pointer transition-all flex items-center justify-center min-h-[140px] ${
                              useNewAddress
                                ? "border-[#8B5A3C] bg-[#F5F1ED] ring-2 ring-[#8B5A3C] shadow-md"
                                : "border-dashed border-[#D9CFC7] hover:border-[#8B5A3C] hover:bg-gray-50"
                            }`}
                          >
                            <div className="text-center">
                              <MapPin className="w-8 h-8 text-[#8B5A3C] mx-auto mb-2 opacity-70" />
                              <p className="text-sm font-medium text-black">Add New Address</p>
                              <p className="text-xs text-gray-500 mt-1">for this order</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* New Address Form - Show if no saved addresses or user wants new address */}
                  {(useNewAddress || !userProfile?.addresses?.length) && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-black mb-2 text-lg font-medium">
                          House Number / Flat Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="houseNumber"
                          value={formData.houseNumber}
                          onChange={handleInputChange}
                          placeholder="e.g., 123, Apt 4B"
                          className={`w-full px-4 py-3 border text-black text-lg ${fieldErrors.houseNumber ? "border-red-500 bg-red-50" : ""}`}
                          style={{ borderColor: fieldErrors.houseNumber ? undefined : "#D9CFC7" }}
                        />
                        {fieldErrors.houseNumber && (
                          <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" /> {fieldErrors.houseNumber}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-black mb-2 text-lg font-medium">
                          Street / Road Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="crossStreet"
                          value={formData.crossStreet}
                          onChange={handleInputChange}
                          placeholder="e.g., Main Street, XYZ Road"
                          className={`w-full px-4 py-3 border text-black text-lg ${fieldErrors.crossStreet ? "border-red-500 bg-red-50" : ""}`}
                          style={{ borderColor: fieldErrors.crossStreet ? undefined : "#D9CFC7" }}
                        />
                        {fieldErrors.crossStreet && (
                          <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" /> {fieldErrors.crossStreet}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-black mb-2 text-lg font-medium">
                          Landmark / Reference <span className="text-gray-500 text-sm">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          name="landmark"
                          value={formData.landmark}
                          onChange={handleInputChange}
                          placeholder="e.g., Near City Hospital, Beside Park"
                          className="w-full px-4 py-3 border text-black text-lg"
                          style={{ borderColor: "#D9CFC7" }}
                        />
                      </div>
                      <div>
                        <label className="block text-black mb-2 text-lg font-medium">
                          Area / Locality <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="locality"
                          value={formData.locality}
                          onChange={handleInputChange}
                          placeholder="e.g., Downtown, Westside"
                          className={`w-full px-4 py-3 border text-black text-lg ${fieldErrors.locality ? "border-red-500 bg-red-50" : ""}`}
                          style={{ borderColor: fieldErrors.locality ? undefined : "#D9CFC7" }}
                        />
                        {fieldErrors.locality && (
                          <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" /> {fieldErrors.locality}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-black mb-2 text-lg font-medium">
                            State <span className="text-red-500">*</span>
                          </label>
                          <select
                            name="state"
                            value={formData.state}
                            onChange={handleInputChange}
                            className={`w-full px-4 py-3 border text-black bg-white text-lg ${fieldErrors.state ? "border-red-500 bg-red-50" : ""}`}
                            style={{ borderColor: fieldErrors.state ? undefined : "#D9CFC7" }}
                          >
                            <option value="">Select State</option>
                            {allStates.map((state) => (
                              <option key={state} value={state}>
                                {state}
                              </option>
                            ))}
                          </select>
                          {fieldErrors.state && (
                            <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" /> {fieldErrors.state}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-black mb-2 text-lg font-medium">
                            City <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            name="city"
                            value={formData.city}
                            onChange={handleInputChange}
                            placeholder="Enter your city"
                            className={`w-full px-4 py-3 border text-black text-lg ${fieldErrors.city ? "border-red-500 bg-red-50" : ""}`}
                            style={{ borderColor: fieldErrors.city ? undefined : "#D9CFC7" }}
                          />
                          {fieldErrors.city && (
                            <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" /> {fieldErrors.city}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-black mb-2 text-lg font-medium">
                            PIN Code <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            name="zipCode"
                            value={formData.zipCode}
                            onChange={handleInputChange}
                            maxLength={6}
                            placeholder="6 digit PIN"
                            className={`w-full px-4 py-3 border text-black text-lg ${fieldErrors.zipCode ? "border-red-500 bg-red-50" : ""}`}
                            style={{ borderColor: fieldErrors.zipCode ? undefined : "#D9CFC7" }}
                          />
                          {fieldErrors.zipCode && (
                            <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" /> {fieldErrors.zipCode}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-black mb-2 text-lg font-medium">Country</label>
                        <select
                          name="country"
                          value={formData.country}
                          onChange={handleInputChange}
                          disabled
                          className="w-full px-4 py-3 border text-black bg-gray-100 cursor-not-allowed text-lg"
                          style={{ borderColor: "#D9CFC7" }}
                        >
                          <option value="India">India</option>
                        </select>
                      </div>

                      {/* Save Address Option */}
                      {useNewAddress && (
                        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                id="saveAddress"
                                checked={saveNewAddress}
                                onChange={(e) => setSaveNewAddress(e.target.checked)}
                                className="w-5 h-5 cursor-pointer"
                                style={{ accentColor: "#8B5A3C" }}
                              />
                              <label htmlFor="saveAddress" className="text-black font-medium cursor-pointer">
                                Save this address for future orders
                              </label>
                            </div>
                            
                            {saveNewAddress && (
                              <div>
                                <label className="block text-black mb-2 text-sm font-medium">
                                  Address Label <span className="text-red-500">*</span>
                                </label>
                                <select
                                  value={addressLabel}
                                  onChange={(e) => setAddressLabel(e.target.value)}
                                  className="w-full px-4 py-2 border text-black bg-white text-sm"
                                  style={{ borderColor: "#D9CFC7" }}
                                >
                                  <option value="Home">Home</option>
                                  <option value="Office">Office</option>
                                  <option value="Other">Other</option>
                                </select>
                                <p className="text-xs text-gray-600 mt-1">This helps you identify the address later</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show selected address summary when using saved address */}
                  {selectedAddressId && !useNewAddress && (
                    <div className="mt-4 p-4 bg-[#F5F1ED] rounded-lg border border-[#E5D5C5]">
                      <p className="text-sm font-medium text-[#6D4530] mb-2">Shipping to:</p>
                      <p className="text-black">{buildFullAddress(formData)}</p>
                      <p className="text-gray-600">{formData.city}, {formData.state} - {formData.zipCode}</p>
                    </div>
                  )}
                </div>

                {/* Billing Address Option */}
                <div className="border-t pt-6" style={{ borderColor: "#D9CFC7" }}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={billingDifferent}
                      onChange={(e) => setBillingDifferent(e.target.checked)}
                      className="w-5 h-5 rounded border-[#D9CFC7] text-[#8B5A3C] focus:ring-[#8B5A3C]"
                    />
                    <span className="text-black text-lg font-medium">
                      Billing address is different from shipping address
                    </span>
                  </label>

                  {billingDifferent && (
                    <div className="mt-6 p-4 border rounded-lg" style={{ borderColor: "#D9CFC7" }}>
                      <h3 className="text-lg font-semibold text-black mb-4 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-[#8B5A3C]" />
                        Billing Address
                      </h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-black mb-2 font-medium">
                              First Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              name="firstName"
                              value={billingData.firstName}
                              onChange={handleBillingInputChange}
                              className={`w-full px-4 py-3 border text-black ${fieldErrors.billing_firstName ? "border-red-500 bg-red-50" : ""}`}
                              style={{ borderColor: fieldErrors.billing_firstName ? undefined : "#D9CFC7" }}
                            />
                            {fieldErrors.billing_firstName && (
                              <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                                <AlertCircle className="w-4 h-4" /> {fieldErrors.billing_firstName}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-black mb-2 font-medium">
                              Last Name <span className="text-foreground/50 text-sm">(Optional)</span>
                            </label>
                            <input
                              type="text"
                              name="lastName"
                              value={billingData.lastName}
                              onChange={handleBillingInputChange}
                              className={`w-full px-4 py-3 border text-black ${fieldErrors.billing_lastName ? "border-red-500 bg-red-50" : ""}`}
                              style={{ borderColor: fieldErrors.billing_lastName ? undefined : "#D9CFC7" }}
                              placeholder="Enter last name (optional)"
                            />
                            {fieldErrors.billing_lastName && (
                              <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                                <AlertCircle className="w-4 h-4" /> {fieldErrors.billing_lastName}
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-black mb-2 font-medium">
                            House Number <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            name="houseNumber"
                            value={billingData.houseNumber}
                            onChange={handleBillingInputChange}
                            className={`w-full px-4 py-3 border text-black ${fieldErrors.billing_houseNumber ? "border-red-500 bg-red-50" : ""}`}
                            style={{ borderColor: fieldErrors.billing_houseNumber ? undefined : "#D9CFC7" }}
                          />
                          {fieldErrors.billing_houseNumber && (
                            <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" /> {fieldErrors.billing_houseNumber}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-black mb-2 font-medium">
                            Street <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            name="crossStreet"
                            value={billingData.crossStreet}
                            onChange={handleBillingInputChange}
                            className={`w-full px-4 py-3 border text-black ${fieldErrors.billing_crossStreet ? "border-red-500 bg-red-50" : ""}`}
                            style={{ borderColor: fieldErrors.billing_crossStreet ? undefined : "#D9CFC7" }}
                          />
                          {fieldErrors.billing_crossStreet && (
                            <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" /> {fieldErrors.billing_crossStreet}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-black mb-2 font-medium">Landmark</label>
                          <input
                            type="text"
                            name="landmark"
                            value={billingData.landmark}
                            onChange={handleBillingInputChange}
                            className="w-full px-4 py-3 border text-black"
                            style={{ borderColor: "#D9CFC7" }}
                          />
                        </div>
                        <div>
                          <label className="block text-black mb-2 font-medium">
                            Area / Locality <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            name="locality"
                            value={billingData.locality}
                            onChange={handleBillingInputChange}
                            className={`w-full px-4 py-3 border text-black ${fieldErrors.billing_locality ? "border-red-500 bg-red-50" : ""}`}
                            style={{ borderColor: fieldErrors.billing_locality ? undefined : "#D9CFC7" }}
                          />
                          {fieldErrors.billing_locality && (
                            <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" /> {fieldErrors.billing_locality}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-black mb-2 font-medium">
                              State <span className="text-red-500">*</span>
                            </label>
                            <select
                              name="state"
                              value={billingData.state}
                              onChange={handleBillingInputChange}
                              className={`w-full px-4 py-3 border text-black bg-white ${fieldErrors.billing_state ? "border-red-500 bg-red-50" : ""}`}
                              style={{ borderColor: fieldErrors.billing_state ? undefined : "#D9CFC7" }}
                            >
                              <option value="">Select State</option>
                              {billingAllStates.map((state) => (
                                <option key={state} value={state}>
                                  {state}
                                </option>
                              ))}
                            </select>
                            {fieldErrors.billing_state && (
                              <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                                <AlertCircle className="w-4 h-4" /> {fieldErrors.billing_state}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-black mb-2 font-medium">
                              City <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              name="city"
                              value={billingData.city}
                              onChange={handleBillingInputChange}
                              placeholder="Enter your city"
                              className={`w-full px-4 py-3 border text-black ${fieldErrors.billing_city ? "border-red-500 bg-red-50" : ""}`}
                              style={{ borderColor: fieldErrors.billing_city ? undefined : "#D9CFC7" }}
                            />
                            {fieldErrors.billing_city && (
                              <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                                <AlertCircle className="w-4 h-4" /> {fieldErrors.billing_city}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-black mb-2 font-medium">
                              PIN Code <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              name="zipCode"
                              value={billingData.zipCode}
                              onChange={handleBillingInputChange}
                              maxLength={6}
                              className={`w-full px-4 py-3 border text-black ${fieldErrors.billing_zipCode ? "border-red-500 bg-red-50" : ""}`}
                              style={{ borderColor: fieldErrors.billing_zipCode ? undefined : "#D9CFC7" }}
                            />
                            {fieldErrors.billing_zipCode && (
                              <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                                <AlertCircle className="w-4 h-4" /> {fieldErrors.billing_zipCode}
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-black mb-2 font-medium">Country</label>
                          <select
                            name="country"
                            value={billingData.country}
                            onChange={handleBillingInputChange}
                            disabled
                            className="w-full px-4 py-3 border text-black bg-gray-100 cursor-not-allowed"
                            style={{ borderColor: "#D9CFC7" }}
                          >
                            <option value="India">India</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* GST Details */}
                <div className="border-t pt-6" style={{ borderColor: "#D9CFC7" }}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasGST}
                      onChange={(e) => setHasGST(e.target.checked)}
                      className="w-5 h-5 rounded border-[#D9CFC7] text-[#8B5A3C] focus:ring-[#8B5A3C]"
                    />
                    <span className="text-black text-lg font-medium">
                      I have a GST number (for business purchases)
                    </span>
                  </label>

                  {hasGST && (
                    <div className="mt-6 p-4 border rounded-lg bg-[#FAFAFA]" style={{ borderColor: "#D9CFC7" }}>
                      <h3 className="text-lg font-semibold text-black mb-4 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-[#8B5A3C]" />
                        GST Details
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-black mb-2 font-medium">
                            GST Number <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={gstNumber}
                            onChange={(e) => {
                              setGstNumber(e.target.value.toUpperCase())
                              if (fieldErrors.gstNumber) setFieldErrors(prev => ({ ...prev, gstNumber: "" }))
                            }}
                            placeholder="e.g., 22AAAAA0000A1Z5"
                            maxLength={15}
                            className={`w-full px-4 py-3 border text-black uppercase ${fieldErrors.gstNumber ? "border-red-500 bg-red-50" : ""}`}
                            style={{ borderColor: fieldErrors.gstNumber ? undefined : "#D9CFC7" }}
                          />
                          {fieldErrors.gstNumber && (
                            <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" /> {fieldErrors.gstNumber}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            Format: 2 digits state code + 10 char PAN + 1 entity code + Z + 1 check digit
                          </p>
                        </div>

                        <div>
                          <label className="block text-black mb-2 font-medium">
                            Company / Business Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={companyName}
                            onChange={(e) => {
                              setCompanyName(e.target.value)
                              if (fieldErrors.companyName) setFieldErrors(prev => ({ ...prev, companyName: "" }))
                            }}
                            placeholder="Enter registered company name"
                            className={`w-full px-4 py-3 border text-black ${fieldErrors.companyName ? "border-red-500 bg-red-50" : ""}`}
                            style={{ borderColor: fieldErrors.companyName ? undefined : "#D9CFC7" }}
                          />
                          {fieldErrors.companyName && (
                            <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" /> {fieldErrors.companyName}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Method */}
                <div>
                  <h2 className="text-xl md:text-2xl font-serif text-black mb-6">
                    Payment Method
                  </h2>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="razorpay"
                        checked={formData.paymentMethod === "razorpay"}
                        onChange={handleInputChange}
                        className="w-4 h-4"
                      />
                      <span className="text-black text-lg">Razorpay (UPI, Card, Netbanking)</span>
                    </label>
                  </div>
                </div>

                {errorMessage && (
                  <p className="text-sm text-red-600" role="alert">
                    {errorMessage}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-4 text-black hover:opacity-90 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg font-medium"
                  style={{ backgroundColor: "#EED9C4" }}
                >
                  {isProcessing ? (
                    "Processing..."
                  ) : (
                    <>
                      <ShoppingCart className="w-6 h-6" />
                      Place Order
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div
                className="border p-6 sticky top-24"
                style={{ borderColor: "#D9CFC7" }}
              >
                <h2 className="text-xl md:text-2xl font-serif text-black mb-6">
                  Order Summary
                </h2>

                {/* Cart Items */}
                <div className="space-y-5 mb-6">
                  {cartItems.map((item) => (
                    <div key={item.id} className="space-y-3">
                      {/* Main Item */}
                      <div className="flex gap-3">
                        <div className="relative w-16 h-16 shrink-0 bg-gray-100 overflow-hidden rounded">
                          <Image
                            src={item.image || "/placeholder.svg"}
                            alt={item.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-black text-base md:text-lg font-medium line-clamp-1">
                            {item.name}
                          </h3>
                          <p className="text-gray-600 text-sm md:text-base">Size: {item.size}</p>
                          <p className="text-gray-600 text-sm md:text-base">Qty: {item.quantity}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-black text-base md:text-lg font-medium">
                            <IndianRupee className="w-4 h-4" />
                            <span>
                              {(item.price * item.quantity).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Complementary Items */}
                      {item.complementaryItems && item.complementaryItems.length > 0 && (
                        <div className="ml-4 pl-3 border-l-4 border-green-300 py-2 space-y-2 bg-green-50 px-3 rounded-r">
                          <div className="flex items-center gap-2">
                            <span className="inline-block bg-green-600 text-white text-xs font-bold px-2 py-1 rounded">
                              FREE
                            </span>
                            <span className="text-xs font-semibold text-green-700">Complimentary Products</span>
                          </div>
                          <div className="space-y-1">
                            {item.complementaryItems.map((freeItem, idx) => (
                              <div key={`${item.id}-free-${idx}`} className="text-xs text-gray-700 pl-2">
                                • {freeItem.name || `Free Product ${idx + 1}`}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Coupon Input Section */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border" style={{ borderColor: "#D9CFC7" }}>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold text-black">Apply Coupon Code</h3>
                    <span className="text-xs text-gray-600">(max 1 per order)</span>
                  </div>
                  {appliedCoupons.length < 1 && (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          placeholder="Enter Coupon Code"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                          className="flex-1 px-3 py-2 border rounded-md text-sm text-black focus:outline-none"
                          style={{ borderColor: "#D9CFC7" }}
                        />
                        <button
                          type="button"
                          onClick={() => applyCoupon()}
                          className="px-4 py-2 text-sm text-black bg-gray-200 hover:bg-gray-300 transition-colors rounded-md"
                        >
                          Apply
                        </button>
                      </div>
                      {availableCoupons.length > 0 && (
                        <div className="mb-2 space-y-2">
                          <p className="text-xs font-medium text-gray-700">Available offers</p>
                          <div className="flex flex-wrap gap-2">
                            {availableCoupons.map((c) => {
                              const meetsMin = subtotal >= c.minPurchase
                              const offLabel =
                                c.type === "percentage"
                                  ? `${c.discount}% off${
                                      c.maxDiscount ? ` (max ₹${c.maxDiscount.toLocaleString("en-IN")})` : ""
                                    }`
                                  : `₹${c.discount.toLocaleString("en-IN")} off`
                              return (
                                <button
                                  key={c.code}
                                  type="button"
                                  disabled={!meetsMin}
                                  title={
                                    meetsMin
                                      ? `Apply ${c.code}`
                                      : `Minimum cart ₹${c.minPurchase.toLocaleString("en-IN")} required`
                                  }
                                  onClick={() => {
                                    setCouponCode(c.code)
                                    void applyCoupon(c.code)
                                  }}
                                  className={`text-left px-3 py-2 rounded-md border text-xs transition-colors ${
                                    meetsMin
                                      ? "border-[#D9CFC7] bg-white hover:bg-gray-100 text-black cursor-pointer"
                                      : "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                                  }`}
                                >
                                  <span className="font-mono font-semibold">{c.code}</span>
                                  <span className="block text-[11px] text-gray-600 mt-0.5">{offLabel}</span>
                                  {!meetsMin && (
                                    <span className="block text-[11px] text-amber-700 mt-0.5">
                                      Min. order ₹{c.minPurchase.toLocaleString("en-IN")}
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {couponError && <p className="text-xs text-red-600 mb-2">{couponError}</p>}
                  {appliedCoupons.length > 0 && (
                    <div className="space-y-2">
                      {appliedCoupons.map((coupon) => (
                        <div
                          key={coupon.code}
                          className="flex items-center justify-between text-xs bg-white p-2 rounded border"
                          style={{ borderColor: "#D9CFC7" }}
                        >
                          <span className="text-green-600">✓ {coupon.code}</span>
                          <button
                            onClick={() => removeCoupon(coupon.code)}
                            className="text-red-600 hover:text-red-700 font-semibold"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  className="border-t pt-4 mb-4"
                  style={{ borderColor: "#D9CFC7" }}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-base md:text-lg">
                      <span className="text-black font-medium">Subtotal</span>
                      <span className="text-black">
                        <div className="flex items-center gap-1">
                          <IndianRupee className="w-4 h-4" />
                          <span>
                            {subtotal.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </span>
                    </div>
                    {appliedCoupons.length > 0 && (
                      <div className="flex items-center justify-between text-base md:text-lg">
                        <span className="text-black font-medium">Discount ({appliedCoupons.map((c) => c.code).join(", ")})</span>
                        <span className="text-green-600 font-semibold">
                          <div className="flex items-center gap-1">
                            <span>-</span>
                            <IndianRupee className="w-4 h-4" />
                            <span>
                              {totalDiscount.toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-base md:text-lg">
                      <span className="text-black font-medium">Shipping Charge</span>
                      <span className="text-green-600 font-semibold">Free</span>
                    </div>
                  </div>
                </div>

                <div
                  className="border-t pt-4"
                  style={{ borderColor: "#D9CFC7" }}
                >
                  <div className="flex items-center justify-between text-2xl md:text-3xl">
                    <span className="text-black text-xl font-semibold">Total</span>
                    <span className="text-black font-bold text-xl">
                      <div className="flex items-center gap-1">
                        <IndianRupee className="w-6 h-6" />
                        <span>
                          {total.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
