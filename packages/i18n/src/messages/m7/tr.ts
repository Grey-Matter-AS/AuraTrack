import type { Language } from '../../index';
import type { m7en } from './en';

// The messages of the hub screens (M7) in the other eight languages. Drafted by Claude; not yet checked by a native speaker.
// A key that is missing in a language shows English (see ../index.ts), so no screen is ever blank.
type Tr = Partial<Record<keyof typeof m7en, string>>;

const nb: Tr = {
  'hub.title': 'Hub',
  'hub.none':
    'En hub er et program på en husstandsdatamaskin (eller en Raspberry Pi eller NAS) som alltid er på. Med en hub oppdateres telefoner mens appene deres er lukket, og husstanden får daglig sikkerhetskopi. Den holder bare forseglede data som den ikke kan lese.',
  'hub.noneLimit': 'Uten hub fungerer alt som før: enhetene oppdaterer hverandre når to av dem er åpne samtidig.',
  'hub.connect': 'Koble til en hub',
  'hub.address': 'Adresse til huben',
  'hub.addressHelp': 'Den begynner med https:// og står på hubens statusside.',
  'hub.code': 'Kode fra huben',
  'hub.codeHelp': 'Hubens statusside viser den. Den brukes bare til oppsettet.',
  'hub.go': 'Koble til',
  'hub.connected': 'Koblet til {address}',
  'hub.state.idle': 'Oppdatert med huben',
  'hub.state.syncing': 'Oppdaterer med huben …',
  'hub.state.unreachable':
    'Huben svarte ikke. Opptak og lagring påvirkes ikke, og enhetene oppdaterer fortsatt hverandre.',
  'hub.state.not_allowed':
    'Huben slipper ikke inn denne enheten. Den kan ha blitt fjernet fra husstanden, eller huben er satt opp på nytt.',
  'hub.state.off': 'Ingen hub',
  'hub.last': 'Sist oppdatert {when}',
  'hub.never': 'Ikke oppdatert ennå',
  'hub.syncNow': 'Oppdater med huben nå',
  'hub.off': 'Slå av huben',
  'hub.offTitle': 'Slå av huben?',
  'hub.offText':
    'Enhetene går tilbake til å oppdatere hverandre når to av dem er åpne samtidig. Huben beholder det den har til du sletter det der.',
  'hub.offConfirm': 'Slå av',
  'hub.err.unreachable': 'Ingenting svarte på den adressen. Sjekk adressen, og at huben kjører og kan nås herfra.',
  'hub.err.wrong_code': 'Den koden er ikke hubens. Den står på hubens statusside.',
  'hub.err.not_a_hub': 'Adressen svarte, men det er ikke en AuraTrack Hub.',
  'hub.err.not_allowed': 'Huben godtok ikke denne enheten.',
  'hub.err.no_household': 'Start en husstand først.',
  'hub.err.insecure': 'Adressen må begynne med https://. Appen snakker bare med https-adresser.',
  'hub.openFromHub':
    'Hvis denne appen er åpen på en annen adresse enn hubens (for eksempel den på Vercel), blokkerer nettleseren huben med vilje. Åpne i stedet appen fra hubens egen adresse: {address}',
  'hub.unreadable':
    'Endringer hos huben som denne enheten ikke kan åpne ennå: {count}. De åpnes så snart enheten møter en annen enhet i husstanden, som bringer de nye nøklene.',
  'hub.row': 'Hub',
  'hub.note': 'Endringer fra huben: {count}',
  'hub.sealed':
    'Huben holder bare forseglede data. Den har ingen nøkkel, så den kan ikke lese et navn, et notat eller et tidspunkt i en registrering.',
  'push.title': 'Varsler på denne enheten',
  'push.help':
    'Få et varsel når en annen enhet i husstanden starter opptak, passerer varseltiden eller har registrert et anfall, også når appen er lukket. Varselet sier bare «AuraTrack» og ber deg åpne appen: ingenting om helse vises på låseskjermen.',
  'push.on': 'Varsler på denne enheten',
  'push.events': 'Si fra når',
  'push.event.started': 'et opptak starter',
  'push.event.alert': 'et anfall passerer varseltiden',
  'push.event.recorded': 'et anfall er registrert',
  'push.people': 'For disse personene',
  'push.everyone': 'Alle',
  'push.requirements':
    'iPhone og iPad: varsler virker bare etter at AuraTrack er lagt til på Hjem-skjermen, med iOS 16.4 eller nyere. Produsenten av telefonens pushtjeneste frakter meldingen: den ser at en melding gikk til denne enheten, ikke hva den sier.',
  'push.state.needs_home_screen': 'Legg først AuraTrack til på Hjem-skjermen (Del, deretter Legg til på Hjem-skjerm).',
  'push.state.unsupported': 'Denne nettleseren kan ikke vise varsler.',
  'push.state.blocked': 'Varsler er blokkert for dette nettstedet i nettleserens innstillinger.',
  'push.err.denied': 'Varsler ble ikke tillatt, så varsler er av.',
  'push.err.failed': 'Varsler kunne ikke slås på. Sjekk at huben kan nås, og prøv igjen.',
  'push.limit':
    'Varsler trenger huben og tillatelse fra denne enheten. De gjøres etter beste evne: de kan komme sent eller utebli hvis telefonen er av, sparer strøm eller er uten nett. De erstatter aldri å følge med på personen eller følge nødplanen.',
  'push.locked': 'Et opptak startet fra PIN-skjermen sender varselet når appen er låst opp.',
  'push.notificationTitle': 'AuraTrack',
  'push.notificationBody': 'Åpne AuraTrack',
};

