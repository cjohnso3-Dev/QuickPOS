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

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-b-0">
      <div className="flex-1">
        <h4 className="text-sm font-medium text-slate-900">{item.product.name}</h4>
        <p className="text-xs text-slate-600">${item.product.price} each</p>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onUpdateQuantity(item.product, item.quantity - 1)}
          disabled={item.quantity <= 1}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-8 text-center">{item.quantity}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onUpdateQuantity(item.product, item.quantity + 1)}
        >
          <Plus className="h-4 w-4" />
        </Button>
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
  );
}