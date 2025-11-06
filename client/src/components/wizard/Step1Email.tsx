import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { emailSchema } from "@/lib/validators";
import { z } from "zod";
import { Loader2, Mail } from "lucide-react";

interface Step1EmailProps {
  onComplete: (email: string) => void;
  isLoading: boolean;
}

type EmailFormData = z.infer<typeof emailSchema>;

export function Step1Email({ onComplete, isLoading }: Step1EmailProps) {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema)
  });

  const onSubmit = (data: EmailFormData) => {
    onComplete(data.email);
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
          <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3">
          Find bedre forsikring i 3 simple trin
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Sammenlign priser fra Danmarks førende forsikringsselskaber
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-lg font-medium">
            E-mailadresse
          </Label>
          <Input
            id="email"
            data-testid="input-email"
            type="email"
            placeholder="din@email.dk"
            {...register("email")}
            className="text-lg h-14"
            disabled={isLoading}
          />
          {errors.email && (
            <p className="text-sm text-red-600 dark:text-red-400" data-testid="error-email">
              {errors.email.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          data-testid="button-start"
          className="w-full h-14 text-lg font-semibold"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Vent venligst...
            </>
          ) : (
            "Kom i gang →"
          )}
        </Button>
      </form>

      <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>Ved at fortsætte accepterer du vores vilkår og betingelser</p>
      </div>
    </div>
  );
}