const nn: Tr = {
  'hub.title': 'Hub',
  'hub.none':
    'Ein hub er eit program på ei husstandsdatamaskin (eller ein Raspberry Pi eller NAS) som alltid er på. Med ein hub blir telefonar oppdaterte medan appane deira er att, og husstanden får dagleg tryggingskopi. Han held berre forsegla data som han ikkje kan lese.',
  'hub.noneLimit': 'Utan hub fungerer alt som før: einingane oppdaterer kvarandre når to av dei er opne samstundes.',
  'hub.connect': 'Koble til ein hub',
  'hub.address': 'Adresse til huben',
  'hub.addressHelp': 'Ho byrjar med https:// og står på statussida til huben.',
  'hub.code': 'Kode frå huben',
  'hub.codeHelp': 'Statussida til huben viser henne. Ho blir berre brukt til oppsettet.',
  'hub.go': 'Koble til',
  'hub.connected': 'Kopla til {address}',
  'hub.state.idle': 'Oppdatert med huben',
  'hub.state.syncing': 'Oppdaterer med huben …',
  'hub.state.unreachable':
    'Huben svarte ikkje. Opptak og lagring blir ikkje påverka, og einingane oppdaterer framleis kvarandre.',
  'hub.state.not_allowed':
    'Huben slepper ikkje inn denne eininga. Ho kan ha blitt fjerna frå husstanden, eller huben er sett opp på nytt.',
  'hub.state.off': 'Ingen hub',
  'hub.last': 'Sist oppdatert {when}',
  'hub.never': 'Ikkje oppdatert enno',
  'hub.syncNow': 'Oppdater med huben no',
  'hub.off': 'Slå av huben',
  'hub.offTitle': 'Slå av huben?',
  'hub.offText':
    'Einingane går tilbake til å oppdatere kvarandre når to av dei er opne samstundes. Huben beheld det han har til du slettar det der.',
  'hub.offConfirm': 'Slå av',
  'hub.err.unreachable': 'Ingenting svarte på den adressa. Sjekk adressa, og at huben køyrer og kan nåast herifrå.',
  'hub.err.wrong_code': 'Den koden er ikkje til huben. Han står på statussida til huben.',
  'hub.err.not_a_hub': 'Adressa svarte, men det er ikkje ein AuraTrack Hub.',
  'hub.err.not_allowed': 'Huben godtok ikkje denne eininga.',
  'hub.err.no_household': 'Start ei husstand først.',
  'hub.err.insecure': 'Adressa må byrje med https://. Appen snakkar berre med https-adresser.',
  'hub.openFromHub':
    'Viss denne appen er open på ei anna adresse enn huben (til dømes den på Vercel), blokkerer nettlesaren huben med vilje. Opne i staden appen frå huben si eiga adresse: {address}',
  'hub.unreadable':
    'Endringar hos huben som denne eininga ikkje kan opne enno: {count}. Dei blir opna så snart eininga møter ei anna eining i husstanden, som tek med dei nye nøklane.',
  'hub.row': 'Hub',
  'hub.note': 'Endringar frå huben: {count}',
  'hub.sealed':
    'Huben held berre forsegla data. Han har ingen nøkkel, så han kan ikkje lese eit namn, eit notat eller eit tidspunkt i ei registrering.',
  'push.title': 'Varsel på denne eininga',
  'push.help':
    'Få eit varsel når ei anna eining i husstanden startar opptak, passerer varseltida eller har registrert eit anfall, også når appen er att. Varselet seier berre «AuraTrack» og ber deg opne appen: ingenting om helse blir vist på låseskjermen.',
  'push.on': 'Varsel på denne eininga',
  'push.events': 'Seg frå når',
  'push.event.started': 'eit opptak startar',
  'push.event.alert': 'eit anfall passerer varseltida',
  'push.event.recorded': 'eit anfall er registrert',
  'push.people': 'For desse personane',
  'push.everyone': 'Alle',
  'push.requirements':
    'iPhone og iPad: varsel verkar berre etter at AuraTrack er lagt til på Heim-skjermen, med iOS 16.4 eller nyare. Produsenten av push-tenesta til telefonen fraktar meldinga: han ser at ei melding gjekk til denne eininga, ikkje kva ho seier.',
  'push.state.needs_home_screen': 'Legg først AuraTrack til på Heim-skjermen (Del, deretter Legg til på Heim-skjerm).',
  'push.state.unsupported': 'Denne nettlesaren kan ikkje vise varsel.',
  'push.state.blocked': 'Varsel er blokkerte for dette nettstaden i innstillingane til nettlesaren.',
  'push.err.denied': 'Varsel vart ikkje tillatne, så varsel er av.',
  'push.err.failed': 'Varsel kunne ikkje slåast på. Sjekk at huben kan nåast, og prøv igjen.',
  'push.limit':
    'Varsel treng huben og løyve frå denne eininga. Dei blir gjorde etter beste evne: dei kan koma seint eller utebli viss telefonen er av, sparar straum eller er utan nett. Dei erstattar aldri å følgje med på personen eller følgje nødplanen.',
  'push.locked': 'Eit opptak starta frå PIN-skjermen sender varselet når appen er låst opp.',
  'push.notificationTitle': 'AuraTrack',
  'push.notificationBody': 'Opne AuraTrack',
};

