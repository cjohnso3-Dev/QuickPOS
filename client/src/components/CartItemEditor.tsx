
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Settings, Trash2 } from "lucide-react";
import type { ProductWithCategory, CartItem } from "@shared/schema";

interface ProductModifier {
  id: string;
  name: string;
  category: string;
  price: number;
}

interface CartItemEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartItem: CartItem | null;
  onUpdate: (updatedItem: CartItem) => void;
  onRemove: (cartItem: CartItem) => void;
}

export default function CartItemEditor({ 
  open, 
  onOpenChange, 
  cartItem, 
  onUpdate, 
  onRemove 
}: CartItemEditorProps) {
  const [selectedModifiers, setSelectedModifiers] = useState<ProductModifier[]>([]);
  const [selectedSize, setSelectedSize] = useState<ProductModifier | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState("");

  // Initialize state when cart item changes
  useState(() => {
    if (cartItem) {
      const modifications = cartItem.modifications || [];
      const sizeModification = modifications.find(mod => mod.category === 'size');
      const otherModifications = modifications.filter(mod => mod.category !== 'size');
      
      setSelectedSize(sizeModification || null);
      setSelectedModifiers(otherModifications);
      setSpecialInstructions(cartItem.specialInstructions || "");
    }
  });

  if (!cartItem) return null;

  const product = cartItem.product;
  const modificationOptions = (product.modificationOptions as ProductModifier[]) || [];
  const sizeOptions = modificationOptions.filter(mod => mod.category === 'size');
  const otherModifiers = modificationOptions.filter(mod => mod.category !== 'size');

  const handleModifierToggle = (modifier: ProductModifier) => {
    setSelectedModifiers(prev => {
      const exists = prev.find(m => m.id === modifier.id);
      if (exists) {
        return prev.filter(m => m.id !== modifier.id);
      } else {
        return [...prev, modifier];
      }
    });
  };

  const calculateTotalPrice = () => {
    const basePrice = parseFloat(product.price);
    const sizePrice = selectedSize?.price || 0;
    const modifierPrice = selectedModifiers.reduce((sum, mod) => sum + mod.price, 0);
    return basePrice + sizePrice + modifierPrice;
  };

  const handleUpdate = () => {
    const finalPrice = calculateTotalPrice();
    const allModifiers = selectedSize ? [selectedSize, ...selectedModifiers] : selectedModifiers;
    
    const updatedItem: CartItem = {
      ...cartItem,
      modifications: allModifiers,
      specialInstructions: specialInstructions || undefined,
      unitPrice: finalPrice,
      totalPrice: finalPrice * cartItem.quantity
    };

    onUpdate(updatedItem);
    onOpenChange(false);
  };

  const handleRemove = () => {
    onRemove(cartItem);
    onOpenChange(false);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl">
            Edit {product.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 touch-manipulation">
          {/* Current Item Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium">Quantity: {cartItem.quantity}</span>
              <Badge variant="secondary">
                Original: {formatPrice(cartItem.unitPrice)}
              </Badge>
            </div>
          </div>

          {/* Size Selection */}
          {sizeOptions.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-lg sm:text-xl">Size</h4>
              <div className="grid grid-cols-1 gap-3">
                {sizeOptions.map((size) => (
                  <Button
                    key={size.id}
                    variant={selectedSize?.id === size.id ? "default" : "outline"}
                    className="justify-between h-14 sm:h-12 p-4 text-base touch-manipulation active:scale-95 transition-transform"
                    onClick={() => setSelectedSize(size)}
                  >
                    <span className="font-medium">{size.name}</span>
                    <span className="font-semibold">
                      {formatPrice(parseFloat(product.price) + size.price)}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Other Modifiers */}
          {otherModifiers.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-lg sm:text-xl">Modifications</h4>
              <div className="grid grid-cols-1 gap-3">
                {otherModifiers.map((modifier) => {
                  const isSelected = selectedModifiers.some(m => m.id === modifier.id);
                  return (
                    <Button
                      key={modifier.id}
                      variant={isSelected ? "default" : "outline"}
                      className="justify-between h-14 sm:h-12 p-4 text-base touch-manipulation active:scale-95 transition-transform"
                      onClick={() => handleModifierToggle(modifier)}
                    >
                      <span className="font-medium">{modifier.name}</span>
                      <span className="font-semibold">
                        {modifier.price > 0 ? `+${formatPrice(modifier.price)}` : 'Free'}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Special Instructions */}
          <div className="space-y-3">
            <h4 className="font-medium text-lg sm:text-xl">Special Instructions</h4>
            <textarea
              className="w-full p-4 border rounded-md resize-none h-24 text-base touch-manipulation"
              placeholder="Any special requests..."
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
            />
          </div>

          {/* Updated Total Price */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center text-xl font-bold">
              <span>New Unit Price:</span>
              <span>{formatPrice(calculateTotalPrice())}</span>
            </div>
            <div className="flex justify-between items-center text-lg text-gray-600 mt-1">
              <span>Total for {cartItem.quantity}:</span>
              <span>{formatPrice(calculateTotalPrice() * cartItem.quantity)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleRemove}
              variant="destructive"
              className="flex-1 h-14 sm:h-12 text-lg font-semibold touch-manipulation active:scale-95 transition-transform"
            >
              <Trash2 className="w-5 h-5 mr-2" />
              Remove Item
            </Button>
            <Button
              onClick={handleUpdate}
              className="flex-1 h-14 sm:h-12 text-lg font-semibold touch-manipulation active:scale-95 transition-transform"
            >
              <Settings className="w-5 h-5 mr-2" />
              Update Item
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
