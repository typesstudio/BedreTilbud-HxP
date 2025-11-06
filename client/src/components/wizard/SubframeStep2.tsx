import { Button } from "../../../../src/ui/components/Button";
import { LinkButton } from "../../../../src/ui/components/LinkButton";
import { IconWithBackground } from "../../../../src/ui/components/IconWithBackground";
import { FeatherUpload, FeatherArrowLeft, FeatherArrowRight, FeatherAlertCircle, FeatherShield, FeatherPiggyBank } from "@subframe/core";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useToast } from "@/hooks/use-toast";

interface SubframeStep2Props {
  onComplete: (documentId: string | null, skipped: boolean) => void;
  onBack?: () => void;
  isLoading: boolean;
}

export function SubframeStep2({ onComplete, onBack, isLoading }: SubframeStep2Props) {
  const { toast } = useToast();
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploadStatus('uploading');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload fejlede');
      }

      const result = await response.json();
      setUploadStatus('success');
      
      toast({
        title: "Succes!",
        description: "Police uploaded successfully",
      });

      setTimeout(() => {
        onComplete(result.id, false);
      }, 500);
    } catch (error: any) {
      setUploadStatus('error');
      toast({
        title: "Fejl",
        description: error.message || 'Der opstod en fejl ved upload',
        variant: "destructive"
      });
    }
  }, [onComplete, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024,
    maxFiles: 1,
    disabled: uploadStatus === 'uploading' || uploadStatus === 'success' || isLoading,
    onDropRejected: (fileRejections) => {
      const error = fileRejections[0]?.errors[0];
      let message = 'Ugyldig fil';
      if (error?.code === 'file-too-large') {
        message = 'Filen må ikke overstige 10MB';
      } else if (error?.code === 'file-invalid-type') {
        message = 'Kun PDF-filer er tilladt';
      }
      toast({
        title: "Fejl",
        description: message,
        variant: "destructive"
      });
    }
  });

  const handleSkip = () => {
    onComplete(null, true);
  };

  return (
    <div className="flex w-full flex-col items-start gap-6">
      <div className="flex w-full flex-col items-start gap-2">
        <span className="text-heading-1 font-heading-1 text-default-font">
          Upload din nuværende forsikring
        </span>
        <span className="text-body font-body text-subtext-color">
          Vi laver en grundig gennemgang og finder skjulte gebyrer, manglende dækning og beregner din mulige besparelse
        </span>
      </div>
      
      <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-6 py-6">
        <span className="text-heading-3 font-heading-3 text-default-font">
          Sådan gør du
        </span>
        <div className="flex w-full flex-col items-start gap-3">
          <div className="flex w-full items-start gap-4">
            <div className="flex h-8 w-8 flex-none items-center justify-center gap-2 rounded-full bg-brand-600">
              <span className="text-body-bold font-body-bold text-white">1</span>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
              <span className="text-body-bold font-body-bold text-default-font">
                Log ind hos dit forsikringsselskab
              </span>
              <span className="text-body font-body text-subtext-color">
                Brug MitID til at logge ind på din forsikrings hjemmeside
              </span>
            </div>
          </div>
          <div className="flex w-full items-start gap-4">
            <div className="flex h-8 w-8 flex-none items-center justify-center gap-2 rounded-full bg-brand-600">
              <span className="text-body-bold font-body-bold text-white">2</span>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
              <span className="text-body-bold font-body-bold text-default-font">
                Gå til dine policer
              </span>
              <span className="text-body font-body text-subtext-color">
                Find afsnittet "Mine Policer" eller "Mine Forsikringer"
              </span>
            </div>
          </div>
          <div className="flex w-full items-start gap-4">
            <div className="flex h-8 w-8 flex-none items-center justify-center gap-2 rounded-full bg-brand-600">
              <span className="text-body-bold font-body-bold text-white">3</span>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
              <span className="text-body-bold font-body-bold text-default-font">
                Upload til os
              </span>
              <span className="text-body font-body text-subtext-color">
                Download policen som PDF og upload den her
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6">
        <span className="text-heading-3 font-heading-3 text-default-font">
          Hvad vi tjekker
        </span>
        <div className="flex w-full items-start gap-4">
          <div className="flex min-w-[160px] grow shrink-0 basis-0 flex-col items-start gap-3 rounded-md bg-neutral-50 px-4 py-4">
            <IconWithBackground
              variant="error"
              size="medium"
              icon={<FeatherAlertCircle />}
            />
            <div className="flex flex-col items-start gap-1">
              <span className="text-body-bold font-body-bold text-default-font">
                Skjulte gebyrer
              </span>
              <span className="text-caption font-caption text-subtext-color">
                Vi finder skjulte omkostninger
              </span>
            </div>
          </div>
          <div className="flex min-w-[160px] grow shrink-0 basis-0 flex-col items-start gap-3 rounded-md bg-neutral-50 px-4 py-4">
            <IconWithBackground
              variant="warning"
              size="medium"
              icon={<FeatherShield />}
            />
            <div className="flex flex-col items-start gap-1">
              <span className="text-body-bold font-body-bold text-default-font">
                Manglende dækning
              </span>
              <span className="text-caption font-caption text-subtext-color">
                Vi identificerer huller i din beskyttelse
              </span>
            </div>
          </div>
          <div className="flex min-w-[160px] grow shrink-0 basis-0 flex-col items-start gap-3 rounded-md bg-neutral-50 px-4 py-4">
            <IconWithBackground
              variant="success"
              size="medium"
              icon={<FeatherPiggyBank />}
            />
            <div className="flex flex-col items-start gap-1">
              <span className="text-body-bold font-body-bold text-default-font">
                Besparelser
              </span>
              <span className="text-caption font-caption text-subtext-color">
                Vi beregner hvad du kan spare
              </span>
            </div>
          </div>
        </div>
      </div>

      <div
        {...getRootProps()}
        data-testid="dropzone-upload"
        className={`w-full border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-brand-600 bg-blue-50' : 'border-neutral-border hover:border-brand-400'
        } ${uploadStatus === 'uploading' ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4">
          <FeatherUpload className="w-12 h-12 text-gray-400" />
          <div>
            <p className="text-body-bold font-body-bold text-default-font">
              {uploadStatus === 'uploading' ? 'Uploader...' : isDragActive ? 'Slip filen her' : 'Træk PDF her eller klik for at vælge'}
            </p>
            <p className="text-caption font-caption text-subtext-color mt-1">
              Maksimal filstørrelse: 10MB
            </p>
          </div>
        </div>
      </div>

      {uploadStatus !== 'uploading' && uploadStatus !== 'success' && (
        <Button
          className="h-10 w-full flex-none"
          size="large"
          icon={<FeatherUpload />}
          onClick={() => document.querySelector<HTMLInputElement>('[data-testid="dropzone-upload"] input')?.click()}
          disabled={isLoading}
          data-testid="button-upload"
        >
          Upload din forsikring
        </Button>
      )}

      <div className="flex w-full items-center justify-between pt-4">
        <LinkButton
          icon={<FeatherArrowLeft />}
          onClick={onBack}
          disabled={uploadStatus === 'uploading' || isLoading}
        >
          Tilbage
        </LinkButton>
        <LinkButton
          iconRight={<FeatherArrowRight />}
          onClick={handleSkip}
          disabled={uploadStatus === 'uploading' || uploadStatus === 'success' || isLoading}
          data-testid="button-skip"
        >
          Spring over
        </LinkButton>
      </div>
    </div>
  );
}