const da: Tr = {
  'hub.title': 'Hub',
  'hub.none':
    'En hub er et program på en husstandscomputer (eller en Raspberry Pi eller NAS), der altid er tændt. Med en hub opdateres telefoner, mens deres apps er lukkede, og husstanden får en daglig sikkerhedskopi. Den rummer kun forseglede data, som den ikke kan læse.',
  'hub.noneLimit': 'Uden en hub virker alt som før: enhederne opdaterer hinanden, når to af dem er åbne på samme tid.',
  'hub.connect': 'Tilslut en hub',
  'hub.address': 'Hubbens adresse',
  'hub.addressHelp': 'Den begynder med https:// og står på hubbens statusside.',
  'hub.code': 'Kode fra hubben',
  'hub.codeHelp': 'Hubbens statusside viser den. Den bruges kun til opsætningen.',
  'hub.go': 'Tilslut',
  'hub.connected': 'Tilsluttet {address}',
  'hub.state.idle': 'Opdateret med hubben',
  'hub.state.syncing': 'Opdaterer med hubben …',
  'hub.state.unreachable':
    'Hubben svarede ikke. Optagelse og lagring påvirkes ikke, og enhederne opdaterer stadig hinanden.',
  'hub.state.not_allowed':
    'Hubben lukker ikke denne enhed ind. Den kan være fjernet fra husstanden, eller hubben er sat op igen.',
  'hub.state.off': 'Ingen hub',
  'hub.last': 'Sidst opdateret {when}',
  'hub.never': 'Ikke opdateret endnu',
  'hub.syncNow': 'Opdater med hubben nu',
  'hub.off': 'Sluk for hubben',
  'hub.offTitle': 'Slukke for hubben?',
  'hub.offText':
    'Enhederne går tilbage til at opdatere hinanden, når to af dem er åbne på samme tid. Hubben beholder det, den har, til du sletter det dér.',
  'hub.offConfirm': 'Sluk',
  'hub.err.unreachable': 'Intet svarede på den adresse. Tjek adressen, og at hubben kører og kan nås herfra.',
  'hub.err.wrong_code': 'Den kode er ikke hubbens. Den står på hubbens statusside.',
  'hub.err.not_a_hub': 'Adressen svarede, men det er ikke en AuraTrack Hub.',
  'hub.err.not_allowed': 'Hubben accepterede ikke denne enhed.',
  'hub.err.no_household': 'Start først en husstand.',
  'hub.err.insecure': 'Adressen skal begynde med https://. Appen taler kun med https-adresser.',
  'hub.openFromHub':
    'Hvis denne app er åben på en anden adresse end hubbens (for eksempel den på Vercel), blokerer browseren hubben med vilje. Åbn i stedet appen fra hubbens egen adresse: {address}',
  'hub.unreadable':
    'Ændringer hos hubben, som denne enhed endnu ikke kan åbne: {count}. De åbnes, så snart enheden møder en anden enhed i husstanden, som bringer de nye nøgler.',
  'hub.row': 'Hub',
  'hub.note': 'Ændringer fra hubben: {count}',
  'hub.sealed':
    'Hubben rummer kun forseglede data. Den har ingen nøgle, så den kan ikke læse et navn, en note eller et tidspunkt i en registrering.',
  'push.title': 'Underretninger på denne enhed',
  'push.help':
    'Få en underretning, når en anden enhed i husstanden starter optagelse, passerer alarmtiden eller har registreret et anfald, også når appen er lukket. Underretningen siger kun “AuraTrack” og beder dig åbne appen: intet om helbred vises på låseskærmen.',
  'push.on': 'Underretninger på denne enhed',
  'push.events': 'Giv besked når',
  'push.event.started': 'en optagelse starter',
  'push.event.alert': 'et anfald passerer alarmtiden',
  'push.event.recorded': 'et anfald er registreret',
  'push.people': 'For disse personer',
  'push.everyone': 'Alle',
  'push.requirements':
    'iPhone og iPad: underretninger virker kun, når AuraTrack er lagt på hjemmeskærmen, med iOS 16.4 eller nyere. Producenten af telefonens push-tjeneste fragter beskeden: den ser, at en besked gik til denne enhed, ikke hvad den siger.',
  'push.state.needs_home_screen': 'Læg først AuraTrack på hjemmeskærmen (Del, derefter Føj til hjemmeskærm).',
  'push.state.unsupported': 'Denne browser kan ikke vise underretninger.',
  'push.state.blocked': 'Underretninger er blokeret for dette websted i browserens indstillinger.',
  'push.err.denied': 'Underretninger blev ikke tilladt, så de er slået fra.',
  'push.err.failed': 'Underretninger kunne ikke slås til. Tjek, at hubben kan nås, og prøv igen.',
  'push.limit':
    'Underretninger kræver hubben og denne enheds tilladelse. De sker efter bedste evne: de kan komme sent eller udeblive, hvis telefonen er slukket, sparer strøm eller er offline. De erstatter aldrig at holde øje med personen eller følge nødplanen.',
  'push.locked': 'En optagelse startet fra PIN-skærmen sender sin underretning, når appen er låst op.',
  'push.notificationTitle': 'AuraTrack',
  'push.notificationBody': 'Åbn AuraTrack',
};

