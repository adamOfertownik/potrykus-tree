"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { useIdentity } from "@/components/IdentityProvider";
import {
  detectPhoneOs,
  dismissPwaHint,
  isIosSafari,
  isMobileViewport,
  isStandaloneDisplay,
  wasPwaHintDismissed,
  type BeforeInstallPromptEvent,
  type PhoneOs,
} from "@/lib/pwaInstall";

const ANDROID_STEPS = [
  {
    title: "Otwórz menu przeglądarki",
    detail: "U góry po prawej kliknij trzy kropki ⋮ (albo trzy kreski).",
  },
  {
    title: "Wybierz dodanie na ekran",
    detail:
      "Kliknij „Zainstaluj aplikację” albo „Dodaj do ekranu głównego”.",
  },
  {
    title: "Potwierdź",
    detail:
      "Kliknij „Dodaj” albo „Zainstaluj”. Ikona Drzewo Potrykus pojawi się między aplikacjami.",
  },
];

const IOS_STEPS = [
  {
    title: "Kliknij Udostępnij",
    detail:
      "Na dole ekranu (albo u góry) kliknij kwadrat ze strzałką do góry.",
  },
  {
    title: "Do ekranu początkowego",
    detail:
      "Przewiń listę i kliknij „Do ekranu początkowego”.",
  },
  {
    title: "Dodaj",
    detail:
      "Kliknij „Dodaj” w prawym górnym rogu. Ikona pojawi się na pulpicie jak zwykła aplikacja.",
  },
];

export function usePwaAutoPrompt() {
  const { identity } = useIdentity();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!identity?.name) return;
    if (isStandaloneDisplay() || wasPwaHintDismissed()) return;
    if (!isMobileViewport()) return;
    const t = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(t);
  }, [identity?.name]);

  return { open, setOpen };
}

export function PwaInstallModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [os, setOs] = useState<PhoneOs>("android");
  const [step, setStep] = useState<number | null>(null);
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [safariHint, setSafariHint] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(null);
      setDone(false);
      return;
    }
    const detected = detectPhoneOs();
    setOs(detected);
    setSafariHint(detected === "ios" && !isIosSafari());
  }, [open]);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const steps = os === "ios" ? IOS_STEPS : ANDROID_STEPS;
  const current = step != null ? steps[step] : null;

  const close = () => {
    dismissPwaHint();
    onClose();
  };

  const addShortcut = async () => {
    if (os === "android" && installEvent) {
      setBusy(true);
      try {
        await installEvent.prompt();
        const choice = await installEvent.userChoice;
        setInstallEvent(null);
        if (choice.outcome === "accepted") {
          setDone(true);
          dismissPwaHint();
          return;
        }
      } catch {
        /* guided steps */
      } finally {
        setBusy(false);
      }
    }
    setStep(0);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      labelledBy="pwa-install-title"
      cardClassName="modal-card--pwa"
    >
      <div className="pwa-guide">
        <header className="modal-card__head">
          <h2 id="pwa-install-title">Dodaj Drzewo na telefon</h2>
          <p>
            Będzie jak zwykła aplikacja: ikona na pulpicie, bez paska
            przeglądarki. Nic nie trzeba szukać w sklepie.
          </p>
        </header>

        <div className="pwa-os-switch" role="tablist" aria-label="Telefon">
          <button
            type="button"
            role="tab"
            aria-selected={os === "android"}
            className={os === "android" ? "is-on" : undefined}
            onClick={() => {
              setOs("android");
              setStep(null);
              setDone(false);
            }}
          >
            Android
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={os === "ios"}
            className={os === "ios" ? "is-on" : undefined}
            onClick={() => {
              setOs("ios");
              setStep(null);
              setDone(false);
              setSafariHint(!isIosSafari() && detectPhoneOs() === "ios");
            }}
          >
            iPhone
          </button>
        </div>

        {done ? (
          <p className="pwa-guide__ok" role="status">
            Gotowe. Szukaj ikony „Potrykus” na ekranie telefonu.
          </p>
        ) : current ? (
          <div className="pwa-step" aria-live="polite">
            <p className="pwa-step__num">
              Krok {step! + 1} z {steps.length}
            </p>
            <h3>{current.title}</h3>
            <p>{current.detail}</p>
          </div>
        ) : (
          <ol className="pwa-preview">
            {steps.map((item, i) => (
              <li key={item.title}>
                <strong>
                  {i + 1}. {item.title}
                </strong>
                <span>{item.detail}</span>
              </li>
            ))}
          </ol>
        )}

        {safariHint && os === "ios" && !done ? (
          <p className="pwa-guide__warn">
            Na iPhonie otwórz tę stronę w <strong>Safari</strong> (nie w Chrome).
            Tylko Safari potrafi dodać ikonę na pulpit.
          </p>
        ) : null}

        <div className="modal-actions modal-actions--stack">
          {!done && step == null && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={addShortcut}
            >
              {busy
                ? "Otwieram…"
                : os === "android" && installEvent
                  ? "Dodaj skrót na ekran"
                  : "Zrób to ze mną — krok po kroku"}
            </button>
          )}
          {!done && step != null && step < steps.length - 1 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setStep(step + 1)}
            >
              Zrobione — dalej
            </button>
          )}
          {!done && step === steps.length - 1 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setDone(true);
                dismissPwaHint();
              }}
            >
              Mam już ikonę
            </button>
          )}
          {step != null && !done && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStep(null)}
            >
              Wróć do listy kroków
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={close}>
            {done ? "Zamknij" : "Później"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
