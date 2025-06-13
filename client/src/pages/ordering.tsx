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
import type { ProductWithCategory, Category, CartItem as CartItemType, TipOption, PaymentSplit, Discount, OrderWithDetails, InsertOrder, Order, Setting, InsertOrderApiPayload } from "@shared/schema"; // Added InsertOrderApiPayload
import { CheckoutDialog } from "@/components/CheckoutDialog"; // Import CheckoutDialog

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
  const [showHeldOrdersDialog, setShowHeldOrdersDialog] = useState(false);
  const [currentOrderForCheckout, setCurrentOrderForCheckout] = useState<OrderWithDetails | Omit<InsertOrderApiPayload, 'items'> | null>(null);
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

  const { data: settings = [] } = useQuery<Setting[]>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const response = await fetch("/api/settings?category=orders"); // Fetch only order-related settings
      if (!response.ok) throw new Error("Failed to fetch settings");
      return response.json();
    }
  });

  const heldOrdersRequireManagerSetting = settings.find(s => s.key === 'held_orders_require_manager');
  const doesHeldOrderRequireManager = heldOrdersRequireManagerSetting?.value === 'true';


  const { data: heldOrders = [], isLoading: heldOrdersLoading } = useQuery<OrderWithDetails[]>({
    queryKey: ["/api/orders/held"],
    queryFn: async () => {
      const response = await fetch("/api/orders?status=HELD");
      if (!response.ok) throw new Error("Failed to fetch held orders");
      return response.json();
    },
    // Enable if manager is authorized OR if the setting doesn't require manager
    enabled: doesHeldOrderRequireManager ? isManagerAuthorized : true,
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status, managedBy }: { orderId: number; status: string; managedBy?: number }) => {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, managedBy }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to update order status" }));
        throw new Error(errorData.message || "Failed to update order status");
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Order Status Updated",
        description: `Order ${data.orderNumber} status changed to ${variables.status}.`,
      });
      // Always invalidate to refetch from server, ensuring consistency
      queryClient.invalidateQueries({ queryKey: ["/api/orders/held"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders", variables.orderId] });

      // If an order was cancelled, also update the client-side state for immediate UI feedback
      // This is an optimistic update of sorts before the query refetches.
      if (variables.status === 'CANCELLED') {
        queryClient.setQueryData<OrderWithDetails[]>(["/api/orders/held"], (oldData) => {
          return oldData ? oldData.filter(order => order.id !== variables.orderId) : [];
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Status Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createOrderMutation = useMutation<Order, Error, Omit<InsertOrderApiPayload, 'items'>>({ // items will be handled separately, use InsertOrderApiPayload
    mutationFn: async (orderData: Omit<InsertOrderApiPayload, 'items'>) => { // Use InsertOrderApiPayload
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to create order" }));
        throw new Error(errorData.message || "Failed to create order");
      }
      return response.json();
    },
    onSuccess: (data, variables) => { // data is the created Order from server, which now includes the server-generated orderNumber
      toast({
        title: data.status === 'HELD' ? "Order Held!" : "Order Placed!", // Use data.status for consistency
        description: `Order ${data.orderNumber} has been ${data.status === 'HELD' ? 'held' : 'processed'}.`, // Use data.orderNumber and data.status
      });

      if (data.status !== 'HELD') { // Only clear cart and reset for non-HELD orders here
        setCart([]);
        setCustomerName("Walk-in Customer");
        setAppliedDiscount(null);
        setTipAmount(0);
      }
      
      // If order is placed (not just held), and we intend to proceed to payment,
      // we might want to store the new order's ID to pass to the checkout modal.
      if (data.status !== 'HELD' && data.id && data.status !== 'COMPLETED') {
        // If it was a "Proceed to Payment" click that created a PENDING_PAYMENT order
        // We might want to open checkout here, or rely on the button's setShowCheckout(true)
      }
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/held"] });

      if (data.status === 'COMPLETED') {
        setShowCheckout(false); // Close checkout dialog on successful finalization
        setCurrentOrderForCheckout(null); // Clear the order context
      }
      // For HELD orders, setCurrentOrderForCheckout will be handled in the specific mutate call's onSuccess
    },
    onError: (error: Error) => {
      toast({
        title: "Order failed",
        description: "There was an error processing your order.",
        variant: "destructive",
      });
    },
  });

  // Placeholder for createOrderItemMutation
  const createOrderItemMutation = useMutation({
    mutationFn: async (orderItemData: { orderId: number; productId: number; quantity: number; unitPrice: string; totalPrice: string; modifications?: any[]; specialInstructions?: string; }) => {
      // This endpoint needs to be created on the backend
      const response = await fetch(`/api/order-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderItemData),
      });
      if (!response.ok) throw new Error("Failed to create order item");
      return response.json();
    },
    onSuccess: (data) => {
      // console.log("Order item created:", data);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add item to order",
        description: error.message,
        variant: "destructive",
      });
    },
  });


  const [showCheckout, setShowCheckout] = useState(false);
  const [showCartEditor, setShowCartEditor] = useState(false);
  const [editingCartItem, setEditingCartItem] = useState<CartItemType | null>(null);
  const [tipAmount, setTipAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'split'>('card'); // Default to card for checkout
  const [cashReceived, setCashReceived] = useState("");
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
  const printReceiptRef = useRef<() => void>();
  const [processingPayment, setProcessingPayment] = useState(false);


  const handleProceedToPayment = () => {
    // const orderNumber = `ORD-${Date.now().toString().slice(-8)}`; // No longer generate here
    const subtotal = calculateDiscountedTotal();
    const taxAmount = subtotal * 0.08;
    // Tip will be added in CheckoutDialog, so total here is pre-tip
    const totalPreTip = subtotal + taxAmount;

      // This object is for the CheckoutDialog's context and display, and for the mutation.
      // It should match the type Omit<InsertOrderApiPayload, 'items'> which createOrderMutation expects.
      const orderDataForCheckoutDialogAndMutation: Omit<InsertOrderApiPayload, 'items'> = {
        customerName,
        orderType: "takeout",
        subtotal: subtotal.toString(),
        tax: taxAmount.toString(),
        tipAmount: "0", // Tip is handled in checkout dialog, this is for the order record
        discountAmount: (calculateTotal() - subtotal).toString(),
        total: totalPreTip.toString(), // This is pre-tip total for the order record
        status: 'PENDING_PAYMENT', // Status before actual payment attempt
        // createdBy and managedBy can be added here or in handlePaymentSuccess if needed from auth context
      };
      setCurrentOrderForCheckout(orderDataForCheckoutDialogAndMutation);
    setShowCheckout(true);
  };

  const handlePaymentSuccess = (paymentDetails: {
    paymentMethod: 'cash' | 'card' | 'split';
    tipAmount: number;
    totalAmount: number; // This is the grand total including tip
    cashReceived?: number;
    changeGiven?: number;
    stripePaymentId?: string;
    splits?: PaymentSplit[];
  }) => {
    if (!currentOrderForCheckout) {
      toast({ title: "Error", description: "No order context for payment.", variant: "destructive" });
      setProcessingPayment(false);
      return;
    }
    setProcessingPayment(true);

    let orderDataForMutation: Omit<InsertOrderApiPayload, 'items'>; // Use InsertOrderApiPayload
    // Dummy user ID, replace with actual authenticated user ID
    const currentUserId = users.find(u => u.role === 'employee')?.id ?? users.find(u => u.role === 'manager')?.id ?? 1;


    if ('id' in currentOrderForCheckout && currentOrderForCheckout.id && 'orderNumber' in currentOrderForCheckout && currentOrderForCheckout.orderNumber) {
      // This case means we are completing an existing HELD order that already has an orderNumber from the server.
      // We need to ensure we pass this existing orderNumber if we are updating the order to COMPLETED.
      // However, the createOrderMutation is for creating new orders or finalizing PENDING_PAYMENT orders
      // that don't yet have a server-side ID.
      // For updating a HELD order to COMPLETED, we should ideally use an updateOrderMutation.
      // For now, if it's a HELD order being completed, we'll prepare data for createOrder,
      // but the server's createOrder will generate a *new* orderNumber. This is not ideal for "completing"
      // a HELD order by its original number. This part needs rethinking if we want to preserve orderNumber
      // when moving from HELD to COMPLETED via this flow.
      // The current setup implies that "Proceed to Payment" from a loaded HELD order effectively creates a new COMPLETED order.

      const existingOrder = currentOrderForCheckout as OrderWithDetails; // It has an ID and orderNumber
      const currentSubtotal = calculateDiscountedTotal();
      const currentTax = currentSubtotal * 0.08;
      const currentDiscountAmount = (calculateTotal() - currentSubtotal);
      
      // This path will create a NEW order record with a NEW order number.
      // If the intent was to update the HELD order to COMPLETED, this is incorrect.
      // We are sending data that looks like a new order, minus the orderNumber.
      orderDataForMutation = {
        // orderNumber: existingOrder.orderNumber, // DO NOT SEND - server generates
        customerName: existingOrder.customerName || "Walk-in Customer",
        customerPhone: existingOrder.customerPhone,
        customerEmail: existingOrder.customerEmail,
        orderType: existingOrder.orderType,
        tableNumber: existingOrder.tableNumber,
        notes: existingOrder.notes,
        subtotal: currentSubtotal.toString(),
        tax: currentTax.toString(),
        discountAmount: currentDiscountAmount.toString(),
        tipAmount: paymentDetails.tipAmount.toString(),
        total: paymentDetails.totalAmount.toString(),
        status: 'COMPLETED',
        createdBy: existingOrder.createdByUser?.id ?? (typeof existingOrder.createdBy === 'number' ? existingOrder.createdBy : currentUserId),
        managedBy: existingOrder.managedByUser?.id ?? (typeof existingOrder.managedBy === 'number' ? existingOrder.managedBy : (isManagerAuthorized ? currentUserId : undefined)),
      };

    } else {
       // This is for a new order (not previously HELD) or a PENDING_PAYMENT order from handleProceedToPayment
       // currentOrderForCheckout should be of type Omit<InsertOrderApiPayload, 'items'> here
       const newOrderDraft = currentOrderForCheckout as Omit<InsertOrderApiPayload, 'items'>;
       orderDataForMutation = {
        customerName: newOrderDraft.customerName,
        orderType: newOrderDraft.orderType,
        subtotal: newOrderDraft.subtotal,
        tax: newOrderDraft.tax,
        discountAmount: newOrderDraft.discountAmount,
        tipAmount: paymentDetails.tipAmount.toString(),
        total: paymentDetails.totalAmount.toString(),
        status: 'COMPLETED',
        createdBy: currentUserId, // Current user creates this new order
        managedBy: isManagerAuthorized ? currentUserId : undefined, // Current manager if authorized
      };
    }
    
    createOrderMutation.mutate(orderDataForMutation, {
      onSuccess: (createdOrder) => {
        if (createdOrder && createdOrder.id) {
          // Persist the full order details (including server-generated orderNumber)
          const fullOrderContext = { ...createdOrder, items: cart.map(ci => ({...ci.product, quantity: ci.quantity, unitPrice: ci.unitPrice.toString(), totalPrice: ci.totalPrice.toString(), modifications: ci.modifications, specialInstructions: ci.specialInstructions })) };
          setCurrentOrderForCheckout(fullOrderContext as unknown as OrderWithDetails);


          // Create order items associated with this newly created order
          cart.forEach(cartItem => {
            createOrderItemMutation.mutate({
              orderId: createdOrder.id!,
              productId: cartItem.product.id,
              quantity: cartItem.quantity,
              unitPrice: cartItem.unitPrice.toString(),
              totalPrice: cartItem.totalPrice.toString(),
              modifications: cartItem.modifications,
              specialInstructions: cartItem.specialInstructions,
            });
          });
          // Global onSuccess will handle toast and, if status is COMPLETED, cart clearing & UI reset.
        }
        setProcessingPayment(false);
      },
      onError: (error) => {
        setProcessingPayment(false);
        // Global onError of createOrderMutation handles toast
        toast({
          title: "Payment Finalization Failed",
          description: error.message || "Could not finalize the order after payment.",
          variant: "destructive",
        });
      }
    });
  };

  const handlePaymentCancel = () => {
    setShowCheckout(false);
    setCurrentOrderForCheckout(null);
    toast({ title: "Checkout Cancelled", description: "The payment process was cancelled."});
  };

  const updateCartQuantity = (product: ProductWithCategory, quantity: number) => {
    const productId = product.id;
    if (quantity === 0) {
      setCart(prev => prev.filter(item => item.product.id !== productId));
    } else {
      setCart(prev => prev.map(item =>
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

  const handleCheckout = (status: 'HELD' | 'PENDING_PAYMENT' | 'COMPLETED') => {
    if (cart.length === 0 && status !== 'PENDING_PAYMENT') { // Allow PENDING_PAYMENT to proceed to checkout dialog even if cart is empty (e.g. loading a held order)
      toast({
        title: "Cart is empty",
        description: "Please add items to your cart.",
        variant: "destructive",
      });
      return;
    }

    // Dummy user ID, replace with actual authenticated user ID
    const currentUserId = users.find(u => u.role === 'employee')?.id ?? users.find(u => u.role === 'manager')?.id ?? 1;

    if (status === 'PENDING_PAYMENT') {
      // This case is now handled by handleProceedToPayment, which sets up currentOrderForCheckout
      // and then shows the CheckoutDialog. The actual order creation happens in handlePaymentSuccess.
      handleProceedToPayment();
      return;
    }
    
    // This part is now primarily for 'HELD' orders.
    // 'COMPLETED' status is handled by handlePaymentSuccess.
    if (status === 'HELD') {
      // const orderNumber = `ORD-${Date.now().toString().slice(-8)}`; // No longer generate here
      const subtotal = calculateDiscountedTotal();
      const taxAmount = subtotal * 0.08;
      const totalForHold = subtotal + taxAmount + tipAmount; // tipAmount is from state

      const orderDataForHold: Omit<InsertOrderApiPayload, 'items' | 'orderNumber'> = { // orderNumber removed
        // orderNumber, // Server will generate
        customerName,
        orderType: "takeout", // Or determine dynamically
        subtotal: subtotal.toString(),
        tax: taxAmount.toString(),
        tipAmount: tipAmount.toString(),
        discountAmount: (calculateTotal() - subtotal).toString(),
        total: totalForHold.toString(),
        status: 'HELD',
        createdBy: currentUserId,
        managedBy: isManagerAuthorized ? currentUserId : undefined,
      };

      createOrderMutation.mutate(orderDataForHold as Omit<InsertOrderApiPayload, 'items'>, {
        onSuccess: (createdOrder) => {
          if (createdOrder && createdOrder.id) {
            // Persist the full order details for the HELD order
            const fullHeldOrderContext = { ...createdOrder, items: cart.map(ci => ({...ci.product, quantity: ci.quantity, unitPrice: ci.unitPrice.toString(), totalPrice: ci.totalPrice.toString(), modifications: ci.modifications, specialInstructions: ci.specialInstructions })) };
            setCurrentOrderForCheckout(fullHeldOrderContext as unknown as OrderWithDetails);

            // Create order items for this HELD order
            cart.forEach(cartItem => {
              createOrderItemMutation.mutate({
                orderId: createdOrder.id!,
                productId: cartItem.product.id,
                quantity: cartItem.quantity,
                unitPrice: cartItem.unitPrice.toString(),
                totalPrice: cartItem.totalPrice.toString(),
                modifications: cartItem.modifications,
                specialInstructions: cartItem.specialInstructions,
              });
            });
            // After items are sent for creation, clear the cart for a new transaction
            setCart([]);
            setCustomerName("Walk-in Customer");
            setAppliedDiscount(null);
            setTipAmount(0);
          }
          // Global onSuccess of createOrderMutation will handle the toast.
        },
        onError: (error) => {
           // Global onError of createOrderMutation will handle the toast
           toast({
            title: "Failed to Hold Order",
            description: error.message || "Could not save the order on hold.",
            variant: "destructive",
          });
        }
      });
    }
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

  const actuallyLoadHeldOrder = (orderToLoad: OrderWithDetails) => {
    const cartItemsFromHeldOrder = orderToLoad.items
      .map(heldItem => {
        // Find the full product details from the main products list
        const fullProduct = products.find(p => p.id === heldItem.productId);
        if (!fullProduct) {
          console.warn(`Product with ID ${heldItem.productId} not found in current product list. Skipping item from held order.`);
          return null; // Skip this item if the product doesn't exist anymore
        }
        return {
          product: fullProduct, // Use the full ProductWithCategory object
          quantity: heldItem.quantity,
          unitPrice: parseFloat(heldItem.unitPrice),
          totalPrice: parseFloat(heldItem.totalPrice),
          modifications: (heldItem.modifications || []) as any[],
          specialInstructions: heldItem.specialInstructions || "",
        };
      })
      .filter(item => item !== null) as CartItemType[]; // Filter out any nulls (skipped items)

    setCart(cartItemsFromHeldOrder);

    setCustomerName(orderToLoad.customerName || "Walk-in Customer");

    // When loading a held order, clear any currently applied discount in the UI.
    // The financial impact of the original discount is already part of orderToLoad's totals.
    setAppliedDiscount(null);

    setTipAmount(parseFloat(orderToLoad.tipAmount || "0"));
    setCurrentOrderForCheckout(orderToLoad); // Set the loaded order as the context for potential payment

    toast({
      title: "Order Loaded",
      description: `Order ${orderToLoad.orderNumber} has been loaded into the cart.`,
    });
    setShowHeldOrdersDialog(false);

    const managerUserId = users.find(u => u.role === 'manager')?.id ?? users.find(u => u.role === 'employee')?.id;
    updateOrderStatusMutation.mutate({ orderId: orderToLoad.id, status: 'PROCESSING', managedBy: managerUserId });
  };

  const handleLoadHeldOrder = (orderToLoad: OrderWithDetails) => {
    if (cart.length > 0) {
      if (window.confirm("You have an active order. Do you want to put the current order on hold and load the selected one?")) {
        // Hold current order first
        // const currentOrderNumber = `ORD-${Date.now().toString().slice(-8)}`; // No longer generate here
        const currentSubtotal = calculateDiscountedTotal();
        const currentTaxAmount = currentSubtotal * 0.08;
        const currentTotalForHold = currentSubtotal + currentTaxAmount + tipAmount;
        const currentUserId = users.find(u => u.role === 'employee')?.id ?? users.find(u => u.role === 'manager')?.id ?? 1;

        const currentOrderDataForHold: Omit<InsertOrderApiPayload, 'items' | 'orderNumber'> = { // orderNumber removed
          // orderNumber: currentOrderNumber, // Server will generate
          customerName,
          orderType: "takeout",
          subtotal: currentSubtotal.toString(),
          tax: currentTaxAmount.toString(),
          tipAmount: tipAmount.toString(),
          discountAmount: (calculateTotal() - currentSubtotal).toString(),
          total: currentTotalForHold.toString(),
          status: 'HELD',
          createdBy: currentUserId,
          managedBy: isManagerAuthorized ? currentUserId : undefined,
        };

        createOrderMutation.mutate(currentOrderDataForHold as Omit<InsertOrderApiPayload, 'items'>, { // Cast to satisfy
          onSuccess: (heldCurrentOrder) => {
            if (heldCurrentOrder && heldCurrentOrder.id) {
              // Items for the *current order being put on hold* need to be created.
              // The `cart` at this point IS the current order's items.
              const itemsToHold = [...cart]; // Capture cart before it's cleared by global or subsequent logic

              itemsToHold.forEach(cartItem => {
                createOrderItemMutation.mutate({
                  orderId: heldCurrentOrder.id!, // Use the ID of the order just put on hold
                  productId: cartItem.product.id,
                  quantity: cartItem.quantity,
                  unitPrice: cartItem.unitPrice.toString(),
                  totalPrice: cartItem.totalPrice.toString(),
                  modifications: cartItem.modifications,
                  specialInstructions: cartItem.specialInstructions,
                });
              });
              
              // Clear cart and reset UI for the *newly loaded* order (which happens in actuallyLoadHeldOrder)
              // The global onSuccess for createOrderMutation (for the HELD order) will show a toast.
              // It will NOT clear the cart because status is 'HELD'.
              // We need to clear the cart here because we are about to load a *different* order.
              setCart([]);
              setCustomerName("Walk-in Customer"); // Reset for the order to be loaded
              setAppliedDiscount(null);
              setTipAmount(0);

              // Now, load the originally selected held order
              actuallyLoadHeldOrder(orderToLoad);
            } else {
              // If holding the current order failed for some reason, still try to load the target order
              // but maybe with a warning or after clearing the cart.
              // For now, just proceed to load, which will clear the cart if it's not empty.
              actuallyLoadHeldOrder(orderToLoad);
            }
          },
          onError: (error) => {
            toast({
              title: "Failed to Hold Current Order",
              description: `Could not hold the current order before loading. ${error.message}`,
              variant: "destructive",
            });
          }
        });
      } else {
        // User chose not to hold the current order
        return;
      }
    } else {
      // Cart is empty, just load the held order
      actuallyLoadHeldOrder(orderToLoad);
    }
  };

  // Dummy users data for managerId - replace with actual user context/auth
  const users = [
    { id: 1, name: "Admin User", role: "admin" },
    { id: 2, name: "Manager User", role: "manager" },
    { id: 3, name: "Employee User", role: "employee" },
  ];

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
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (doesHeldOrderRequireManager && !isManagerAuthorized) {
                    toast({
                      title: "Manager Access Required",
                      description: "Please log in as a manager to view held orders.",
                      variant: "destructive"
                    });
                    // Optionally, prompt for manager PIN here or direct to manager login
                    // setShowManagerInterface(true);
                  } else {
                    setShowHeldOrdersDialog(true);
                  }
                }}
                className="bg-yellow-500 text-white border-yellow-500 hover:bg-yellow-600 relative"
              >
                <Receipt className="h-4 w-4 mr-1" />
                Held Orders
                {heldOrders && heldOrders.length > 0 && (
                  <Badge variant="destructive" className="absolute -top-2 -right-2 px-1.5 py-0.5 text-xs">
                    {heldOrders.length}
                  </Badge>
                )}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-32 sm:h-36 bg-gray-200 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <h2 className="font-semibold">
                      Order #{currentOrderForCheckout && 'orderNumber' in currentOrderForCheckout && currentOrderForCheckout.orderNumber
                                ? currentOrderForCheckout.orderNumber.replace('ORD-', '')
                                : cart.length > 0 ? "New" : "----"}
                    </h2>
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
                {/* Scrollable Area for Customer Info and Cart Items */}
                <div className="flex-1 overflow-y-auto">
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

                  {/* Cart Items List */}
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
                                    <p key={idx} className="text-xs text-gray-500">• {typeof mod === 'object' && mod !== null && mod.name ? mod.name : mod}</p>
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
                                  onChange={(e) => updateCartQuantity(item.product, parseInt(e.target.value) || 0)}
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
                {/* End Scrollable Area */}

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
                        onClick={() => handleCheckout('HELD')}
                        className="w-full bg-orange-500 hover:bg-orange-600"
                        disabled={createOrderMutation.isPending}
                      >
                        {createOrderMutation.isPending && appliedDiscount?.name.startsWith("Comp:") ? "Processing..." : createOrderMutation.isPending ? "Holding..." : "Hold Order"}
                      </Button>
                      <Button
                        onClick={handleProceedToPayment}
                        className="w-full bg-green-600 hover:bg-green-700"
                        disabled={createOrderMutation.isPending || cart.length === 0}
                      >
                        Proceed to Payment
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
                      onClick={() => handleCheckout('HELD')}
                      className="w-full bg-orange-500 hover:bg-orange-600"
                      disabled={createOrderMutation.isPending}
                    >
                      Hold Order
                    </Button>
                    <Button
                      onClick={handleProceedToPayment}
                      className="w-full bg-green-600 hover:bg-green-700"
                      disabled={createOrderMutation.isPending || cart.length === 0}
                    >
                      Proceed to Payment
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
              <TabsList className="grid grid-cols-4 w-full"> {/* Changed to grid-cols-4 */}
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
                <TabsTrigger value="heldOrders" className="text-xs sm:text-sm" onClick={() => setShowHeldOrdersDialog(true)}>
                  <Receipt className="w-4 h-4 mr-1" />
                  Held Orders
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

      {/* Held Orders Dialog */}
      <Dialog open={showHeldOrdersDialog} onOpenChange={setShowHeldOrdersDialog}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl flex items-center gap-2">
              <Receipt className="w-6 h-6 text-blue-600" />
              Held Orders
            </DialogTitle>
          </DialogHeader>
          {heldOrdersLoading ? (
            <p>Loading held orders...</p>
          ) : heldOrders.length === 0 ? (
            <p className="text-gray-500 py-8 text-center">No orders are currently on hold.</p>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-3 pr-2">
                {heldOrders.map((order) => (
                  <Card key={order.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{order.orderNumber}</p>
                        <p className="text-sm text-gray-600">{order.customerName || "Walk-in"}</p>
                        <p className="text-xs text-gray-500">
                          {order.items.length} item(s) - Total: {formatCurrency(parseFloat(order.total))}
                       </p>
                       <p className="text-xs text-gray-500">
                         Held at: {order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : 'N/A'}
                       </p>
                     </div>
                     <div className="flex gap-2">
                       <Button onClick={() => {
                         // When loading a held order, it becomes the current order for checkout
                         setCurrentOrderForCheckout(order);
                         handleLoadHeldOrder(order);
                       }} size="sm">
                         Load Order
                       </Button>
                       <Button
                         onClick={() => {
                           // Confirm before cancelling
                           if (window.confirm(`Are you sure you want to cancel order ${order.orderNumber}? This action cannot be undone.`)) {
                             const managerUserId = users.find(u => u.role === 'manager')?.id; // Or get from auth context
                             updateOrderStatusMutation.mutate({ orderId: order.id, status: 'CANCELLED', managedBy: managerUserId });
                           }
                         }}
                         size="sm"
                         variant="destructive"
                         disabled={updateOrderStatusMutation.isPending && updateOrderStatusMutation.variables?.orderId === order.id && updateOrderStatusMutation.variables?.status === 'CANCELLED'}
                       >
                         {updateOrderStatusMutation.isPending && updateOrderStatusMutation.variables?.orderId === order.id && updateOrderStatusMutation.variables?.status === 'CANCELLED' ? "Cancelling..." : "Cancel"}
                       </Button>
                     </div>
                   </CardContent>
                 </Card>
               ))}
              </div>
            </ScrollArea>
          )}
           <div className="flex justify-end mt-4">
            <Button
              onClick={() => setShowHeldOrdersDialog(false)}
              variant="outline"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      {showCheckout && currentOrderForCheckout && (cart.length > 0 || ('items' in currentOrderForCheckout && currentOrderForCheckout.items.length > 0)) && (
        <CheckoutDialog
          open={showCheckout}
          onOpenChange={setShowCheckout}
          orderSubtotal={calculateDiscountedTotal()}
          orderTax={calculateDiscountedTotal() * 0.08}
          orderItems={cart}
          customerName={customerName}
          currentOrder={currentOrderForCheckout as OrderWithDetails | null}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentCancel={handlePaymentCancel}
        />
      )}
    </div>
  );
}