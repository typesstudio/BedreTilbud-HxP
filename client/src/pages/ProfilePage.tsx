import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { IconButton } from "@/ui/components/IconButton";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { Tabs } from "@/ui/components/Tabs";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { FeatherChevronDown, FeatherDownload, FeatherEdit, FeatherFileText, FeatherPlus, FeatherUpload } from "@subframe/core";
import * as SubframeCore from "@subframe/core";
import { Link } from "wouter";
import { format } from "date-fns";

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [activeTab, setActiveTab] = useState("personal");

  const { data: user, isLoading: loadingUser } = useQuery({
    queryKey: ["/api/users", userId],
    enabled: !!userId,
  });

  const { data: documents = [], isLoading: loadingDocs } = useQuery({
    queryKey: ["/api/documents", userId],
    enabled: !!userId,
  });

  const { data: householdMembers = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["/api/household-members", userId],
    enabled: !!userId,
  });

  if (loadingUser) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <div className="flex h-screen items-center justify-center">User not found</div>;
  }

  const insuranceTypes = user.insuranceTypes || [];

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
                    <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border py-6">
                      <span className="grow shrink-0 basis-0 text-body font-body text-subtext-color">
                        Fulde navn
                      </span>
                      <span className="grow shrink-0 basis-0 text-body font-body text-default-font" data-testid="text-full-name">
                        {user.name || "Ikke oplyst"}
                      </span>
                    </div>
                    <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border py-6">
                      <span className="grow shrink-0 basis-0 text-body font-body text-subtext-color">
                        Email
                      </span>
                      <span className="grow shrink-0 basis-0 text-body font-body text-default-font" data-testid="text-email">
                        {user.email}
                      </span>
                    </div>
                    <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border py-6">
                      <span className="grow shrink-0 basis-0 text-body font-body text-subtext-color">
                        Telefonnummer
                      </span>
                      <span className="grow shrink-0 basis-0 text-body font-body text-default-font" data-testid="text-phone">
                        {user.phone || "Ikke oplyst"}
                      </span>
                    </div>
                    <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border py-6">
                      <span className="grow shrink-0 basis-0 text-body font-body text-subtext-color">
                        Fødselsdato
                      </span>
                      <span className="grow shrink-0 basis-0 text-body font-body text-default-font" data-testid="text-dob">
                        {user.dateOfBirth || "Ikke oplyst"}
                      </span>
                    </div>
                    <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border py-6">
                      <span className="grow shrink-0 basis-0 text-body font-body text-subtext-color">
                        Adresse
                      </span>
                      <span className="grow shrink-0 basis-0 text-body font-body text-default-font" data-testid="text-address">
                        {user.address || "Ikke oplyst"}
                      </span>
                    </div>
                    <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border py-6">
                      <span className="grow shrink-0 basis-0 text-body font-body text-subtext-color">
                        CPR-nummer
                      </span>
                      <span className="grow shrink-0 basis-0 text-body font-body text-default-font" data-testid="text-cpr">
                        {user.personalIdNumber ? "************" : "Ikke oplyst"}
                      </span>
                    </div>
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
                      className="mobile:h-8 mobile:shrink-0 mobile:basis-0"
                      variant="neutral-secondary"
                      icon={<FeatherPlus />}
                      data-testid="button-add-member"
                    >
                      Tilføj medlem
                    </Button>
                  </div>
                  {loadingMembers ? (
                    <div>Indlæser...</div>
                  ) : householdMembers.length === 0 ? (
                    <div className="w-full text-center py-8 text-subtext-color">
                      Ingen husstandsmedlemmer tilføjet endnu
                    </div>
                  ) : (
                    <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-default-background px-4 py-4">
                      {householdMembers.map((member: any, index: number) => (
                        <div key={member.id}>
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
                        <Badge variant="neutral" icon={<FeatherPlus />} data-testid="badge-add-insurance">
                          Tilføj forsikringstype
                        </Badge>
                      </div>
                    </div>
                    <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
                    <div className="flex w-full flex-col items-start gap-3">
                      <span className="text-body-bold font-body-bold text-default-font">
                        Hvad er vigtigst for mig
                      </span>
                      <div className="flex w-full flex-col items-start">
                        <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border py-4">
                          <span className="grow shrink-0 basis-0 text-body font-body text-subtext-color">
                            Prioritet #1
                          </span>
                          <span className="grow shrink-0 basis-0 text-body font-body text-default-font" data-testid="text-priority-1">
                            {user.priorityOne || "Ikke valgt"}
                          </span>
                        </div>
                        <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border py-4">
                          <span className="grow shrink-0 basis-0 text-body font-body text-subtext-color">
                            Prioritet #2
                          </span>
                          <span className="grow shrink-0 basis-0 text-body font-body text-default-font" data-testid="text-priority-2">
                            {user.priorityTwo || "Ikke valgt"}
                          </span>
                        </div>
                        <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border py-4">
                          <span className="grow shrink-0 basis-0 text-body font-body text-subtext-color">
                            Prioritet #3
                          </span>
                          <span className="grow shrink-0 basis-0 text-body font-body text-default-font" data-testid="text-priority-3">
                            {user.priorityThree || "Ikke valgt"}
                          </span>
                        </div>
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
                    <Link href={`/onboarding/${userId}`}>
                      <Button
                        className="mobile:h-8 mobile:grow mobile:shrink-0 mobile:basis-0"
                        variant="neutral-secondary"
                        icon={<FeatherUpload />}
                        data-testid="button-upload-policy"
                      >
                        Upload police
                      </Button>
                    </Link>
                  </div>
                  {loadingDocs ? (
                    <div>Indlæser...</div>
                  ) : documents.length === 0 ? (
                    <div className="w-full text-center py-8 text-subtext-color">
                      Ingen dokumenter uploadet endnu
                    </div>
                  ) : (
                    <div className="flex w-full flex-col items-start">
                      {documents.map((doc: any, index: number) => (
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
                              Uploadet {doc.createdAt ? format(new Date(doc.createdAt), "d. MMMM yyyy", { locale: require('date-fns/locale/da') }) : "ukendt"} • PDF • {doc.fileSize ? `${(doc.fileSize / 1024 / 1024).toFixed(1)} MB` : "ukendt størrelse"}
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
    </DefaultPageLayout>
  );
}
