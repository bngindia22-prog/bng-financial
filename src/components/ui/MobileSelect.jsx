import React, { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check } from 'lucide-react';

// Detects touch device (mobile WebView)
const isMobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px)').matches;

export function MobileSelect({ value, onValueChange, placeholder, children, label }) {
  const [open, setOpen] = useState(false);
  const mobile = isMobile();

  // Extract options from children (SelectItem or option elements)
  const options = React.Children.toArray(children).map(child => ({
    value: child.props.value,
    label: child.props.children || child.props.label || child.props.value,
  }));

  const selectedLabel = options.find(o => o.value === value)?.label;

  if (!mobile) {
    return (
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 select-none"
      >
        <span className={selectedLabel ? '' : 'text-muted-foreground'}>
          {selectedLabel || placeholder}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          {label && (
            <DrawerHeader className="pb-2">
              <DrawerTitle className="text-base">{label}</DrawerTitle>
            </DrawerHeader>
          )}
          <div className="px-4 pb-8 space-y-1 max-h-[60vh] overflow-y-auto">
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onValueChange(opt.value); setOpen(false); }}
                className="flex items-center justify-between w-full px-4 py-3.5 rounded-xl text-sm font-medium transition-colors hover:bg-secondary active:bg-secondary select-none"
              >
                <span>{opt.label}</span>
                {value === opt.value && <Check className="w-4 h-4 text-primary" />}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}