import type { Metadata } from "next";
import { LegalDoc } from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "Regulamin — Drzewo Potrykus",
  description: "Zasady korzystania z prywatnego drzewa rodziny Potrykus",
};

export default function RegulaminPage() {
  return (
    <LegalDoc title="Regulamin">
      <h2>1. Co to jest</h2>
      <p>
        Drzewo Potrykus to prywatne archiwum genealogiczne rodziny. Prowadzi je{" "}
        <strong>Adam Lieske</strong> na użytek własny i rodziny — nie jest to
        firma, sklep ani publiczny serwis internetowy. Aplikacja powstała, żeby
        rodzina mogła wspólnie oglądać drzewo, uzupełniać dane i umawiać
        spotkanie.
      </p>
      <p>
        Korzystanie odbywa się za zgodą rodziny wyrażoną na grupie rodzinnej.
        Wejście do aplikacji oznacza, że znasz ten charakter strony i go
        akceptujesz.
      </p>

      <h2>2. Dostęp — hasło rodzinne</h2>
      <p>
        Strona jest zabezpieczona wspólnym kodem rodzinnym. Kod jest tylko dla
        rodziny. Nie wolno go publikować, wpisywać na obcych stronach ani
        przekazywać osobom spoza umówionego kręgu.
      </p>
      <p>
        Kto zna kod, widzi dane rodziny (imiona, daty, zdjęcia, telefony,
        zapisy na spotkanie). Jeśli udostępnisz kod komuś obcemu, odpowiadasz
        za skutki.
      </p>

      <h2>3. Administratorzy</h2>
      <p>
        Oprócz kodu rodzinnego są konta administratorów. Administratorzy
        nadzorują zgłoszenia: mogą przyjąć, poprawić albo odrzucić zmiany w
        drzewie, oznaczać wpłaty i pomagać przy błędach. Nie oznacza to, że
        sprawdzają każdą informację co do joty — dane i tak pochodzą od
        rodziny.
      </p>
      <p>
        Twórca (Adam Lieske) i administratorzy działają społecznie, w dobrej
        wierze, bez wynagrodzenia z tytułu tej strony.
      </p>

      <h2>4. Kto wprowadza dane</h2>
      <p>
        Rodzina sama zgłasza i wprowadza informacje: osoby, pokrewieństwo,
        daty, zdjęcia, telefony, zapisy na spotkanie. Aplikacja jest narzędziem
        — nie źródłem urzędowym i nie „oficjalną księgą rodu”.
      </p>
      <p>
        Wpisy mogą być niekompletne, nieaktualne albo błędne. Zanim coś
        poprawisz, zgłoś zmianę. Nie kopiuj danych z drzewa do internetu bez
        zgody osób, których dotyczą (albo ich bliskich, gdy osoby już nie ma).
      </p>

      <h2>5. Zdjęcia i treści</h2>
      <p>
        Wysyłając zdjęcie albo opis, oświadczasz, że masz prawo je tu umieścić
        (np. Twoje zdjęcie, zgoda rodziny). Nie dodawaj materiałów obraźliwych
        ani takich, których osoba nie chce w archiwum rodzinnym.
      </p>

      <h2>6. Odpowiedzialność</h2>
      <p>
        Korzystasz z aplikacji na własną odpowiedzialność. Adam Lieske,
        administratorzy i hosting nie odpowiadają za:
      </p>
      <ul>
        <li>błędy w drzewie, datach, nazwiskach i pokrewieństwie,</li>
        <li>spory rodzinne wynikłe z treści strony,</li>
        <li>decyzje podjęte na podstawie danych z aplikacji,</li>
        <li>
          dostęp osoby trzeciej, która dostała kod rodzinny albo hasło od
          kogoś z rodziny,
        </li>
        <li>
          przerwy w działaniu, utratę danych albo zmiany po stronie
          dostawców (hosting, baza, pliki),
        </li>
        <li>treści dodane przez innych członków rodziny.</li>
      </ul>
      <p>
        Aplikacja jest udostępniana „tak jak jest”, bez gwarancji
        nieprzerwanego działania i bez gwarancji, że dane są prawdziwe albo
        kompletne. To archiwum hobbystyczne, nie usługa profesjonalna.
      </p>

      <h2>7. Zmiany, usunięcie, wyłączenie</h2>
      <p>
        Możesz poprosić o poprawkę albo usunięcie swoich danych przez zakładkę
        Zgłoś, administratora albo grupę rodzinną. Twórca może zmienić
        regulamin, ograniczyć dostęp albo wyłączyć stronę — zwłaszcza gdy
        ktoś łamie te zasady albo wycieknie kod.
      </p>

      <h2>8. Akceptacja</h2>
      <p>
        Zaznaczając zgodę przy wejściu i podając kod rodzinny, potwierdzasz, że
        przeczytałeś ten regulamin i politykę prywatności, rozumiesz prywatny
        charakter aplikacji i nie będziesz zgłaszać roszczeń z tytułu
        korzystania z drzewa jako z usługi publicznej.
      </p>
    </LegalDoc>
  );
}