const sv: Tr = {
  'hub.title': 'Hubb',
  'hub.none':
    'En hubb är ett program på en hushållsdator (eller en Raspberry Pi eller NAS) som alltid är på. Med en hubb uppdateras telefoner medan deras appar är stängda, och hushållet får en daglig säkerhetskopia. Den håller bara förseglade data som den inte kan läsa.',
  'hub.noneLimit':
    'Utan hubb fungerar allt som förut: enheterna uppdaterar varandra när två av dem är öppna samtidigt.',
  'hub.connect': 'Anslut en hubb',
  'hub.address': 'Hubbens adress',
  'hub.addressHelp': 'Den börjar med https:// och står på hubbens statussida.',
  'hub.code': 'Kod från hubben',
  'hub.codeHelp': 'Hubbens statussida visar den. Den används bara vid uppsättningen.',
  'hub.go': 'Anslut',
  'hub.connected': 'Ansluten till {address}',
  'hub.state.idle': 'Uppdaterad med hubben',
  'hub.state.syncing': 'Uppdaterar med hubben …',
  'hub.state.unreachable':
    'Hubben svarade inte. Inspelning och sparande påverkas inte, och enheterna uppdaterar fortfarande varandra.',
  'hub.state.not_allowed':
    'Hubben släpper inte in den här enheten. Den kan ha tagits bort från hushållet, eller så har hubben ställts in på nytt.',
  'hub.state.off': 'Ingen hubb',
  'hub.last': 'Senast uppdaterad {when}',
  'hub.never': 'Inte uppdaterad ännu',
  'hub.syncNow': 'Uppdatera med hubben nu',
  'hub.off': 'Stäng av hubben',
  'hub.offTitle': 'Stänga av hubben?',
  'hub.offText':
    'Enheterna går tillbaka till att uppdatera varandra när två av dem är öppna samtidigt. Hubben behåller det den har tills du tar bort det där.',
  'hub.offConfirm': 'Stäng av',
  'hub.err.unreachable':
    'Inget svarade på den adressen. Kontrollera adressen, och att hubben körs och kan nås härifrån.',
  'hub.err.wrong_code': 'Den koden är inte hubbens. Den står på hubbens statussida.',
  'hub.err.not_a_hub': 'Adressen svarade, men det är ingen AuraTrack Hub.',
  'hub.err.not_allowed': 'Hubben godtog inte den här enheten.',
  'hub.err.no_household': 'Starta ett hushåll först.',
  'hub.err.insecure': 'Adressen måste börja med https://. Appen pratar bara med https-adresser.',
  'hub.openFromHub':
    'Om den här appen är öppen på en annan adress än hubbens (till exempel den på Vercel) blockerar webbläsaren hubben med avsikt. Öppna i stället appen från hubbens egen adress: {address}',
  'hub.unreadable':
    'Ändringar hos hubben som den här enheten ännu inte kan öppna: {count}. De öppnas så snart enheten träffar en annan enhet i hushållet, som tar med de nya nycklarna.',
  'hub.row': 'Hubb',
  'hub.note': 'Ändringar från hubben: {count}',
  'hub.sealed':
    'Hubben håller bara förseglade data. Den har ingen nyckel, så den kan inte läsa ett namn, en anteckning eller en tid i en registrering.',
  'push.title': 'Aviseringar på den här enheten',
  'push.help':
    'Få en avisering när en annan enhet i hushållet startar inspelning, passerar larmtiden eller har registrerat ett anfall, även när appen är stängd. Aviseringen säger bara ”AuraTrack” och ber dig öppna appen: inget om hälsa visas på låsskärmen.',
  'push.on': 'Aviseringar på den här enheten',
  'push.events': 'Säg till när',
  'push.event.started': 'en inspelning startar',
  'push.event.alert': 'ett anfall passerar larmtiden',
  'push.event.recorded': 'ett anfall har registrerats',
  'push.people': 'För dessa personer',
  'push.everyone': 'Alla',
  'push.requirements':
    'iPhone och iPad: aviseringar fungerar bara efter att AuraTrack lagts till på hemskärmen, med iOS 16.4 eller senare. Tillverkaren av telefonens pushtjänst fraktar meddelandet: den ser att ett meddelande gick till den här enheten, inte vad det säger.',
  'push.state.needs_home_screen': 'Lägg först till AuraTrack på hemskärmen (Dela, sedan Lägg till på hemskärmen).',
  'push.state.unsupported': 'Den här webbläsaren kan inte visa aviseringar.',
  'push.state.blocked': 'Aviseringar är blockerade för den här webbplatsen i webbläsarens inställningar.',
  'push.err.denied': 'Aviseringar tilläts inte, så de är avstängda.',
  'push.err.failed': 'Aviseringar kunde inte slås på. Kontrollera att hubben kan nås och försök igen.',
  'push.limit':
    'Aviseringar kräver hubben och den här enhetens tillstånd. De sker efter bästa förmåga: de kan komma sent eller utebli om telefonen är avstängd, sparar batteri eller är offline. De ersätter aldrig att hålla uppsikt över personen eller följa nödplanen.',
  'push.locked': 'En inspelning som startats från PIN-skärmen skickar sin avisering när appen låsts upp.',
  'push.notificationTitle': 'AuraTrack',
  'push.notificationBody': 'Öppna AuraTrack',
};

