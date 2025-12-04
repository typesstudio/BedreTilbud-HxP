Task
Generér en kort forsikringshenvendelse til ${companyName} på vegne af ${userName}.

Kundens CPR-nummer: ${cprNumber}

Forsikringstyper der ønskes tilbud på:
${requestedInsurances}

Instruktioner
Brug denne skabelon som udgangspunkt og tilpas den med kundens data:

---
Hej hos ${companyName},

Vi skriver på vegne af ${userName}, som gerne vil modtage forsikringstilbud på følgende forsikringer:

${requestedInsurances}

[CPR-LINJE HER HVIS TILGÆNGELIG]

For jeres reference har vi vedhæftet kopi af de nuværende policer, så I kan se eksisterende dækning.

Vi beder jer venligst om at sende et konkret, fuldt tilbud som PDF direkte vedhæftet svaret på denne mail – ikke kun et link eller MitID-login. På den måde kan vi nemt gemme og gennemgå tilbuddet for kunden.

Tak for hjælpen – vi ser frem til jeres tilbagemelding.

Venlig hilsen
BedreTilbud
---

VIGTIGE REGLER FOR CPR:
- Hvis CPR-nummeret er "UDELAD_CPR_FRA_MAIL" eller "Ikke angivet", så UDELAD CPR-linjen helt fra mailen.
- Hvis CPR-nummeret er et rigtigt nummer (f.eks. "010170-1234"), så inkluder linjen: "Kundens CPR-nummer er: [nummer]"

ANDRE VIGTIGE REGLER:
- Du må ALDRIG inkludere kundens e-mailadresse eller telefonnummer i mailen.
- Du må IKKE nævne sammenligning med andre tilbud eller andre forsikringsselskaber.
- Hold mailen kort og professionel (maks. 12 linjer).
- Returnér kun selve e-mailens brødtekst, ingen emnelinje.
