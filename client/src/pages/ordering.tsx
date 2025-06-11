import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import QuickOrderCard from "@/components/QuickOrderCard";
import { ShoppingCart, Trash2, CreditCard, User } from "lucide-react";
import type { ProductWithCategory, CartItem as CartItemType, Category } from "@shared/schema";

export default function OrderingPage() {
  const [cart, setCart] = useState<CartItemType[]>([]);
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: products = [], isLoading: productsLoading } = useQuery<ProductWithCategory[]>({
    queryKey: ["/api/products"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
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

  const addToCart = (product: ProductWithCategory) => {
    setCart(prev => {
      const existing = prev.find(item => 
        item.product.id === product.id && 
        !item.modifications?.length && 
        !item.specialInstructions
      );

      if (existing) {
        return prev.map(item =>
          item.product.id === product.id && !item.modifications?.length && !item.specialInstructions
            ? { ...item, quantity: item.quantity + 1, totalPrice: (item.quantity + 1) * item.unitPrice }
            : item
        );
      } else {
        const unitPrice = parseFloat(product.price);
        return [...prev, { 
          product, 
          quantity: 1, 
          unitPrice,
          totalPrice: unitPrice,
          modifications: [],
          specialInstructions: ""
        }];
      }
    });
  };

  const addCustomItemToCart = (cartItem: CartItemType) => {
    setCart(prev => [...prev, cartItem]);
  };

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
                  cart.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{item.product.name}</h4>
                          <div className="text-sm text-gray-600">
                            {formatCurrency(item.unitPrice)} each
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeCartItem(index)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 touch-manipulation"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Modifications */}
                      {item.modifications && item.modifications.length > 0 && (
                        <div className="text-xs space-y-1 pl-2 border-l-2 border-blue-200">
                          {item.modifications.map((mod: any, modIndex) => (
                            <div key={modIndex} className="flex justify-between text-gray-600">
                              <span>+ {mod.name}</span>
                              {mod.price > 0 && <span>{formatCurrency(mod.price)}</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Special Instructions */}
                      {item.specialInstructions && (
                        <div className="text-xs text-gray-600 italic bg-yellow-50 p-2 rounded">
                          Note: {item.specialInstructions}
                        </div>
                      )}

                      {/* Quantity Controls */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                            className="h-8 w-8 p-0 touch-manipulation"
                          >
                            -
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                            className="h-8 w-8 p-0 touch-manipulation"
                          >
                            +
                          </Button>
                        </div>
                        <div className="font-semibold text-blue-600">
                          {formatCurrency(item.totalPrice)}
                        </div>
                      </div>
                    </div>
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
                    <div className="flex justify-between text-sm">
                      <span>Tax (8%):</span>
                      <span>{formatCurrency(calculateTotal() * 0.08)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-xl">
                      <span>Total:</span>
                      <span className="text-blue-600">{formatCurrency(calculateTotal() * 1.08)}</span>
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
                    <Button
                      onClick={clearCart}
                      variant="outline"
                      className="w-full h-12 touch-manipulation border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear Order
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}