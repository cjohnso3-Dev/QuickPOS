import { Button } from "@/components/ui/button";
import type { CartItem } from "@shared/schema";
import { Minus, Plus } from "lucide-react";

interface CartItemProps {
  item: CartItem;
  onUpdateQuantity: (productId: number, quantity: number) => void;
}

export default function CartItem({ item, onUpdateQuantity }: CartItemProps) {
  const decreaseQuantity = () => {
    onUpdateQuantity(item.product.id, item.quantity - 1);
  };

  const increaseQuantity = () => {
    onUpdateQuantity(item.product.id, item.quantity + 1);
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
          className="w-6 h-6 p-0"
          onClick={decreaseQuantity}
        >
          <Minus className="w-3 h-3" />
        </Button>
        <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
        <Button
          variant="outline"
          size="sm"
          className="w-6 h-6 p-0"
          onClick={increaseQuantity}
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
