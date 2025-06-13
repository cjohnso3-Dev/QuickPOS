import React from 'react';
import { Button } from './button';
import { Delete } from 'lucide-react';

interface NumpadProps {
  onKeyPress: (key: string) => void;
  disabled?: boolean;
}

const Numpad: React.FC<NumpadProps> = ({ onKeyPress, disabled }) => {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'backspace'];

  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((key, index) => {
        if (key === '') return <div key={`spacer-${index}`} />; // Spacer

        return (
          <Button
            key={key}
            variant="outline"
            className="h-16 text-2xl font-bold bg-gray-50 hover:bg-gray-100 focus:bg-gray-200"
            onClick={() => onKeyPress(key)}
            disabled={disabled}
            aria-label={key === 'backspace' ? 'Delete last digit' : `Enter digit ${key}`}
          >
            {key === 'backspace' ? <Delete className="h-7 w-7" /> : key}
          </Button>
        );
      })}
    </div>
  );
};

export default Numpad;