const fi: Tr = {
  'hub.title': 'Keskus',
  'hub.none':
    'Keskus on kotitalouden tietokoneella (tai Raspberry Pillä tai NAS-laitteella) toimiva ohjelma, joka on aina päällä. Keskuksen avulla puhelimet päivittyvät, vaikka niiden sovellukset ovat kiinni, ja kotitaloudella on päivittäinen varmuuskopio. Se säilyttää vain sinetöityä tietoa, jota se ei voi lukea.',
  'hub.noneLimit':
    'Ilman keskusta kaikki toimii kuten ennen: laitteet päivittävät toisensa, kun kaksi niistä on auki samaan aikaan.',
  'hub.connect': 'Yhdistä keskus',
  'hub.address': 'Keskuksen osoite',
  'hub.addressHelp': 'Se alkaa https:// ja näkyy keskuksen tilasivulla.',
  'hub.code': 'Keskuksen koodi',
  'hub.codeHelp': 'Keskuksen tilasivu näyttää sen. Sitä käytetään vain käyttöönotossa.',
  'hub.go': 'Yhdistä',
  'hub.connected': 'Yhdistetty: {address}',
  'hub.state.idle': 'Ajan tasalla keskuksen kanssa',
  'hub.state.syncing': 'Päivitetään keskuksen kanssa …',
  'hub.state.unreachable':
    'Keskus ei vastannut. Tallennus ja kirjaaminen eivät häiriinny, ja laitteet päivittävät silti toisensa.',
  'hub.state.not_allowed':
    'Keskus ei päästä tätä laitetta sisään. Se on voitu poistaa kotitaloudesta, tai keskus on otettu uudelleen käyttöön.',
  'hub.state.off': 'Ei keskusta',
  'hub.last': 'Viimeksi päivitetty {when}',
  'hub.never': 'Ei vielä päivitetty',
  'hub.syncNow': 'Päivitä keskuksen kanssa nyt',
  'hub.off': 'Sammuta keskus',
  'hub.offTitle': 'Sammutetaanko keskus?',
  'hub.offText':
    'Laitteet palaavat päivittämään toisensa, kun kaksi niistä on auki samaan aikaan. Keskus säilyttää sen, mitä sillä on, kunnes poistat sen sieltä.',
  'hub.offConfirm': 'Sammuta',
  'hub.err.unreachable':
    'Mikään ei vastannut siihen osoitteeseen. Tarkista osoite ja että keskus on käynnissä ja tavoitettavissa täältä.',
  'hub.err.wrong_code': 'Tuo koodi ei ole keskuksen. Se on keskuksen tilasivulla.',
  'hub.err.not_a_hub': 'Osoite vastasi, mutta se ei ole AuraTrack-keskus.',
  'hub.err.not_allowed': 'Keskus ei hyväksynyt tätä laitetta.',
  'hub.err.no_household': 'Aloita ensin kotitalous.',
  'hub.err.insecure': 'Osoitteen on alettava https://. Sovellus puhuu vain https-osoitteille.',
  'hub.openFromHub':
    'Jos tämä sovellus on auki eri osoitteessa kuin keskus (esimerkiksi Vercelissä oleva), selain estää keskuksen tarkoituksella. Avaa sen sijaan sovellus keskuksen omasta osoitteesta: {address}',
  'hub.unreadable':
    'Keskuksen muutokset, joita tämä laite ei vielä voi avata: {count}. Ne aukeavat heti, kun laite tapaa toisen kotitalouden laitteen, joka tuo uudet avaimet.',
  'hub.row': 'Keskus',
  'hub.note': 'Muutokset keskukselta: {count}',
  'hub.sealed':
    'Keskus säilyttää vain sinetöityä tietoa. Sillä ei ole avainta, joten se ei voi lukea nimeä, muistiinpanoa eikä aikaa merkinnän sisältä.',
  'push.title': 'Hälytykset tällä laitteella',
  'push.help':
    'Saat ilmoituksen, kun toinen kotitalouden laite aloittaa tallennuksen, ylittää hälytysajan tai on kirjannut kohtauksen, vaikka tämä sovellus olisi kiinni. Ilmoitus sanoo vain ”AuraTrack” ja pyytää avaamaan sovelluksen: lukitusnäytöllä ei näy mitään terveydestä.',
  'push.on': 'Hälytykset tällä laitteella',
  'push.events': 'Ilmoita, kun',
  'push.event.started': 'tallennus alkaa',
  'push.event.alert': 'kohtaus ylittää hälytysajan',
  'push.event.recorded': 'kohtaus on kirjattu',
  'push.people': 'Näille henkilöille',
  'push.everyone': 'Kaikille',
  'push.requirements':
    'iPhone ja iPad: hälytykset toimivat vasta, kun AuraTrack on lisätty Koti-valikkoon, iOS 16.4:llä tai uudemmalla. Puhelimen push-palvelun tarjoaja kuljettaa viestin: se näkee, että viesti meni tälle laitteelle, ei mitä siinä lukee.',
  'push.state.needs_home_screen': 'Lisää ensin AuraTrack Koti-valikkoon (Jaa, sitten Lisää Koti-valikkoon).',
  'push.state.unsupported': 'Tämä selain ei voi näyttää hälytyksiä.',
  'push.state.blocked': 'Ilmoitukset on estetty tälle sivustolle selaimen asetuksissa.',
  'push.err.denied': 'Ilmoituksia ei sallittu, joten hälytykset ovat pois päältä.',
  'push.err.failed':
    'Hälytyksiä ei voitu ottaa käyttöön. Tarkista, että keskus on tavoitettavissa, ja yritä uudelleen.',
  'push.limit':
    'Hälytykset tarvitsevat keskuksen ja tämän laitteen luvan. Ne tehdään parhaan kykyjen mukaan: ne voivat tulla myöhässä tai jäädä tulematta, jos puhelin on sammutettu, säästää akkua tai on offline-tilassa. Ne eivät koskaan korvaa henkilön seuraamista tai hätäsuunnitelman noudattamista.',
  'push.locked': 'PIN-näytöltä aloitettu tallennus lähettää hälytyksensä, kun sovellus on avattu.',
  'push.notificationTitle': 'AuraTrack',
  'push.notificationBody': 'Avaa AuraTrack',
};

