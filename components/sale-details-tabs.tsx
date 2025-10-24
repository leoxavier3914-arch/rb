"use client"

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import clsx from "clsx"
import QRCode from "qrcode"

export type DetailListItem = {
  label: string
  value: string
}

type PixQrAction = {
  type: "pix-qr"
  pixCode: string
  triggerLabel?: string
  expiresAt?: string | null
}

type DetailAction = PixQrAction

export type DetailItem = {
  label: string
  value: ReactNode | null
  list?: DetailListItem[]
  action?: DetailAction
}

type Section = {
  id: string
  label: string
  items: DetailItem[]
}

const fallbackValue = (value: ReactNode | null | undefined) => {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/70">—</span>
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      return <span className="text-muted-foreground/70">—</span>
    }
    return trimmed
  }

  return value
}

const PixQrCodeAction = ({ action }: { action: PixQrAction }) => {
  const [open, setOpen] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">("idle")
  const dialogTitleId = useId()
  const descriptionId = `${dialogTitleId}-description`

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false
    setIsLoading(true)
    setCopyState("idle")

    QRCode.toDataURL(action.pixCode, {
      width: 256,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) {
          setQrCodeUrl(url)
        }
      })
      .catch((error) => {
        console.error("Erro ao gerar QR Code do PIX", error)
        if (!cancelled) {
          setQrCodeUrl(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [action.pixCode, open])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  const handleCopy = useCallback(async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        throw new Error("Clipboard API indisponível")
      }

      await navigator.clipboard.writeText(action.pixCode)
      setCopyState("success")
    } catch (error) {
      console.error("Erro ao copiar código PIX", error)
      setCopyState("error")
    } finally {
      setTimeout(() => setCopyState("idle"), 2500)
    }
  }, [action.pixCode])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-full border border-primary/50 bg-transparent px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        {action.triggerLabel ?? "ver QR"}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          aria-describedby={descriptionId}
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl border border-surface-accent/30 bg-surface p-6 text-primary-foreground shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Fechar
            </button>

            <div className="space-y-3">
              <div>
                <h4 id={dialogTitleId} className="text-lg font-semibold">
                  QR Code do PIX
                </h4>
                <p id={descriptionId} className="text-sm text-muted-foreground">
                  Escaneie o QR Code abaixo ou copie o código PIX para concluir o pagamento.
                </p>
                {action.expiresAt ? (
                  <p className="text-xs text-muted-foreground/80">
                    Expira em: <span className="font-medium text-primary-foreground">{action.expiresAt}</span>
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col items-center gap-4">
                <div className="flex h-64 w-64 items-center justify-center rounded-3xl border border-surface-accent/40 bg-surface-accent/50 p-4">
                  {isLoading ? (
                    <span className="text-sm text-muted-foreground">Gerando QR Code…</span>
                  ) : qrCodeUrl ? (
                    <img src={qrCodeUrl} alt="QR Code do PIX" className="h-full w-full rounded-2xl object-contain" />
                  ) : (
                    <span className="text-center text-sm text-muted-foreground">
                      Não foi possível gerar o QR Code. Copie o código PIX abaixo.
                    </span>
                  )}
                </div>

                <code className="w-full break-all rounded-2xl border border-surface-accent/40 bg-surface-accent/30 p-4 text-xs text-muted-foreground">
                  {action.pixCode}
                </code>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center rounded-full border border-primary/60 px-4 py-2 text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    {copyState === "success"
                      ? "Copiado!"
                      : copyState === "error"
                        ? "Tentar novamente"
                        : "Copiar código PIX"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

const DetailActionButton = ({ action }: { action: DetailAction }) => {
  if (action.type === "pix-qr") {
    return <PixQrCodeAction action={action} />
  }

  return null
}

const DetailsSection = ({ title, items }: { title: string; items: DetailItem[] }) => {
  return (
    <section className="rounded-3xl border border-surface-accent/40 bg-surface-accent/60 p-6 shadow-soft">
      <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">{title}</h3>
      <dl className="mt-4 space-y-3 text-sm">
        {items.map((item) => {
          const hasList = item.list && item.list.length > 0
          const renderedValue = fallbackValue(item.value)
          return (
            <div key={item.label} className="flex flex-col gap-1">
              <dt className="text-muted-foreground/80">{item.label}</dt>
              <dd className="font-medium text-primary-foreground">
                {hasList ? (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {item.list?.map((entry) => (
                      <li key={entry.label}>
                        <span className="text-muted-foreground/80">{entry.label}:</span> {entry.value}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div
                    className={clsx(
                      "flex flex-wrap items-center gap-3",
                      item.action ? "justify-between" : "justify-start",
                    )}
                  >
                    {typeof renderedValue === "string" ? (
                      <span className="break-words">{renderedValue}</span>
                    ) : (
                      renderedValue
                    )}
                    {item.action ? <DetailActionButton action={item.action} /> : null}
                  </div>
                )}
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}

const SaleDetailsTabs = ({ sections }: { sections: Section[] }) => {
  if (sections.length === 0) {
    return null
  }

  const [activeTab, setActiveTab] = useState(sections[0]?.id ?? "")
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const baseId = useId()

  const focusTabAtIndex = (index: number) => {
    const clampedIndex = (index + sections.length) % sections.length
    const ref = tabRefs.current[clampedIndex]
    ref?.focus()
    setActiveTab(sections[clampedIndex]?.id ?? "")
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault()
      focusTabAtIndex(index + 1)
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault()
      focusTabAtIndex(index - 1)
    } else if (event.key === "Home") {
      event.preventDefault()
      focusTabAtIndex(0)
    } else if (event.key === "End") {
      event.preventDefault()
      focusTabAtIndex(sections.length - 1)
    }
  }

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Detalhes da venda" className="flex flex-wrap gap-2">
        {sections.map((section, index) => {
          const isActive = section.id === activeTab
          const tabId = `${baseId}-${section.id}-tab`
          const panelId = `${baseId}-${section.id}-panel`
          return (
            <button
              key={section.id}
              ref={(element) => {
                tabRefs.current[index] = element
              }}
              type="button"
              id={tabId}
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(section.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={clsx(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-soft"
                  : "border-surface-accent/60 bg-surface-accent text-muted-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground"
              )}
            >
              {section.label}
            </button>
          )
        })}
      </div>

      {sections.map((section) => {
        const isActive = section.id === activeTab
        const tabId = `${baseId}-${section.id}-tab`
        const panelId = `${baseId}-${section.id}-panel`
        return (
          <div
            key={section.id}
            role="tabpanel"
            id={panelId}
            aria-labelledby={tabId}
            hidden={!isActive}
            className={clsx(!isActive && "hidden")}
          >
            {isActive ? <DetailsSection title={section.label} items={section.items} /> : null}
          </div>
        )
      })}
    </div>
  )
}

export default SaleDetailsTabs
