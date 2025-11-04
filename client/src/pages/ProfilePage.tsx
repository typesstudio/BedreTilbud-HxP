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
import { FeatherDownload, FeatherEdit, FeatherFileText, FeatherMoreVertical, FeatherPlus, FeatherUpload, FeatherX } from "@subframe/core";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [location, setLocation] = useLocation();
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showEditPrefsDialog, setShowEditPrefsDialog] = useState(false);
  const [newMember, setNewMember] = useState({ name: "", relationship: "", dateOfBirth: "" });
  const [prefs, setPrefs] = useState({ priorityOne: "", priorityTwo: "", priorityThree: "", additionalInfo: "", insuranceTypes: [] as string[] });
  const [newInsuranceType, setNewInsuranceType] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: user, isLoading: loadingUser } = useQuery({
    queryKey: ["/api/users", userId],
    enabled: !!userId,
  });

  const { data: documents = [], isLoading: loadingDocs } = useQuery({
    queryKey: ["/api/documents/user", userId],
    enabled: !!userId,
  });

  const { data: householdMembers = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["/api/household-members", userId],
    enabled: !!userId,
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

  const uploadDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("files", file);
      formData.append("userId", userId!);
      formData.append("documentType", "current");
      
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
        headers: {
          "X-User-ID": userId!,
        },
      });
      
      if (!response.ok) throw new Error("Upload failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/user", userId] });
      toast({ title: "Dokument uploadet" });
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
    return <div className="flex h-screen items-center justify-center">Indlæser...</div>;
  }

  if (!user) {
    return <div className="flex h-screen items-center justify-center">Bruger ikke fundet</div>;
  }

  const insuranceTypes = user.insuranceTypes || [];

  const openEditPrefs = () => {
    setPrefs({
      priorityOne: user.priorityOne || "",
      priorityTwo: user.priorityTwo || "",
      priorityThree: user.priorityThree || "",
      additionalInfo: user.additionalInfo || "",
      insuranceTypes: user.insuranceTypes || []
    });
    setShowEditPrefsDialog(true);
  };

  const handleAddInsuranceType = () => {
    if (newInsuranceType && !prefs.insuranceTypes.includes(newInsuranceType)) {
      setPrefs({ ...prefs, insuranceTypes: [...prefs.insuranceTypes, newInsuranceType] });
      setNewInsuranceType("");
    }
  };

  const handleRemoveInsuranceType = (type: string) => {
    setPrefs({ ...prefs, insuranceTypes: prefs.insuranceTypes.filter(t => t !== type) });
  };

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
                  <Button
                    className="h-12 mobile:grow mobile:shrink-0 mobile:basis-0 touch-target"
                    variant="neutral-secondary"
                    data-testid="button-edit-info"
                  >
                    Rediger oplysninger
                  </Button>
                </div>
                <div className="flex w-full flex-col items-start">
                  {[
                    { label: "Fulde navn", value: user.name || "Ikke oplyst", testid: "text-full-name" },
                    { label: "Email", value: user.email, testid: "text-email" },
                    { label: "Telefonnummer", value: user.phone || "Ikke oplyst", testid: "text-phone" },
                    { label: "Fødselsdato", value: user.dateOfBirth || "Ikke oplyst", testid: "text-dob" },
                    { label: "Adresse", value: user.address || "Ikke oplyst", testid: "text-address" },
                    { label: "CPR-nummer", value: user.personalIdNumber ? "************" : "Ikke oplyst", testid: "text-cpr" },
                  ].map((item) => (
                    <div key={item.label} className="flex w-full items-center gap-2 border-b border-solid border-neutral-border py-6 mobile:flex-col mobile:flex-nowrap mobile:items-start mobile:justify-start mobile:gap-1 mobile:px-0 mobile:py-4">
                      <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-subtext-color mobile:text-caption mobile:font-caption">
                        {item.label}
                      </span>
                      <span className="grow shrink-0 basis-0 text-body font-body text-default-font mobile:text-body-bold mobile:font-body-bold" data-testid={item.testid}>
                        {item.value}
                      </span>
                    </div>
                  ))}
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
                          <span className="w-full text-body-bold font-body-bold text-default-font mobile:text-caption-bold mobile:font-caption-bold" data-testid={`text-doc-name-${doc.id}`}>
                            {doc.fileName}
                          </span>
                          <span className="w-full text-body font-body text-subtext-color mobile:text-caption mobile:font-caption" data-testid={`text-doc-info-${doc.id}`}>
                            Uploadet {doc.createdAt ? format(new Date(doc.createdAt), "d. MMMM yyyy", { locale: da }) : "ukendt"} • PDF • {doc.fileSize ? `${(doc.fileSize / 1024 / 1024).toFixed(1)} MB` : "ukendt"}
                          </span>
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
                    onClick={openEditPrefs}
                    data-testid="button-edit-preferences"
                  >
                    Rediger præferencer
                  </Button>
                </div>
                <div className="flex w-full flex-col items-start gap-6 rounded-md border border-solid border-neutral-border bg-neutral-50 px-6 py-6 mobile:flex-col mobile:flex-nowrap mobile:gap-4 mobile:px-4 mobile:py-4">
                  <div className="flex w-full flex-col items-start gap-3 mobile:flex-col mobile:flex-nowrap mobile:gap-2">
                    <span className="text-body-bold font-body-bold text-default-font mobile:text-caption-bold mobile:font-caption-bold">
                      Forsikringstyper jeg har brug for
                    </span>
                    <div className="flex w-full items-start gap-2 flex-wrap">
                      {insuranceTypes.length > 0 ? (
                        insuranceTypes.map((type: string) => (
                          <Badge key={type} data-testid={`badge-insurance-${type}`}>{type}</Badge>
                        ))
                      ) : (
                        <>
                          <Badge variant="neutral" icon={<FeatherPlus />}>
                            Tilføj forsikringstype
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
                  <div className="flex w-full flex-col items-start gap-3 mobile:flex-col mobile:flex-nowrap mobile:gap-2">
                    <span className="text-body-bold font-body-bold text-default-font mobile:text-caption-bold mobile:font-caption-bold">
                      Hvad er vigtigst for mig
                    </span>
                    <div className="flex w-full flex-col items-start">
                      {[
                        { label: "Prioritet #1", value: user.priorityOne || "Laveste pris", testid: "text-priority-1" },
                        { label: "Prioritet #2", value: user.priorityTwo || "Bedste dækning", testid: "text-priority-2" },
                        { label: "Prioritet #3", value: user.priorityThree || "God kundeservice", testid: "text-priority-3" },
                      ].map((item) => (
                        <div key={item.label} className="flex w-full items-center gap-2 border-b border-solid border-neutral-border py-4 mobile:flex-col mobile:flex-nowrap mobile:items-start mobile:justify-start mobile:gap-1 mobile:px-0 mobile:py-3">
                          <span className="grow shrink-0 basis-0 text-body font-body text-subtext-color mobile:text-caption mobile:font-caption">
                            {item.label}
                          </span>
                          <span className="grow shrink-0 basis-0 text-body font-body text-default-font mobile:text-body-bold mobile:font-body-bold" data-testid={item.testid}>
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
                  <div className="flex w-full flex-col items-start gap-3 mobile:flex-col mobile:flex-nowrap mobile:gap-2">
                    <span className="text-body-bold font-body-bold text-default-font mobile:text-caption-bold mobile:font-caption-bold">
                      Yderligere krav
                    </span>
                    <div className="flex w-full flex-col items-start gap-2">
                      {user.additionalInfo ? (
                        <span className="text-body font-body text-default-font mobile:text-caption mobile:font-caption" data-testid="text-additional-info">
                          {user.additionalInfo}
                        </span>
                      ) : (
                        <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption">
                          Ingen yderligere krav angivet
                        </span>
                      )}
                    </div>
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
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
              />
              <TextField
                label="Relation (f.eks. Ægtefælle, Barn)"
                value={newMember.relationship}
                onChange={(e) => setNewMember({ ...newMember, relationship: e.target.value })}
              />
              <TextField
                label="Fødselsdato (DD/MM/ÅÅÅÅ)"
                value={newMember.dateOfBirth}
                onChange={(e) => setNewMember({ ...newMember, dateOfBirth: e.target.value })}
              />
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
              <span className="text-heading-3 font-heading-3 text-default-font">Rediger præferencer</span>
              <IconButton size="small" icon={<FeatherX />} onClick={() => setShowEditPrefsDialog(false)} />
            </div>
            
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium text-default-font mb-2 block">Forsikringstyper</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {prefs.insuranceTypes.map((type) => (
                    <Badge key={type} variant="brand">
                      {type}
                      <button onClick={() => handleRemoveInsuranceType(type)} className="ml-1">×</button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <TextField
                    placeholder="Tilføj type"
                    value={newInsuranceType}
                    onChange={(e) => setNewInsuranceType(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddInsuranceType()}
                  />
                  <Button onClick={handleAddInsuranceType} disabled={!newInsuranceType}>
                    Tilføj
                  </Button>
                </div>
              </div>

              <TextField
                label="Prioritet #1"
                value={prefs.priorityOne}
                onChange={(e) => setPrefs({ ...prefs, priorityOne: e.target.value })}
              />
              <TextField
                label="Prioritet #2"
                value={prefs.priorityTwo}
                onChange={(e) => setPrefs({ ...prefs, priorityTwo: e.target.value })}
              />
              <TextField
                label="Prioritet #3"
                value={prefs.priorityThree}
                onChange={(e) => setPrefs({ ...prefs, priorityThree: e.target.value })}
              />
              <TextField
                label="Yderligere krav"
                value={prefs.additionalInfo}
                onChange={(e) => setPrefs({ ...prefs, additionalInfo: e.target.value })}
              />
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
                onClick={() => updatePrefsMutation.mutate(prefs)}
                disabled={updatePrefsMutation.isPending}
              >
                {updatePrefsMutation.isPending ? "Gemmer..." : "Gem"}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog>
    </AppLayoutWithNav>
  );
}
