import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Shield, ArrowLeft, Upload } from "lucide-react";
import FileUpload from "@/components/file-upload";
import UserSelector from "@/components/user-selector";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";

export default function UploadOffer() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const userId = localStorage.getItem("userId");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

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

  const handleFilesUploaded = (files: FileList) => {
    const fileArray = Array.from(files);
    setPendingFiles(fileArray);
    
    const displayFiles = fileArray.map((file) => ({
      fileName: file.name,
      fileSize: file.size,
    }));
    setUploadedFiles(displayFiles);
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

            <Card className="shadow-card-lg">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-foreground mb-3">
                    Upload modtaget tilbud
                  </h2>
                  <p className="text-lg text-muted-foreground">
                    Upload PDF-tilbuddet du har modtaget fra et forsikringsselskab
                  </p>
                </div>

                {/* Company Selection */}
                <div className="mb-8">
                  <label className="block text-lg font-semibold text-foreground mb-3">
                    Hvilket selskab kommer tilbuddet fra?
                  </label>
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
                <FileUpload
                  onFilesUploaded={handleFilesUploaded}
                  uploadedFiles={uploadedFiles}
                  isUploading={uploadMutation.isPending}
                />

                <div className="flex justify-end mt-8">
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
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </AppLayoutWithNav>
  );
}
