import { Button } from "@/components/ui/button";
import { Minus, Plus, X, Edit } from "lucide-react";
import type { CartItem as CartItemType } from "@shared/schema";

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (product: CartItemType['product'], newQuantity: number) => void;
  onRemove: (product: CartItemType['product']) => void;
  onEdit?: (item: CartItemType) => void;
}

export default function CartItem({ item, onUpdateQuantity, onRemove, onEdit }: CartItemProps) {
  const decreaseQuantity = () => {
    onUpdateQuantity(item.product, item.quantity - 1);
  };

  const increaseQuantity = () => {
    onUpdateQuantity(item.product, item.quantity + 1);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  return (
    <div className="py-3 border-b border-slate-100 last:border-b-0">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h4 className="text-sm font-medium text-slate-900">{item.product.name}</h4>
          <p className="text-xs text-slate-600">{formatPrice(item.unitPrice)} each</p>
          
          {/* Display modifications */}
          {item.modifications && item.modifications.length > 0 && (
            <div className="mt-1 space-y-1">
              {item.modifications.map((mod, index) => (
                <div key={index} className="text-xs text-slate-500 flex justify-between">
                  <span>• {mod.name}</span>
                  {mod.price > 0 && <span>+{formatPrice(mod.price)}</span>}
                </div>
              ))}
            </div>
          )}
          
          {/* Display special instructions */}
          {item.specialInstructions && (
            <div className="mt-1">
              <p className="text-xs text-slate-500 italic">Note: {item.specialInstructions}</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUpdateQuantity(item.product, item.quantity - 1)}
            disabled={item.quantity <= 1}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUpdateQuantity(item.product, item.quantity + 1)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-slate-900">
            {formatPrice(item.totalPrice)}
          </span>
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(item)}
              className="text-blue-600 hover:text-blue-700"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRemove(item.product)}
            className="text-red-600 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}