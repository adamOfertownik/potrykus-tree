import type { Metadata } from "next";
import { LegalDoc } from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "Regulamin — Drzewo Potrykus",
  description: "Zasady korzystania z prywatnego drzewa Rodu Potrykus",
};

export default function RegulaminPage() {
  return (
    <LegalDoc title="Regulamin">
      <h2>1. Co to jest</h2>
      <p>
        Drzewo Potrykus to <strong>prywatne archiwum Rodu Potrykus</strong>.
        Nie jest to firma, sklep ani publiczny serwis internetowy. Aplikacja
        służy rodowi: oglądanie drzewa, uzupełnianie danych i spotkania
        rodzinne.
      </p>
      <p>
        Archiwum cyfrowe złożyliśmy z <strong>papierów rodzinnych</strong>{" "}
        (wydruki, notatki, stare zestawienia). To punkt startu — nie
        „oficjalna księga rodu” i nie źródło urzędowe. Korzystanie jest za
        zgodą rodziny na grupie rodzinnej.
      </p>

      <h2>2. Dostęp — hasło rodzinne</h2>
      <p>
        Strona jest zabezpieczona wspólnym kodem rodzinnym. Kod jest tylko dla
        rodu. Nie wolno go publikować, wpisywać na obcych stronach ani
        przekazywać osobom spoza umówionego kręgu.
      </p>
      <p>
        Kto zna kod, widzi dane rodziny (imiona, daty, zdjęcia, telefony,
        zapisy na spotkanie). Jeśli udostępnisz kod komuś obcemu, odpowiadasz
        za skutki.
      </p>

      <h2>3. Pobieranie drzewa i listy</h2>
      <p>
        Każdy, kto wszedł kodem, może pobrać aktualny graf drzewa albo listę
        osób (PDF z menu). To kopia stanu na chwilę pobrania — do użytku
        rodzinnego, nie do publikacji w internecie bez zgody osób, których
        dane dotyczą.
      </p>

      <h2>4. Administratorzy</h2>
      <p>
        Oprócz kodu rodzinnego są konta administratorów. Nadzorują zgłoszenia:
        mogą przyjąć, poprawić albo odrzucić zmiany, pomagać przy błędach.
        Nie sprawdzają każdej daty w urzędzie — dane i tak pochodzą od
        rodziny i z papierów.
      </p>
      <p>
        Osoby, które utrzymują stronę (w tym Adam Lieske), i administratorzy
        działają społecznie, w dobrej wierze, bez wynagrodzenia z tytułu tej
        aplikacji.
      </p>

      <h2>5. Kto dodaje zmiany — bierze to na siebie</h2>
      <p>
        Każdy, kto zgłasza albo wprowadza zmianę, <strong>akceptuje ten
        regulamin</strong> i bierze na siebie odpowiedzialność za dane swojej{" "}
        <strong>najbliższej rodziny</strong>: czy są prawdziwe, czy ma prawo
        je tu umieścić i czy bliscy się na to zgadzają.
      </p>
      <p>
        Rodzina sama uzupełnia drzewo: osoby, pokrewieństwo, daty, zdjęcia,
        telefony, zapisy na spotkanie. Wpisy mogą być niekompletne albo
        błędne — zgłoś poprawkę, zamiast kłócić się w komentarzach poza
        aplikacją.
      </p>

      <h2>6. Zdjęcia i treści</h2>
      <p>
        Wysyłając zdjęcie albo opis, oświadczasz, że masz prawo je tu umieścić.
        Nie dodawaj materiałów obraźliwych ani takich, których osoba nie chce
        w archiwum rodowym.
      </p>

      <h2>7. Odpowiedzialność</h2>
      <p>
        Korzystasz z aplikacji na własną odpowiedzialność. Ród, osoby
        utrzymujące stronę, administratorzy i hosting nie odpowiadają za:
      </p>
      <ul>
        <li>błędy w drzewie, datach, nazwiskach i pokrewieństwie,</li>
        <li>nieścisłości przepisane z papierów rodzinnych,</li>
        <li>dane zgłoszone przez Ciebie albo przez kogoś z Twojej linii,</li>
        <li>spory rodzinne wynikłe z treści strony,</li>
        <li>decyzje podjęte na podstawie danych z aplikacji,</li>
        <li>
          dostęp osoby trzeciej, która dostała kod rodzinny albo hasło od
          kogoś z rodziny,
        </li>
        <li>
          przerwy w działaniu, utratę danych albo zmiany po stronie
          dostawców (hosting, baza, pliki).
        </li>
      </ul>
      <p>
        Aplikacja jest udostępniana „tak jak jest”, bez gwarancji
        nieprzerwanego działania i bez gwarancji, że dane są prawdziwe albo
        kompletne.
      </p>

      <h2>8. Zmiany, usunięcie, wyłączenie</h2>
      <p>
        Możesz poprosić o poprawkę albo usunięcie danych przez zakładkę Zgłoś,
        administratora albo grupę rodzinną. Administratorzy mogą zmienić
        regulamin, ograniczyć dostęp albo wyłączyć stronę — zwłaszcza gdy ktoś
        łamie te zasady albo wycieknie kod.
      </p>

      <h2>9. Akceptacja</h2>
      <p>
        Zaznaczając zgodę przy wejściu, potwierdzasz, że to prywatne archiwum
        Rodu Potrykus, że możesz pobierać aktualny graf i listę na użytek
        rodziny, a zgłaszając zmiany bierzesz na siebie dane swojej
        najbliższej rodziny.
      </p>
    </LegalDoc>
  );
}
