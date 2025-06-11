import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Settings } from "lucide-react";
import type { ProductWithCategory, CartItem } from "@shared/schema";

interface QuickOrderCardProps {
  product: ProductWithCategory;
  onQuickAdd: (product: ProductWithCategory) => void;
  onCustomAdd: (cartItem: CartItem) => void;
}

interface ProductModifier {
  id: string;
  name: string;
  category: string;
  price: number;
}

export default function QuickOrderCard({ product, onQuickAdd, onCustomAdd }: QuickOrderCardProps) {
  const [showModifiers, setShowModifiers] = useState(false);
  const [selectedModifiers, setSelectedModifiers] = useState<ProductModifier[]>([]);
  const [selectedSize, setSelectedSize] = useState<ProductModifier | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState("");

  const modificationOptions = (product.modificationOptions as ProductModifier[]) || [];
  const sizeOptions = modificationOptions.filter(mod => mod.category === 'size');
  const otherModifiers = modificationOptions.filter(mod => mod.category !== 'size');

  const handleQuickAdd = (sizeOverride?: ProductModifier) => {
    const basePrice = parseFloat(product.price);
    const sizePrice = sizeOverride ? sizeOverride.price : 0;
    const finalPrice = basePrice + sizePrice;
    
    const cartItem: CartItem = {
      product,
      quantity: 1,
      modifications: sizeOverride ? [sizeOverride] : [],
      specialInstructions: undefined,
      unitPrice: finalPrice,
      totalPrice: finalPrice
    };

    onCustomAdd(cartItem);
  };

  const handleCustomizeClick = () => {
    // Set default size if product has sizes
    if (sizeOptions.length > 0 && !selectedSize) {
      setSelectedSize(sizeOptions[0]);
    }
    setShowModifiers(true);
  };

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

  const handleAddToOrder = () => {
    const finalPrice = calculateTotalPrice();
    const allModifiers = selectedSize ? [selectedSize, ...selectedModifiers] : selectedModifiers;
    
    const cartItem: CartItem = {
      product,
      quantity: 1,
      modifications: allModifiers,
      specialInstructions: specialInstructions || undefined,
      unitPrice: finalPrice,
      totalPrice: finalPrice
    };

    onCustomAdd(cartItem);
    setShowModifiers(false);
    setSelectedModifiers([]);
    setSelectedSize(null);
    setSpecialInstructions("");
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  return (
    <>
      <Card className="group hover:shadow-lg transition-all duration-200 border-2 hover:border-blue-200 touch-manipulation">
        <CardContent className="p-3 sm:p-4">
          <div className="space-y-3">
            {/* Product Image with Overlaid Badges */}
            {product.imageUrl && (
              <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                
                {/* Overlaid Badges */}
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                  {/* Price Badge */}
                  <Badge variant="default" className="text-xs shadow-lg bg-green-600/95 text-white font-semibold backdrop-blur-sm border-0">
                    {formatPrice(parseFloat(product.price))}
                  </Badge>
                  
                  {/* Service/Stock Status Badges */}
                  {product.itemType === "service" ? (
                    <>
                      <Badge variant="outline" className="text-xs shadow-md bg-white/90 backdrop-blur-sm">
                        Service
                      </Badge>
                      {product.serviceDetails?.duration && (
                        <Badge variant="secondary" className="text-xs shadow-md bg-white/90 backdrop-blur-sm">
                          {product.serviceDetails.duration}m
                        </Badge>
                      )}
                      {product.serviceDetails?.appointmentRequired && (
                        <Badge variant="outline" className="text-xs shadow-md bg-white/90 backdrop-blur-sm">
                          Appt Req'd
                        </Badge>
                      )}
                    </>
                  ) : (
                    product.requiresInventory && product.stock <= (product.minStock || 5) && (
                      <Badge variant="destructive" className="text-xs shadow-md bg-red-500/90 backdrop-blur-sm text-white">
                        Low Stock
                      </Badge>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Product Info */}
            <div className="space-y-2">
              <h3 className="font-semibold text-base sm:text-lg leading-tight">{product.name}</h3>
              
              {product.description && (
                <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">{product.description}</p>
              )}
            </div>

            {/* Size Selection with Split Buttons (if product has sizes) */}
            {sizeOptions.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-sm font-medium text-gray-700">Size:</h4>
                <div className="grid grid-cols-1 gap-2">
                  {sizeOptions.map((size) => (
                    <div key={size.id} className="flex rounded-md overflow-hidden border border-gray-300">
                      {/* Quick Add Section (75% width) */}
                      <Button
                        onClick={() => handleQuickAdd(size)}
                        className="flex-1 h-12 text-sm font-semibold touch-manipulation active:scale-95 transition-transform rounded-none border-0"
                        disabled={product.requiresInventory && product.stock === 0}
                      >
                        <div className="flex flex-col">
                          <span>{size.name}</span>
                          <span className="text-xs opacity-75">
                            {formatPrice(parseFloat(product.price) + size.price)}
                          </span>
                        </div>
                      </Button>
                      
                      {/* Customize Section (25% width) */}
                      {otherModifiers.length > 0 && (
                        <Button
                          onClick={() => {
                            setSelectedSize(size);
                            setShowModifiers(true);
                          }}
                          variant="outline"
                          className="w-12 h-12 p-0 touch-manipulation active:scale-95 transition-transform rounded-none border-0 border-l border-gray-300"
                          disabled={product.stock === 0}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons - Touch Optimized */}
            <div className="flex gap-2 pt-2">
              {sizeOptions.length === 0 && (
                <Button
                  onClick={() => handleQuickAdd()}
                  className="flex-1 h-14 sm:h-12 text-base sm:text-lg font-semibold touch-manipulation active:scale-95 transition-transform"
                  disabled={product.requiresInventory && product.stock === 0}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  <span className="hidden xs:inline">
                    {product.itemType === "service" ? "Book " : "Quick "}
                  </span>
                  {product.itemType === "service" ? "Service" : "Add"}
                </Button>
              )}
              
              {(product.allowModifications && otherModifiers.length > 0) && (
                <Button
                  onClick={handleCustomizeClick}
                  variant="outline"
                  className={`h-14 sm:h-12 px-3 sm:px-4 touch-manipulation active:scale-95 transition-transform ${sizeOptions.length > 0 ? 'flex-1' : ''}`}
                  disabled={product.stock === 0}
                >
                  <Settings className="w-5 h-5" />
                  <span className="hidden sm:inline ml-1">
                    {sizeOptions.length > 0 ? "Customize" : "Modify"}
                  </span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modification Dialog - Touch Optimized */}
      <Dialog open={showModifiers} onOpenChange={setShowModifiers}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl">
              {sizeOptions.length > 0 ? `Customize ${product.name}` : `Modify ${product.name}`}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 touch-manipulation">
            {/* Size Selection - Only show if size not pre-selected */}
            {sizeOptions.length > 0 && !selectedSize && (
              <div className="space-y-3">
                <h4 className="font-medium text-lg sm:text-xl">Size (required)</h4>
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

            {/* Show selected size when pre-selected */}
            {selectedSize && (
              <div className="space-y-3">
                <h4 className="font-medium text-lg sm:text-xl">Selected Size</h4>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-blue-900">{selectedSize.name}</span>
                    <span className="font-semibold text-blue-900">
                      {formatPrice(parseFloat(product.price) + selectedSize.price)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Other Modifiers */}
            {otherModifiers.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-lg sm:text-xl">Customer Requests</h4>
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

            {/* Total Price */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center text-xl font-bold">
                <span>Total:</span>
                <span>{formatPrice(calculateTotalPrice())}</span>
              </div>
            </div>

            {/* Add to Order Button */}
            <Button
              onClick={handleAddToOrder}
              className="w-full h-16 sm:h-14 text-lg font-semibold touch-manipulation active:scale-95 transition-transform"
              disabled={sizeOptions.length > 0 && !selectedSize}
            >
              {sizeOptions.length > 0 && !selectedSize ? 'Select Size First' : 'Add to Order'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}