const de: Tr = {
  'hub.title': 'Hub',
  'hub.none':
    'Ein Hub ist ein Programm auf einem Haushaltscomputer (oder einem Raspberry Pi oder NAS), das immer läuft. Mit einem Hub aktualisieren sich Telefone, während ihre Apps geschlossen sind, und der Haushalt hat eine tägliche Sicherung. Er hält nur versiegelte Daten, die er nicht lesen kann.',
  'hub.noneLimit':
    'Ohne Hub funktioniert alles wie bisher: Die Geräte aktualisieren einander, wenn zwei von ihnen gleichzeitig geöffnet sind.',
  'hub.connect': 'Hub verbinden',
  'hub.address': 'Adresse des Hubs',
  'hub.addressHelp': 'Sie beginnt mit https:// und steht auf der Statusseite des Hubs.',
  'hub.code': 'Code vom Hub',
  'hub.codeHelp': 'Die Statusseite des Hubs zeigt ihn. Er dient nur der Einrichtung.',
  'hub.go': 'Verbinden',
  'hub.connected': 'Verbunden mit {address}',
  'hub.state.idle': 'Auf dem Stand des Hubs',
  'hub.state.syncing': 'Gleiche mit dem Hub ab …',
  'hub.state.unreachable':
    'Der Hub hat nicht geantwortet. Erfassen und Speichern sind nicht betroffen, und die Geräte aktualisieren einander weiterhin.',
  'hub.state.not_allowed':
    'Der Hub lässt dieses Gerät nicht ein. Es wurde vielleicht aus dem Haushalt entfernt, oder der Hub wurde neu eingerichtet.',
  'hub.state.off': 'Kein Hub',
  'hub.last': 'Zuletzt abgeglichen {when}',
  'hub.never': 'Noch nicht abgeglichen',
  'hub.syncNow': 'Jetzt mit dem Hub abgleichen',
  'hub.off': 'Hub ausschalten',
  'hub.offTitle': 'Hub ausschalten?',
  'hub.offText':
    'Die Geräte aktualisieren einander wieder, wenn zwei von ihnen gleichzeitig geöffnet sind. Der Hub behält, was er hat, bis Sie es dort löschen.',
  'hub.offConfirm': 'Ausschalten',
  'hub.err.unreachable':
    'Unter dieser Adresse hat nichts geantwortet. Prüfen Sie die Adresse und ob der Hub läuft und von hier erreichbar ist.',
  'hub.err.wrong_code': 'Dieser Code gehört nicht zum Hub. Er steht auf der Statusseite des Hubs.',
  'hub.err.not_a_hub': 'Die Adresse hat geantwortet, ist aber kein AuraTrack-Hub.',
  'hub.err.not_allowed': 'Der Hub hat dieses Gerät nicht akzeptiert.',
  'hub.err.no_household': 'Starten Sie zuerst einen Haushalt.',
  'hub.err.insecure': 'Die Adresse muss mit https:// beginnen. Die App spricht nur mit https-Adressen.',
  'hub.openFromHub':
    'Wenn diese App unter einer anderen Adresse als der des Hubs geöffnet ist (zum Beispiel der auf Vercel), blockiert der Browser den Hub absichtlich. Öffnen Sie die App stattdessen unter der eigenen Adresse des Hubs: {address}',
  'hub.unreadable':
    'Änderungen beim Hub, die dieses Gerät noch nicht öffnen kann: {count}. Sie lassen sich öffnen, sobald dieses Gerät ein anderes Gerät des Haushalts trifft, das die neuen Schlüssel mitbringt.',
  'hub.row': 'Hub',
  'hub.note': 'Änderungen vom Hub: {count}',
  'hub.sealed':
    'Der Hub hält nur versiegelte Daten. Er hat keinen Schlüssel und kann deshalb weder einen Namen noch eine Notiz noch eine Zeit in einem Eintrag lesen.',
  'push.title': 'Warnungen auf diesem Gerät',
  'push.help':
    'Erhalten Sie eine Benachrichtigung, wenn ein anderes Gerät des Haushalts eine Erfassung startet, die Alarmzeit erreicht oder einen Anfall erfasst hat, auch wenn diese App geschlossen ist. Die Benachrichtigung sagt nur „AuraTrack“ und bittet Sie, die App zu öffnen: Nichts zur Gesundheit erscheint auf dem Sperrbildschirm.',
  'push.on': 'Warnungen auf diesem Gerät',
  'push.events': 'Benachrichtigen, wenn',
  'push.event.started': 'eine Erfassung startet',
  'push.event.alert': 'ein Anfall die Alarmzeit erreicht',
  'push.event.recorded': 'ein Anfall erfasst wurde',
  'push.people': 'Für diese Personen',
  'push.everyone': 'Alle',
  'push.requirements':
    'iPhone und iPad: Warnungen funktionieren erst, wenn AuraTrack zum Home-Bildschirm hinzugefügt wurde, ab iOS 16.4. Der Hersteller des Push-Dienstes des Telefons befördert die Nachricht: Er sieht, dass eine Nachricht an dieses Gerät ging, nicht was darin steht.',
  'push.state.needs_home_screen':
    'Fügen Sie AuraTrack zuerst zum Home-Bildschirm hinzu (Teilen, dann Zum Home-Bildschirm).',
  'push.state.unsupported': 'Dieser Browser kann keine Warnungen anzeigen.',
  'push.state.blocked': 'Benachrichtigungen sind für diese Website in den Einstellungen des Browsers blockiert.',
  'push.err.denied': 'Benachrichtigungen wurden nicht erlaubt, deshalb sind Warnungen aus.',
  'push.err.failed':
    'Warnungen konnten nicht eingeschaltet werden. Prüfen Sie, ob der Hub erreichbar ist, und versuchen Sie es erneut.',
  'push.limit':
    'Warnungen brauchen den Hub und die Erlaubnis dieses Geräts. Sie erfolgen nach bestem Bemühen: Sie können sich verspäten oder ausbleiben, wenn das Telefon aus ist, Akku spart oder offline ist. Sie ersetzen nie, die Person im Blick zu behalten oder dem Notfallplan zu folgen.',
  'push.locked': 'Eine vom PIN-Bildschirm gestartete Erfassung sendet ihre Warnung, sobald die App entsperrt ist.',
  'push.notificationTitle': 'AuraTrack',
  'push.notificationBody': 'AuraTrack öffnen',
};

