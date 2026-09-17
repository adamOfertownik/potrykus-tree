import type { Metadata } from "next";
import { LegalDoc } from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "Polityka prywatności — Drzewo Potrykus",
  description: "Jak prywatne drzewo rodziny Potrykus przetwarza dane",
};

export default function PolitykaPrywatnosciPage() {
  return (
    <LegalDoc title="Polityka prywatności">
      <h2>1. Po co ten tekst</h2>
      <p>
        Krótko: jakie dane są w Drzewie Potrykus, po co i kto je widzi. To
        prywatne archiwum rodziny, nie sklep i nie portal otwarty dla
        internetu. Tekst jest napisany prostym językiem dla rodziny — nie
        zastępuje porady prawnej.
      </p>

      <h2>2. Kto prowadzi stronę</h2>
      <p>
        Stronę prowadzi <strong>Adam Lieske</strong> prywatnie, za zgodą
        rodziny na grupie rodzinnej. Kontakt w sprawach danych: grupa
        rodzinna, zakładka Zgłoś w aplikacji albo administratorzy.
      </p>

      <h2>3. Jakie dane tu są</h2>
      <p>W archiwum mogą być m.in.:</p>
      <ul>
        <li>
          dane genealogiczne — imiona, nazwiska, daty urodzenia, ślubu i
          śmierci, pokrewieństwo, notatki rodzinne,
        </li>
        <li>zdjęcia osób i uroczystości,</li>
        <li>numery telefonów, jeśli ktoś je podał,</li>
        <li>
          zapisy na spotkanie rodzinne (kto idzie, bilety, czy zapłacono),
        </li>
        <li>
          zgłoszenia poprawek (kto zgłasza i czego dotyczy),
        </li>
        <li>
          dane logowania administratorów (e-mail i skrót hasła, nie hasło
          jawnym tekstem),
        </li>
        <li>
          dane techniczne potrzebne do działania strony (sesja po podaniu
          kodu, ograniczenie liczby prób kodu).
        </li>
      </ul>
      <p>
        Część danych dotyczy osób, których już nie ma. Wprowadza je rodzina,
        w dobrej wierze, jako pamięć rodową — nie jako publiczny rejestr.
      </p>

      <h2>4. Po co te dane</h2>
      <p>Wyłącznie na potrzeby rodziny:</p>
      <ul>
        <li>wspólne drzewo i lista osób,</li>
        <li>urodziny i pokrewieństwo,</li>
        <li>organizacja spotkania rodzinnego,</li>
        <li>przyjmowanie i nadzór zgłoszeń przez administratorów.</li>
      </ul>
      <p>
        Danych nie sprzedajemy, nie wysyłamy reklam i nie udostępniamy
        publicznie w wyszukiwarkach (strona prosi roboty, żeby jej nie
        indeksować).
      </p>

      <h2>5. Komu dane są widoczne</h2>
      <p>
        Osobom, które znają kod rodzinny, oraz administratorom. Dostawcy
        techniczni (hosting strony, baza danych, pliki ze zdjęciami) mogą
        przetwarzać dane wyłącznie po to, żeby aplikacja działała — nie do
        własnego marketingu z naszej strony.
      </p>
      <p>
        Nie mamy wpływu na to, czy ktoś z rodziny zrobi zrzut ekranu albo
        przekaże kod. Dlatego kod ma zostać w rodzinie.
      </p>

      <h2>6. Jak długo i jak chronimy</h2>
      <p>
        Dane trzymamy, dopóki archiwum jest potrzebne rodzinie. Wejście jest
        za kodem. Administratorzy nadzorują zmiany. To nie gwarantuje
        absolutnego bezpieczeństwa — żaden serwis w internecie go nie ma.
      </p>

      <h2>7. Twoje wybory</h2>
      <p>
        Możesz poprosić o wgląd, poprawkę albo usunięcie danych, które Cię
        dotyczą (albo osoby, którą reprezentujesz). Zgłoś to przez aplikację,
        administratora albo grupę rodzinną. Czasem usunięcie jednej osoby
        psuje spójność drzewa — wtedy szukamy rozsądnego kompromisu w
        rodzinie.
      </p>
      <p>
        W przeglądarce zostaje sesja po zalogowaniu kodem oraz informacja, że
        zaakceptowałeś ten dokument. Bez tego nie da się wejść do drzewa.
      </p>

      <h2>8. Dzieci</h2>
      <p>
        W drzewie mogą być dane dzieci z rodziny. Dodaje je opiekun albo
        bliscy na użytek rodzinny. Nie używamy tych danych do reklamy.
      </p>
    </LegalDoc>
  );
}
