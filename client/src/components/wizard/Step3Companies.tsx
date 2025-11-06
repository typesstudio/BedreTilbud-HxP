import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CPRInput } from "./CPRInput";
import { priorityOptions, isValidCPR } from "@/lib/validators";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Company } from "@shared/schema";

interface Step3CompaniesProps {
  onComplete: (data: {
    selectedCompanyIds: string[];
    name: string;
    cpr: string;
    priority: string;
  }) => void;
  isLoading: boolean;
  uploadSkipped: boolean;
}

export function Step3Companies({ onComplete, isLoading, uploadSkipped }: Step3CompaniesProps) {
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [cpr, setCpr] = useState('');
  const [priority, setPriority] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: companies, isLoading: loadingCompanies } = useQuery<Company[]>({
    queryKey: ['/api/companies']
  });

  const popularCompanies = companies?.filter(c => c.popular) || [];
  const otherCompanies = companies?.filter(c => !c.popular) || [];

  const toggleCompany = (companyId: string) => {
    if (uploadSkipped) return;
    
    setSelectedCompanyIds(prev => 
      prev.includes(companyId)
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    );
    
    if (errors.companies) {
      setErrors(prev => ({ ...prev, companies: '' }));
    }
  };

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};

    if (selectedCompanyIds.length === 0) {
      newErrors.companies = 'Vælg mindst ét forsikringsselskab';
    }
    if (!name.trim()) {
      newErrors.name = 'Navn er påkrævet';
    }
    if (!cpr) {
      newErrors.cpr = 'CPR-nummer er påkrævet';
    } else if (!isValidCPR(cpr)) {
      newErrors.cpr = 'CPR skal være i formatet XXXXXX-XXXX';
    }
    if (!priority) {
      newErrors.priority = 'Vælg din prioritet';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onComplete({
      selectedCompanyIds,
      name: name.trim(),
      cpr,
      priority
    });
  };

  if (loadingCompanies) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Vælg forsikringsselskaber
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Vi sender din forespørgsel til de valgte selskaber
        </p>
      </div>

      {uploadSkipped && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Upload police for at vælge forsikringsselskaber
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              Gå tilbage til trin 2 og upload din police for at fortsætte.
            </p>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Populære Forsikringsselskaber
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {popularCompanies.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              selected={selectedCompanyIds.includes(company.id)}
              onToggle={() => toggleCompany(company.id)}
              size="large"
              disabled={uploadSkipped}
            />
          ))}
        </div>
      </div>

      {otherCompanies.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Andre Forsikringsselskaber
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {otherCompanies.map((company) => (
              <CompanyCard
                key={company.id}
                company={company}
                selected={selectedCompanyIds.includes(company.id)}
                onToggle={() => toggleCompany(company.id)}
                size="small"
                disabled={uploadSkipped}
              />
            ))}
          </div>
        </div>
      )}

      {errors.companies && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-4" data-testid="error-companies">
          {errors.companies}
        </p>
      )}

      <div className="mt-10 p-6 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Din Information
        </h3>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-lg font-medium">
              Fulde navn *
            </Label>
            <Input
              id="name"
              data-testid="input-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
              }}
              placeholder="Dit fulde navn"
              className="text-lg h-14"
              disabled={isLoading}
            />
            {errors.name && (
              <p className="text-sm text-red-600 dark:text-red-400" data-testid="error-name">
                {errors.name}
              </p>
            )}
          </div>

          <CPRInput
            value={cpr}
            onChange={(value) => {
              setCpr(value);
              if (errors.cpr) setErrors(prev => ({ ...prev, cpr: '' }));
            }}
            error={errors.cpr}
            disabled={isLoading}
          />

          <div className="space-y-2">
            <Label htmlFor="priority" className="text-lg font-medium">
              Hvad er vigtigst for dig? *
            </Label>
            <Select
              value={priority}
              onValueChange={(value) => {
                setPriority(value);
                if (errors.priority) setErrors(prev => ({ ...prev, priority: '' }));
              }}
              disabled={isLoading}
            >
              <SelectTrigger
                id="priority"
                data-testid="select-priority"
                className="text-lg h-14"
              >
                <SelectValue placeholder="Vælg din prioritet" />
              </SelectTrigger>
              <SelectContent>
                {priorityOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    data-testid={`priority-${option.value}`}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.priority && (
              <p className="text-sm text-red-600 dark:text-red-400" data-testid="error-priority">
                {errors.priority}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <Button
          onClick={handleSubmit}
          data-testid="button-submit"
          className="h-14 px-12 text-lg font-semibold"
          disabled={isLoading || uploadSkipped}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Sender forespørgsler...
            </>
          ) : (
            "Få Tilbud →"
          )}
        </Button>
      </div>

      {selectedCompanyIds.length > 0 && (
        <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>{selectedCompanyIds.length} selskab{selectedCompanyIds.length !== 1 ? 'er' : ''} valgt</p>
        </div>
      )}
    </div>
  );
}

interface CompanyCardProps {
  company: Company;
  selected: boolean;
  onToggle: () => void;
  size: 'large' | 'small';
  disabled?: boolean;
}

function CompanyCard({ company, selected, onToggle, size, disabled }: CompanyCardProps) {
  const isLarge = size === 'large';

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      data-testid={`company-${company.id}`}
      className={cn(
        "relative rounded-lg border-2 transition-all p-4 text-left",
        isLarge ? "h-24" : "h-20",
        selected && !disabled && "border-blue-600 bg-blue-50 dark:bg-blue-950 ring-2 ring-blue-200",
        !selected && !disabled && "border-gray-300 dark:border-gray-700 hover:border-blue-400 bg-white dark:bg-gray-800",
        disabled && "opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900",
        "focus:outline-none focus:ring-2 focus:ring-blue-500"
      )}
    >
      {selected && !disabled && (
        <div className="absolute top-2 right-2">
          <CheckCircle2 className="w-5 h-5 text-blue-600" />
        </div>
      )}

      <div className="flex items-center h-full">
        {company.logoUrl ? (
          <img
            src={company.logoUrl}
            alt={`${company.name} logo`}
            className={cn(
              "object-contain",
              isLarge ? "h-12 w-full" : "h-10 w-full"
            )}
          />
        ) : (
          <div className="w-full text-center">
            <p className={cn(
              "font-semibold text-gray-900 dark:text-white",
              isLarge ? "text-base" : "text-sm"
            )}>
              {company.name}
            </p>
          </div>
        )}
      </div>
    </button>
  );
}