const fr: Tr = {
  'hub.title': 'Hub',
  'hub.none':
    'Un hub est un programme sur un ordinateur du foyer (ou un Raspberry Pi ou un NAS) qui reste toujours allumé. Avec un hub, les téléphones se mettent à jour même quand leurs applis sont fermées, et le foyer a une sauvegarde quotidienne. Il ne garde que des données scellées qu’il ne peut pas lire.',
  'hub.noneLimit':
    'Sans hub, tout continue de fonctionner : les appareils se mettent à jour entre eux quand deux d’entre eux sont ouverts en même temps.',
  'hub.connect': 'Connecter un hub',
  'hub.address': 'Adresse du hub',
  'hub.addressHelp': 'Elle commence par https:// et figure sur la page d’état du hub.',
  'hub.code': 'Code du hub',
  'hub.codeHelp': 'La page d’état du hub l’affiche. Il ne sert qu’à la mise en place.',
  'hub.go': 'Connecter',
  'hub.connected': 'Connecté à {address}',
  'hub.state.idle': 'À jour avec le hub',
  'hub.state.syncing': 'Mise à jour avec le hub…',
  'hub.state.unreachable':
    'Le hub n’a pas répondu. L’enregistrement et la sauvegarde ne sont pas touchés, et les appareils se mettent toujours à jour entre eux.',
  'hub.state.not_allowed':
    'Le hub ne laisse pas entrer cet appareil. Il a peut-être été retiré du foyer, ou le hub a été reconfiguré.',
  'hub.state.off': 'Pas de hub',
  'hub.last': 'Dernière mise à jour {when}',
  'hub.never': 'Pas encore mis à jour',
  'hub.syncNow': 'Se mettre à jour avec le hub maintenant',
  'hub.off': 'Éteindre le hub',
  'hub.offTitle': 'Éteindre le hub ?',
  'hub.offText':
    'Les appareils se remettent à se mettre à jour entre eux quand deux d’entre eux sont ouverts en même temps. Le hub garde ce qu’il détient jusqu’à ce que vous le supprimiez là-bas.',
  'hub.offConfirm': 'Éteindre',
  'hub.err.unreachable':
    'Rien n’a répondu à cette adresse. Vérifiez l’adresse, et que le hub fonctionne et est joignable d’ici.',
  'hub.err.wrong_code': 'Ce code n’est pas celui du hub. Il figure sur la page d’état du hub.',
  'hub.err.not_a_hub': 'L’adresse a répondu, mais ce n’est pas un hub AuraTrack.',
  'hub.err.not_allowed': 'Le hub n’a pas accepté cet appareil.',
  'hub.err.no_household': 'Créez d’abord un foyer.',
  'hub.err.insecure': 'L’adresse doit commencer par https://. L’appli ne parle qu’à des adresses https.',
  'hub.openFromHub':
    'Si cette appli est ouverte à une autre adresse que celle du hub (par exemple celle de Vercel), le navigateur bloque le hub volontairement. Ouvrez plutôt l’appli depuis l’adresse du hub lui-même : {address}',
  'hub.unreadable':
    'Modifications du hub que cet appareil ne peut pas encore ouvrir : {count}. Elles s’ouvriront dès que cet appareil rencontrera un autre appareil du foyer, qui apporte les nouvelles clés.',
  'hub.row': 'Hub',
  'hub.note': 'Modifications du hub : {count}',
  'hub.sealed':
    'Le hub ne garde que des données scellées. Il n’a pas de clé, il ne peut donc lire ni un nom, ni une note, ni une heure dans un enregistrement.',
  'push.title': 'Alertes sur cet appareil',
  'push.help':
    'Recevez une notification quand un autre appareil du foyer démarre un enregistrement, dépasse la durée d’alerte ou a enregistré une crise, même quand cette appli est fermée. La notification dit seulement « AuraTrack » et vous invite à ouvrir l’appli : rien sur la santé n’apparaît sur l’écran de verrouillage.',
  'push.on': 'Alertes sur cet appareil',
  'push.events': 'Me prévenir quand',
  'push.event.started': 'un enregistrement démarre',
  'push.event.alert': 'une crise dépasse la durée d’alerte',
  'push.event.recorded': 'une crise a été enregistrée',
  'push.people': 'Pour ces personnes',
  'push.everyone': 'Tout le monde',
  'push.requirements':
    'iPhone et iPad : les alertes ne fonctionnent qu’une fois AuraTrack ajouté à l’écran d’accueil, avec iOS 16.4 ou plus. Le fabricant du service push du téléphone transporte le message : il voit qu’un message est allé à cet appareil, pas ce qu’il dit.',
  'push.state.needs_home_screen':
    'Ajoutez d’abord AuraTrack à l’écran d’accueil (Partager, puis Sur l’écran d’accueil).',
  'push.state.unsupported': 'Ce navigateur ne peut pas afficher d’alertes.',
  'push.state.blocked': 'Les notifications sont bloquées pour ce site dans les réglages du navigateur.',
  'push.err.denied': 'Les notifications n’ont pas été autorisées, les alertes sont donc désactivées.',
  'push.err.failed': 'Les alertes n’ont pas pu être activées. Vérifiez que le hub est joignable, puis réessayez.',
  'push.limit':
    'Les alertes demandent le hub et l’autorisation de cet appareil. Elles sont faites au mieux : elles peuvent arriver en retard ou manquer si le téléphone est éteint, économise la batterie ou est hors ligne. Elles ne remplacent jamais de surveiller la personne ni de suivre le plan d’urgence.',
  'push.locked':
    'Un enregistrement démarré depuis l’écran du code PIN envoie son alerte une fois l’appli déverrouillée.',
  'push.notificationTitle': 'AuraTrack',
  'push.notificationBody': 'Ouvrir AuraTrack',
};

