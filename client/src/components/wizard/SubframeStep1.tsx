import { Button } from "../../../../src/ui/components/Button";
import { TextField } from "../../../../src/ui/components/TextField";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { emailSchema } from "@/lib/validators";
import { z } from "zod";

interface SubframeStep1Props {
  onComplete: (email: string) => Promise<void>;
  isLoading: boolean;
}

type EmailFormData = z.infer<typeof emailSchema>;

export function SubframeStep1({ onComplete, isLoading }: SubframeStep1Props) {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" }
  });

  const onSubmit = async (data: EmailFormData) => {
    await onComplete(data.email);
  };

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex w-full flex-col items-center gap-2">
        <span className="font-['Inter_Tight'] text-[56px] font-[600] leading-[56px] text-default-font text-center">
          Få bedre forsikringer
        </span>
        <span className="whitespace-pre-wrap text-body font-body text-subtext-color text-center">
          {"Upload dine nuværende aftaler én gang. \nVi henter nye tilbud, sammenligner side om side"}
        </span>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="flex w-full max-w-[448px] flex-col items-start gap-6">
        <TextField
          className="h-auto w-full flex-none"
          label="Email adresse"
          helpText={errors.email?.message || ""}
          error={!!errors.email}
        >
          <TextField.Input
            data-testid="input-email"
            placeholder="din@email.dk"
            {...register("email")}
            disabled={isLoading}
          />
        </TextField>
        <Button
          type="submit"
          data-testid="button-start"
          className="h-10 w-full flex-none"
          variant="brand-primary"
          size="large"
          disabled={isLoading}
          loading={isLoading}
        >
          Fortsæt
        </Button>
      </form>
    </div>
  );
}
