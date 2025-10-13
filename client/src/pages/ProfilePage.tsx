import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { 
  Avatar, 
  Badge, 
  Button, 
  DropdownMenu, 
  IconButton, 
  IconWithBackground, 
  Tabs, 
  DefaultPageLayout,
  Dialog,
  TextField
} from "@/ui";
import { FeatherChevronDown, FeatherDownload, FeatherEdit, FeatherFileText, FeatherPlus, FeatherUpload, FeatherX } from "@subframe/core";
import * as SubframeCore from "@subframe/core";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [activeTab, setActiveTab] = useState("personal");
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
      return apiRequest("/api/household-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, userId }),
      });
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
      return apiRequest(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
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
    <DefaultPageLayout>
      <div className="flex h-full w-full flex-col items-start">
        <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border px-12 py-4">
          <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
            BedreTilbud.com
          </span>
          <div className="flex items-center gap-1">
            <Link href={`/offers/${userId}`}>
              <Button variant="neutral-tertiary" data-testid="link-dashboard">
                Dashboard
              </Button>
            </Link>
            <Link href={`/offers/${userId}`}>
              <Button variant="neutral-tertiary" data-testid="link-offers">
                Mine tilbud
              </Button>
            </Link>
            <SubframeCore.DropdownMenu.Root>
              <SubframeCore.DropdownMenu.Trigger asChild={true}>
                <Button
                  variant="neutral-tertiary"
                  iconRight={<FeatherChevronDown />}
                  data-testid="button-account-menu"
                >
                  Konto
                </Button>
              </SubframeCore.DropdownMenu.Trigger>
              <SubframeCore.DropdownMenu.Portal>
                <SubframeCore.DropdownMenu.Content
                  side="bottom"
                  align="end"
                  sideOffset={4}
                  asChild={true}
                >
                  <DropdownMenu>
                    <DropdownMenu.DropdownItem icon={null} data-testid="menu-profile">
                      Profil
                    </DropdownMenu.DropdownItem>
                    <DropdownMenu.DropdownItem icon={null} data-testid="menu-settings">
                      Indstillinger
                    </DropdownMenu.DropdownItem>
                    <DropdownMenu.DropdownItem icon={null} data-testid="menu-logout">
                      Log ud
                    </DropdownMenu.DropdownItem>
                  </DropdownMenu>
                </SubframeCore.DropdownMenu.Content>
              </SubframeCore.DropdownMenu.Portal>
            </SubframeCore.DropdownMenu.Root>
          </div>
        </div>
        <div className="flex w-full grow shrink-0 basis-0 flex-col items-center gap-8 bg-default-background px-12 py-12 overflow-auto">
          <div className="flex w-full max-w-[768px] flex-col items-start gap-8">
            <div className="flex w-full flex-col items-start gap-6">
              <div className="flex w-full items-center gap-4">
                <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                  <span className="text-heading-2 font-heading-2 text-default-font" data-testid="text-user-name">
                    {user.name || "Ikke oplyst"}
                  </span>
                  <span className="text-body font-body text-subtext-color" data-testid="text-user-email">
                    {user.email}
                  </span>
                </div>
              </div>
            </div>
            <Tabs>
              <Tabs.Item 
                active={activeTab === "personal"} 
                onClick={() => setActiveTab("personal")}
                data-testid="tab-personal-info"
              >
                Personlige oplysninger
              </Tabs.Item>
              <Tabs.Item 
                active={activeTab === "household"} 
                onClick={() => setActiveTab("household")}
                data-testid="tab-household"
              >
                Husstandsmedlemmer
              </Tabs.Item>
              <Tabs.Item 
                active={activeTab === "preferences"} 
                onClick={() => setActiveTab("preferences")}
                data-testid="tab-preferences"
              >
                Præferencer
              </Tabs.Item>
              <Tabs.Item 
                active={activeTab === "documents"} 
                onClick={() => setActiveTab("documents")}
                data-testid="tab-documents"
              >
                Forsikringsdokumenter
              </Tabs.Item>
            </Tabs>
            
            {activeTab === "personal" && (
              <div className="flex w-full flex-col items-start gap-12 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                <div className="flex w-full flex-col items-start gap-4">
                  <div className="flex w-full flex-wrap items-center gap-2">
                    <span className="grow shrink-0 basis-0 text-heading-3 font-heading-3 text-default-font">
                      Personlige oplysninger
                    </span>
                    <Button
                      className="mobile:h-8 mobile:grow mobile:shrink-0 mobile:basis-0"
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
                      <div key={item.label} className="flex w-full items-center gap-2 border-b border-solid border-neutral-border py-6">
                        <span className="grow shrink-0 basis-0 text-body font-body text-subtext-color">
                          {item.label}
                        </span>
                        <span className="grow shrink-0 basis-0 text-body font-body text-default-font" data-testid={item.testid}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "household" && (
              <div className="flex w-full flex-col items-start gap-12 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                <div className="flex w-full flex-col items-start gap-4">
                  <div className="flex w-full flex-wrap items-center gap-2">
                    <span className="grow shrink-0 basis-0 text-heading-3 font-heading-3 text-default-font">
                      Husstandsmedlemmer
                    </span>
                    <Button
                      className="mobile:h-8 mobile:grow mobile:shrink-0 mobile:basis-0"
                      variant="neutral-secondary"
                      icon={<FeatherPlus />}
                      onClick={() => setShowAddMemberDialog(true)}
                      data-testid="button-add-member"
                    >
                      Tilføj medlem
                    </Button>
                  </div>
                  {loadingMembers ? (
                    <div className="w-full text-center py-8 text-subtext-color">Indlæser...</div>
                  ) : householdMembers.length === 0 ? (
                    <div className="w-full text-center py-8 text-subtext-color">
                      Ingen husstandsmedlemmer tilføjet endnu
                    </div>
                  ) : (
                    <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-4 py-4">
                      {householdMembers.map((member: any, index: number) => (
                        <div key={member.id} className="w-full">
                          <div className="flex w-full items-center gap-4">
                            <Avatar image={member.avatarUrl || ""}>
                              {member.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                            </Avatar>
                            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                              <span className="text-body-bold font-body-bold text-default-font" data-testid={`text-member-name-${member.id}`}>
                                {member.name}
                              </span>
                              <span className="text-caption font-caption text-subtext-color" data-testid={`text-member-info-${member.id}`}>
                                {member.relationship ? `${member.relationship} • ` : ""}Født {member.dateOfBirth || "ukendt"}
                              </span>
                            </div>
                            <IconButton
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
              </div>
            )}

            {activeTab === "preferences" && (
              <div className="flex w-full flex-col items-start gap-12 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                <div className="flex w-full flex-col items-start gap-4">
                  <div className="flex w-full flex-wrap items-center gap-2">
                    <span className="grow shrink-0 basis-0 text-heading-3 font-heading-3 text-default-font">
                      Forsikringspræferencer
                    </span>
                    <Button
                      className="mobile:h-8 mobile:grow mobile:shrink-0 mobile:basis-0"
                      variant="neutral-secondary"
                      onClick={openEditPrefs}
                      data-testid="button-edit-preferences"
                    >
                      Rediger præferencer
                    </Button>
                  </div>
                  <div className="flex w-full flex-col items-start gap-6 rounded-md border border-solid border-neutral-border bg-neutral-50 px-6 py-6">
                    <div className="flex w-full flex-col items-start gap-3">
                      <span className="text-body-bold font-body-bold text-default-font">
                        Forsikringstyper jeg har brug for
                      </span>
                      <div className="flex w-full flex-wrap items-start gap-2">
                        {insuranceTypes.length > 0 ? (
                          insuranceTypes.map((type: string) => (
                            <Badge key={type} data-testid={`badge-insurance-${type}`}>{type}</Badge>
                          ))
                        ) : (
                          <span className="text-body text-subtext-color">Ingen forsikringstyper valgt</span>
                        )}
                      </div>
                    </div>
                    <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
                    <div className="flex w-full flex-col items-start gap-3">
                      <span className="text-body-bold font-body-bold text-default-font">
                        Hvad er vigtigst for mig
                      </span>
                      <div className="flex w-full flex-col items-start">
                        {[
                          { label: "Prioritet #1", value: user.priorityOne || "Ikke valgt", testid: "text-priority-1" },
                          { label: "Prioritet #2", value: user.priorityTwo || "Ikke valgt", testid: "text-priority-2" },
                          { label: "Prioritet #3", value: user.priorityThree || "Ikke valgt", testid: "text-priority-3" },
                        ].map((item) => (
                          <div key={item.label} className="flex w-full items-center gap-2 border-b border-solid border-neutral-border py-4">
                            <span className="grow shrink-0 basis-0 text-body font-body text-subtext-color">
                              {item.label}
                            </span>
                            <span className="grow shrink-0 basis-0 text-body font-body text-default-font" data-testid={item.testid}>
                              {item.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
                    <div className="flex w-full flex-col items-start gap-3">
                      <span className="text-body-bold font-body-bold text-default-font">
                        Yderligere krav
                      </span>
                      <div className="flex w-full flex-col items-start gap-2">
                        {user.additionalInfo ? (
                          <span className="text-body font-body text-default-font" data-testid="text-additional-info">
                            {user.additionalInfo}
                          </span>
                        ) : (
                          <span className="text-body text-subtext-color">Ingen yderligere krav</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "documents" && (
              <div className="flex w-full flex-col items-start gap-12 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6">
                <div className="flex w-full flex-col items-start gap-4">
                  <div className="flex w-full flex-wrap items-center gap-2">
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
                      className="mobile:h-8 mobile:grow mobile:shrink-0 mobile:basis-0"
                      variant="neutral-secondary"
                      icon={<FeatherUpload />}
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-upload-policy"
                      disabled={uploadDocumentMutation.isPending}
                    >
                      {uploadDocumentMutation.isPending ? "Uploader..." : "Upload police"}
                    </Button>
                  </div>
                  {loadingDocs ? (
                    <div className="w-full text-center py-8 text-subtext-color">Indlæser...</div>
                  ) : documents.length === 0 ? (
                    <div className="w-full text-center py-8 text-subtext-color">
                      Ingen dokumenter uploadet endnu
                    </div>
                  ) : (
                    <div className="flex w-full flex-col items-start">
                      {documents.map((doc: any) => (
                        <div key={doc.id} className="flex w-full items-center gap-4 border-b border-solid border-neutral-border py-6">
                          <IconWithBackground
                            size="large"
                            icon={<FeatherFileText />}
                          />
                          <div className="flex grow shrink-0 basis-0 flex-col items-start justify-center gap-1">
                            <span className="w-full text-body-bold font-body-bold text-default-font" data-testid={`text-doc-name-${doc.id}`}>
                              {doc.fileName}
                            </span>
                            <span className="w-full text-body font-body text-subtext-color" data-testid={`text-doc-info-${doc.id}`}>
                              Uploadet {doc.createdAt ? format(new Date(doc.createdAt), "d. MMMM yyyy", { locale: da }) : "ukendt"} • PDF • {doc.fileSize ? `${(doc.fileSize / 1024 / 1024).toFixed(1)} MB` : "ukendt størrelse"}
                            </span>
                          </div>
                          <Button
                            variant="neutral-secondary"
                            size="small"
                            data-testid={`button-view-doc-${doc.id}`}
                          >
                            Se
                          </Button>
                          <IconButton
                            size="small"
                            icon={<FeatherDownload />}
                            data-testid={`button-download-doc-${doc.id}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex w-full flex-col items-center justify-center gap-2">
              <span className="text-caption font-caption text-subtext-color">
                © Copyright 2025, BedreTilbud.com. Alle rettigheder forbeholdes.
              </span>
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
                data-testid="input-member-name"
              />
              <TextField
                label="Relation (f.eks. Ægtefælle, Barn)"
                value={newMember.relationship}
                onChange={(e) => setNewMember({ ...newMember, relationship: e.target.value })}
                data-testid="input-member-relationship"
              />
              <TextField
                label="Fødselsdato (DD/MM/ÅÅÅÅ)"
                value={newMember.dateOfBirth}
                onChange={(e) => setNewMember({ ...newMember, dateOfBirth: e.target.value })}
                data-testid="input-member-dob"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="neutral-secondary" onClick={() => setShowAddMemberDialog(false)}>
                Annuller
              </Button>
              <Button 
                onClick={() => addMemberMutation.mutate(newMember)}
                disabled={!newMember.name || addMemberMutation.isPending}
                data-testid="button-save-member"
              >
                {addMemberMutation.isPending ? "Gemmer..." : "Gem"}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog>

      {/* Edit Preferences Dialog */}
      <Dialog open={showEditPrefsDialog} onOpenChange={setShowEditPrefsDialog}>
        <Dialog.Content>
          <div className="flex flex-col gap-6 p-6 w-full max-w-2xl">
            <div className="flex items-center justify-between">
              <span className="text-heading-3 font-heading-3 text-default-font">Rediger præferencer</span>
              <IconButton size="small" icon={<FeatherX />} onClick={() => setShowEditPrefsDialog(false)} />
            </div>
            
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <span className="text-body-bold font-body-bold text-default-font">Forsikringstyper</span>
                <div className="flex gap-2">
                  <TextField
                    placeholder="Tilføj forsikringstype"
                    value={newInsuranceType}
                    onChange={(e) => setNewInsuranceType(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddInsuranceType()}
                  />
                  <Button onClick={handleAddInsuranceType} icon={<FeatherPlus />}>Tilføj</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {prefs.insuranceTypes.map((type) => (
                    <Badge key={type} variant="brand">
                      {type}
                      <button onClick={() => handleRemoveInsuranceType(type)} className="ml-2">×</button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <span className="text-body-bold font-body-bold text-default-font">Prioriteter</span>
                <TextField
                  label="Prioritet #1"
                  value={prefs.priorityOne}
                  onChange={(e) => setPrefs({ ...prefs, priorityOne: e.target.value })}
                  placeholder="F.eks. Laveste pris"
                />
                <TextField
                  label="Prioritet #2"
                  value={prefs.priorityTwo}
                  onChange={(e) => setPrefs({ ...prefs, priorityTwo: e.target.value })}
                  placeholder="F.eks. God kundeservice"
                />
                <TextField
                  label="Prioritet #3"
                  value={prefs.priorityThree}
                  onChange={(e) => setPrefs({ ...prefs, priorityThree: e.target.value })}
                  placeholder="F.eks. Omfattende dækning"
                />
              </div>

              <TextField
                label="Yderligere krav"
                value={prefs.additionalInfo}
                onChange={(e) => setPrefs({ ...prefs, additionalInfo: e.target.value })}
                placeholder="Beskriv eventuelle særlige krav eller præferencer"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="neutral-secondary" onClick={() => setShowEditPrefsDialog(false)}>
                Annuller
              </Button>
              <Button 
                onClick={() => updatePrefsMutation.mutate(prefs)}
                disabled={updatePrefsMutation.isPending}
                data-testid="button-save-prefs"
              >
                {updatePrefsMutation.isPending ? "Gemmer..." : "Gem"}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog>
    </DefaultPageLayout>
  );
}
