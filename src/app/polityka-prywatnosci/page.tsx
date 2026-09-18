import type { Metadata } from "next";
import { LegalDoc } from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "Polityka prywatności — Drzewo Potrykus",
  description: "Jak prywatne archiwum Rodu Potrykus przetwarza dane",
};

export default function PolitykaPrywatnosciPage() {
  return (
    <LegalDoc title="Polityka prywatności">
      <h2>1. Po co ten tekst</h2>
      <p>
        Krótko: jakie dane są w Drzewie Potrykus, po co i kto je widzi. To
        prywatne archiwum <strong>Rodu Potrykus</strong>, nie sklep i nie
        portal otwarty dla internetu. Tekst jest napisany prostym językiem —
        nie zastępuje porady prawnej.
      </p>

      <h2>2. Kto to prowadzi</h2>
      <p>
        Archiwum jest na prywatny użytek całego rodu, za zgodą na grupie
        rodzinnej. Stronę technicznie utrzymuje m.in. Adam Lieske.
        Kontakt w sprawach danych: grupa rodzinna, zakładka Zgłoś albo
        administratorzy.
      </p>
      <p>
        Cyfrową bazę złożyliśmy z papierów rodzinnych. Dalsze uzupełnienia
        dodaje rodzina — każdy za swoją najbliższą linię.
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
        <li>zgłoszenia poprawek (kto zgłasza i czego dotyczy),</li>
        <li>
          opcjonalny e-mail przy wysyłce zgłoszenia — tylko jeśli ktoś sam
          go wpisze, żeby dostać kopię swoich zmian,
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
        Część danych dotyczy osób, których już nie ma. Są w archiwum jako
        pamięć rodowa — nie jako publiczny rejestr.
      </p>

      <h2>4. Po co te dane</h2>
      <p>Wyłącznie na potrzeby Rodu Potrykus:</p>
      <ul>
        <li>wspólne drzewo i lista osób,</li>
        <li>pobranie aktualnego grafu albo listy (PDF),</li>
        <li>urodziny i pokrewieństwo,</li>
        <li>organizacja spotkania rodzinnego,</li>
        <li>przyjmowanie i nadzór zgłoszeń przez administratorów,</li>
        <li>
          wysłanie potwierdzenia zgłoszenia na podany przy wysyłce adres
          (kopia zmian, żeby nic nie zaginęło).
        </li>
      </ul>
      <p>
        Opcjonalnego e-maila nie zapisujemy na drzewie, nie używamy do
        newslettera ani reklam i nie przekazujemy dalej poza to, co trzeba,
        żeby mail doszedł (dostawca poczty).
      </p>
      <p>
        Danych nie sprzedajemy, nie wysyłamy reklam i nie udostępniamy
        publicznie w wyszukiwarkach (strona prosi roboty, żeby jej nie
        indeksować).
      </p>

      <h2>5. Komu dane są widoczne</h2>
      <p>
        Osobom z rodu, które znają kod rodzinny, oraz administratorom. Te
        osoby mogą też pobrać aktualny graf albo listę na swój komputer.
        Dostawcy techniczni (hosting, baza, pliki ze zdjęciami, wysyłka
        poczty) mogą przetwarzać dane wyłącznie po to, żeby aplikacja
        działała.
      </p>
      <p>
        Jeśli przy zgłoszeniu podasz e-mail, administratorzy widzą, że poszło
        potwierdzenie (żeby wiedzieć, iż kopia nie zaginęła). Adres nie jest
        publikowany na drzewie.
      </p>
      <p>
        Nie mamy wpływu na to, czy ktoś z rodziny zrobi zrzut ekranu, zapisze
        PDF albo przekaże kod. Dlatego kod i pobrane pliki zostają w rodzie.
      </p>

      <h2>6. Kto odpowiada za swoje zgłoszenia</h2>
      <p>
        Kto dodaje albo zgłasza zmianę, bierze na siebie dane swojej
        najbliższej rodziny: prawdziwość, zgodę bliskich i prawo do umieszczenia
        ich w archiwum. Administratorzy mogą odrzucić zgłoszenie, ale nie
        przejmują za Ciebie tej odpowiedzialności.
      </p>

      <h2>7. Jak długo i jak chronimy</h2>
      <p>
        Dane trzymamy, dopóki archiwum jest potrzebne rodowi. Wejście jest za
        kodem. Administratorzy nadzorują zmiany. To nie gwarantuje
        absolutnego bezpieczeństwa — żaden serwis w internecie go nie ma.
      </p>
      <p>
        E-mail z potwierdzenia trzymamy przy tym zgłoszeniu, żeby wysłać kopię
        i ewentualnie sprawdzić, czy doszła. Nie budujemy z niego listy
        mailingowej.
      </p>

      <h2>8. Twoje wybory</h2>
      <p>
        Możesz poprosić o wgląd, poprawkę albo usunięcie danych, które Cię
        dotyczą (albo osoby, którą reprezentujesz). Zgłoś to przez aplikację,
        administratora albo grupę rodzinną. Czasem usunięcie jednej osoby
        psuje spójność drzewa — wtedy szukamy rozsądnego kompromisu w rodzie.
      </p>
      <p>
        W przeglądarce zostaje sesja po podaniu kodu oraz informacja, że
        zaakceptowałeś ten dokument. Bez tego nie da się wejść do drzewa.
        Opcjonalnego e-maila z potwierdzenia w przeglądarce nie zapisujemy —
        wpisujesz go przy konkretnej wysyłce.
      </p>

      <h2>9. Dzieci</h2>
      <p>
        W drzewie mogą być dane dzieci z rodu. Dodaje je opiekun albo
        najbliższa rodzina na użytek rodowy. Nie używamy tych danych do
        reklamy.
      </p>
    </LegalDoc>
  );
}
