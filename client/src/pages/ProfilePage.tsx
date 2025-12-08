import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { 
  Avatar, 
  Badge, 
  Button, 
  IconButton, 
  IconWithBackground, 
  Dialog,
  TextField
} from "@/ui";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";
import { FeatherDownload, FeatherEdit, FeatherFileText, FeatherMoreVertical, FeatherPlus, FeatherUpload, FeatherX, FeatherGitCompare, FeatherTrash2 } from "@subframe/core";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import LoadingProfile from "@/components/loading/LoadingProfile";

interface CompanyComparisonData {
  id: string;
  userId: string;
  currentCompany: string | null;
  offerCompany: string | null;
  status: string;
  createdAt: string;
  isSuperseded?: boolean;
}

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [location, setLocation] = useLocation();
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showEditPrefsDialog, setShowEditPrefsDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newMember, setNewMember] = useState({ name: "", relationship: "", dateOfBirth: "" });
  const [prefs, setPrefs] = useState<any>({ insurancePriority: "" });
  const [password, setPassword] = useState({ current: "", new: "", confirm: "" });
  const [deleteConfirmDocId, setDeleteConfirmDocId] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedProfile, setEditedProfile] = useState({
    name: "",
    phone: "",
    dateOfBirth: "",
    address: "",
    personalIdNumber: ""
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: user, isLoading: loadingUser } = useQuery({
    queryKey: ["/api/users", userId],
    enabled: !!userId,
  });

  const { data: documentsResponse, isLoading: loadingDocs } = useQuery<{ data: any[]; pagination: any }>({
    queryKey: ["/api/documents/user", userId],
    enabled: !!userId,
  });
  const documents = documentsResponse?.data || [];

  const { data: householdMembers = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["/api/household-members", userId],
    enabled: !!userId,
  });

  const { data: comparisonsData, isLoading: loadingComparisons } = useQuery<CompanyComparisonData[]>({
    queryKey: ["/api/offers", userId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/company-comparisons/user/${userId}`);
      return response.json();
    },
    enabled: !!userId,
  });
  const comparisons = (comparisonsData || []).filter((c: CompanyComparisonData) => !c.isSuperseded);

  const [deleteComparisonId, setDeleteComparisonId] = useState<string | null>(null);

  const deleteComparisonMutation = useMutation({
    mutationFn: async (comparisonId: string) => {
      const response = await apiRequest("DELETE", `/api/company-comparisons/${comparisonId}`, {});
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/offers", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/nav-data", userId] });
      setDeleteComparisonId(null);
      toast({ title: "Tilbud slettet" });
    },
    onError: () => {
      toast({ title: "Kunne ikke slette tilbud", variant: "destructive" });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/household-members", { ...data, userId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/household-members", userId] });
      setShowAddMemberDialog(false);
      setNewMember({ name: "", relationship: "", dateOfBirth: "" });
      toast({ title: "Husstandsmedlem tilføjet" });
    },
  });

  const updatePrefsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", `/api/users/${userId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      setShowEditPrefsDialog(false);
      toast({ title: "Præferencer opdateret" });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", `/api/users/${userId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      setIsEditingProfile(false);
      toast({ title: "Oplysninger gemt" });
    },
    onError: () => {
      toast({ title: "Kunne ikke gemme", variant: "destructive" });
    },
  });

  const startEditing = () => {
    setEditedProfile({
      name: user?.name || "",
      phone: user?.phone || "",
      dateOfBirth: user?.dateOfBirth || "",
      address: user?.address || "",
      personalIdNumber: user?.personalIdNumber || ""
    });
    setIsEditingProfile(true);
  };

  const saveProfile = () => {
    updateProfileMutation.mutate(editedProfile);
  };

  const uploadDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("files", file);
      formData.append("userId", userId!);
      formData.append("documentType", "current");
      
      const response = await apiRequest("POST", "/api/documents/upload", formData);
      const result = await response.json();
      return result;
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/user", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/policies", "user", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/nav-data", userId] });
      
      if (result.ok === false && result.errorCode === "duplicate_file") {
        toast({ 
          title: "Filen er allerede uploadet", 
          description: "Se dit eksisterende forsikringstjek" 
        });
      } else if (result.documents?.[0]?.document?.documentKind === "unknown") {
        toast({ 
          title: "Ukendt dokumenttype", 
          description: "Vi kunne ikke genkende dette som en forsikringspolice. Prøv at uploade selve policen.",
          variant: "destructive"
        });
      } else if (result.documents?.[0]?.error) {
        const errorReason = result.documents[0].error;
        const errorMessages: Record<string, { title: string; description: string }> = {
          'file_too_large': {
            title: "Filen er for stor",
            description: "Upload en PDF på maks 20 MB."
          },
          'pdf_password_protected': {
            title: "PDF beskyttet med adgangskode",
            description: "Gem en version uden kode, eller tag en kopi og upload som en almindelig PDF."
          },
          'pdf_corrupt': {
            title: "PDF kunne ikke læses",
            description: "Prøv at downloade den igen fra dit forsikringsselskab og upload en ny version."
          },
          'ocr_failed': {
            title: "Teknisk fejl",
            description: "Der skete en fejl, da vi forsøgte at læse filen. Prøv igen eller upload en anden version."
          }
        };
        const errorInfo = errorMessages[errorReason] || errorMessages['ocr_failed'];
        toast({ 
          title: errorInfo.title, 
          description: errorInfo.description,
          variant: "destructive"
        });
      } else {
        toast({ 
          title: "Dokument uploadet og analyseret", 
          description: "Dit forsikringstjek er klar" 
        });
      }
    },
    onError: (error: Error) => {
      toast({ 
        title: "Upload fejlede", 
        description: error.message || "Kunne ikke uploade dokument",
        variant: "destructive" 
      });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiRequest("DELETE", `/api/documents/${documentId}`, {});
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/user", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/nav-data", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/policies", "user", userId] });
      setDeleteConfirmDocId(null);
      toast({ title: "Dokument slettet" });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await apiRequest("POST", `/api/users/${userId}/password`, data);
      return response.json();
    },
    onSuccess: () => {
      setShowPasswordDialog(false);
      setPassword({ current: "", new: "", confirm: "" });
      toast({ title: "Adgangskode opdateret" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Fejl", 
        description: error.message || "Kunne ikke opdatere adgangskode",
        variant: "destructive"
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      uploadDocumentMutation.mutate(file);
    } else if (file) {
      toast({ title: "Kun PDF-filer er tilladt", variant: "destructive" });
    }
  };

  if (loadingUser) {
    return (
      <AppLayoutWithNav userId={userId!}>
        <LoadingProfile />
      </AppLayoutWithNav>
    );
  }

  if (!user) {
    return <div className="flex h-screen items-center justify-center">Bruger ikke fundet</div>;
  }


  return (
    <AppLayoutWithNav userId={userId!}>
      <div className="flex h-full w-full flex-col items-start">
        <div className="flex w-full grow shrink-0 basis-0 flex-col items-center gap-8 bg-default-background px-4 py-6 overflow-auto mobile:px-4 mobile:py-4">
          <div className="flex w-full max-w-[768px] flex-col items-start gap-6 mobile:flex-col mobile:flex-nowrap mobile:gap-4">
            <div className="flex w-full flex-col items-start gap-4 mobile:flex-col mobile:flex-nowrap mobile:gap-3">
              <div className="flex w-full items-center gap-4 mobile:flex-row mobile:flex-nowrap mobile:gap-3">
                <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                  <span className="text-heading-1 font-heading-1 text-default-font mobile:text-heading-2 mobile:font-heading-2" data-testid="text-page-title">
                    Din profil
                  </span>
                  <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption">
                    Her kan du ændre i din information og tilføje personer til din husstand, samt tilføje flere forsikringer
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex w-full flex-col items-start gap-8 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6 mobile:flex-col mobile:flex-nowrap mobile:gap-6 mobile:px-4 mobile:py-4">
              {/* Personal Information Section */}
              <div className="flex w-full flex-col items-start gap-4 mobile:flex-col mobile:flex-nowrap mobile:gap-3">
                <div className="flex w-full items-center gap-2 flex-wrap">
                  <span className="grow shrink-0 basis-0 text-heading-2 font-heading-2 text-default-font">
                    Personlige oplysninger
                  </span>
                  {isEditingProfile ? (
                    <Button
                      className="h-12 mobile:grow mobile:shrink-0 mobile:basis-0 touch-target"
                      variant="brand-primary"
                      onClick={saveProfile}
                      loading={updateProfileMutation.isPending}
                      data-testid="button-save-info"
                    >
                      Gem
                    </Button>
                  ) : (
                    <Button
                      className="h-12 mobile:grow mobile:shrink-0 mobile:basis-0 touch-target"
                      variant="neutral-secondary"
                      onClick={startEditing}
                      data-testid="button-edit-info"
                    >
                      Rediger oplysninger
                    </Button>
                  )}
                </div>
                <div className="flex w-full flex-col items-start">
                  {/* Fulde navn */}
                  <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border py-6 mobile:flex-col mobile:flex-nowrap mobile:items-start mobile:justify-start mobile:gap-1 mobile:px-0 mobile:py-4">
                    <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-subtext-color mobile:text-caption mobile:font-caption">
                      Fulde navn
                    </span>
                    {isEditingProfile ? (
                      <TextField className="grow shrink-0 basis-0">
                        <TextField.Input
                          placeholder="Dit fulde navn"
                          value={editedProfile.name}
                          onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                          data-testid="input-full-name"
                        />
                      </TextField>
                    ) : (
                      <span className="grow shrink-0 basis-0 text-body font-body text-default-font mobile:text-body-bold mobile:font-body-bold" data-testid="text-full-name">
                        {user.name || "Ikke oplyst"}
                      </span>
                    )}
                  </div>
                  
                  {/* Email (read-only) */}
                  <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border py-6 mobile:flex-col mobile:flex-nowrap mobile:items-start mobile:justify-start mobile:gap-1 mobile:px-0 mobile:py-4">
                    <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-subtext-color mobile:text-caption mobile:font-caption">
                      Email
                    </span>
                    <span className="grow shrink-0 basis-0 text-body font-body text-default-font mobile:text-body-bold mobile:font-body-bold" data-testid="text-email">
                      {user.email}
                    </span>
                  </div>
                  
                  {/* Telefonnummer */}
                  <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border py-6 mobile:flex-col mobile:flex-nowrap mobile:items-start mobile:justify-start mobile:gap-1 mobile:px-0 mobile:py-4">
                    <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-subtext-color mobile:text-caption mobile:font-caption">
                      Telefonnummer
                    </span>
                    {isEditingProfile ? (
                      <TextField className="grow shrink-0 basis-0">
                        <TextField.Input
                          placeholder="Dit telefonnummer"
                          value={editedProfile.phone}
                          onChange={(e) => setEditedProfile({ ...editedProfile, phone: e.target.value })}
                          data-testid="input-phone"
                        />
                      </TextField>
                    ) : (
                      <span className="grow shrink-0 basis-0 text-body font-body text-default-font mobile:text-body-bold mobile:font-body-bold" data-testid="text-phone">
                        {user.phone || "Ikke oplyst"}
                      </span>
                    )}
                  </div>
                  
                  {/* Fødselsdato */}
                  <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border py-6 mobile:flex-col mobile:flex-nowrap mobile:items-start mobile:justify-start mobile:gap-1 mobile:px-0 mobile:py-4">
                    <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-subtext-color mobile:text-caption mobile:font-caption">
                      Fødselsdato
                    </span>
                    {isEditingProfile ? (
                      <TextField className="grow shrink-0 basis-0">
                        <TextField.Input
                          placeholder="DD-MM-ÅÅÅÅ"
                          value={editedProfile.dateOfBirth}
                          onChange={(e) => setEditedProfile({ ...editedProfile, dateOfBirth: e.target.value })}
                          data-testid="input-dob"
                        />
                      </TextField>
                    ) : (
                      <span className="grow shrink-0 basis-0 text-body font-body text-default-font mobile:text-body-bold mobile:font-body-bold" data-testid="text-dob">
                        {user.dateOfBirth || "Ikke oplyst"}
                      </span>
                    )}
                  </div>
                  
                  {/* Adresse */}
                  <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border py-6 mobile:flex-col mobile:flex-nowrap mobile:items-start mobile:justify-start mobile:gap-1 mobile:px-0 mobile:py-4">
                    <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-subtext-color mobile:text-caption mobile:font-caption">
                      Adresse
                    </span>
                    {isEditingProfile ? (
                      <TextField className="grow shrink-0 basis-0">
                        <TextField.Input
                          placeholder="Din adresse"
                          value={editedProfile.address}
                          onChange={(e) => setEditedProfile({ ...editedProfile, address: e.target.value })}
                          data-testid="input-address"
                        />
                      </TextField>
                    ) : (
                      <span className="grow shrink-0 basis-0 text-body font-body text-default-font mobile:text-body-bold mobile:font-body-bold" data-testid="text-address">
                        {user.address || "Ikke oplyst"}
                      </span>
                    )}
                  </div>
                  
                  {/* CPR-nummer */}
                  <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border py-6 mobile:flex-col mobile:flex-nowrap mobile:items-start mobile:justify-start mobile:gap-1 mobile:px-0 mobile:py-4">
                    <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-subtext-color mobile:text-caption mobile:font-caption">
                      CPR-nummer
                    </span>
                    {isEditingProfile ? (
                      <TextField className="grow shrink-0 basis-0">
                        <TextField.Input
                          placeholder="DDMMÅÅ-XXXX"
                          value={editedProfile.personalIdNumber}
                          onChange={(e) => setEditedProfile({ ...editedProfile, personalIdNumber: e.target.value })}
                          data-testid="input-cpr"
                        />
                      </TextField>
                    ) : (
                      <span className="grow shrink-0 basis-0 text-body font-body text-default-font mobile:text-body-bold mobile:font-body-bold" data-testid="text-cpr">
                        {user.personalIdNumber ? "************" : "Ikke oplyst"}
                      </span>
                    )}
                  </div>
                  
                  {/* Adgangskode */}
                  <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border py-6 mobile:flex-col mobile:flex-nowrap mobile:items-start mobile:justify-start mobile:gap-1 mobile:px-0 mobile:py-4">
                    <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-subtext-color mobile:text-caption mobile:font-caption">
                      Adgangskode
                    </span>
                    <div className="flex grow shrink-0 basis-0 items-center gap-2 mobile:flex-col mobile:items-start mobile:w-full">
                      <span className="flex-1 text-body font-body text-default-font mobile:text-body-bold mobile:font-body-bold" data-testid="text-password-status">
                        {user.passwordHash ? "••••••••" : "Ikke angivet"}
                      </span>
                      <Button
                        variant="neutral-secondary"
                        size="small"
                        onClick={() => setShowPasswordDialog(true)}
                        data-testid="button-change-password"
                      >
                        {user.passwordHash ? "Skift adgangskode" : "Opret adgangskode"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Uploaded Insurance Documents Section */}
              <div className="flex w-full flex-col items-start gap-4 mobile:flex-col mobile:flex-nowrap mobile:gap-3">
                <div className="flex w-full items-center gap-2 flex-wrap">
                  <span className="grow shrink-0 basis-0 text-heading-3 font-heading-3 text-default-font">
                    Uploadede forsikringsdokumenter
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    className="h-12 mobile:grow mobile:shrink-0 mobile:basis-0 touch-target"
                    variant="neutral-secondary"
                    icon={<FeatherUpload />}
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-upload-policy"
                    disabled={uploadDocumentMutation.isPending}
                  >
                    {uploadDocumentMutation.isPending ? "Uploader..." : "Upload police"}
                  </Button>
                </div>
                <div className="flex w-full flex-col items-start">
                  {loadingDocs ? (
                    <div className="w-full text-center py-8 text-body font-body text-subtext-color">Indlæser...</div>
                  ) : documents.length === 0 ? (
                    <div className="w-full text-center py-8 text-body font-body text-subtext-color">
                      Ingen dokumenter uploadet endnu
                    </div>
                  ) : (
                    documents.map((doc: any) => (
                      <div key={doc.id} className="flex w-full items-center gap-4 border-b border-solid border-neutral-border py-6 mobile:flex-row mobile:flex-nowrap mobile:gap-3 mobile:px-0 mobile:py-4">
                        <IconWithBackground
                          className="mobile:hidden"
                          size="large"
                          icon={<FeatherFileText />}
                        />
                        <IconWithBackground
                          className="hidden mobile:flex"
                          size="medium"
                          icon={<FeatherFileText />}
                        />
                        <div className="flex grow shrink-0 basis-0 flex-col items-start justify-center gap-1">
                          <div className="flex items-center gap-2 w-full flex-wrap">
                            <span className="text-body-bold font-body-bold text-default-font mobile:text-caption-bold mobile:font-caption-bold" data-testid={`text-doc-name-${doc.id}`}>
                              {doc.fileName}
                            </span>
                            {doc.documentKind === 'unknown' && (
                              <span 
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                                data-testid={`badge-unknown-doc-${doc.id}`}
                                title="Vi kunne ikke genkende dette dokument som en forsikringspolice. Prøv at uploade selve policen eller din forsikringsoversigt fra dit selskab."
                              >
                                Ukendt dokument
                              </span>
                            )}
                            {(doc.extractionStatus === 'pending' || doc.extractionStatus === 'processing') && (
                              <span 
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                data-testid={`badge-processing-doc-${doc.id}`}
                              >
                                Behandler...
                              </span>
                            )}
                            {doc.extractionStatus === 'failed' && (
                              <span 
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                data-testid={`badge-failed-doc-${doc.id}`}
                              >
                                Fejl ved filen
                              </span>
                            )}
                          </div>
                          <span className="w-full text-body font-body text-subtext-color mobile:text-caption mobile:font-caption" data-testid={`text-doc-info-${doc.id}`}>
                            Uploadet {doc.createdAt ? format(new Date(doc.createdAt), "d. MMMM yyyy", { locale: da }) : "ukendt"} • PDF • {doc.fileSize ? `${(doc.fileSize / 1024 / 1024).toFixed(1)} MB` : "ukendt"}
                          </span>
                          {doc.documentKind === 'unknown' && (
                            <span className="w-full text-caption font-caption text-amber-600 dark:text-amber-400" data-testid={`text-unknown-hint-${doc.id}`}>
                              Vi kunne ikke genkende dette som en forsikringspolice. Prøv at uploade selve policen.
                            </span>
                          )}
                          {(doc.extractionStatus === 'pending' || doc.extractionStatus === 'processing') && (
                            <span className="w-full text-caption font-caption text-blue-600 dark:text-blue-400" data-testid={`text-processing-hint-${doc.id}`}>
                              Vi er i gang med at læse din forsikring. Prøv at genindlæse siden om lidt.
                            </span>
                          )}
                          {doc.extractionStatus === 'failed' && doc.errorReason === 'file_too_large' && (
                            <span className="w-full text-caption font-caption text-red-600 dark:text-red-400" data-testid={`text-error-hint-${doc.id}`}>
                              Filen er for stor. Upload en PDF på maks 20 MB.
                            </span>
                          )}
                          {doc.extractionStatus === 'failed' && doc.errorReason === 'pdf_password_protected' && (
                            <span className="w-full text-caption font-caption text-red-600 dark:text-red-400" data-testid={`text-error-hint-${doc.id}`}>
                              PDF'en er beskyttet med adgangskode. Gem en version uden kode, eller tag en kopi/screenshot og upload som en almindelig PDF.
                            </span>
                          )}
                          {doc.extractionStatus === 'failed' && doc.errorReason === 'pdf_corrupt' && (
                            <span className="w-full text-caption font-caption text-red-600 dark:text-red-400" data-testid={`text-error-hint-${doc.id}`}>
                              Vi kunne ikke læse denne PDF-fil. Prøv at downloade den igen fra dit forsikringsselskab og upload en ny version.
                            </span>
                          )}
                          {doc.extractionStatus === 'failed' && (!doc.errorReason || doc.errorReason === 'ocr_failed') && (
                            <span className="w-full text-caption font-caption text-red-600 dark:text-red-400" data-testid={`text-error-hint-${doc.id}`}>
                              Der skete en teknisk fejl, da vi forsøgte at læse filen. Prøv igen eller upload en anden version.
                            </span>
                          )}
                        </div>
                        <Button
                          className="mobile:hidden touch-target"
                          variant="neutral-secondary"
                          size="small"
                          data-testid={`button-view-doc-${doc.id}`}
                        >
                          Se
                        </Button>
                        <IconButton
                          className="mobile:hidden touch-target"
                          size="small"
                          icon={<FeatherDownload />}
                          data-testid={`button-download-doc-${doc.id}`}
                        />
                        <IconButton
                          className="mobile:hidden touch-target"
                          size="small"
                          icon={<FeatherX />}
                          onClick={() => {
                            if (confirm(`Er du sikker på, at du vil slette "${doc.fileName}"?`)) {
                              deleteDocumentMutation.mutate(doc.id);
                            }
                          }}
                          data-testid={`button-delete-doc-${doc.id}`}
                        />
                        <IconButton
                          className="hidden mobile:flex touch-target"
                          size="small"
                          icon={<FeatherMoreVertical />}
                          data-testid={`button-more-doc-${doc.id}`}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Offers/Comparisons Section */}
              <div className="flex w-full flex-col items-start gap-4 mobile:flex-col mobile:flex-nowrap mobile:gap-3">
                <div className="flex w-full items-center gap-2 flex-wrap">
                  <span className="grow shrink-0 basis-0 text-heading-3 font-heading-3 text-default-font">
                    Mine tilbud og sammenligninger
                  </span>
                </div>
                {loadingComparisons ? (
                  <div className="w-full text-center py-8 text-body font-body text-subtext-color">Indlæser...</div>
                ) : comparisons.length === 0 ? (
                  <div className="w-full text-center py-8 text-body font-body text-subtext-color">
                    Ingen tilbud modtaget endnu
                  </div>
                ) : (
                  <div className="flex w-full flex-col items-start gap-3">
                    {comparisons.map((comparison: CompanyComparisonData) => (
                      <div 
                        key={comparison.id} 
                        className="flex w-full items-center gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-4 py-4 hover:bg-neutral-50 transition-colors mobile:flex-row mobile:flex-nowrap mobile:gap-3 mobile:px-3 mobile:py-3"
                      >
                        <IconWithBackground
                          className="mobile:hidden"
                          size="large"
                          icon={<FeatherGitCompare />}
                          variant={comparison.status === 'completed' ? 'success' : comparison.status === 'failed' ? 'error' : 'warning'}
                        />
                        <IconWithBackground
                          className="hidden mobile:flex"
                          size="medium"
                          icon={<FeatherGitCompare />}
                          variant={comparison.status === 'completed' ? 'success' : comparison.status === 'failed' ? 'error' : 'warning'}
                        />
                        <div className="flex grow shrink-0 basis-0 flex-col items-start justify-center gap-1">
                          <div className="flex items-center gap-2 w-full flex-wrap">
                            <span className="text-body-bold font-body-bold text-default-font mobile:text-caption-bold mobile:font-caption-bold" data-testid={`text-comparison-company-${comparison.id}`}>
                              Tilbud fra {comparison.offerCompany || 'Ukendt selskab'}
                            </span>
                            {comparison.status === 'completed' && (
                              <Badge variant="success">Klar</Badge>
                            )}
                            {comparison.status === 'pending' && (
                              <Badge variant="warning">Afventer</Badge>
                            )}
                            {comparison.status === 'processing' && (
                              <Badge variant="warning">Behandler</Badge>
                            )}
                            {comparison.status === 'failed' && (
                              <Badge variant="error">Fejl</Badge>
                            )}
                          </div>
                          <span className="w-full text-body font-body text-subtext-color mobile:text-caption mobile:font-caption" data-testid={`text-comparison-date-${comparison.id}`}>
                            Oprettet {comparison.createdAt ? format(new Date(comparison.createdAt), "d. MMMM yyyy", { locale: da }) : "ukendt"}
                          </span>
                        </div>
                        {comparison.status === 'completed' && (
                          <Button
                            className="mobile:hidden touch-target"
                            variant="brand-secondary"
                            size="small"
                            onClick={() => setLocation(`/sammenligning/${comparison.id}`)}
                            data-testid={`button-view-comparison-${comparison.id}`}
                          >
                            Se sammenligning
                          </Button>
                        )}
                        <IconButton
                          className="touch-target"
                          size="small"
                          icon={<FeatherTrash2 />}
                          onClick={() => setDeleteComparisonId(comparison.id)}
                          data-testid={`button-delete-comparison-${comparison.id}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Household Members Section */}
              <div className="flex w-full flex-col items-start gap-4 mobile:flex-col mobile:flex-nowrap mobile:gap-3">
                <div className="flex w-full items-center gap-2 flex-wrap">
                  <span className="grow shrink-0 basis-0 text-heading-3 font-heading-3 text-default-font">
                    Husstandsmedlemmer
                  </span>
                  <Button
                    className="h-12 mobile:grow mobile:shrink-0 mobile:basis-0 touch-target"
                    variant="neutral-secondary"
                    icon={<FeatherPlus />}
                    onClick={() => setShowAddMemberDialog(true)}
                    data-testid="button-add-member"
                  >
                    Tilføj medlem
                  </Button>
                </div>
                {loadingMembers ? (
                  <div className="w-full text-center py-8 text-body font-body text-subtext-color">Indlæser...</div>
                ) : householdMembers.length === 0 ? (
                  <div className="w-full text-center py-8 text-body font-body text-subtext-color">
                    Ingen husstandsmedlemmer tilføjet endnu
                  </div>
                ) : (
                  <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-4 py-4 mobile:flex-col mobile:flex-nowrap mobile:gap-3 mobile:px-3 mobile:py-3">
                    {householdMembers.map((member: any, index: number) => (
                      <div key={member.id} className="w-full">
                        <div className="flex w-full items-center gap-4 mobile:flex-row mobile:flex-nowrap mobile:gap-3">
                          <Avatar
                            className="mobile:hidden"
                            image={member.avatarUrl || ""}
                          >
                            {member.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </Avatar>
                          <Avatar
                            className="hidden mobile:flex"
                            size="small"
                            image={member.avatarUrl || ""}
                          >
                            {member.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </Avatar>
                          <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                            <span className="text-body-bold font-body-bold text-default-font mobile:text-caption-bold mobile:font-caption-bold" data-testid={`text-member-name-${member.id}`}>
                              {member.name}
                            </span>
                            <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption" data-testid={`text-member-info-${member.id}`}>
                              {member.relationship ? `${member.relationship} • ` : ""}Født {member.dateOfBirth || "ukendt"}
                            </span>
                          </div>
                          <IconButton
                            className="touch-target"
                            size="small"
                            icon={<FeatherEdit />}
                            data-testid={`button-edit-member-${member.id}`}
                          />
                        </div>
                        {index < householdMembers.length - 1 && (
                          <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border mt-4" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Insurance Preferences Section */}
              <div className="flex w-full flex-col items-start gap-4 mobile:flex-col mobile:flex-nowrap mobile:gap-3">
                <div className="flex w-full items-center gap-2 flex-wrap">
                  <span className="grow shrink-0 basis-0 text-heading-3 font-heading-3 text-default-font">
                    Forsikringspræferencer
                  </span>
                  <Button
                    className="h-12 mobile:grow mobile:shrink-0 mobile:basis-0 touch-target"
                    variant="neutral-secondary"
                    onClick={() => setShowEditPrefsDialog(true)}
                    data-testid="button-edit-preferences"
                  >
                    Rediger præference
                  </Button>
                </div>
                <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-6 py-6 mobile:flex-col mobile:flex-nowrap mobile:gap-3 mobile:px-4 mobile:py-4">
                  <span className="text-body-bold font-body-bold text-default-font mobile:text-caption-bold mobile:font-caption-bold">
                    Hvad er vigtigst for dig?
                  </span>
                  <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border py-4 mobile:py-3">
                    <span className="flex-1 text-body font-body text-default-font mobile:text-body-bold mobile:font-body-bold" data-testid="text-insurance-priority">
                      {user.insurancePriority === 'cheap' ? '💰 Laveste pris' :
                       user.insurancePriority === 'coverage' ? '🛡️ Bedste dækning' :
                       user.insurancePriority === 'convenience' ? '✨ God kundeservice' :
                       'Ikke valgt'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Household Member Dialog */}
      <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
        <Dialog.Content>
          <div className="flex flex-col gap-6 p-6 w-full max-w-md">
            <div className="flex items-center justify-between">
              <span className="text-heading-3 font-heading-3 text-default-font">Tilføj husstandsmedlem</span>
              <IconButton size="small" icon={<FeatherX />} onClick={() => setShowAddMemberDialog(false)} />
            </div>
            
            <div className="flex flex-col gap-4">
              <TextField
                label="Navn"
                helpText=""
              >
                <TextField.Input
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                  placeholder="Indtast navn"
                  data-testid="input-member-name"
                />
              </TextField>
              <TextField
                label="Relation (f.eks. Ægtefælle, Barn)"
                helpText=""
              >
                <TextField.Input
                  value={newMember.relationship}
                  onChange={(e) => setNewMember({ ...newMember, relationship: e.target.value })}
                  placeholder="Indtast relation"
                  data-testid="input-member-relationship"
                />
              </TextField>
              <TextField
                label="Fødselsdato (DD/MM/ÅÅÅÅ)"
                helpText=""
              >
                <TextField.Input
                  value={newMember.dateOfBirth}
                  onChange={(e) => setNewMember({ ...newMember, dateOfBirth: e.target.value })}
                  placeholder="DD/MM/ÅÅÅÅ"
                  data-testid="input-member-dob"
                />
              </TextField>
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1"
                variant="neutral-secondary"
                onClick={() => setShowAddMemberDialog(false)}
              >
                Annuller
              </Button>
              <Button
                className="flex-1"
                onClick={() => addMemberMutation.mutate(newMember)}
                disabled={!newMember.name || addMemberMutation.isPending}
              >
                {addMemberMutation.isPending ? "Tilføjer..." : "Tilføj"}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog>

      {/* Edit Preferences Dialog */}
      <Dialog open={showEditPrefsDialog} onOpenChange={setShowEditPrefsDialog}>
        <Dialog.Content>
          <div className="flex flex-col gap-6 p-6 w-full max-w-md">
            <div className="flex items-center justify-between">
              <span className="text-heading-3 font-heading-3 text-default-font">Vælg forsikringspræference</span>
              <IconButton size="small" icon={<FeatherX />} onClick={() => setShowEditPrefsDialog(false)} />
            </div>
            
            <div className="flex flex-col gap-3">
              <span className="text-body-bold font-body-bold text-default-font">Hvad er vigtigst for dig?</span>
              {[
                { value: 'cheap', label: '💰 Laveste pris', desc: 'Find den billigste forsikring' },
                { value: 'coverage', label: '🛡️ Bedste dækning', desc: 'Maksimal beskyttelse' },
                { value: 'convenience', label: '✨ God kundeservice', desc: 'Nemt og hurtigt' },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex items-start gap-3 p-4 border border-solid border-neutral-border rounded-md cursor-pointer hover:bg-neutral-50"
                  data-testid={`radio-priority-${option.value}`}
                >
                  <input
                    type="radio"
                    name="insurancePriority"
                    value={option.value}
                    checked={(prefs as any).insurancePriority === option.value}
                    onChange={() => setPrefs({ ...prefs, insurancePriority: option.value } as any)}
                    className="mt-1"
                  />
                  <div className="flex flex-col">
                    <span className="text-body-bold font-body-bold text-default-font">{option.label}</span>
                    <span className="text-caption font-caption text-subtext-color">{option.desc}</span>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1"
                variant="neutral-secondary"
                onClick={() => setShowEditPrefsDialog(false)}
              >
                Annuller
              </Button>
              <Button
                className="flex-1"
                onClick={() => updatePrefsMutation.mutate({ insurancePriority: (prefs as any).insurancePriority })}
                disabled={updatePrefsMutation.isPending}
                data-testid="button-save-preferences"
              >
                {updatePrefsMutation.isPending ? "Gemmer..." : "Gem"}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog>

      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <Dialog.Content>
          <div className="flex flex-col gap-6 p-6 w-full max-w-md">
            <div className="flex items-center justify-between">
              <span className="text-heading-3 font-heading-3 text-default-font">
                {user?.passwordHash ? "Skift adgangskode" : "Opret adgangskode"}
              </span>
              <IconButton size="small" icon={<FeatherX />} onClick={() => setShowPasswordDialog(false)} />
            </div>
            
            <div className="flex flex-col gap-4">
              {user?.passwordHash && (
                <TextField label="Nuværende adgangskode" helpText="">
                  <TextField.Input
                    type="password"
                    value={password.current}
                    onChange={(e) => setPassword({ ...password, current: e.target.value })}
                    placeholder="Indtast nuværende adgangskode"
                    data-testid="input-current-password"
                  />
                </TextField>
              )}
              <TextField label="Ny adgangskode" helpText="Mindst 8 tegn">
                <TextField.Input
                  type="password"
                  value={password.new}
                  onChange={(e) => setPassword({ ...password, new: e.target.value })}
                  placeholder="Indtast ny adgangskode"
                  data-testid="input-new-password"
                />
              </TextField>
              <TextField label="Bekræft adgangskode" helpText="">
                <TextField.Input
                  type="password"
                  value={password.confirm}
                  onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
                  placeholder="Indtast ny adgangskode igen"
                  data-testid="input-confirm-password"
                />
              </TextField>
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1"
                variant="neutral-secondary"
                onClick={() => setShowPasswordDialog(false)}
              >
                Annuller
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  if (password.new !== password.confirm) {
                    toast({ title: "Adgangskoderne matcher ikke", variant: "destructive" });
                    return;
                  }
                  if (password.new.length < 8) {
                    toast({ title: "Adgangskoden skal være mindst 8 tegn", variant: "destructive" });
                    return;
                  }
                  updatePasswordMutation.mutate({
                    currentPassword: password.current,
                    newPassword: password.new
                  });
                }}
                disabled={updatePasswordMutation.isPending || !password.new}
                data-testid="button-save-password"
              >
                {updatePasswordMutation.isPending ? "Gemmer..." : "Gem"}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog>

      {/* Delete Comparison Confirmation Dialog */}
      <Dialog open={!!deleteComparisonId} onOpenChange={() => setDeleteComparisonId(null)}>
        <Dialog.Content>
          <div className="flex flex-col gap-6 p-6 w-full max-w-md">
            <div className="flex items-center justify-between">
              <span className="text-heading-3 font-heading-3 text-default-font">Slet tilbud</span>
              <IconButton size="small" icon={<FeatherX />} onClick={() => setDeleteComparisonId(null)} />
            </div>
            
            <p className="text-body text-default-font">
              Er du sikker på, at du vil slette dette tilbud? Denne handling kan ikke fortrydes.
            </p>

            <div className="flex gap-3">
              <Button
                className="flex-1"
                variant="neutral-secondary"
                onClick={() => setDeleteComparisonId(null)}
              >
                Annuller
              </Button>
              <Button
                className="flex-1"
                variant="destructive-primary"
                onClick={() => {
                  if (deleteComparisonId) {
                    deleteComparisonMutation.mutate(deleteComparisonId);
                  }
                }}
                disabled={deleteComparisonMutation.isPending}
                data-testid="button-confirm-delete-comparison"
              >
                {deleteComparisonMutation.isPending ? "Sletter..." : "Slet tilbud"}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog>
    </AppLayoutWithNav>
  );
}
