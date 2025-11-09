import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Upload } from "lucide-react";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";
import { IconButton } from "@/ui/components/IconButton";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { FeatherFileText, FeatherTrash, FeatherUploadCloud } from "@subframe/core";

export default function UploadOffer() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const userId = localStorage.getItem("userId");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!userId) {
    setLocation("/onboarding");
    return null;
  }

  // Get companies
  const { data: companies = [] } = useQuery({
    queryKey: ["/api/companies"],
  });

  // Upload offer mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: { files: File[]; companyId: string }) => {
      const formData = new FormData();
      data.files.forEach((file) => {
        formData.append("files", file);
      });
      formData.append("userId", userId!);
      formData.append("companyId", data.companyId);
      formData.append("documentType", "offer");

      const response = await apiRequest("POST", "/api/documents/upload", formData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/emails/threads", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/comparisons/user", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats", userId] });
      toast({
        title: "Tilbud uploadet",
        description: "Dit tilbud er blevet behandlet og sammenlignet",
      });
      setLocation("/offers");
    },
    onError: () => {
      toast({
        title: "Fejl",
        description: "Kunne ikke uploade tilbud",
        variant: "destructive",
      });
    },
  });

  const handleFilesUploaded = (files: FileList | File[]) => {
    const fileArray = Array.isArray(files) ? files : Array.from(files);
    const newFiles = [...pendingFiles, ...fileArray];
    setPendingFiles(newFiles);
    
    const displayFiles = newFiles.map((file, index) => ({
      id: `${file.name}-${index}`,
      fileName: file.name,
      fileSize: file.size,
      file: file,
    }));
    setUploadedFiles(displayFiles);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesUploaded(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const pdfFiles = Array.from(e.dataTransfer.files).filter(
        file => file.type === 'application/pdf'
      );
      
      if (pdfFiles.length === 0) {
        toast({
          title: "Forkert filtype",
          description: "Kun PDF-filer er tilladt",
          variant: "destructive",
        });
        return;
      }
      
      handleFilesUploaded(pdfFiles);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    const updatedFiles = uploadedFiles.filter(f => f.id !== fileId);
    setUploadedFiles(updatedFiles);
    setPendingFiles(updatedFiles.map(f => f.file));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + ' ' + sizes[i];
  };

  const handleSubmit = () => {
    if (!selectedCompany) {
      toast({
        title: "Vælg selskab",
        description: "Du skal vælge hvilket selskab tilbuddet kommer fra",
        variant: "destructive",
      });
      return;
    }

    if (pendingFiles.length === 0) {
      toast({
        title: "Upload fil",
        description: "Du skal uploade mindst én fil",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({
      files: pendingFiles,
      companyId: selectedCompany,
    });
  };

  return (
    <AppLayoutWithNav userId={userId!}>
      <main className="flex-1">
        <section className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <Button
              variant="ghost"
              onClick={() => setLocation("/offers")}
              className="mb-6 gap-2"
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
              Tilbage til oversigt
            </Button>

            <div className="flex flex-col gap-6">
              {/* Company Selection */}
              <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm mobile:px-4 mobile:py-4">
                <div className="flex w-full items-center gap-3">
                  <IconWithBackground size="medium" icon={<FeatherUploadCloud />} />
                  <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                    <span className="text-heading-3 font-heading-3 text-default-font mobile:text-body-bold mobile:font-body-bold">
                      Vælg forsikringsselskab
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Hvilket selskab kommer tilbuddet fra?
                    </span>
                  </div>
                </div>
                <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                  <SelectTrigger className="w-full text-lg p-6" data-testid="select-company">
                    <SelectValue placeholder="Vælg forsikringsselskab" />
                  </SelectTrigger>
                  <SelectContent>
                    {(companies as any[]).map((company: any) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* File Upload */}
              <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm mobile:flex-col mobile:flex-nowrap mobile:gap-3 mobile:px-4 mobile:py-4">
                <div className="flex w-full items-center gap-3">
                  <IconWithBackground size="medium" icon={<FeatherUploadCloud />} />
                  <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                    <span className="text-heading-3 font-heading-3 text-default-font mobile:text-body-bold mobile:font-body-bold">
                      Upload forsikringsdokumenter
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Tilføj tilbud eller andre relevante dokumenter
                    </span>
                  </div>
                </div>
                
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={handleFileInputChange}
                  className="hidden"
                  data-testid="input-file"
                />

                {/* Drag and drop area */}
                <div
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-brand-600 px-6 py-6 mobile:px-4 mobile:py-4 cursor-pointer hover:bg-brand-50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  data-testid="dropzone"
                >
                  <FeatherUploadCloud className="text-heading-1 font-heading-1 text-brand-700" />
                  <div className="flex flex-col items-center justify-center gap-1">
                    <span className="text-body font-body text-default-font text-center">
                      Klik for at vælge filer eller træk og slip
                    </span>
                    <span className="text-caption font-caption text-subtext-color text-center">
                      PDF, maks 10MB per fil
                    </span>
                  </div>
                </div>

                {/* Uploaded files list */}
                {uploadedFiles.length > 0 && (
                  <div className="flex w-full flex-col items-start gap-3">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Uploadede filer ({uploadedFiles.length})
                    </span>
                    {uploadedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex w-full items-center gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4"
                        data-testid={`file-item-${file.id}`}
                      >
                        <IconWithBackground
                          variant="success"
                          size="medium"
                          icon={<FeatherFileText />}
                        />
                        <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                          <span className="text-body-bold font-body-bold text-default-font">
                            {file.fileName}
                          </span>
                          <span className="text-caption font-caption text-subtext-color">
                            {formatFileSize(file.fileSize)} • Klar til upload
                          </span>
                        </div>
                        <IconButton
                          icon={<FeatherTrash />}
                          onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                            event.preventDefault();
                            handleRemoveFile(file.id);
                          }}
                          data-testid={`button-remove-${file.id}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit button */}
              <div className="flex justify-end">
                <Button
                  onClick={handleSubmit}
                  disabled={uploadMutation.isPending || !selectedCompany || pendingFiles.length === 0}
                  size="lg"
                  className="text-lg px-12 py-4 gap-2"
                  data-testid="button-submit-offer"
                >
                  <Upload className="w-5 h-5" />
                  {uploadMutation.isPending ? "Uploader..." : "Upload og sammenlign"}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </AppLayoutWithNav>
  );
}
