import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCPR } from "@/lib/validators";
import { useState } from "react";

interface CPRInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function CPRInput({ value, onChange, error, disabled }: CPRInputProps) {
  const [focused, setFocused] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPR(e.target.value);
    if (formatted.replace(/\D/g, '').length <= 10) {
      onChange(formatted);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="cpr" className="text-lg font-medium">
        CPR-nummer *
      </Label>
      <Input
        id="cpr"
        data-testid="input-cpr"
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="DDMMÅÅ-XXXX"
        disabled={disabled}
        className="text-lg h-14"
        maxLength={11}
      />
      {focused && !value && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Format: DDMMÅÅ-XXXX (f.eks. 010190-1234)
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" data-testid="error-cpr">
          {error}
        </p>
      )}
    </div>
  );
}
