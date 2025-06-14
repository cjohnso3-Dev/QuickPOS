import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, CreditCard, DollarSign, Users, PercentIcon } from 'lucide-react';
import type { CartItem as CartItemType, TipOption, PaymentSplit, OrderWithDetails } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Ensure VITE_STRIPE_PUBLISHABLE_KEY is set in your .env file
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderSubtotal: number;
  orderTax: number;
  orderItems: CartItemType[];
  customerName: string;
  currentOrder?: OrderWithDetails | null; // If an order is already created (e.g., held then processing)
  onPaymentSuccess: (paymentDetails: {
    paymentMethod: 'cash' | 'card' | 'split';
    tipAmount: number;
    totalAmount: number;
    cashReceived?: number;
    changeGiven?: number;
    stripePaymentId?: string;
    splits?: PaymentSplit[];
  }) => void;
  onPaymentCancel: () => void;
}

const defaultTipOptions: TipOption[] = [
  { label: '15%', percentage: 15 },
  { label: '18%', percentage: 18 },
  { label: '20%', percentage: 20 },
  { label: '25%', percentage: 25 },
  { label: 'Custom' },
  { label: 'No Tip' },
];

// Renamed to CheckoutDialogContent to be wrapped by Elements provider
function CheckoutDialogContent({
  open,
  onOpenChange,
  orderSubtotal,
  orderTax,
  orderItems,
  customerName,
  currentOrder,
  onPaymentSuccess,
  onPaymentCancel,
}: CheckoutDialogProps) {
  const { toast } = useToast();
  const [selectedTipOption, setSelectedTipOption] = useState<TipOption | null>(defaultTipOptions[2]); // Default to 20%
  const [customTipAmount, setCustomTipAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'split'>('card');
  const [cashReceived, setCashReceived] = useState<string>("");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [cardPaymentError, setCardPaymentError] = useState<string | null>(null);

  const stripe = useStripe();
  const elements = useElements();

  const calculatedTip = useMemo(() => {
    if (!selectedTipOption) return 0;
    if (selectedTipOption.label === 'No Tip') return 0;
    if (selectedTipOption.label === 'Custom') return parseFloat(customTipAmount) || 0;
    if (selectedTipOption.percentage) return orderSubtotal * (selectedTipOption.percentage / 100);
    return 0;
  }, [selectedTipOption, customTipAmount, orderSubtotal]);

  const finalTotal = useMemo(() => {
    return orderSubtotal + orderTax + calculatedTip;
  }, [orderSubtotal, orderTax, calculatedTip]);

  const changeDue = useMemo(() => {
    if (paymentMethod === 'cash') {
      const received = parseFloat(cashReceived) || 0;
      return Math.max(0, received - finalTotal);
    }
    return 0;
  }, [cashReceived, finalTotal, paymentMethod]);

  useEffect(() => {
    if (open) {
      // Reset state when dialog opens
      setSelectedTipOption(defaultTipOptions[2]);
      setCustomTipAmount("");
      setPaymentMethod('card');
      setCashReceived("");
      setProcessingPayment(false);
      setCardPaymentError(null);
    }
  }, [open]);

  const handleTipSelect = (option: TipOption) => {
    setSelectedTipOption(option);
    if (option.label !== 'Custom') {
      setCustomTipAmount("");
    }
  };

  const handleProcessPayment = async () => {
    setProcessingPayment(true);
    setCardPaymentError(null);

    if (paymentMethod === 'cash') {
      if (parseFloat(cashReceived) < finalTotal) {
        toast({ title: "Insufficient cash received", variant: "destructive" });
        setProcessingPayment(false);
        return;
      }
      onPaymentSuccess({
        paymentMethod: 'cash',
        tipAmount: calculatedTip,
        totalAmount: finalTotal,
        cashReceived: parseFloat(cashReceived),
        changeGiven: changeDue,
      });
    } else if (paymentMethod === 'card') {
      if (!stripe || !elements) {
        toast({ title: "Stripe not loaded", description: "Please try again in a moment.", variant: "destructive" });
        setProcessingPayment(false);
        return;
      }

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        toast({ title: "Card element not found", description: "Please ensure card details are entered correctly.", variant: "destructive" });
        setProcessingPayment(false);
        return;
      }

      try {
        // 1. Create Payment Intent on the server
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: finalTotal }), // Send amount in dollars, backend will convert to cents
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to create payment intent');
        }

        const { client_secret: clientSecret, payment_intent_id: paymentIntentId } = await response.json();

        if (!clientSecret) {
          throw new Error('Client secret not received from server.');
        }

        // 2. Confirm Card Payment
        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: { name: customerName || 'Customer' }, // Optional: Add customer name
          },
        });

        if (error) {
          setCardPaymentError(error.message || "An unexpected error occurred during card payment.");
          toast({ title: "Payment Failed", description: error.message || "Please try again.", variant: "destructive" });
          setProcessingPayment(false);
        } else if (paymentIntent?.status === 'succeeded') {
          onPaymentSuccess({
            paymentMethod: 'card',
            tipAmount: calculatedTip,
            totalAmount: finalTotal,
            stripePaymentId: paymentIntent.id,
          });
          toast({ title: "Payment Successful!", variant: "default" });
          setProcessingPayment(false);
        } else {
          setCardPaymentError("Payment not successful. Status: " + paymentIntent?.status);
          toast({ title: "Payment Not Successful", description: "Status: " + paymentIntent?.status, variant: "destructive" });
          setProcessingPayment(false);
        }
      } catch (error: any) {
        console.error("Payment processing error:", error);
        setCardPaymentError(error.message || "An error occurred while processing your payment.");
        toast({ title: "Payment Error", description: error.message || "Please try again.", variant: "destructive" });
        setProcessingPayment(false);
      }

    } else if (paymentMethod === 'split') {
      toast({ title: "Split Payment UI Placeholder", description: "UI for specifying split amounts and methods is needed." });
      setProcessingPayment(false);
    }
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 m-0 max-w-full w-full h-full flex flex-col overflow-hidden">
        <DialogHeader className="p-4 border-b bg-gray-50 flex justify-between items-center">
          <DialogTitle className="text-2xl font-semibold">Checkout</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" onClick={onPaymentCancel}>
              <X className="h-6 w-6" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Order Summary Section (Left or Top on Mobile) */}
          <div className="w-full md:w-1/3 bg-gray-100 p-6 flex flex-col space-y-4 overflow-y-auto">
            <h3 className="text-xl font-medium">Order Summary</h3>
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span>Customer:</span> <span>{customerName}</span></div>
              {currentOrder && <div className="flex justify-between"><span>Order #:</span> <span>{currentOrder.orderNumber}</span></div>}
            </div>
            <Separator />
            <ScrollArea className="max-h-48">
              {orderItems.map((item, index) => (
                <div key={index} className="py-2 border-b last:border-b-0">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{item.quantity}x {item.product.name}</span>
                    <span className="text-sm font-medium">{formatCurrency(item.totalPrice)}</span>
                  </div>
                  {item.modifications && item.modifications.length > 0 && (
                    <div className="pl-2 text-xs text-gray-500">
                      {item.modifications.map((mod, idx) => <span key={idx} className="mr-1">• {typeof mod === 'object' ? mod.name : mod}</span>)}
                    </div>
                  )}
                </div>
              ))}
            </ScrollArea>
            <Separator />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Subtotal:</span> <span>{formatCurrency(orderSubtotal)}</span></div>
              <div className="flex justify-between"><span>Tax:</span> <span>{formatCurrency(orderTax)}</span></div>
              <div className="flex justify-between"><span>Tip:</span> <span>{formatCurrency(calculatedTip)}</span></div>
              <Separator />
              <div className="flex justify-between text-xl font-bold">
                <span>Total:</span>
                <span>{formatCurrency(finalTotal)}</span>
              </div>
            </div>
          </div>

          {/* Payment Section (Right or Bottom on Mobile) */}
          <div className="flex-1 p-6 flex flex-col space-y-6 overflow-y-auto">
            {/* Tip Selection */}
            <div>
              <h3 className="text-lg font-medium mb-3">Add a Tip</h3>
              <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {defaultTipOptions.map(opt => (
                  <Button
                    key={opt.label}
                    variant={selectedTipOption?.label === opt.label ? 'default' : 'outline'}
                    onClick={() => handleTipSelect(opt)}
                    className={`h-12 text-sm ${selectedTipOption?.label === opt.label ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              {selectedTipOption?.label === 'Custom' && (
                <div className="mt-3">
                  <Label htmlFor="customTip">Custom Tip Amount</Label>
                  <Input
                    id="customTip"
                    type="number"
                    value={customTipAmount}
                    onChange={(e) => setCustomTipAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Payment Method */}
            <div>
              <h3 className="text-lg font-medium mb-3">Payment Method</h3>
              <Tabs value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="card" className="text-sm"><CreditCard className="w-4 h-4 mr-1 inline-block"/>Card</TabsTrigger>
                  <TabsTrigger value="cash" className="text-sm"><DollarSign className="w-4 h-4 mr-1 inline-block"/>Cash</TabsTrigger>
                  <TabsTrigger value="split" className="text-sm"><Users className="w-4 h-4 mr-1 inline-block"/>Split</TabsTrigger>
                </TabsList>
                <TabsContent value="card" className="mt-4">
                  <div className="p-4 border rounded-md bg-gray-50 min-h-[100px]">
                    <CardElement options={{
                      style: {
                        base: { fontSize: '16px' }
                      },
                      hidePostalCode: true
                    }} />
                  </div>
                  {cardPaymentError && <p className="text-red-500 text-sm mt-2">{cardPaymentError}</p>}
                </TabsContent>
                <TabsContent value="cash" className="mt-4 space-y-3">
                  <div>
                    <Label htmlFor="cashReceived">Cash Received</Label>
                    <Input
                      id="cashReceived"
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="Enter amount received"
                      className="mt-1"
                    />
                  </div>
                  {parseFloat(cashReceived) > 0 && (
                    <div className="text-lg font-medium">
                      Change Due: {formatCurrency(changeDue)}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="split" className="mt-4">
                   <div className="p-4 border rounded-md bg-gray-50 min-h-[100px] flex flex-col items-center justify-center">
                    <Users className="w-12 h-12 text-gray-400 mb-2" />
                    <p className="text-gray-500 text-center">UI for specifying split amounts and payment methods is needed.</p>
                    <p className="text-xs text-gray-400 mt-1">This feature is not yet implemented.</p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 border-t bg-gray-50">
          <Button
            variant="outline"
            onClick={onPaymentCancel}
            className="w-full md:w-auto"
            disabled={processingPayment}
          >
            Cancel
          </Button>
          <Button
            onClick={handleProcessPayment}
            className="w-full md:w-auto bg-green-600 hover:bg-green-700"
            disabled={processingPayment || (paymentMethod === 'cash' && (!cashReceived || parseFloat(cashReceived) < finalTotal))}
          >
            {processingPayment ? 'Processing...' : `Pay ${formatCurrency(finalTotal)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Wrapper component that provides the Elements context
export default function CheckoutDialogWrapper(props: CheckoutDialogProps) {
  if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
    console.error("Stripe publishable key is not set. Please set VITE_STRIPE_PUBLISHABLE_KEY in your .env file.");
    // Optionally, render a message to the user or handle this error more gracefully
    return (
      <Dialog open={props.open} onOpenChange={props.onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configuration Error</DialogTitle>
          </DialogHeader>
          <p className="py-4">Stripe payments cannot be processed at this time. Please contact support.</p>
          <DialogFooter>
            <Button onClick={() => props.onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Elements stripe={stripePromise}>
      <CheckoutDialogContent {...props} />
    </Elements>
  );
}