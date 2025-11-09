import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { IconButton } from "@/ui/components/IconButton";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { FeatherArrowRight, FeatherChevronDown, FeatherFileText, FeatherPlus, FeatherShield, FeatherTrash, FeatherUploadCloud } from "@subframe/core";
import * as SubframeCore from "@subframe/core";

export default function UploadOffer() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const userId = localStorage.getItem("userId");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedCompanyName, setSelectedCompanyName] = useState("Vælg forsikringsselskab");
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
    onSuccess: (data: any[]) => {
      queryClient.invalidateQueries({ queryKey: ["/api/emails/threads", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/comparisons/user", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats", userId] });
      
      const hasIdenticalPolicies = data.some((result: any) => result.identicalPoliciesDetected);
      const hasComparisons = data.some((result: any) => result.comparisons && result.comparisons.length > 0);
      
      if (hasIdenticalPolicies && !hasComparisons) {
        const identicalMessage = data.find((r: any) => r.identicalPolicyMessage)?.identicalPolicyMessage || 
          "Tilbuddet ser ud til at være identisk med din nuværende police";
        toast({
          title: "Identisk police opdaget",
          description: identicalMessage,
          variant: "default",
        });
      } else if (hasComparisons) {
        toast({
          title: "Tilbud uploadet",
          description: "Dit tilbud er blevet behandlet og sammenlignet",
        });
      } else {
        toast({
          title: "Tilbud uploadet",
          description: "Dit tilbud er blevet behandlet",
        });
      }
      
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

  const handleCompanySelect = (companyId: string, companyName: string) => {
    setSelectedCompany(companyId);
    setSelectedCompanyName(companyName);
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

  const handleCancel = () => {
    setLocation("/offers");
  };

  return (
    <AppLayoutWithNav userId={userId!}>
      <div className="container max-w-none flex h-full w-full flex-col items-center gap-6 bg-default-background py-12 mobile:flex-col mobile:flex-nowrap mobile:gap-4 mobile:px-4 mobile:py-6">
        <div className="flex w-full max-w-[768px] flex-col items-start gap-6 mobile:flex-col mobile:flex-nowrap mobile:gap-4">
          {/* Header with progress stepper */}
          <div className="flex w-full flex-col items-start gap-4 mobile:flex-col mobile:flex-nowrap mobile:gap-3">
            <div className="flex w-full flex-col items-start gap-2">
              <span className="text-heading-1 font-heading-1 text-default-font mobile:text-heading-2 mobile:font-heading-2">
                Upload eksisterende tilbud
              </span>
              <span className="text-body font-body text-subtext-color">
                Del dit nuværende forsikringstilbud med os, så vi kan finde bedre løsninger
              </span>
            </div>
            
            {/* Progress stepper */}
            <div className="flex w-full items-center gap-3 mobile:flex-wrap">
              <div className="flex items-center gap-2">
                <Badge data-testid="step-1">1</Badge>
                <span className="text-body-bold font-body-bold text-default-font mobile:text-caption-bold mobile:font-caption-bold">
                  Upload
                </span>
              </div>
              <div className="flex h-px grow shrink-0 basis-0 flex-col items-center gap-2 bg-neutral-200" />
              <div className="flex items-center gap-2">
                <Badge variant="neutral" data-testid="step-2">2</Badge>
                <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption">
                  Analyser
                </span>
              </div>
              <div className="flex h-px grow shrink-0 basis-0 flex-col items-center gap-2 bg-neutral-200" />
              <div className="flex items-center gap-2">
                <Badge variant="neutral" data-testid="step-3">3</Badge>
                <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption">
                  Sammenlign
                </span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex w-full flex-col items-start gap-6 mobile:flex-col mobile:flex-nowrap mobile:gap-4">
            {/* Company Selection */}
            <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm mobile:flex-col mobile:flex-nowrap mobile:gap-3 mobile:px-4 mobile:py-4">
              <div className="flex w-full items-center gap-3">
                <IconWithBackground size="medium" icon={<FeatherShield />} />
                <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                  <span className="text-heading-3 font-heading-3 text-default-font mobile:text-body-bold mobile:font-body-bold">
                    Vælg forsikringsselskab
                  </span>
                  <span className="text-caption font-caption text-subtext-color">
                    Hvilket selskab er dit nuværende tilbud fra?
                  </span>
                </div>
              </div>
              
              <SubframeCore.DropdownMenu.Root>
                <SubframeCore.DropdownMenu.Trigger asChild={true}>
                  <Button
                    className="h-10 w-full flex-none"
                    variant="neutral-secondary"
                    size="large"
                    iconRight={<FeatherChevronDown />}
                    data-testid="select-company"
                  >
                    {selectedCompanyName}
                  </Button>
                </SubframeCore.DropdownMenu.Trigger>
                <SubframeCore.DropdownMenu.Portal>
                  <SubframeCore.DropdownMenu.Content
                    side="bottom"
                    align="start"
                    sideOffset={4}
                    asChild={true}
                  >
                    <DropdownMenu>
                      {(companies as any[]).map((company: any) => (
                        <DropdownMenu.DropdownItem
                          key={company.id}
                          icon={<FeatherShield />}
                          onClick={() => handleCompanySelect(company.id, company.name)}
                        >
                          {company.name}
                        </DropdownMenu.DropdownItem>
                      ))}
                    </DropdownMenu>
                  </SubframeCore.DropdownMenu.Content>
                </SubframeCore.DropdownMenu.Portal>
              </SubframeCore.DropdownMenu.Root>
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
                    Tilføj police, tilbud eller andre relevante dokumenter
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
                    Uploadede filer
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
                          {formatFileSize(file.fileSize)} • Uploadet nu
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
          </div>

          {/* Action buttons */}
          <div className="flex w-full items-center justify-between border-t border-solid border-neutral-border pt-6 mobile:flex-col mobile:flex-nowrap mobile:gap-3 mobile:px-0 mobile:pt-4 mobile:pb-0">
            <Button
              className="h-10 w-auto flex-none mobile:h-10 mobile:w-full mobile:flex-none"
              variant="neutral-secondary"
              size="large"
              onClick={handleCancel}
              data-testid="button-cancel"
            >
              Annuller
            </Button>
            <Button
              className="h-10 w-auto flex-none mobile:h-10 mobile:w-full mobile:flex-none"
              size="large"
              iconRight={<FeatherArrowRight />}
              onClick={handleSubmit}
              disabled={uploadMutation.isPending || !selectedCompany || pendingFiles.length === 0}
              data-testid="button-submit-offer"
            >
              {uploadMutation.isPending ? "Uploader..." : "Start forsikrings analyse"}
            </Button>
          </div>
        </div>
      </div>
    </AppLayoutWithNav>
  );
}
