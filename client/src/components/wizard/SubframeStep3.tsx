import { useState } from "react";
import { Button } from "../../../../src/ui/components/Button";
import { Badge } from "../../../../src/ui/components/Badge";
import { TextField } from "../../../../src/ui/components/TextField";
import { ToggleGroup } from "../../../../src/ui/components/ToggleGroup";
import { LinkButton } from "../../../../src/ui/components/LinkButton";
import { FeatherCheck, FeatherCheckCircle, FeatherInfo, FeatherArrowLeft, FeatherDollarSign, FeatherShield, FeatherPackage } from "@subframe/core";
import { useQuery } from "@tanstack/react-query";
import { formatCPR, isValidCPR } from "@/lib/validators";
import type { Company } from "@shared/schema";

interface SubframeStep3Props {
  onComplete: (data: {
    selectedCompanyIds: string[];
    name: string;
    cpr: string;
    priority: string;
  }) => void;
  onBack?: () => void;
  isLoading: boolean;
  uploadSkipped: boolean;
}

export function SubframeStep3({ onComplete, onBack, isLoading, uploadSkipped }: SubframeStep3Props) {
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

  const handleSelectAll = () => {
    if (uploadSkipped) return;
    const allPopularIds = popularCompanies.map(c => c.id);
    setSelectedCompanyIds(allPopularIds);
    if (errors.companies) {
      setErrors(prev => ({ ...prev, companies: '' }));
    }
  };

  const handleCprChange = (value: string) => {
    const formatted = formatCPR(value);
    if (formatted.replace(/\D/g, '').length <= 10) {
      setCpr(formatted);
      if (errors.cpr) {
        setErrors(prev => ({ ...prev, cpr: '' }));
      }
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
    return <div className="flex items-center justify-center py-16">Indlæser...</div>;
  }

  return (
    <div className="flex w-full flex-col items-start gap-6">
      <div className="flex w-full flex-col items-start gap-2">
        <span className="text-heading-1 font-heading-1 text-default-font">
          Hvilke forsikringsselskaber vil du have tilbud fra?
        </span>
        <span className="text-body font-body text-subtext-color">
          Vælg de selskaber du gerne vil sammenligne. Vi kontakter dem automatisk og forhandler de bedste priser for dig.
        </span>
      </div>

      {uploadSkipped && (
        <div className="flex w-full flex-col items-start gap-3 rounded-lg border border-solid border-warning-200 bg-warning-50 px-6 py-4">
          <div className="flex w-full items-center gap-3">
            <FeatherInfo className="text-heading-3 font-heading-3 text-warning-600" />
            <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
              Upload police for at vælge forsikringsselskaber
            </span>
          </div>
          <span className="text-caption font-caption text-subtext-color">
            Gå tilbage til trin 2 og upload din police for at fortsætte.
          </span>
        </div>
      )}

      <div className="flex w-full items-center justify-between">
        <span className="text-body-bold font-body-bold text-default-font">
          Populære selskaber
        </span>
        <Button
          variant="neutral-secondary"
          size="small"
          onClick={handleSelectAll}
          disabled={uploadSkipped || isLoading}
        >
          Vælg alle
        </Button>
      </div>

      <div className="flex w-full items-start gap-4 flex-wrap">
        {popularCompanies.slice(0, 2).map((company) => (
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

      <div className="flex w-full items-start gap-4 flex-wrap">
        {popularCompanies.slice(2, 4).map((company) => (
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

      {otherCompanies.length > 0 && (
        <>
          <span className="text-body-bold font-body-bold text-default-font">
            Andre selskaber
          </span>
          <div className="flex w-full items-start gap-4 flex-wrap">
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
        </>
      )}

      {errors.companies && (
        <span className="text-caption font-caption text-error-600" data-testid="error-companies">
          {errors.companies}
        </span>
      )}

      <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-6 py-6">
        <span className="text-heading-3 font-heading-3 text-default-font">
          Dine informationer
        </span>
        <div className="flex w-full flex-col items-start gap-4">
          <TextField
            className="h-auto w-full flex-none"
            label="Navn"
            helpText={errors.name || ""}
            error={!!errors.name}
          >
            <TextField.Input
              data-testid="input-name"
              placeholder="Dit fulde navn"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
              }}
              disabled={isLoading}
            />
          </TextField>

          <TextField
            className="h-auto w-full flex-none"
            label="CPR-nummer"
            helpText={errors.cpr || ""}
            error={!!errors.cpr}
          >
            <TextField.Input
              data-testid="input-cpr"
              placeholder="XXXXXX-XXXX"
              value={cpr}
              onChange={(e) => handleCprChange(e.target.value)}
              disabled={isLoading}
              maxLength={11}
            />
          </TextField>

          <div className="flex w-full flex-col items-start gap-2">
            <span className="text-body-bold font-body-bold text-default-font">
              Hvad er vigtigst for dig?
            </span>
            <ToggleGroup
              className="h-auto w-full flex-none"
              value={priority}
              onValueChange={(value: string) => {
                setPriority(value);
                if (errors.priority) setErrors(prev => ({ ...prev, priority: '' }));
              }}
            >
              <ToggleGroup.Item icon={<FeatherDollarSign />} value="pris">
                Billig forsikring
              </ToggleGroup.Item>
              <ToggleGroup.Item icon={<FeatherShield />} value="daekning">
                Bedste dækning
              </ToggleGroup.Item>
              <ToggleGroup.Item icon={<FeatherPackage />} value="balance">
                Alt samlet ét sted
              </ToggleGroup.Item>
            </ToggleGroup>
            {errors.priority && (
              <span className="text-caption font-caption text-error-600" data-testid="error-priority">
                {errors.priority}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col items-start gap-3 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-6 py-4">
        <div className="flex w-full items-center gap-3">
          <FeatherInfo className="text-heading-3 font-heading-3 text-brand-600" />
          <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
            Vi forhandler automatisk med alle valgte selskaber
          </span>
        </div>
        <span className="text-caption font-caption text-subtext-color">
          Jo flere selskaber du vælger, jo bedre kan vi forhandle. Vi anbefaler at vælge mindst 4-5 selskaber for de bedste resultater.
        </span>
      </div>

      <Button
        className="h-10 w-full flex-none"
        size="large"
        icon={<FeatherCheckCircle />}
        onClick={handleSubmit}
        disabled={isLoading || uploadSkipped}
        loading={isLoading}
        data-testid="button-submit"
      >
        Find bedre tilbud ({selectedCompanyIds.length} selskab{selectedCompanyIds.length !== 1 ? 'er' : ''} valgt)
      </Button>

      <div className="flex w-full items-center justify-between pt-4">
        <LinkButton
          icon={<FeatherArrowLeft />}
          onClick={onBack}
          disabled={isLoading}
        >
          Tilbage
        </LinkButton>
      </div>
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
      className={`flex min-w-[${isLarge ? '240px' : '160px'}] grow shrink-0 basis-0 flex-col items-start gap-${isLarge ? '4' : '3'} rounded-lg border${selected && !disabled ? '-2' : ''} border-solid border-${selected && !disabled ? 'brand-600' : 'neutral-border'} bg-default-background px-${isLarge ? '6' : '4'} py-${isLarge ? '6' : '4'} transition-${selected && !disabled ? 'shadow' : 'all'} cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className="flex w-full items-start justify-between">
        {company.logoUrl ? (
          <img
            className={`h-${isLarge ? '12' : '10'} flex-none object-contain`}
            src={company.logoUrl}
            alt={company.name}
          />
        ) : (
          <span className={`text-body${isLarge ? '-bold' : ''} font-body${isLarge ? '-bold' : ''} text-default-font`}>
            {company.name}
          </span>
        )}
        <div className={`flex h-${isLarge ? '8' : '6'} w-${isLarge ? '8' : '6'} flex-none items-center justify-center rounded-full ${selected && !disabled ? 'bg-brand-600' : 'border border-solid border-neutral-200'}`}>
          {selected && !disabled && (
            <FeatherCheck className={`text-${isLarge ? 'body' : 'caption'} font-${isLarge ? 'body' : 'caption'} text-white`} />
          )}
        </div>
      </div>
      {isLarge && company.logoUrl && (
        <div className="flex flex-col items-start gap-1">
          {company.popular && (
            <div className="flex items-center gap-2">
              <span className="text-body-bold font-body-bold text-default-font">
                {company.name}
              </span>
              <Badge>Populær</Badge>
            </div>
          )}
          {!company.popular && (
            <span className="text-body-bold font-body-bold text-default-font">
              {company.name}
            </span>
          )}
          {company.description && (
            <span className="text-caption font-caption text-subtext-color">
              {company.description}
            </span>
          )}
        </div>
      )}
      {!isLarge && !company.logoUrl && (
        <span className="text-body-bold font-body-bold text-default-font">
          {company.name}
        </span>
      )}
    </button>
  );
}
