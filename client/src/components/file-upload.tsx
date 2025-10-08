import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, File, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFilesUploaded: (files: FileList) => void;
  uploadedFiles: any[];
  isUploading: boolean;
}

export default function FileUpload({ onFilesUploaded, uploadedFiles, isUploading }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        // Convert File[] to FileList-like object
        const dataTransfer = new DataTransfer();
        acceptedFiles.forEach(file => dataTransfer.items.add(file));
        
        onFilesUploaded(dataTransfer.files);
      }
    },
    [onFilesUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    onDragEnter: () => setDragOver(true),
    onDragLeave: () => setDragOver(false),
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div>
      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={cn(
          "upload-zone bg-muted p-12 text-center cursor-pointer transition-all duration-300",
          isDragActive && "dragover",
          isUploading && "opacity-50 cursor-not-allowed"
        )}
        data-testid="file-upload-zone"
      >
        <input {...getInputProps()} disabled={isUploading} />
        <Upload className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">
          {isDragActive ? "Slip filerne her" : "Træk og slip dine filer her"}
        </h3>
        <p className="text-muted-foreground mb-4">eller klik for at vælge filer</p>
        <Button
          type="button"
          disabled={isUploading}
          className="font-semibold"
          data-testid="button-select-files"
        >
          {isUploading ? "Uploader..." : "Vælg filer"}
        </Button>
        <p className="text-sm text-muted-foreground mt-4">PDF, max 10 MB pr. fil</p>
      </div>

      {/* Uploaded Files Preview */}
      {uploadedFiles.length > 0 && (
        <div className="mt-6 space-y-3">
          <h4 className="font-semibold text-foreground">Uploadede filer:</h4>
          {uploadedFiles.map((file, index) => (
            <Card key={file.id || index} className="bg-muted">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <File className="w-6 h-6 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground" data-testid={`file-name-${index}`}>
                      {file.fileName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {file.fileSize ? formatFileSize(file.fileSize) : 'Ukjent størrelse'} • Uploadet
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    data-testid={`button-remove-file-${index}`}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
