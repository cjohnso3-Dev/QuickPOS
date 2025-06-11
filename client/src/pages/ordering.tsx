import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VirtualKeyboard } from "@/components/ui/virtual-keyboard";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Receipt, 
  CreditCard, 
  DollarSign, 
  Trash2, 
  ShoppingCart, 
  User, 
  Shield, 
  Percent, 
  Gift,
  Search,
  Plus,
  Calendar,
  Settings,
  Users,
  Clock,
  Menu,
  ChevronRight,
  ChevronDown,
  X
} from "lucide-react";
import QuickOrderCard from "@/components/QuickOrderCard";
import CartItem from "@/components/CartItem";
import CartItemEditor from "@/components/CartItemEditor";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { queryClient } from "@/lib/queryClient";
import type { ProductWithCategory, Category, CartItem as CartItemType, TipOption, PaymentSplit, Discount } from "@shared/schema";

export default function OrderingPage() {
  const [cart, setCart] = useState<CartItemType[]>([]);
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [showManagerInterface, setShowManagerInterface] = useState(false);
  const [managerPinCode, setManagerPinCode] = useState("");
  const [isManagerAuthorized, setIsManagerAuthorized] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<Discount | null>(null);
  const [compReason, setCompReason] = useState("");
  const [compAmount, setCompAmount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isOrderPanelCollapsed, setIsOrderPanelCollapsed] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const { data: products = [], isLoading: productsLoading } = useQuery<ProductWithCategory[]>({
    queryKey: ["/api/products"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: discounts = [] } = useQuery<Discount[]>({
    queryKey: ["/api/discounts"],
    enabled: isManagerAuthorized,
  });

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });
      if (!response.ok) throw new Error("Failed to create order");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Order placed successfully!",
        description: "Your order has been processed.",
      });
      setCart([]);
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: () => {
      toast({
        title: "Order failed",
        description: "There was an error processing your order.",
        variant: "destructive",
      });
    },
  });

  const [showCheckout, setShowCheckout] = useState(false);
  const [showCartEditor, setShowCartEditor] = useState(false);
  const [editingCartItem, setEditingCartItem] = useState<CartItemType | null>(null);
  const [tipAmount, setTipAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'split'>('cash');
  const [cashReceived, setCashReceived] = useState("");
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
  const [splitAmount1, setSplitAmount1] = useState("");
  const [splitAmount2, setSplitAmount2] = useState("");
  const printReceiptRef = useRef<() => void>();

  const updateCartQuantity = (productId: number, quantity: number) => {
    if (quantity === 0) {
      setCart(prev => prev.filter((_, index) => 
        !(prev[index].product.id === productId)
      ));
    } else {
      setCart(prev => prev.map((item, index) =>
        item.product.id === productId
          ? { ...item, quantity, totalPrice: quantity * item.unitPrice }
          : item
      ));
    }
  };

  const removeCartItem = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.totalPrice, 0);
  };

  const calculateDiscountedTotal = () => {
    const subtotal = calculateTotal();
    if (!appliedDiscount) return subtotal;

    if (appliedDiscount.type === 'percentage') {
      return subtotal * (1 - parseFloat(appliedDiscount.value) / 100);
    } else {
      return Math.max(0, subtotal - parseFloat(appliedDiscount.value));
    }
  };

  const handleManagerLogin = () => {
    if (managerPinCode === "1234" || managerPinCode === "manager") {
      setIsManagerAuthorized(true);
      toast({
        title: "Manager access granted",
        description: "You now have access to manager functions.",
      });
    } else {
      toast({
        title: "Invalid PIN",
        description: "Please enter a valid manager PIN.",
        variant: "destructive",
      });
    }
  };

  const handleApplyDiscount = (discount: Discount) => {
    setAppliedDiscount(discount);
    toast({
      title: "Discount applied",
      description: `${discount.name} has been applied to the order.`,
    });
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    toast({
      title: "Discount removed",
      description: "Discount has been removed from the order.",
    });
  };

  const handleCompOrder = () => {
    if (!compReason.trim()) {
      toast({
        title: "Comp reason required",
        description: "Please provide a reason for comping this order.",
        variant: "destructive",
      });
      return;
    }

    const compValue = parseFloat(compAmount) || calculateTotal();

    const compDiscount: Discount = {
      id: -1,
      name: `Comp: ${compReason}`,
      type: compAmount ? 'fixed_amount' : 'percentage',
      value: compAmount ? compValue.toString() : '100',
      isActive: true,
      requiresManager: true,
      createdAt: new Date()
    };

    setAppliedDiscount(compDiscount);
    setCompReason("");
    setCompAmount("");

    toast({
      title: "Order comped",
      description: `Order has been comped: ${compReason}`,
    });
  };

  const closeManagerInterface = () => {
    setShowManagerInterface(false);
    setManagerPinCode("");
    setIsManagerAuthorized(false);
    setCompReason("");
    setCompAmount("");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast({
        title: "Cart is empty",
        description: "Please add items to your cart before checkout.",
        variant: "destructive",
      });
      return;
    }

    const orderData = {
      customerName,
      orderType: "takeout",
      items: cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        totalPrice: item.totalPrice.toString(),
        modifications: item.modifications || [],
        specialInstructions: item.specialInstructions || ""
      })),
      subtotal: calculateTotal().toString(),
      tax: (calculateTotal() * 0.08).toString(),
      total: (calculateTotal() * 1.08).toString(),
    };

    createOrderMutation.mutate(orderData);
  };

  const filteredProducts = selectedCategory 
    ? products.filter(product => product.categoryId === selectedCategory)
    : products;

  const searchFilteredProducts = searchQuery
    ? filteredProducts.filter(product => 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredProducts;

  const activeProducts = searchFilteredProducts.filter(product => product.isActive && product.stock > 0);

  const handleQuickAdd = (product: ProductWithCategory) => {
    const cartItem: CartItemType = {
      product,
      quantity: 1,
      modifications: [],
      unitPrice: parseFloat(product.price),
      totalPrice: parseFloat(product.price),
      specialInstructions: "",
    };

    setCart(prev => {
      const existing = prev.find(item => 
        item.product.id === product.id && 
        !item.modifications?.length &&
        !item.specialInstructions
      );

      if (existing) {
        return prev.map(item =>
          item.product.id === product.id && !item.modifications?.length && !item.specialInstructions
            ? { ...item, quantity: item.quantity + 1, totalPrice: item.unitPrice * (item.quantity + 1) }
            : item
        );
      }

      return [...prev, cartItem];
    });

    toast({
      title: "Added to cart",
      description: `${product.name} has been added to your cart.`,
    });
  };

  const handleCustomAdd = (cartItem: CartItemType) => {
    setCart(prev => {
      const existing = prev.find(item => 
        item.product.id === cartItem.product.id &&
        JSON.stringify(item.modifications) === JSON.stringify(cartItem.modifications) &&
        item.specialInstructions === cartItem.specialInstructions
      );

      if (existing) {
        return prev.map(item =>
          item.product.id === cartItem.product.id &&
          JSON.stringify(item.modifications) === JSON.stringify(cartItem.modifications) &&
          item.specialInstructions === cartItem.specialInstructions
            ? { ...item, quantity: item.quantity + cartItem.quantity, totalPrice: item.unitPrice * (item.quantity + cartItem.quantity) }
            : item
        );
      }

      return [...prev, cartItem];
    });

    toast({
      title: "Added to cart",
      description: `Customized ${cartItem.product.name} has been added to your cart.`,
    });
  };

  const removeFromCart = (product: ProductWithCategory) => {
    setCart(prev => prev.filter(item => item.product.id !== product.id));
  };

  const handleEditCartItem = (item: CartItemType) => {
    setEditingCartItem(item);
    setShowCartEditor(true);
  };

  const handleUpdateCartItem = (updatedItem: CartItemType) => {
    setCart(prev => prev.map(item => 
      item.product.id === updatedItem.product.id ? updatedItem : item
    ));
  };

  const handleRemoveCartItem = (itemToRemove: CartItemType) => {
    setCart(prev => prev.filter(item => item.product.id !== itemToRemove.product.id));
  };

  return (
    <div className="h-screen bg-gray-100 flex overflow-hidden">
      {/* Left Sidebar Navigation */}
      <div className={`${isSidebarCollapsed && !isMobile ? 'w-16' : 'w-64'} ${isMobile ? 'hidden' : 'flex'} bg-white border-r border-gray-200 flex-col transition-all duration-300`}>
        {/* Brand Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {!isSidebarCollapsed && (
              <h1 className="text-xl font-bold text-gray-800">Restro POS</h1>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 py-4">
          <nav className="space-y-2 px-3">
            <Button 
              variant="default" 
              className="w-full justify-start bg-orange-500 hover:bg-orange-600"
            >
              <ShoppingCart className="h-4 w-4" />
              {!isSidebarCollapsed && <span className="ml-2">Orders</span>}
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <Users className="h-4 w-4" />
              {!isSidebarCollapsed && <span className="ml-2">Customers</span>}
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <Calendar className="h-4 w-4" />
              {!isSidebarCollapsed && <span className="ml-2">Reservations</span>}
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <Clock className="h-4 w-4" />
              {!isSidebarCollapsed && <span className="ml-2">Time Clock</span>}
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <Settings className="h-4 w-4" />
              {!isSidebarCollapsed && <span className="ml-2">Settings</span>}
            </Button>
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="p-3 border-t">
          <Button
            onClick={() => setShowManagerInterface(true)}
            variant="outline"
            className="w-full justify-start"
          >
            <Shield className="h-4 w-4" />
            {!isSidebarCollapsed && <span className="ml-2">Manager</span>}
          </Button>
        </div>
      </div>

      {/* Mobile Sidebar Toggle */}
      {isMobile && (
        <Button
          variant="ghost"
          size="sm"
          className="fixed top-4 left-4 z-50 bg-white shadow-md"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        >
          <Menu className="h-4 w-4" />
        </Button>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            {/* Search Bar */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 h-10"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-4">
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Customer
              </Button>
              <Button variant="outline" size="sm" className="bg-orange-500 text-white border-orange-500 hover:bg-orange-600">
                Select Table
              </Button>
            </div>
          </div>
        </div>

        {/* Main Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Products Section */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Category Tabs */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex gap-2 overflow-x-auto">
                <Button
                  onClick={() => setSelectedCategory(null)}
                  variant={selectedCategory === null ? "default" : "outline"}
                  size="sm"
                  className={selectedCategory === null ? "bg-orange-500 hover:bg-orange-600" : ""}
                >
                  All
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    variant={selectedCategory === category.id ? "default" : "outline"}
                    size="sm"
                    className={selectedCategory === category.id ? "bg-orange-500 hover:bg-orange-600" : ""}
                  >
                    {category.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            <div className="flex-1 p-4 overflow-y-auto">
              {productsLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {activeProducts.map((product) => (
                    <QuickOrderCard
                      key={product.id}
                      product={product}
                      onQuickAdd={handleQuickAdd}
                      onCustomAdd={handleCustomAdd}
                    />
                  ))}
                </div>
              )}

              {activeProducts.length === 0 && !productsLoading && (
                <div className="text-center py-12">
                  <p className="text-gray-500">
                    {searchQuery ? 'No products found matching your search.' : 'No products available in this category.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Order Panel */}
          <div className={`${isOrderPanelCollapsed && !isMobile ? 'w-12' : 'w-80'} ${isMobile ? 'hidden' : 'flex'} bg-white border-l border-gray-200 flex-col transition-all duration-300`}>
            {/* Order Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                {!isOrderPanelCollapsed && (
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">Order #{new Date().getTime().toString().slice(-6)}</h2>
                    <Badge variant="secondary">{cart.length}</Badge>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOrderPanelCollapsed(!isOrderPanelCollapsed)}
                  className="p-2"
                >
                  {isOrderPanelCollapsed ? <ChevronRight className="h-4 w-4" /> : <X className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {!isOrderPanelCollapsed && (
              <>
                {/* Customer Info */}
                <div className="p-4 border-b border-gray-200">
                  <Input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Customer name"
                    className="text-sm"
                  />
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto">
                  {cart.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No items added</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {cart.map((item, index) => (
                        <div key={`cart-${item.product.id}-${index}-${JSON.stringify(item.modifications)}`} className="border-b border-gray-100 p-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{item.quantity}</span>
                                <span className="text-sm">{item.product.name}</span>
                                <span className="font-medium text-sm">{formatCurrency(item.totalPrice)}</span>
                              </div>
                              {item.modifications && item.modifications.length > 0 && (
                                <div className="mt-1">
                                  {item.modifications.map((mod, idx) => (
                                    <p key={idx} className="text-xs text-gray-500">• {mod}</p>
                                  ))}
                                </div>
                              )}
                              {item.specialInstructions && (
                                <p className="text-xs text-gray-500 mt-1">Note: {item.specialInstructions}</p>
                              )}
                              <div className="flex gap-2 mt-2">
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => updateCartQuantity(item.product.id, parseInt(e.target.value) || 0)}
                                  className="w-16 h-6 text-xs"
                                  min="0"
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditCartItem(item)}
                                  className="h-6 px-2 text-xs"
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFromCart(item.product)}
                                  className="h-6 px-2 text-xs text-red-600"
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Order Summary */}
                {cart.length > 0 && (
                  <div className="border-t border-gray-200 p-4 space-y-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>{formatCurrency(calculateTotal())}</span>
                      </div>
                      {appliedDiscount && (
                        <div className="flex justify-between text-green-600">
                          <span>Discount</span>
                          <span>-{formatCurrency(calculateTotal() - calculateDiscountedTotal())}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Tax</span>
                        <span>{formatCurrency(calculateDiscountedTotal() * 0.08)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-bold text-lg">
                        <span>Payable Amount</span>
                        <span>{formatCurrency(calculateDiscountedTotal() * 1.08)}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2">
                      <Button
                        onClick={handleCheckout}
                        className="w-full bg-orange-500 hover:bg-orange-600"
                        disabled={createOrderMutation.isPending}
                      >
                        {createOrderMutation.isPending ? "Processing..." : "Hold Order"}
                      </Button>
                      <Button
                        onClick={handleCheckout}
                        className="w-full bg-green-600 hover:bg-green-700"
                        disabled={createOrderMutation.isPending}
                      >
                        {createOrderMutation.isPending ? "Processing..." : "Proceed"}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Order Panel */}
      {isMobile && (
        <Collapsible open={!isOrderPanelCollapsed} onOpenChange={setIsOrderPanelCollapsed}>
          <CollapsibleTrigger asChild>
            <Button
              className="fixed bottom-4 right-4 z-50 bg-orange-500 hover:bg-orange-600"
              size="lg"
            >
              <ShoppingCart className="h-5 w-5" />
              {cart.length > 0 && (
                <Badge className="ml-2 bg-white text-orange-500">
                  {cart.length}
                </Badge>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="fixed inset-0 bg-white z-40 flex flex-col">
              {/* Mobile Order Header */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="font-semibold">Current Order</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOrderPanelCollapsed(true)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Mobile Cart Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {cart.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500">No items in cart</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item, index) => (
                      <CartItem
                        key={`mobile-cart-${item.product.id}-${index}-${JSON.stringify(item.modifications)}`}
                        item={item}
                        onUpdateQuantity={updateCartQuantity}
                        onRemove={removeFromCart}
                        onEdit={handleEditCartItem}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Mobile Order Summary */}
              {cart.length > 0 && (
                <div className="border-t border-gray-200 p-4">
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>{formatCurrency(calculateTotal())}</span>
                    </div>
                    {appliedDiscount && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span>-{formatCurrency(calculateTotal() - calculateDiscountedTotal())}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Tax</span>
                      <span>{formatCurrency(calculateDiscountedTotal() * 0.08)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>{formatCurrency(calculateDiscountedTotal() * 1.08)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button
                      onClick={handleCheckout}
                      className="w-full bg-orange-500 hover:bg-orange-600"
                      disabled={createOrderMutation.isPending}
                    >
                      Hold Order
                    </Button>
                    <Button
                      onClick={handleCheckout}
                      className="w-full bg-green-600 hover:bg-green-700"
                      disabled={createOrderMutation.isPending}
                    >
                      {createOrderMutation.isPending ? "Processing..." : "Proceed"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Cart Item Editor Modal */}
      <CartItemEditor
        open={showCartEditor}
        onOpenChange={setShowCartEditor}
        cartItem={editingCartItem}
        onUpdate={handleUpdateCartItem}
        onRemove={handleRemoveCartItem}
      />

      {/* Manager Interface Modal */}
      <Dialog open={showManagerInterface} onOpenChange={setShowManagerInterface}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl flex items-center gap-2">
              <Shield className="w-6 h-6 text-orange-600" />
              Manager Functions
            </DialogTitle>
          </DialogHeader>

          {!isManagerAuthorized ? (
            <div className="space-y-4">
              <div className="text-center py-4">
                <p className="text-gray-600 mb-4">Enter manager PIN to access manager functions</p>
                <VirtualKeyboard
                  value={managerPinCode}
                  onChange={setManagerPinCode}
                  placeholder="Manager PIN"
                  type="password"
                  maxLength={10}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleManagerLogin}
                  className="flex-1 h-12 text-base font-semibold"
                  disabled={!managerPinCode.trim()}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Authorize
                </Button>
                <Button
                  onClick={closeManagerInterface}
                  variant="outline"
                  className="flex-1 h-12 text-base"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Tabs defaultValue="discounts" className="space-y-4">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="discounts" className="text-xs sm:text-sm">
                  <Percent className="w-4 h-4 mr-1" />
                  Discounts
                </TabsTrigger>
                <TabsTrigger value="comp" className="text-xs sm:text-sm">
                  <Gift className="w-4 h-4 mr-1" />
                  Comp
                </TabsTrigger>
                <TabsTrigger value="override" className="text-xs sm:text-sm">
                  <Shield className="w-4 h-4 mr-1" />
                  Override
                </TabsTrigger>
              </TabsList>

              <TabsContent value="discounts" className="space-y-4">
                <div className="space-y-3">
                  <h4 className="font-medium text-lg">Apply Discount</h4>

                  {appliedDiscount && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-green-900">{appliedDiscount.name}</p>
                          <p className="text-sm text-green-700">
                            {appliedDiscount.type === 'percentage' 
                              ? `${appliedDiscount.value}% off` 
                              : `$${appliedDiscount.value} off`}
                          </p>
                        </div>
                        <Button
                          onClick={handleRemoveDiscount}
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                    {discounts.map((discount) => (
                      <Button
                        key={discount.id}
                        onClick={() => handleApplyDiscount(discount)}
                        variant="outline"
                        className="justify-between h-12 p-3 text-left"
                        disabled={appliedDiscount?.id === discount.id}
                      >
                        <div>
                          <div className="font-medium">{discount.name}</div>
                          <div className="text-xs text-gray-500">
                            {discount.type === 'percentage' 
                              ? `${discount.value}% off` 
                              : `$${discount.value} off`}
                          </div>
                        </div>
                        <Percent className="w-4 h-4" />
                      </Button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="comp" className="space-y-4">
                <div className="space-y-4">
                  <h4 className="font-medium text-lg">Comp Order</h4>

                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium">Comp Reason (Required)</Label>
                      <VirtualKeyboard
                        value={compReason}
                        onChange={setCompReason}
                        placeholder="Reason for comp (e.g., customer complaint, service issue)"
                        maxLength={100}
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Comp Amount (Leave blank for full comp)</Label>
                      <VirtualKeyboard
                        value={compAmount}
                        onChange={setCompAmount}
                        placeholder="Optional: specific dollar amount"
                        type="number"
                        maxLength={10}
                      />
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm text-yellow-800">
                        {compAmount 
                          ? `Comp amount: $${compAmount}` 
                          : `Full order comp: ${formatCurrency(calculateTotal())}`}
                      </p>
                    </div>

                    <Button
                      onClick={handleCompOrder}
                      className="w-full h-12 bg-yellow-600 hover:bg-yellow-700"
                      disabled={!compReason.trim()}
                    >
                      <Gift className="w-4 h-4 mr-2" />
                      Apply Comp
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="override" className="space-y-4">
                <div className="space-y-4">
                  <h4 className="font-medium text-lg">Manager Overrides</h4>

                  <div className="grid grid-cols-1 gap-3">
                    <Button
                      variant="outline"
                      className="justify-start h-12 p-3"
                      onClick={() => {
                        toast({
                          title: "Price Override",
                          description: "Price override functionality would be implemented here.",
                        });
                      }}
                    >
                      <DollarSign className="w-4 h-4 mr-2" />
                      Price Override
                    </Button>

                    <Button
                      variant="outline"
                      className="justify-start h-12 p-3"
                      onClick={() => {
                        toast({
                          title: "Tax Override",
                          description: "Tax override functionality would be implemented here.",
                        });
                      }}
                    >
                      <Percent className="w-4 h-4 mr-2" />
                      Tax Override
                    </Button>
                  </div>

                  <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
                    <p>Additional manager functions can be added here such as:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Item price modifications</li>
                      <li>Tax exemptions</li>
                      <li>Refund processing</li>
                      <li>Void transactions</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <div className="flex justify-end mt-4">
            <Button
              onClick={closeManagerInterface}
              variant="outline"
              className="px-6"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}