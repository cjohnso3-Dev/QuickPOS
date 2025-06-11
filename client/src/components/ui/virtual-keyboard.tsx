
import React, { useState, useRef, useEffect } from 'react';
import { Button } from './button';
import { Delete, Space, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VirtualKeyboardProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
  value,
  onChange,
  placeholder,
  maxLength,
  className
}) => {
  const [isShift, setIsShift] = useState(false);
  const [isCapsLock, setIsCapsLock] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState(0);

  const rows = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm']
  ];

  const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
      textareaRef.current.focus();
    }
  }, [cursorPosition, value]);

  const insertCharacter = (char: string) => {
    if (maxLength && value.length >= maxLength) return;
    
    const shouldCapitalize = isShift || isCapsLock;
    const finalChar = shouldCapitalize ? char.toUpperCase() : char;
    
    const newValue = value.slice(0, cursorPosition) + finalChar + value.slice(cursorPosition);
    onChange(newValue);
    setCursorPosition(cursorPosition + 1);
    
    if (isShift && !isCapsLock) {
      setIsShift(false);
    }
  };

  const handleBackspace = () => {
    if (cursorPosition > 0) {
      const newValue = value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
      onChange(newValue);
      setCursorPosition(cursorPosition - 1);
    }
  };

  const handleSpace = () => {
    if (maxLength && value.length >= maxLength) return;
    
    const newValue = value.slice(0, cursorPosition) + ' ' + value.slice(cursorPosition);
    onChange(newValue);
    setCursorPosition(cursorPosition + 1);
  };

  const handleShift = () => {
    setIsShift(!isShift);
  };

  const handleCapsLock = () => {
    setIsCapsLock(!isCapsLock);
    setIsShift(false);
  };

  const handleTextareaClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    setCursorPosition(textarea.selectionStart || 0);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Text Display Area */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setCursorPosition(e.target.selectionStart || 0);
          }}
          onClick={handleTextareaClick}
          onKeyUp={(e) => setCursorPosition(e.currentTarget.selectionStart || 0)}
          placeholder={placeholder}
          className="w-full p-4 border rounded-md resize-none h-24 text-base touch-manipulation bg-white"
          style={{ 
            userSelect: 'text',
            WebkitUserSelect: 'text',
            fontSize: '16px' // Prevents zoom on iOS
          }}
          inputMode="none" // Prevents mobile keyboard
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
        {maxLength && (
          <div className="absolute bottom-2 right-2 text-xs text-gray-500">
            {value.length}/{maxLength}
          </div>
        )}
      </div>

      {/* Virtual Keyboard */}
      <div className="bg-gray-100 p-4 rounded-lg touch-manipulation select-none">
        {/* Number Row */}
        <div className="grid grid-cols-10 gap-1 mb-2">
          {numbers.map((num) => (
            <Button
              key={num}
              variant="outline"
              size="sm"
              className="h-10 text-sm bg-white hover:bg-gray-50 active:bg-gray-200 transition-colors"
              onClick={() => insertCharacter(num)}
            >
              {isShift ? getShiftSymbol(num) : num}
            </Button>
          ))}
        </div>

        {/* Letter Rows */}
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className={cn(
            "grid gap-1 mb-2",
            rowIndex === 0 ? "grid-cols-10" : rowIndex === 1 ? "grid-cols-9" : "grid-cols-7"
          )}>
            {rowIndex === 1 && <div className="w-5" />} {/* Spacer for middle row */}
            {row.map((letter) => (
              <Button
                key={letter}
                variant="outline"
                size="sm"
                className="h-10 text-sm bg-white hover:bg-gray-50 active:bg-gray-200 transition-colors"
                onClick={() => insertCharacter(letter)}
              >
                {isShift || isCapsLock ? letter.toUpperCase() : letter}
              </Button>
            ))}
            {rowIndex === 2 && (
              <Button
                variant="outline"
                size="sm"
                className="h-10 text-sm bg-white hover:bg-gray-50 active:bg-gray-200 transition-colors"
                onClick={handleBackspace}
              >
                <Delete className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}

        {/* Bottom Row */}
        <div className="grid grid-cols-12 gap-1">
          <Button
            variant={isCapsLock ? "default" : "outline"}
            size="sm"
            className="h-10 text-xs col-span-2 bg-white hover:bg-gray-50 active:bg-gray-200 transition-colors"
            onClick={handleCapsLock}
          >
            CAPS
          </Button>
          <Button
            variant={isShift ? "default" : "outline"}
            size="sm"
            className="h-10 text-xs col-span-2 bg-white hover:bg-gray-50 active:bg-gray-200 transition-colors"
            onClick={handleShift}
          >
            SHIFT
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 text-xs col-span-6 bg-white hover:bg-gray-50 active:bg-gray-200 transition-colors"
            onClick={handleSpace}
          >
            <Space className="w-4 h-4 mr-1" />
            SPACE
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 text-xs col-span-2 bg-white hover:bg-gray-50 active:bg-gray-200 transition-colors"
            onClick={() => insertCharacter('.')}
          >
            . , ?
          </Button>
        </div>
      </div>
    </div>
  );
};

// Helper function for shift symbols on number keys
const getShiftSymbol = (num: string): string => {
  const shiftMap: { [key: string]: string } = {
    '1': '!',
    '2': '@',
    '3': '#',
    '4': '$',
    '5': '%',
    '6': '^',
    '7': '&',
    '8': '*',
    '9': '(',
    '0': ')'
  };
  return shiftMap[num] || num;
};

export { VirtualKeyboard };
