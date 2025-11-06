import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step2UploadProps {
  onComplete: (documentId: string | null, skipped: boolean) => void;
  isLoading: boolean;
}

export function Step2Upload({ onComplete, isLoading }: Step2UploadProps) {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploadedFile(file);
    setUploadStatus('uploading');
    setErrorMessage('');

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
      
      setTimeout(() => {
        onComplete(result.id, false);
      }, 500);
    } catch (error: any) {
      setUploadStatus('error');
      setErrorMessage(error.message || 'Der opstod en fejl ved upload');
    }
  }, [onComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024,
    maxFiles: 1,
    disabled: uploadStatus === 'uploading' || uploadStatus === 'success' || isLoading,
    onDropRejected: (fileRejections) => {
      const error = fileRejections[0]?.errors[0];
      if (error?.code === 'file-too-large') {
        setErrorMessage('Filen må ikke overstige 10MB');
      } else if (error?.code === 'file-invalid-type') {
        setErrorMessage('Kun PDF-filer er tilladt');
      } else {
        setErrorMessage('Ugyldig fil');
      }
      setUploadStatus('error');
    }
  });

  const handleSkip = () => {
    onComplete(null, true);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Upload din nuværende police
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Vi analyserer din police for at finde de bedste tilbud
        </p>
      </div>

      <div
        {...getRootProps()}
        data-testid="dropzone-upload"
        className={cn(
          "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
          isDragActive && "border-blue-500 bg-blue-50 dark:bg-blue-950",
          uploadStatus === 'success' && "border-green-500 bg-green-50 dark:bg-green-950",
          uploadStatus === 'error' && "border-red-500 bg-red-50 dark:bg-red-950",
          uploadStatus === 'idle' && "border-gray-300 dark:border-gray-700 hover:border-blue-400",
          (uploadStatus === 'uploading' || uploadStatus === 'success') && "cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center">
          {uploadStatus === 'uploading' && (
            <>
              <Loader2 className="w-16 h-16 text-blue-600 animate-spin mb-4" />
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                Uploader...
              </p>
            </>
          )}

          {uploadStatus === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 text-green-600 mb-4" />
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
                Upload gennemført!
              </p>
              {uploadedFile && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {uploadedFile.name}
                </p>
              )}
            </>
          )}

          {uploadStatus === 'error' && (
            <>
              <AlertCircle className="w-16 h-16 text-red-600 mb-4" />
              <p className="text-lg font-medium text-red-700 dark:text-red-400 mb-2">
                Upload fejlede
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">
                {errorMessage}
              </p>
            </>
          )}

          {uploadStatus === 'idle' && (
            <>
              <Upload className="w-16 h-16 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                {isDragActive ? 'Slip filen her' : 'Træk PDF her eller klik for at vælge'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Maksimal filstørrelse: 10MB
              </p>
            </>
          )}
        </div>
      </div>

      {uploadStatus === 'error' && (
        <div className="mt-4 text-center">
          <Button
            onClick={() => {
              setUploadStatus('idle');
              setErrorMessage('');
            }}
            variant="outline"
            data-testid="button-retry"
          >
            Prøv igen
          </Button>
        </div>
      )}

      <div className="mt-8 flex gap-4 justify-center">
        <Button
          onClick={handleSkip}
          variant="outline"
          data-testid="button-skip"
          disabled={uploadStatus === 'uploading' || uploadStatus === 'success' || isLoading}
          className="h-12 px-8 text-base"
        >
          Spring over (upload senere)
        </Button>
      </div>

      <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>💡 Tip: Upload din police for mere præcise sammenligninger</p>
      </div>
    </div>
  );
}
