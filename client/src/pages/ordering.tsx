import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ProductCard from "@/components/ProductCard";
import CartItem from "@/components/CartItem";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import type { ProductWithCategory, CartItem as CartItemType } from "@shared/schema";
import { ShoppingCart, CreditCard, Trash2 } from "lucide-react";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "pk_test_placeholder");

export default function OrderingPage() {
  const [cart, setCart] = useState<CartItemType[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const { toast } = useToast();

  const {
    data: products = [],
    isLoading: productsLoading,
  } = useQuery<ProductWithCategory[]>({
    queryKey: ["/api/products"],
  });

  const {
    data: categories = [],
  } = useQuery({
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
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prev, { product, quantity: 1 }];
      }
    });
    
    toast({
      title: "Added to cart",
      description: `${product.name} added to your order`,
    });
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.product.id !== productId));
    } else {
      setCart(prev =>
        prev.map(item =>
          item.product.id === productId
            ? { ...item, quantity }
            : item
        )
      );
    }
  };

  const clearCart = () => {
    setCart([]);
    toast({
      title: "Cart cleared",
      description: "All items removed from your order",
    });
  };

  const filteredProducts = products.filter(product => {
    if (selectedCategory === "all") return product.isActive;
    return product.isActive && product.category?.name === selectedCategory;
  });

  const subtotal = cart.reduce((sum, item) => 
    sum + (parseFloat(item.product.price) * item.quantity), 0
  );
  const tax = subtotal * 0.0825; // 8.25% tax rate
  const total = subtotal + tax;

  const processPayment = async () => {
    if (cart.length === 0) {
      toast({
        title: "Cart is empty",
        description: "Add items to your cart before processing payment",
        variant: "destructive",
      });
      return;
    }

    const orderData = {
      order: {
        customerName: "Walk-in Customer",
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        status: "pending",
      },
      items: cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        price: item.product.price,
      })),
    };

    createOrderMutation.mutate(orderData);
  };

  return (
    <Elements stripe={stripePromise}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Catalog */}
        <div className="lg:col-span-2">
          {/* Category Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedCategory === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory("all")}
                >
                  All Items
                </Button>
                {categories.map((category: any) => (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.name ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category.name)}
                  >
                    {category.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Product Grid */}
          <Card>
            <CardContent className="p-6">
              {productsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="border rounded-lg p-4 animate-pulse">
                      <div className="w-full h-32 bg-slate-200 rounded-md mb-3" />
                      <div className="h-4 bg-slate-200 rounded mb-2" />
                      <div className="h-3 bg-slate-200 rounded mb-2" />
                      <div className="flex justify-between">
                        <div className="h-4 bg-slate-200 rounded w-16" />
                        <div className="h-3 bg-slate-200 rounded w-12" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredProducts.map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onAddToCart={addToCart}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order Cart & Checkout */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <ShoppingCart className="h-5 w-5" />
                <h3 className="text-lg font-semibold text-slate-900">Current Order</h3>
              </div>

              {/* Cart Items */}
              <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
                {cart.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No items in cart</p>
                ) : (
                  cart.map(item => (
                    <CartItem
                      key={item.product.id}
                      item={item}
                      onUpdateQuantity={updateQuantity}
                    />
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <>
                  <Separator className="my-4" />
                  
                  {/* Order Summary */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Subtotal</span>
                      <span className="font-medium">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Tax</span>
                      <span className="font-medium">${tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
                      <span>Total</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Checkout Actions */}
                  <div className="mt-6 space-y-3">
                    <Button
                      className="w-full"
                      onClick={processPayment}
                      disabled={createOrderMutation.isPending}
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      {createOrderMutation.isPending ? "Processing..." : "Process Payment"}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={clearCart}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear Order
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Elements>
  );
}
