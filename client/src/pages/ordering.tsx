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
import CartItem from "@/components/CartItem";
import { ShoppingCart, Trash2, CreditCard, DollarSign } from "lucide-react";
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
      orderType: "dine-in",
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

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Order Menu</h1>
            <div className="text-sm text-muted-foreground">
              Fast service • Quick add or customize
            </div>
          </div>

          {/* Category Filter */}
          <Tabs value={selectedCategory?.toString() || "all"} className="w-full">
            <TabsList className="grid grid-cols-4 lg:grid-cols-6">
              <TabsTrigger 
                value="all" 
                onClick={() => setSelectedCategory(null)}
                className="text-xs"
              >
                All Items
              </TabsTrigger>
              {categories.map((category) => (
                <TabsTrigger
                  key={category.id}
                  value={category.id.toString()}
                  onClick={() => setSelectedCategory(category.id)}
                  className="text-xs"
                >
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Products Grid */}
          {productsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 bg-gray-200 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeProducts.map((product) => (
                <QuickOrderCard
                  key={product.id}
                  product={product}
                  onQuickAdd={addToCart}
                  onCustomAdd={addCustomItemToCart}
                />
              ))}
            </div>
          )}

          {activeProducts.length === 0 && !productsLoading && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No products available in this category.</p>
            </div>
          )}
        </div>

        {/* Cart Section */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Current Order ({cart.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full p-2 border rounded-md"
                  placeholder="Customer name..."
                />
              </div>

              <Separator />

              {/* Cart Items */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {cart.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Cart is empty
                  </p>
                ) : (
                  cart.map((item, index) => (
                    <div key={index} className="border rounded-lg p-3 space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium">{item.product.name}</h4>
                          <div className="text-sm text-muted-foreground">
                            {formatCurrency(item.unitPrice)} each
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeCartItem(index)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Modifications */}
                      {item.modifications && item.modifications.length > 0 && (
                        <div className="text-xs space-y-1">
                          {item.modifications.map((mod: any, modIndex) => (
                            <div key={modIndex} className="flex justify-between text-muted-foreground">
                              <span>+ {mod.name}</span>
                              {mod.price > 0 && <span>{formatCurrency(mod.price)}</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Special Instructions */}
                      {item.specialInstructions && (
                        <div className="text-xs text-muted-foreground italic">
                          Note: {item.specialInstructions}
                        </div>
                      )}

                      {/* Quantity and Total */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                            className="h-8 w-8 p-0"
                          >
                            -
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                            className="h-8 w-8 p-0"
                          >
                            +
                          </Button>
                        </div>
                        <div className="font-semibold">
                          {formatCurrency(item.totalPrice)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <>
                  <Separator />
                  
                  {/* Order Summary */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(calculateTotal())}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tax (8%):</span>
                      <span>{formatCurrency(calculateTotal() * 0.08)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span>{formatCurrency(calculateTotal() * 1.08)}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <Button
                      onClick={handleCheckout}
                      className="w-full h-12 text-lg font-semibold"
                      disabled={createOrderMutation.isPending}
                    >
                      <CreditCard className="w-5 h-5 mr-2" />
                      {createOrderMutation.isPending ? "Processing..." : "Place Order"}
                    </Button>
                    <Button
                      onClick={clearCart}
                      variant="outline"
                      className="w-full"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear Cart
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}