const es: Tr = {
  'hub.title': 'Hub',
  'hub.none':
    'Un hub es un programa en un ordenador del hogar (o una Raspberry Pi o un NAS) que está siempre encendido. Con uno, los teléfonos se actualizan aunque sus apps estén cerradas, y el hogar tiene una copia de seguridad diaria. Solo guarda datos sellados que no puede leer.',
  'hub.noneLimit':
    'Sin hub todo sigue funcionando: los dispositivos se actualizan entre sí cuando dos de ellos están abiertos a la vez.',
  'hub.connect': 'Conectar un hub',
  'hub.address': 'Dirección del hub',
  'hub.addressHelp': 'Empieza por https:// y aparece en la página de estado del hub.',
  'hub.code': 'Código del hub',
  'hub.codeHelp': 'La página de estado del hub lo muestra. Solo sirve para la configuración.',
  'hub.go': 'Conectar',
  'hub.connected': 'Conectado a {address}',
  'hub.state.idle': 'Al día con el hub',
  'hub.state.syncing': 'Actualizando con el hub…',
  'hub.state.unreachable':
    'El hub no respondió. El registro y el guardado no se ven afectados, y los dispositivos siguen actualizándose entre sí.',
  'hub.state.not_allowed':
    'El hub no deja entrar a este dispositivo. Puede que lo hayan quitado del hogar, o que el hub se haya configurado de nuevo.',
  'hub.state.off': 'Sin hub',
  'hub.last': 'Última actualización {when}',
  'hub.never': 'Aún sin actualizar',
  'hub.syncNow': 'Actualizar con el hub ahora',
  'hub.off': 'Apagar el hub',
  'hub.offTitle': '¿Apagar el hub?',
  'hub.offText':
    'Los dispositivos vuelven a actualizarse entre sí cuando dos de ellos están abiertos a la vez. El hub conserva lo que tiene hasta que lo borre allí.',
  'hub.offConfirm': 'Apagar',
  'hub.err.unreachable':
    'Nada respondió en esa dirección. Compruebe la dirección, y que el hub funciona y es accesible desde aquí.',
  'hub.err.wrong_code': 'Ese código no es el del hub. Está en la página de estado del hub.',
  'hub.err.not_a_hub': 'La dirección respondió, pero no es un hub de AuraTrack.',
  'hub.err.not_allowed': 'El hub no aceptó este dispositivo.',
  'hub.err.no_household': 'Cree primero un hogar.',
  'hub.err.insecure': 'La dirección debe empezar por https://. La app solo habla con direcciones https.',
  'hub.openFromHub':
    'Si esta app está abierta en una dirección distinta de la del hub (por ejemplo la de Vercel), el navegador bloquea el hub a propósito. Abra en su lugar la app desde la dirección propia del hub: {address}',
  'hub.unreadable':
    'Cambios en el hub que este dispositivo aún no puede abrir: {count}. Se abrirán en cuanto este dispositivo se encuentre con otro dispositivo del hogar, que trae las claves nuevas.',
  'hub.row': 'Hub',
  'hub.note': 'Cambios del hub: {count}',
  'hub.sealed':
    'El hub solo guarda datos sellados. No tiene clave, así que no puede leer un nombre, una nota ni una hora dentro de un registro.',
  'push.title': 'Alertas en este dispositivo',
  'push.help':
    'Reciba una notificación cuando otro dispositivo del hogar inicie un registro, pase la duración de alerta o haya registrado una crisis, incluso con esta app cerrada. La notificación dice solo «AuraTrack» y le pide abrir la app: nada sobre salud aparece en la pantalla de bloqueo.',
  'push.on': 'Alertas en este dispositivo',
  'push.events': 'Avisarme cuando',
  'push.event.started': 'se inicie un registro',
  'push.event.alert': 'una crisis pase la duración de alerta',
  'push.event.recorded': 'se haya registrado una crisis',
  'push.people': 'Para estas personas',
  'push.everyone': 'Todas',
  'push.requirements':
    'iPhone y iPad: las alertas solo funcionan una vez añadida AuraTrack a la pantalla de inicio, con iOS 16.4 o posterior. El fabricante del servicio push del teléfono transporta el mensaje: ve que un mensaje fue a este dispositivo, no lo que dice.',
  'push.state.needs_home_screen':
    'Añada primero AuraTrack a la pantalla de inicio (Compartir y luego Añadir a pantalla de inicio).',
  'push.state.unsupported': 'Este navegador no puede mostrar alertas.',
  'push.state.blocked': 'Las notificaciones están bloqueadas para este sitio en los ajustes del navegador.',
  'push.err.denied': 'No se permitieron las notificaciones, así que las alertas están desactivadas.',
  'push.err.failed': 'No se pudieron activar las alertas. Compruebe que el hub es accesible e inténtelo de nuevo.',
  'push.limit':
    'Las alertas necesitan el hub y el permiso de este dispositivo. Se hacen lo mejor posible: pueden llegar tarde o faltar si el teléfono está apagado, ahorrando batería o sin conexión. Nunca sustituyen vigilar a la persona ni seguir el plan de emergencia.',
  'push.locked': 'Un registro iniciado desde la pantalla del PIN envía su alerta cuando la app se desbloquea.',
  'push.notificationTitle': 'AuraTrack',
  'push.notificationBody': 'Abrir AuraTrack',
};

export const m7tr: Record<Exclude<Language, 'en'>, Tr> = { nb, nn, da, sv, fi, de, fr, es };
