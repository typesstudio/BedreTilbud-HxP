import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Download, Edit, Plus, Upload, ChevronDown, User } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();

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
    return <div className="flex h-screen items-center justify-center">Indlæser...</div>;
  }

  if (!user) {
    return <div className="flex h-screen items-center justify-center">Bruger ikke fundet</div>;
  }

  const insuranceTypes = user.insuranceTypes || [];

  return (
    <div className="flex h-screen w-full flex-col bg-neutral-50">
      {/* Header */}
      <div className="flex w-full items-center justify-between border-b border-solid border-neutral-200 bg-white px-8 py-4">
        <span className="text-xl font-bold text-neutral-900">BedreTilbud.com</span>
        <div className="flex items-center gap-2">
          <Link href={`/offers/${userId}`}>
            <Button variant="ghost" data-testid="link-dashboard">Dashboard</Button>
          </Link>
          <Link href={`/offers/${userId}`}>
            <Button variant="ghost" data-testid="link-offers">Mine tilbud</Button>
          </Link>
          <Button variant="ghost" data-testid="button-account-menu">
            Konto <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto px-8 py-12">
        <div className="mx-auto max-w-4xl space-y-8">
          {/* Profile Header */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src="" />
              <AvatarFallback className="bg-primary text-2xl text-primary-foreground">
                {user.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-neutral-900" data-testid="text-user-name">
                {user.name || "Ikke oplyst"}
              </h1>
              <p className="text-lg text-neutral-600" data-testid="text-user-email">{user.email}</p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="personal" data-testid="tab-personal-info">
                Personlige oplysninger
              </TabsTrigger>
              <TabsTrigger value="household" data-testid="tab-household">
                Husstandsmedlemmer
              </TabsTrigger>
              <TabsTrigger value="preferences" data-testid="tab-preferences">
                Præferencer
              </TabsTrigger>
              <TabsTrigger value="documents" data-testid="tab-documents">
                Forsikringsdokumenter
              </TabsTrigger>
            </TabsList>

            {/* Personal Info Tab */}
            <TabsContent value="personal">
              <Card className="p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-2xl font-semibold">Personlige oplysninger</h2>
                  <Button variant="outline" data-testid="button-edit-info">
                    <Edit className="mr-2 h-4 w-4" /> Rediger oplysninger
                  </Button>
                </div>

                <div className="space-y-4">
                  {[
                    { label: "Fulde navn", value: user.name || "Ikke oplyst", testid: "text-full-name" },
                    { label: "Email", value: user.email, testid: "text-email" },
                    { label: "Telefonnummer", value: user.phone || "Ikke oplyst", testid: "text-phone" },
                    { label: "Fødselsdato", value: user.dateOfBirth || "Ikke oplyst", testid: "text-dob" },
                    { label: "Adresse", value: user.address || "Ikke oplyst", testid: "text-address" },
                    { label: "CPR-nummer", value: user.personalIdNumber ? "************" : "Ikke oplyst", testid: "text-cpr" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center border-b border-neutral-200 py-4">
                      <span className="flex-1 text-neutral-600">{item.label}</span>
                      <span className="flex-1 font-medium text-neutral-900" data-testid={item.testid}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            {/* Household Members Tab */}
            <TabsContent value="household">
              <Card className="p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-2xl font-semibold">Husstandsmedlemmer</h2>
                  <Button variant="outline" data-testid="button-add-member">
                    <Plus className="mr-2 h-4 w-4" /> Tilføj medlem
                  </Button>
                </div>

                {loadingMembers ? (
                  <div className="py-8 text-center text-neutral-600">Indlæser...</div>
                ) : householdMembers.length === 0 ? (
                  <div className="py-8 text-center text-neutral-600">
                    Ingen husstandsmedlemmer tilføjet endnu
                  </div>
                ) : (
                  <div className="space-y-4">
                    {householdMembers.map((member: any) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-4 rounded-lg border border-neutral-200 p-4"
                      >
                        <Avatar>
                          <AvatarImage src={member.avatarUrl || ""} />
                          <AvatarFallback>
                            {member.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-semibold text-neutral-900" data-testid={`text-member-name-${member.id}`}>
                            {member.name}
                          </p>
                          <p className="text-sm text-neutral-600" data-testid={`text-member-info-${member.id}`}>
                            {member.relationship ? `${member.relationship} • ` : ""}Født {member.dateOfBirth || "ukendt"}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" data-testid={`button-edit-member-${member.id}`}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Preferences Tab */}
            <TabsContent value="preferences">
              <Card className="p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-2xl font-semibold">Forsikringspræferencer</h2>
                  <Button variant="outline" data-testid="button-edit-preferences">
                    <Edit className="mr-2 h-4 w-4" /> Rediger præferencer
                  </Button>
                </div>

                <div className="space-y-6">
                  {/* Insurance Types */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-neutral-900">Forsikringstyper jeg har brug for</h3>
                    <div className="flex flex-wrap gap-2">
                      {insuranceTypes.length > 0 ? (
                        insuranceTypes.map((type: string) => (
                          <Badge key={type} variant="secondary" data-testid={`badge-insurance-${type}`}>
                            {type}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-neutral-600">Ingen forsikringstyper valgt</span>
                      )}
                      <Badge variant="outline" className="cursor-pointer" data-testid="badge-add-insurance">
                        <Plus className="mr-1 h-3 w-3" /> Tilføj forsikringstype
                      </Badge>
                    </div>
                  </div>

                  {/* Priorities */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-neutral-900">Hvad er vigtigst for mig</h3>
                    <div className="space-y-2">
                      {[
                        { label: "Prioritet #1", value: user.priorityOne || "Ikke valgt", testid: "text-priority-1" },
                        { label: "Prioritet #2", value: user.priorityTwo || "Ikke valgt", testid: "text-priority-2" },
                        { label: "Prioritet #3", value: user.priorityThree || "Ikke valgt", testid: "text-priority-3" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center border-b border-neutral-200 py-3">
                          <span className="flex-1 text-neutral-600">{item.label}</span>
                          <span className="flex-1 font-medium text-neutral-900" data-testid={item.testid}>
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Additional Requirements */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-neutral-900">Yderligere krav</h3>
                    {user.additionalInfo ? (
                      <p className="text-neutral-900" data-testid="text-additional-info">
                        {user.additionalInfo}
                      </p>
                    ) : (
                      <p className="text-neutral-600">Ingen yderligere krav</p>
                    )}
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents">
              <Card className="p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-2xl font-semibold">Uploadede forsikringsdokumenter</h2>
                  <Link href={`/onboarding/${userId}`}>
                    <Button variant="outline" data-testid="button-upload-policy">
                      <Upload className="mr-2 h-4 w-4" /> Upload police
                    </Button>
                  </Link>
                </div>

                {loadingDocs ? (
                  <div className="py-8 text-center text-neutral-600">Indlæser...</div>
                ) : documents.length === 0 ? (
                  <div className="py-8 text-center text-neutral-600">
                    Ingen dokumenter uploadet endnu
                  </div>
                ) : (
                  <div className="space-y-4">
                    {documents.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-4 rounded-lg border border-neutral-200 p-4"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                          <FileText className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-neutral-900" data-testid={`text-doc-name-${doc.id}`}>
                            {doc.fileName}
                          </p>
                          <p className="text-sm text-neutral-600" data-testid={`text-doc-info-${doc.id}`}>
                            Uploadet {doc.createdAt ? format(new Date(doc.createdAt), "d. MMMM yyyy", { locale: da }) : "ukendt"} • PDF • {doc.fileSize ? `${(doc.fileSize / 1024 / 1024).toFixed(1)} MB` : "ukendt størrelse"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" data-testid={`button-view-doc-${doc.id}`}>
                            Se
                          </Button>
                          <Button variant="ghost" size="sm" data-testid={`button-download-doc-${doc.id}`}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="py-4 text-center text-sm text-neutral-600">
            © Copyright 2025, BedreTilbud.com. Alle rettigheder forbeholdes.
          </div>
        </div>
      </div>
    </div>
  );
}
