
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VirtualKeyboard } from "@/components/ui/virtual-keyboard";
import { Plus, Settings, ShoppingCart } from "lucide-react";
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

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
    if (sizeOptions.length > 0 && !selectedSize) {
      setSelectedSize(sizeOptions[0]);
    }
    setShowModifiers(true);
  };

  const handleAddWithModifications = () => {
    const basePrice = parseFloat(product.price);
    const sizePrice = selectedSize ? selectedSize.price : 0;
    const modifiersPrice = selectedModifiers.reduce((sum, mod) => sum + mod.price, 0);
    const finalPrice = basePrice + sizePrice + modifiersPrice;

    const modifications = [
      ...(selectedSize ? [selectedSize] : []),
      ...selectedModifiers
    ];

    const cartItem: CartItem = {
      product,
      quantity: 1,
      modifications,
      specialInstructions: specialInstructions || undefined,
      unitPrice: finalPrice,
      totalPrice: finalPrice
    };

    onCustomAdd(cartItem);
    setShowModifiers(false);
    setSelectedModifiers([]);
    setSelectedSize(sizeOptions.length > 0 ? sizeOptions[0] : null);
    setSpecialInstructions("");
  };

  const toggleModifier = (modifier: ProductModifier) => {
    setSelectedModifiers(prev =>
      prev.find(m => m.id === modifier.id)
        ? prev.filter(m => m.id !== modifier.id)
        : [...prev, modifier]
    );
  };

  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock <= (product.minStock || 5) && product.stock > 0;

  return (
    <>
      <Card className={`relative overflow-hidden transition-all duration-200 hover:shadow-md ${
        isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'
      }`}>
        <CardContent className="p-0">
          {/* Product Image */}
          <div className="relative aspect-square bg-gray-100">
            <img
              src={product.imageUrl || "https://via.placeholder.com/200x200?text=No+Image"}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            
            {/* Price Badge */}
            <div className="absolute top-2 left-2">
              <Badge 
                className="bg-green-600 text-white font-semibold px-2 py-1 text-sm"
              >
                {formatCurrency(parseFloat(product.price))}
              </Badge>
            </div>

            {/* Stock Status */}
            {isOutOfStock && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Badge variant="destructive" className="text-white font-medium">
                  Out of Stock
                </Badge>
              </div>
            )}
            
            {isLowStock && (
              <div className="absolute top-2 right-2">
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                  Low Stock
                </Badge>
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="p-3">
            <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">
              {product.name}
            </h3>
            <p className="text-sm text-gray-600 mb-3 line-clamp-2 min-h-[2.5rem]">
              {product.description || "No description available"}
            </p>

            {/* Size Options for Quick Add */}
            {sizeOptions.length > 0 && !isOutOfStock && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-700 mb-2">Size:</p>
                <div className="grid grid-cols-1 gap-1">
                  {sizeOptions.slice(0, 3).map((size) => (
                    <Button
                      key={size.id}
                      onClick={() => handleQuickAdd(size)}
                      variant="outline"
                      size="sm"
                      className="justify-between h-8 px-2 text-xs font-medium hover:bg-blue-50 hover:border-blue-300"
                    >
                      <span>{size.name}</span>
                      <span className="text-blue-600 font-semibold">
                        {formatCurrency(parseFloat(product.price) + size.price)}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              {!isOutOfStock && (
                <>
                  {sizeOptions.length === 0 ? (
                    <Button
                      onClick={() => onQuickAdd(product)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-9"
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  ) : null}
                  
                  {(modificationOptions.length > 0 || product.description?.includes('customizable')) && (
                    <Button
                      onClick={handleCustomizeClick}
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 hover:bg-gray-50"
                    >
                      <Settings className="w-4 h-4 mr-1" />
                      Modify
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Stock Info */}
            <div className="mt-2 text-xs text-gray-500 text-center">
              {product.stock} {product.stock === 1 ? 'item' : 'items'} available
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customization Modal */}
      <Dialog open={showModifiers} onOpenChange={setShowModifiers}>
        <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Customize {product.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Size Selection */}
            {sizeOptions.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Size (Required)</h4>
                <div className="grid grid-cols-1 gap-2">
                  {sizeOptions.map((size) => (
                    <Button
                      key={size.id}
                      onClick={() => setSelectedSize(size)}
                      variant={selectedSize?.id === size.id ? "default" : "outline"}
                      className="justify-between h-10"
                    >
                      <span>{size.name}</span>
                      <span>+{formatCurrency(size.price)}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Other Modifiers */}
            {otherModifiers.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Add-ons (Optional)</h4>
                <div className="grid grid-cols-1 gap-2">
                  {otherModifiers.map((modifier) => (
                    <Button
                      key={modifier.id}
                      onClick={() => toggleModifier(modifier)}
                      variant={selectedModifiers.find(m => m.id === modifier.id) ? "default" : "outline"}
                      className="justify-between h-10"
                    >
                      <span>{modifier.name}</span>
                      <span>+{formatCurrency(modifier.price)}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Special Instructions */}
            <div>
              <h4 className="font-medium mb-2">Special Instructions (Optional)</h4>
              <VirtualKeyboard
                value={specialInstructions}
                onChange={setSpecialInstructions}
                placeholder="Any special requests..."
                maxLength={200}
              />
            </div>

            {/* Price Summary */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total Price:</span>
                <span className="font-bold text-lg text-blue-600">
                  {formatCurrency(
                    parseFloat(product.price) +
                    (selectedSize?.price || 0) +
                    selectedModifiers.reduce((sum, mod) => sum + mod.price, 0)
                  )}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => setShowModifiers(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddWithModifications}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Add to Cart
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
