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
import { Receipt, CreditCard, DollarSign, Trash2, ShoppingCart, User, Shield, Percent, Gift } from "lucide-react";
import QuickOrderCard from "@/components/QuickOrderCard";
import CartItem from "@/components/CartItem";
import CartItemEditor from "@/components/CartItemEditor";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();

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
    // In production, this would validate against actual manager credentials
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
    
    // Apply comp as 100% discount or specific amount
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

  const activeProducts = filteredProducts.filter(product => product.isActive && product.stock > 0);

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Employee Header */}
        <div className="bg-white border-b p-3 sm:p-4 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center justify-between">
            <h1 className="text-lg sm:text-xl font-bold text-gray-800">POS Terminal</h1>
            <div className="text-xs sm:text-sm text-gray-600 bg-blue-50 px-2 py-1 rounded">
              Employee Interface
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-0">
          {/* Products Section - Employee View */}
          <div className="xl:col-span-2 p-3 sm:p-4 space-y-4">
            {/* Category Tabs - Touch Optimized for Speed */}
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <Tabs value={selectedCategory?.toString() || "all"} className="w-full">
                <TabsList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 h-auto gap-1 bg-gray-100 p-1">
                  <TabsTrigger 
                    value="all" 
                    onClick={() => setSelectedCategory(null)}
                    className="h-12 text-xs sm:text-sm font-medium touch-manipulation data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-colors"
                  >
                    All Items
                  </TabsTrigger>
                  {categories.map((category) => (
                    <TabsTrigger
                      key={category.id}
                      value={category.id.toString()}
                      onClick={() => setSelectedCategory(category.id)}
                      className="h-12 text-xs sm:text-sm font-medium touch-manipulation data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-colors"
                    >
                      {category.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {/* Products Grid - Optimized for Employee Speed */}
            {productsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-64 bg-gray-200 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
              <div className="text-center py-12 bg-white rounded-lg">
                <p className="text-gray-500">No products available in this category.</p>
              </div>
            )}
          </div>

          {/* Order Cart - Fixed Right Panel */}
          <div className="xl:col-span-1 bg-white xl:min-h-screen border-t xl:border-t-0 xl:border-l xl:sticky xl:top-16">
            <div className="p-4 xl:p-6">
              {/* Cart Header */}
              <div className="flex items-center gap-2 mb-4">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold">Current Order</h2>
                <Badge variant="secondary" className="ml-auto">
                  {cart.length} items
                </Badge>
              </div>

              {/* Customer Info */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <User className="h-4 w-4" />
                  Customer
                </div>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full p-3 text-base border border-gray-300 rounded-md touch-manipulation focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Customer name or order number..."
                />
              </div>

              <Separator className="my-4" />

              {/* Cart Items */}
              <div className="space-y-3 max-h-64 xl:max-h-96 overflow-y-auto mb-4">
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No items in cart</p>
                    <p className="text-sm">Tap items to add</p>
                  </div>
                ) : (
                  cart.map((item) => (
                      <CartItem
                        key={item.product.id}
                        item={item}
                        onUpdateQuantity={updateCartQuantity}
                        onRemove={removeFromCart}
                        onEdit={handleEditCartItem}
                      />
                    ))
                )}
              </div>

              {/* Order Total */}
              {cart.length > 0 && (
                <>
                  <div className="space-y-2 bg-gray-50 p-4 rounded-lg mb-4">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(calculateTotal())}</span>
                    </div>
                    
                    {appliedDiscount && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Discount ({appliedDiscount.name}):</span>
                        <span>-{formatCurrency(calculateTotal() - calculateDiscountedTotal())}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-sm">
                      <span>Tax (8%):</span>
                      <span>{formatCurrency(calculateDiscountedTotal() * 0.08)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-xl">
                      <span>Total:</span>
                      <span className="text-blue-600">{formatCurrency(calculateDiscountedTotal() * 1.08)}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    <Button
                      onClick={handleCheckout}
                      className="w-full h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700 touch-manipulation active:scale-98 transition-all"
                      disabled={createOrderMutation.isPending}
                    >
                      <CreditCard className="w-5 h-5 mr-2" />
                      {createOrderMutation.isPending ? "Processing..." : "Process Payment"}
                    </Button>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => setShowManagerInterface(true)}
                        variant="outline"
                        className="h-12 touch-manipulation border-orange-200 text-orange-600 hover:bg-orange-50"
                      >
                        <Shield className="w-4 h-4 mr-1" />
                        Manager
                      </Button>
                      <Button
                        onClick={clearCart}
                        variant="outline"
                        className="h-12 touch-manipulation border-red-200 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Clear
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

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
                        // This would typically open a price override dialog
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
                        // This would typically open a tax override dialog
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

      {/* Checkout Modal */}
    </div>
  );
}